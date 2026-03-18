from .celery_app import celery_app
from ..database import SessionLocal
from ..models import Business, Conversation, Message, Classification
from datetime import datetime, timedelta, timezone


@celery_app.task(name="send_daily_briefing")
def send_daily_briefing():
    """Generate a daily briefing for each business summarizing the last 24 hours."""
    db = SessionLocal()
    try:
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        businesses = db.query(Business).all()

        for business in businesses:
            conversations = (
                db.query(Conversation)
                .filter(
                    Conversation.business_id == business.id,
                    Conversation.last_message_at >= since,
                )
                .all()
            )

            if not conversations:
                continue

            open_count = sum(1 for c in conversations if c.status == "open")
            pending_count = sum(1 for c in conversations if c.status == "pending")
            resolved_count = sum(1 for c in conversations if c.status == "resolved")
            high_priority = sum(1 for c in conversations if c.priority == "high")

            # Get label distribution
            labels = {}
            for conv in conversations:
                msg = (
                    db.query(Message)
                    .filter(Message.conversation_id == conv.id)
                    .order_by(Message.created_at.desc())
                    .first()
                )
                if msg:
                    clf = db.query(Classification).filter(Classification.message_id == msg.id).first()
                    if clf and clf.predicted_label:
                        labels[clf.predicted_label] = labels.get(clf.predicted_label, 0) + 1

            label_summary = ", ".join(f"{k}: {v}" for k, v in sorted(labels.items(), key=lambda x: -x[1]))

            briefing = (
                f"\n{'='*50}\n"
                f"POCK Daily Briefing — {business.name}\n"
                f"{datetime.now(timezone.utc).strftime('%Y-%m-%d')}\n"
                f"{'='*50}\n"
                f"Last 24 hours: {len(conversations)} active conversations\n"
                f"  Open: {open_count} | Pending: {pending_count} | Resolved: {resolved_count}\n"
                f"  High priority: {high_priority}\n"
                f"  Labels: {label_summary or 'none'}\n"
                f"{'='*50}\n"
            )
            print(briefing)

    except Exception as e:
        print(f"Briefing task error: {e}")
    finally:
        db.close()
