import os
from fastapi import APIRouter, Request, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..core.classification_engine import process_normalized_message
from ..utils.normalization import NormalizedMessage
from ..schemas import WebhookPayload

router = APIRouter(prefix="/meta", tags=["WhatsApp"])

VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN")

@router.get("/webhook", include_in_schema=False)
async def verify_whatsapp(
    mode: str = Query(None, alias="hub.mode"),
    token: str = Query(None, alias="hub.verify_token"),
    challenge: str = Query(None, alias="hub.challenge")
):
    if mode and token:
        if mode == "subscribe" and token == VERIFY_TOKEN:
            return int(challenge)
    raise HTTPException(status_code=403, detail="Verification failed")

@router.post("/webhook")
async def handle_whatsapp(payload: WebhookPayload, db: Session = Depends(get_db)):
    body = payload.model_dump(by_alias=True)
    if body.get("object") == "whatsapp_business_account":
        for entry in body.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                if "messages" in value:
                    for message in value["messages"]:
                        if message.get("type") == "text":
                            norm_msg = NormalizedMessage(
                                source="whatsapp",
                                sender_id=message.get("from"),
                                text=message.get("text", {}).get("body")
                            )
                            process_normalized_message(db, norm_msg)
        return {"status": "success"}
    return {"status": "ignored"}
