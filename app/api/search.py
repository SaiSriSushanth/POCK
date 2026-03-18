from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models import TeamMember, Message, Conversation, Contact, Classification
from ..api.auth import get_current_member
from ..core.llm_service import get_embedding
from uuid import UUID

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("")
def semantic_search(
    q: str = Query(..., description="Search query"),
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    if not q.strip():
        return []

    query_embedding = get_embedding(q)

    # Raw vector similarity search on messages scoped to this business
    from sqlalchemy import text
    results = db.execute(
        text("""
            SELECT m.id, m.message_text, m.sender_id, m.source, m.created_at, m.conversation_id,
                   c.predicted_label, c.final_confidence,
                   1 - (l.embedding <=> CAST(:embedding AS vector)) AS similarity
            FROM messages m
            LEFT JOIN classifications c ON c.message_id = m.id
            LEFT JOIN labels l ON l.name = c.predicted_label
            WHERE m.business_id = CAST(:business_id AS uuid)
            ORDER BY similarity DESC NULLS LAST
            LIMIT 10
        """),
        {"embedding": str(query_embedding), "business_id": str(current_member.business_id)}
    ).fetchall()

    # Better approach: embed query and compare against message embeddings directly
    # For now, do keyword + label search as fallback
    messages = (
        db.query(Message)
        .filter(
            Message.business_id == current_member.business_id,
            Message.message_text.ilike(f"%{q}%"),
        )
        .order_by(Message.created_at.desc())
        .limit(20)
        .all()
    )

    output = []
    for msg in messages:
        clf = db.query(Classification).filter(Classification.message_id == msg.id).first()
        conv = db.query(Conversation).filter(Conversation.id == msg.conversation_id).first()
        contact = db.query(Contact).filter(Contact.id == conv.contact_id).first() if conv else None
        output.append({
            "message_id": str(msg.id),
            "message_text": msg.message_text,
            "source": msg.source,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
            "conversation_id": str(msg.conversation_id) if msg.conversation_id else None,
            "contact_name": contact.display_name if contact else msg.sender_id,
            "label": clf.predicted_label if clf else None,
        })

    return output
