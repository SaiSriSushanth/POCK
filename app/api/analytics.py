from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from datetime import datetime, timedelta, timezone

from ..database import get_db
from ..models import Message, Conversation, Classification, TeamMember
from ..api.auth import get_current_member

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/overview")
def analytics_overview(
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    biz_id = current_member.business_id

    total_messages = (
        db.query(func.count(Message.id))
        .filter(Message.business_id == biz_id)
        .scalar()
    ) or 0

    open_conversations = (
        db.query(func.count(Conversation.id))
        .filter(
            Conversation.business_id == biz_id,
            Conversation.status == "open",
        )
        .scalar()
    ) or 0

    # Resolved today (UTC)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    resolved_today = (
        db.query(func.count(Conversation.id))
        .filter(
            Conversation.business_id == biz_id,
            Conversation.status == "resolved",
            Conversation.last_message_at >= today_start,
        )
        .scalar()
    ) or 0

    avg_confidence = (
        db.query(func.avg(Classification.final_confidence))
        .filter(Classification.business_id == biz_id)
        .scalar()
    )
    avg_confidence = round(float(avg_confidence), 4) if avg_confidence else 0.0

    return {
        "total_messages": total_messages,
        "open_conversations": open_conversations,
        "resolved_today": resolved_today,
        "avg_confidence": avg_confidence,
    }


@router.get("/messages")
def analytics_messages(
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    """Message count grouped by day for the last 30 days."""
    biz_id = current_member.business_id
    since = datetime.now(timezone.utc) - timedelta(days=30)

    rows = (
        db.query(
            cast(Message.created_at, Date).label("day"),
            func.count(Message.id).label("count"),
        )
        .filter(Message.business_id == biz_id, Message.created_at >= since)
        .group_by(cast(Message.created_at, Date))
        .order_by(cast(Message.created_at, Date).asc())
        .all()
    )

    return [{"day": str(r.day), "count": r.count} for r in rows]


@router.get("/labels")
def analytics_labels(
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    """Label distribution — count per predicted_label for this business."""
    biz_id = current_member.business_id

    rows = (
        db.query(
            Classification.predicted_label,
            func.count(Classification.id).label("count"),
        )
        .filter(Classification.business_id == biz_id)
        .group_by(Classification.predicted_label)
        .order_by(func.count(Classification.id).desc())
        .all()
    )

    return [{"label": r.predicted_label, "count": r.count} for r in rows]


@router.get("/channels")
def analytics_channels(
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    """Message count grouped by source channel."""
    biz_id = current_member.business_id

    rows = (
        db.query(
            Message.source,
            func.count(Message.id).label("count"),
        )
        .filter(Message.business_id == biz_id)
        .group_by(Message.source)
        .order_by(func.count(Message.id).desc())
        .all()
    )

    return [{"source": r.source, "count": r.count} for r in rows]
