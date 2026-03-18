from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

from ..database import get_db
from ..models import Label, TeamMember
from ..api.auth import get_current_member
from ..core.llm_service import get_embedding

router = APIRouter(prefix="/labels", tags=["Labels"])


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class LabelCreate(BaseModel):
    name: str
    description: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def list_labels(
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    """Return business-specific labels + global labels."""
    labels = (
        db.query(Label)
        .filter(
            (Label.business_id == current_member.business_id) | (Label.business_id.is_(None))
        )
        .order_by(Label.created_at.asc())
        .all()
    )

    return [
        {
            "id": str(lbl.id),
            "name": lbl.name,
            "description": lbl.description,
            "business_id": str(lbl.business_id) if lbl.business_id else None,
            "is_global": lbl.business_id is None,
            "created_at": lbl.created_at.isoformat() if lbl.created_at else None,
        }
        for lbl in labels
    ]


@router.post("", status_code=201)
def create_label(
    body: LabelCreate,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    # Check for duplicates within this business
    existing = (
        db.query(Label)
        .filter(
            Label.name == body.name,
            Label.business_id == current_member.business_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Label with this name already exists for your business")

    # Generate embedding immediately
    embedding_text = f"{body.name}: {body.description}"
    embedding = get_embedding(embedding_text)

    label = Label(
        business_id=current_member.business_id,
        name=body.name,
        description=body.description,
        embedding=embedding,
    )
    db.add(label)
    db.commit()
    db.refresh(label)

    return {
        "id": str(label.id),
        "name": label.name,
        "description": label.description,
        "business_id": str(label.business_id),
        "is_global": False,
        "created_at": label.created_at.isoformat() if label.created_at else None,
    }


@router.delete("/{label_id}", status_code=204)
def delete_label(
    label_id: UUID,
    db: Session = Depends(get_db),
    current_member: TeamMember = Depends(get_current_member),
):
    label = db.query(Label).filter(Label.id == label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    # Only allow deletion of business-specific labels
    if label.business_id is None:
        raise HTTPException(status_code=403, detail="Cannot delete global labels")

    if label.business_id != current_member.business_id:
        raise HTTPException(status_code=403, detail="Not allowed to delete this label")

    db.delete(label)
    db.commit()
    return None
