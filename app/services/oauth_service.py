import os
import httpx
from dotenv import load_dotenv

load_dotenv()

META_APP_ID = os.getenv("META_APP_ID")
META_APP_SECRET = os.getenv("META_APP_SECRET")
META_REDIRECT_URI = os.getenv("META_OAUTH_REDIRECT_URI")
GRAPH_API_BASE = "https://graph.facebook.com/v19.0"


async def exchange_code_for_short_lived_token(code: str) -> str:
    """Exchange OAuth code for a short-lived user access token."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GRAPH_API_BASE}/oauth/access_token",
            params={
                "client_id": META_APP_ID,
                "client_secret": META_APP_SECRET,
                "redirect_uri": META_REDIRECT_URI,
                "code": code,
            },
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def exchange_for_long_lived_token(short_lived_token: str) -> dict:
    """Exchange short-lived token for a 60-day long-lived token."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GRAPH_API_BASE}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": META_APP_ID,
                "client_secret": META_APP_SECRET,
                "fb_exchange_token": short_lived_token,
            },
        )
        resp.raise_for_status()
        return resp.json()  # {"access_token": ..., "expires_in": ...}


async def get_connected_accounts(long_lived_token: str) -> dict:
    """Fetch Pages, WABA IDs, and Instagram accounts connected to this user."""
    async with httpx.AsyncClient() as client:
        # Get Facebook Pages
        pages_resp = await client.get(
            f"{GRAPH_API_BASE}/me/accounts",
            params={"access_token": long_lived_token, "fields": "id,name,instagram_business_account"},
        )
        pages_resp.raise_for_status()
        pages_data = pages_resp.json().get("data", [])

        # Get WhatsApp Business Accounts
        waba_resp = await client.get(
            f"{GRAPH_API_BASE}/me/businesses",
            params={"access_token": long_lived_token, "fields": "id,name,whatsapp_business_accounts"},
        )
        # WABA fetch may fail if not provisioned — treat as optional
        waba_data = []
        if waba_resp.status_code == 200:
            for biz in waba_resp.json().get("data", []):
                for waba in biz.get("whatsapp_business_accounts", {}).get("data", []):
                    waba_data.append(waba)

        return {"pages": pages_data, "waba_accounts": waba_data}


async def subscribe_webhooks(page_id: str, page_access_token: str) -> bool:
    """Subscribe our app to receive webhooks for a Facebook Page."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GRAPH_API_BASE}/{page_id}/subscribed_apps",
            params={
                "access_token": page_access_token,
                "subscribed_fields": "messages,messaging_postbacks",
            },
        )
        return resp.status_code == 200
