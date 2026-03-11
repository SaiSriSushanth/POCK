import os
from fastapi import APIRouter, Request, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..core.classification_engine import process_normalized_message
from ..utils.normalization import NormalizedMessage

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
            if "messaging" in entry:
                for messaging_event in entry.get("messaging", []):
                    if "message" in messaging_event:
                        message = messaging_event["message"]
                        sender_id = messaging_event.get("sender", {}).get("id")

                        # Ignore echo messages (messages sent by the page itself)
                        if not message.get("is_echo"):
                            text = message.get("text")
                            if text:
                                norm_msg = NormalizedMessage(
                                    source="messenger",
                                    sender_id=sender_id,
                                    text=text
                                )
                                process_normalized_message(db, norm_msg)

        return {"status": "success"}

    print(f"Ignored Messenger webhook object: {body.get('object')}")
    return {"status": "ignored"}
