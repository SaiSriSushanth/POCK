from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID

from ..database import get_db
from ..models import Contact, ContactChannel, Message, TeamMember
from ..api.auth import get_current_member

router = APIRouter(prefix="/contacts", tags=["Contacts"])


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class ContactCreate(BaseModel):
    display_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    tags: Optional[List[str]] = []
    notes: Optional[str] = None


class ContactUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _serialize_contact(contact: Contact, channels: list):
    return {
        "id": str(contact.id),
        "business_id": str(contact.business_id),
        "display_name": contact.display_name,
        "email": contact.email,
        "phone": contact.phone,
        "tags": contact.tags or [],
        "notes": contact.notes,
        "created_at": contact.created_at.isoformat() if contact.created_at else None,
        "channels": [
            {"channel": ch.channel, "external_id": ch.external_id}
            for ch in channels
        ],
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def list_contacts(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    query = db.query(Contact).filter(Contact.business_id == current_member.business_id)

    if search:
        like = f"%{search}%"
        query = query.filter(
            Contact.display_name.ilike(like)
            | Contact.email.ilike(like)
            | Contact.phone.ilike(like)
        )

    contacts = query.order_by(Contact.created_at.desc()).all()

    results = []
    for c in contacts:
        channels = db.query(ContactChannel).filter(ContactChannel.contact_id == c.id).all()
        results.append(_serialize_contact(c, channels))

    return results


@router.post("", status_code=201)
def create_contact(
    body: ContactCreate,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    contact = Contact(
        business_id=current_member.business_id,
        display_name=body.display_name,
        email=body.email,
        phone=body.phone,
        tags=body.tags or [],
        notes=body.notes,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return _serialize_contact(contact, [])


@router.get("/{contact_id}")
def get_contact(
    contact_id: UUID,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.business_id == current_member.business_id,
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    channels = db.query(ContactChannel).filter(ContactChannel.contact_id == contact.id).all()
    return _serialize_contact(contact, channels)


@router.patch("/{contact_id}")
def update_contact(
    contact_id: UUID,
    body: ContactUpdate,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.business_id == current_member.business_id,
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    if body.display_name is not None:
        contact.display_name = body.display_name
    if body.email is not None:
        contact.email = body.email
    if body.phone is not None:
        contact.phone = body.phone
    if body.tags is not None:
        contact.tags = body.tags
    if body.notes is not None:
        contact.notes = body.notes

    db.commit()
    db.refresh(contact)

    channels = db.query(ContactChannel).filter(ContactChannel.contact_id == contact.id).all()
    return _serialize_contact(contact, channels)


@router.get("/{contact_id}/history")
def get_contact_history(
    contact_id: UUID,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.business_id == current_member.business_id,
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # Get all channels for the contact
    channels = db.query(ContactChannel).filter(ContactChannel.contact_id == contact.id).all()
    sender_ids = [ch.external_id for ch in channels]

    if not sender_ids:
        return []

    messages = (
        db.query(Message)
        .filter(
            Message.business_id == current_member.business_id,
            Message.sender_id.in_(sender_ids),
        )
        .order_by(Message.created_at.desc())
        .all()
    )

    return [
        {
            "id": str(m.id),
            "source": m.source,
            "sender_id": m.sender_id,
            "message_text": m.message_text,
            "conversation_id": str(m.conversation_id) if m.conversation_id else None,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]
