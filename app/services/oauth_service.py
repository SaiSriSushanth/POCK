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

        # Get WhatsApp Business Accounts via owned_whatsapp_business_accounts
        waba_data = []
        try:
            biz_resp = await client.get(
                f"{GRAPH_API_BASE}/me/businesses",
                params={"access_token": long_lived_token, "fields": "id,name"},
            )
            if biz_resp.status_code == 200:
                for biz in biz_resp.json().get("data", []):
                    waba_resp = await client.get(
                        f"{GRAPH_API_BASE}/{biz['id']}/owned_whatsapp_business_accounts",
                        params={"access_token": long_lived_token},
                    )
                    if waba_resp.status_code == 200:
                        for waba in waba_resp.json().get("data", []):
                            waba_data.append(waba)
        except Exception:
            pass

        return {"pages": pages_data, "waba_accounts": waba_data}


async def get_whatsapp_phone_number_id(waba_id: str, token: str) -> str | None:
    """Fetch the first phone number ID registered under a WABA."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GRAPH_API_BASE}/{waba_id}/phone_numbers",
            params={"access_token": token, "fields": "id,display_phone_number"},
        )
        if resp.status_code == 200:
            data = resp.json().get("data", [])
            if data:
                return data[0]["id"]
    return None


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
