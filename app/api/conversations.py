from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
import uuid as _uuid

from ..database import get_db
from ..models import Conversation, Message, Classification, Contact, ContactChannel, InternalNote, TeamMember, Business
from ..api.auth import get_current_member
from ..services.reply_sender import send_whatsapp_reply, send_messenger_reply, send_instagram_reply
from ..services.token_service import decrypt_token

router = APIRouter(prefix="/conversations", tags=["Conversations"])


# ── Pydantic schemas ────────────────────────────────────────────────────────

class ConversationUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[UUID] = None
    priority: Optional[str] = None


class NoteCreate(BaseModel):
    text: str


class ReplyCreate(BaseModel):
    text: str


# ── Helpers ─────────────────────────────────────────────────────────────────

def _serialize_conversation(conv: Conversation, contact: Optional[Contact], label: Optional[str]):
    return {
        "id": str(conv.id),
        "business_id": str(conv.business_id),
        "source": conv.source,
        "status": conv.status,
        "priority": conv.priority,
        "assigned_to": str(conv.assigned_to) if conv.assigned_to else None,
        "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "contact": {
            "id": str(contact.id),
            "display_name": contact.display_name,
            "email": contact.email,
            "phone": contact.phone,
            "tags": contact.tags or [],
        } if contact else None,
        "latest_label": label,
    }


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
def list_conversations(
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    label: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    query = db.query(Conversation).filter(
        Conversation.business_id == current_member.business_id
    )
    if status:
        query = query.filter(Conversation.status == status)
    if source:
        query = query.filter(Conversation.source == source)

    conversations = query.order_by(Conversation.last_message_at.desc().nullslast()).all()

    results = []
    for conv in conversations:
        contact = db.query(Contact).filter(Contact.id == conv.contact_id).first() if conv.contact_id else None

        # Get latest message classification label
        latest_msg = (
            db.query(Message)
            .filter(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc())
            .first()
        )
        latest_label = None
        if latest_msg:
            clf = (
                db.query(Classification)
                .filter(Classification.message_id == latest_msg.id)
                .first()
            )
            if clf:
                latest_label = clf.predicted_label

        # Filter by label if requested
        if label and latest_label != label:
            continue

        results.append(_serialize_conversation(conv, contact, latest_label))

    return results


@router.patch("/{conversation_id}")
def update_conversation(
    conversation_id: UUID,
    body: ConversationUpdate,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.business_id == current_member.business_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if body.status is not None:
        conv.status = body.status
    if body.assigned_to is not None:
        conv.assigned_to = body.assigned_to
    if body.priority is not None:
        conv.priority = body.priority

    db.commit()
    db.refresh(conv)

    contact = db.query(Contact).filter(Contact.id == conv.contact_id).first() if conv.contact_id else None
    return _serialize_conversation(conv, contact, None)


@router.get("/{conversation_id}/messages")
def get_conversation_messages(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.business_id == current_member.business_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )

    results = []
    for msg in messages:
        clf = (
            db.query(Classification)
            .filter(Classification.message_id == msg.id)
            .first()
        )
        results.append({
            "id": str(msg.id),
            "sender_id": msg.sender_id,
            "message_text": msg.message_text,
            "source": msg.source,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
            "classification": {
                "id": str(clf.id),
                "predicted_label": clf.predicted_label,
                "final_confidence": clf.final_confidence,
                "reasoning": clf.reasoning,
                "draft_reply": clf.draft_reply,
            } if clf else None,
        })

    return results


@router.post("/{conversation_id}/notes")
def add_note(
    conversation_id: UUID,
    body: NoteCreate,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.business_id == current_member.business_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    note = InternalNote(
        conversation_id=conversation_id,
        author_id=current_member.id,
        note_text=body.text,
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    return {
        "id": str(note.id),
        "conversation_id": str(note.conversation_id),
        "author_id": str(note.author_id),
        "note_text": note.note_text,
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }


@router.post("/{conversation_id}/reply")
async def send_reply(
    conversation_id: UUID,
    body: ReplyCreate,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.business_id == current_member.business_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    business = db.query(Business).filter(Business.id == current_member.business_id).first()
    if not business or not business.access_token:
        raise HTTPException(status_code=400, detail="Business not connected to Meta")

    token = decrypt_token(business.access_token)

    # Get the contact's external_id for this channel
    channel_row = (
        db.query(ContactChannel)
        .filter(
            ContactChannel.contact_id == conv.contact_id,
            ContactChannel.channel == conv.source,
        )
        .first()
    )
    if not channel_row:
        raise HTTPException(status_code=400, detail="No channel info found for contact")

    recipient_id = channel_row.external_id

    try:
        if conv.source == "whatsapp":
            if not business.whatsapp_phone_number:
                raise HTTPException(status_code=400, detail="WhatsApp Phone Number ID not configured. Reconnect Facebook.")
            await send_whatsapp_reply(business.whatsapp_phone_number, recipient_id, body.text, token)
        elif conv.source == "messenger":
            if not business.page_id:
                raise HTTPException(status_code=400, detail="Messenger page not connected")
            await send_messenger_reply(business.page_id, recipient_id, body.text, token)
        elif conv.source == "instagram":
            await send_instagram_reply(recipient_id, body.text, token)
        else:
            raise HTTPException(status_code=400, detail=f"Replies not supported for channel: {conv.source}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to send message: {str(e)}")

    # Store outbound message in thread
    outbound = Message(
        business_id=conv.business_id,
        conversation_id=conv.id,
        source=conv.source,
        sender_id="agent",
        message_text=body.text,
    )
    db.add(outbound)
    conv.status = "pending"
    db.commit()

    return {"status": "sent"}


@router.get("/{conversation_id}/notes")
def get_notes(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.business_id == current_member.business_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    notes = (
        db.query(InternalNote)
        .filter(InternalNote.conversation_id == conversation_id)
        .order_by(InternalNote.created_at.asc())
        .all()
    )

    return [
        {
            "id": str(n.id),
            "conversation_id": str(n.conversation_id),
            "author_id": str(n.author_id),
            "note_text": n.note_text,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notes
    ]
