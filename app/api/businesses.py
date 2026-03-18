import os
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Business, TeamMember
from ..services.oauth_service import (
    exchange_code_for_short_lived_token,
    exchange_for_long_lived_token,
    get_connected_accounts,
    subscribe_webhooks,
    META_APP_ID,
    META_REDIRECT_URI,
)
from ..services.token_service import encrypt_token
from ..api.auth import get_current_member

router = APIRouter(prefix="/businesses", tags=["Businesses"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
FACEBOOK_OAUTH_SCOPES = "pages_messaging,instagram_basic,instagram_manage_messages,whatsapp_business_management,business_management"


@router.get("/oauth/facebook/url")
def get_facebook_oauth_url(current_member: TeamMember = Depends(get_current_member)):
    """Returns the Facebook OAuth URL with member ID as state for backend callback auth."""
    params = urlencode({
        "client_id": META_APP_ID,
        "redirect_uri": META_REDIRECT_URI,
        "scope": FACEBOOK_OAUTH_SCOPES,
        "response_type": "code",
        "state": str(current_member.id),
    })
    return {"url": f"https://www.facebook.com/v19.0/dialog/oauth?{params}"}


@router.get("/oauth/facebook/callback")
async def facebook_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    """Facebook redirects here. Auth via state (team_member_id), redirects to frontend when done."""
    member = db.query(TeamMember).filter(TeamMember.id == state).first()
    if not member:
        return RedirectResponse(f"{FRONTEND_URL}/inbox?error=auth_failed")

    try:
        short_lived_token = await exchange_code_for_short_lived_token(code)
        long_lived_data = await exchange_for_long_lived_token(short_lived_token)
    except Exception:
        return RedirectResponse(f"{FRONTEND_URL}/inbox?error=token_exchange_failed")

    long_lived_token = long_lived_data["access_token"]
    expires_in_seconds = long_lived_data.get("expires_in", 5184000)

    accounts = await get_connected_accounts(long_lived_token)
    pages = accounts.get("pages", [])
    waba_accounts = accounts.get("waba_accounts", [])

    business = db.query(Business).filter(Business.id == member.business_id).first()
    if not business:
        return RedirectResponse(f"{FRONTEND_URL}/inbox?error=business_not_found")

    business.access_token = encrypt_token(long_lived_token)
    business.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in_seconds)

    if pages:
        business.page_id = pages[0]["id"]
        instagram = pages[0].get("instagram_business_account")
        if instagram:
            business.instagram_account_id = instagram["id"]

    if waba_accounts:
        business.whatsapp_waba_id = waba_accounts[0]["id"]

    db.commit()

    if business.page_id:
        await subscribe_webhooks(business.page_id, long_lived_token)

    return RedirectResponse(f"{FRONTEND_URL}/inbox?connected=true")


@router.get("/oauth/debug")
async def debug_accounts(
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    """Debug: shows raw Meta API responses for connected accounts."""
    import httpx
    from ..services.token_service import decrypt_token
    business = db.query(Business).filter(Business.id == current_member.business_id).first()
    if not business or not business.access_token:
        raise HTTPException(status_code=400, detail="No token stored")

    token = decrypt_token(business.access_token)
    async with httpx.AsyncClient() as client:
        pages = await client.get("https://graph.facebook.com/v19.0/me/accounts",
            params={"access_token": token, "fields": "id,name,instagram_business_account"})
        businesses = await client.get("https://graph.facebook.com/v19.0/me/businesses",
            params={"access_token": token, "fields": "id,name"})
        waba_list = []
        for biz in businesses.json().get("data", []):
            waba = await client.get(f"https://graph.facebook.com/v19.0/{biz['id']}/owned_whatsapp_business_accounts",
                params={"access_token": token})
            waba_list.append({"business": biz["id"], "waba": waba.json()})

    return {
        "pages": pages.json(),
        "businesses": businesses.json(),
        "waba": waba_list,
    }


@router.get("/channels")
def get_channel_status(
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    business = db.query(Business).filter(Business.id == current_member.business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    return {
        "whatsapp": bool(business.whatsapp_waba_id),
        "messenger": bool(business.page_id),
        "instagram": bool(business.instagram_account_id),
        "slack": bool(business.slack_team_id),
    }
