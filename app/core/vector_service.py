from sqlalchemy.orm import Session
from ..models import Label
from typing import Optional
from uuid import UUID


def get_top_labels(db: Session, message_embedding: list, business_id: Optional[UUID] = None, limit: int = 3):
    """
    Find top N labels similar to the message embedding.
    Prefers business-specific labels; falls back to global labels (business_id IS NULL).
    """
    query = db.query(
        Label.name,
        Label.description,
        (1 - Label.embedding.cosine_distance(message_embedding)).label("similarity")
    )

    if business_id:
        # Use business-specific labels if they exist, otherwise fall back to global
        business_labels = query.filter(Label.business_id == business_id)
        if business_labels.count() > 0:
            results = business_labels.order_by(
                Label.embedding.cosine_distance(message_embedding)
            ).limit(limit).all()
            return [{"name": r.name, "description": r.description, "similarity": r.similarity} for r in results]

    # Fall back to global labels (business_id IS NULL)
    results = query.filter(Label.business_id.is_(None)).order_by(
        Label.embedding.cosine_distance(message_embedding)
    ).limit(limit).all()

    return [{"name": r.name, "description": r.description, "similarity": r.similarity} for r in results]
