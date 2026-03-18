from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database import get_db
from ..models import TeamMember, Message, Conversation, Contact, Classification
from ..api.auth import get_current_member
from ..core.llm_service import get_embedding

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
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    rows = db.execute(
        text("""
            SELECT m.id, m.message_text, m.sender_id, m.source, m.created_at, m.conversation_id,
                   c.predicted_label,
                   1 - (m.embedding <=> CAST(:embedding AS vector)) AS similarity
            FROM messages m
            LEFT JOIN classifications c ON c.message_id = m.id
            WHERE m.business_id = CAST(:business_id AS uuid)
              AND m.embedding IS NOT NULL
              AND m.sender_id != 'agent'
            ORDER BY m.embedding <=> CAST(:embedding AS vector)
            LIMIT 15
        """),
        {"embedding": embedding_str, "business_id": str(current_member.business_id)}
    ).fetchall()

    output = []
    for row in rows:
        conv = db.query(Conversation).filter(Conversation.id == row.conversation_id).first()
        contact = db.query(Contact).filter(Contact.id == conv.contact_id).first() if conv else None
        output.append({
            "message_id": str(row.id),
            "message_text": row.message_text,
            "source": row.source,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "conversation_id": str(row.conversation_id) if row.conversation_id else None,
            "contact_name": contact.display_name if contact else row.sender_id,
            "label": row.predicted_label,
            "similarity": round(float(row.similarity), 3) if row.similarity else None,
        })

    # Fallback to keyword search if no vector results
    if not output:
        messages = (
            db.query(Message)
            .filter(
                Message.business_id == current_member.business_id,
                Message.message_text.ilike(f"%{q}%"),
                Message.sender_id != "agent",
            )
            .order_by(Message.created_at.desc())
            .limit(15)
            .all()
        )
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
                "similarity": None,
            })

    return output
