import os
from fastapi import APIRouter, Request, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..core.classification_engine import process_normalized_message
from ..utils.normalization import NormalizedMessage

router = APIRouter(prefix="/meta/instagram", tags=["Instagram"])

VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN") # Usually the same for the whole Meta App

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
    
    # Debug: Print the object type reaching the server
    obj_type = body.get("object")
    
    # Instagram DMs can come as 'instagram' or 'page' objects depending on subscription
    if obj_type in ["instagram", "page"]:
        for entry in body.get("entry", []):
            # Instagram DMs use 'messaging' field
            if "messaging" in entry:
                for messaging_event in entry.get("messaging", []):
                    if "message" in messaging_event:
                        message = messaging_event["message"]
                        sender_id = messaging_event.get("sender", {}).get("id")
                        
                        if not message.get("is_echo"):
                            text = message.get("text")
                            if text:
                                norm_msg = NormalizedMessage(
                                    source="instagram",
                                    sender_id=sender_id,
                                    text=text
                                )
                                process_normalized_message(db, norm_msg)
        
        return {"status": "success"}
    
    print(f"Ignored Instagram webhook object: {obj_type}")
    return {"status": "ignored"}
