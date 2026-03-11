from .celery_app import celery_app
from ..database import SessionLocal
from ..core.classification_engine import process_normalized_message
from ..utils.normalization import NormalizedMessage
from typing import Optional
from uuid import UUID


@celery_app.task(name="classify_message", bind=True, max_retries=3)
def classify_message_task(self, source: str, sender_id: str, text: str, business_id: Optional[str] = None):
    """
    Celery task: classify an incoming message asynchronously.
    Replaces the in-process BackgroundTasks approach from the POC.
    """
    db = SessionLocal()
    try:
        msg = NormalizedMessage(
            source=source,
            sender_id=sender_id,
            text=text,
            business_id=UUID(business_id) if business_id else None,
        )
        process_normalized_message(db, msg)
    except Exception as exc:
        db.rollback()
        raise self.retry(exc=exc, countdown=5)
    finally:
        db.close()
