import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Business, TeamMember
from ..services.oauth_service import (
    exchange_code_for_short_lived_token,
    exchange_for_long_lived_token,
    get_connected_accounts,
    subscribe_webhooks,
)
from ..services.token_service import encrypt_token
from ..api.auth import get_current_member

router = APIRouter(prefix="/businesses", tags=["Businesses"])


@router.get("/oauth/facebook/callback")
async def facebook_oauth_callback(
    code: str = Query(...),
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    """
    Step 1–10 of Facebook OAuth onboarding flow.
    Called after Meta redirects back with an OAuth code.
    """
    # Step 5: Exchange code for short-lived token
    short_lived_token = await exchange_code_for_short_lived_token(code)

    # Step 6: Exchange short-lived token for 60-day long-lived token
    long_lived_data = await exchange_for_long_lived_token(short_lived_token)
    long_lived_token = long_lived_data["access_token"]
    expires_in_seconds = long_lived_data.get("expires_in", 5184000)  # default 60 days

    # Step 7: Fetch connected Pages, WABA IDs, Instagram accounts
    accounts = await get_connected_accounts(long_lived_token)
    pages = accounts.get("pages", [])
    waba_accounts = accounts.get("waba_accounts", [])

    # Step 8: Update the business record for this team member
    business = db.query(Business).filter(Business.id == current_member.business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    # Encrypt and store token
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

    # Step 9: Subscribe webhooks to connected page
    if business.page_id:
        await subscribe_webhooks(business.page_id, long_lived_token)

    return {
        "status": "connected",
        "page_id": business.page_id,
        "instagram_account_id": business.instagram_account_id,
        "whatsapp_waba_id": business.whatsapp_waba_id,
    }


@router.get("/channels")
def get_channel_status(
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    """Returns which channels are connected for the current business."""
    business = db.query(Business).filter(Business.id == current_member.business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    return {
        "whatsapp": bool(business.whatsapp_waba_id),
        "messenger": bool(business.page_id),
        "instagram": bool(business.instagram_account_id),
        "slack": bool(business.slack_team_id),
    }
