import os
from fastapi import APIRouter, Request, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Business
from ..workers.classification_task import classify_message_task

router = APIRouter(prefix="/meta/instagram", tags=["Instagram"])

VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN")


@router.get("/webhook", include_in_schema=False)
async def verify_instagram(
    mode: str = Query(None, alias="hub.mode"),
    token: str = Query(None, alias="hub.verify_token"),
    challenge: str = Query(None, alias="hub.challenge")
):
    if mode and token:
        if mode == "subscribe" and token == VERIFY_TOKEN:
            return int(challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook")
async def handle_instagram(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    obj_type = body.get("object")

    if obj_type in ["instagram", "page"]:
        for entry in body.get("entry", []):
            # Resolve business by Instagram account ID or page ID
            entry_id = entry.get("id")
            business = None
            if entry_id:
                business = (
                    db.query(Business)
                    .filter(
                        (Business.instagram_account_id == entry_id) |
                        (Business.page_id == entry_id)
                    )
                    .first()
                )

            if "messaging" in entry:
                for messaging_event in entry.get("messaging", []):
                    if "message" in messaging_event:
                        message = messaging_event["message"]
                        sender_id = messaging_event.get("sender", {}).get("id")

                        if not message.get("is_echo"):
                            text = message.get("text")
                            if text:
                                classify_message_task.delay(
                                    source="instagram",
                                    sender_id=sender_id or "",
                                    text=text,
                                    business_id=str(business.id) if business else None,
                                )

        return {"status": "success"}

    return {"status": "ignored"}
