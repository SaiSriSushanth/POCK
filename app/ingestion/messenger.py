import os
from fastapi import APIRouter, Request, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Business
from ..workers.classification_task import classify_message_task

router = APIRouter(prefix="/meta/messenger", tags=["Messenger"])

VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN")


@router.get("/webhook", include_in_schema=False)
async def verify_messenger(
    mode: str = Query(None, alias="hub.mode"),
    token: str = Query(None, alias="hub.verify_token"),
    challenge: str = Query(None, alias="hub.challenge")
):
    if mode and token:
        if mode == "subscribe" and token == VERIFY_TOKEN:
            return int(challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook")
async def handle_messenger(request: Request, db: Session = Depends(get_db)):
    body = await request.json()

    if body.get("object") == "page":
        for entry in body.get("entry", []):
            # Resolve business by Page ID
            page_id = entry.get("id")
            business = None
            if page_id:
                business = db.query(Business).filter(Business.page_id == page_id).first()

            if "messaging" in entry:
                for messaging_event in entry.get("messaging", []):
                    if "message" in messaging_event:
                        message = messaging_event["message"]
                        sender_id = messaging_event.get("sender", {}).get("id")

                        if not message.get("is_echo"):
                            text = message.get("text")
                            if text:
                                classify_message_task.delay(
                                    source="messenger",
                                    sender_id=sender_id or "",
                                    text=text,
                                    business_id=str(business.id) if business else None,
                                )

        return {"status": "success"}

    return {"status": "ignored"}
