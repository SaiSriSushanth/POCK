from .celery_app import celery_app
from ..database import SessionLocal
from ..models import Business
from ..services.token_service import decrypt_token, encrypt_token
from datetime import datetime, timedelta, timezone
import httpx
import os

META_APP_ID = os.getenv("META_APP_ID")
META_APP_SECRET = os.getenv("META_APP_SECRET")
GRAPH_API_BASE = "https://graph.facebook.com/v19.0"


@celery_app.task(name="refresh_meta_tokens")
def refresh_meta_tokens():
    """Refresh Meta long-lived tokens that expire within 7 days."""
    db = SessionLocal()
    try:
        soon = datetime.now(timezone.utc) + timedelta(days=7)
        businesses = (
            db.query(Business)
            .filter(
                Business.token_expires_at != None,
                Business.token_expires_at <= soon,
                Business.access_token != None,
                Business.access_token != "",
            )
            .all()
        )

        for business in businesses:
            try:
                current_token = decrypt_token(business.access_token)
                async_refresh(business, current_token, db)
            except Exception as e:
                print(f"Token refresh failed for business {business.id}: {e}")

    except Exception as e:
        print(f"Token refresh task error: {e}")
    finally:
        db.close()


def async_refresh(business, current_token, db):
    import asyncio
    asyncio.run(_refresh(business, current_token, db))


async def _refresh(business, current_token, db):
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GRAPH_API_BASE}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": META_APP_ID,
                "client_secret": META_APP_SECRET,
                "fb_exchange_token": current_token,
            },
        )
        if resp.status_code == 200:
            data = resp.json()
            new_token = data["access_token"]
            expires_in = data.get("expires_in", 5184000)
            business.access_token = encrypt_token(new_token)
            business.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            db.commit()
            print(f"Refreshed token for business {business.name}, expires in {expires_in}s")
        else:
            print(f"Token refresh API error for {business.name}: {resp.text}")
