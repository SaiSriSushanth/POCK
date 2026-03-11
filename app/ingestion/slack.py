import os
import redis
from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Business
from ..workers.classification_task import classify_message_task

router = APIRouter(prefix="/slack", tags=["Slack"])

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
_redis_client = None


def get_redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


def _is_duplicate(event_id: str) -> bool:
    """Returns True if already processed. Uses Redis with 1-hour TTL."""
    r = get_redis()
    key = f"slack:event:{event_id}"
    if r.exists(key):
        return True
    r.setex(key, 3600, "1")
    return False


@router.post("/events")
async def handle_slack_events(request: Request, db: Session = Depends(get_db)):
    body = await request.json()

    # 1. Handle Slack URL Verification
    if body.get("type") == "url_verification":
        return {"challenge": body.get("challenge")}

    event_id = body.get("event_id")
    if event_id and _is_duplicate(event_id):
        return {"status": "ok"}

    # 2. Handle Message Events
    if body.get("event", {}).get("type") == "message":
        event = body["event"]

        if "bot_id" not in event:
            team_id = body.get("team_id")
            business = None
            if team_id:
                business = db.query(Business).filter(Business.slack_team_id == team_id).first()

            classify_message_task.delay(
                source="slack",
                sender_id=event.get("user", ""),
                text=event.get("text", ""),
                business_id=str(business.id) if business else None,
            )

    return {"status": "ok"}
