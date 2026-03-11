from sqlalchemy.orm import Session
from ..models import Label
from pgvector.sqlalchemy import Vector

def get_top_labels(db: Session, message_embedding: list, limit: int = 3):
    """
    Find top N labels similar to the message embedding.
    Using cosine distance (<=>) for similarity.
    """
    # In pgvector, <=> is cosine distance. 1 - distance = similarity.
    results = db.query(
        Label.name,
        Label.description,
        (1 - Label.embedding.cosine_distance(message_embedding)).label("similarity")
    ).order_by(Label.embedding.cosine_distance(message_embedding)).limit(limit).all()
    
    return [{"name": r.name, "description": r.description, "similarity": r.similarity} for r in results]
