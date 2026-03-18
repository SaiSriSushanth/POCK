from .celery_app import celery_app
from ..database import SessionLocal
from ..core.classification_engine import process_normalized_message
from ..utils.normalization import NormalizedMessage
from ..models import Contact, ContactChannel, Conversation, Message, Classification
from ..services.reply_service import generate_draft_reply
from typing import Optional
from uuid import UUID
from sqlalchemy.sql import func


@celery_app.task(name="classify_message", bind=True, max_retries=3)
def classify_message_task(self, source: str, sender_id: str, text: str, business_id: Optional[str] = None):
    """
    Celery task: classify an incoming message asynchronously.
    - Auto-creates or finds a Contact + ContactChannel for the sender.
    - Auto-creates or finds an active Conversation for the contact.
    - Passes conversation_id into classification engine.
    - Generates a draft reply and stores it on the Classification record.
    - Updates conversation.last_message_at.
    """
    db = SessionLocal()
    try:
        biz_id = UUID(business_id) if business_id else None

        if not biz_id:
            print(f"Warning: no business_id for {source} message from {sender_id}, skipping")
            return

        # ── 1. Resolve Contact ──────────────────────────────────────────────
        channel_row = (
            db.query(ContactChannel)
            .filter(ContactChannel.channel == source, ContactChannel.external_id == sender_id)
            .first()
        )

        if channel_row:
            contact = db.query(Contact).filter(Contact.id == channel_row.contact_id).first()
        else:
            # Create a new contact for this business
            contact = Contact(
                business_id=biz_id,
                display_name=sender_id,  # default; can be updated later
            )
            db.add(contact)
            db.flush()

            channel_row = ContactChannel(
                contact_id=contact.id,
                channel=source,
                external_id=sender_id,
            )
            db.add(channel_row)
            db.flush()

        # ── 2. Resolve Conversation ─────────────────────────────────────────
        conversation = (
            db.query(Conversation)
            .filter(
                Conversation.business_id == biz_id,
                Conversation.contact_id == contact.id,
                Conversation.source == source,
                Conversation.status != "resolved",
            )
            .order_by(Conversation.created_at.desc())
            .first()
        )

        if not conversation:
            conversation = Conversation(
                business_id=biz_id,
                contact_id=contact.id,
                source=source,
                status="open",
            )
            db.add(conversation)
            db.flush()

        # ── 3. Classify message ─────────────────────────────────────────────
        msg = NormalizedMessage(
            source=source,
            sender_id=sender_id,
            text=text,
            business_id=biz_id,
        )
        classification = process_normalized_message(
            db, msg, business_id=biz_id, conversation_id=conversation.id
        )

        # ── 4. Generate draft reply ─────────────────────────────────────────
        # Fetch last 5 messages in this conversation for context
        prior_messages = (
            db.query(Message)
            .filter(
                Message.conversation_id == conversation.id,
                Message.id != classification.message_id,
            )
            .order_by(Message.created_at.desc())
            .limit(5)
            .all()
        )
        history = [
            {"role": "user", "content": m.message_text}
            for m in reversed(prior_messages)
        ]

        draft_failed = False
        try:
            draft = generate_draft_reply(
                message_text=text,
                label=classification.predicted_label,
                reasoning=classification.reasoning or "",
                history=history,
            )
            classification.draft_reply = draft
            db.commit()
        except Exception as draft_err:
            # Draft generation failure is non-fatal
            print(f"Warning: draft reply generation failed: {draft_err}")
            db.rollback()
            draft_failed = True

        # ── 5. Update conversation timestamp ───────────────────────────────
        # Re-fetch conversation if session was rolled back
        if draft_failed:
            conversation = db.query(Conversation).filter(Conversation.id == conversation.id).first()
        if conversation:
            conversation.last_message_at = func.now()
            db.commit()

    except Exception as exc:
        db.rollback()
        raise self.retry(exc=exc, countdown=5)
    finally:
        db.close()
