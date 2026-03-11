import os
from fastapi import APIRouter, Request, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from ..database import get_db
from ..core.classification_engine import process_normalized_message
from ..utils.normalization import NormalizedMessage

router = APIRouter(prefix="/slack", tags=["Slack"])

# Simple in-memory cache to prevent duplicate processing of the same event_id
processed_events = set()

@router.post("/events")
async def handle_slack_events(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    body = await request.json()
    
    # 1. Handle Slack URL Verification
    if body.get("type") == "url_verification":
        return {"challenge": body.get("challenge")}
    
    event_id = body.get("event_id")
    if event_id in processed_events:
        print(f"Duplicate event ignored: {event_id}")
        return {"status": "ok"}
    
    # 2. Handle Message Events
    if body.get("event", {}).get("type") == "message":
        event = body["event"]
        
        # Ignore bot messages to avoid loops
        if "bot_id" not in event:
            processed_events.add(event_id)
            # Limit cache size
            if len(processed_events) > 1000:
                processed_events.pop()

            norm_msg = NormalizedMessage(
                source="slack",
                sender_id=event.get("user"),
                text=event.get("text")
            )
            # Process in background so we can respond to Slack within 3 seconds
            background_tasks.add_task(process_normalized_message, db, norm_msg)
            
    return {"status": "ok"}
