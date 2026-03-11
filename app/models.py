import uuid
from sqlalchemy import Column, String, Float, Text, DateTime, ForeignKey, UUID
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from .database import Base

class Label(Base):
    __tablename__ = "labels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text, nullable=False)
    embedding = Column(Vector(1536))
    embedding_model = Column(String, default="text-embedding-3-small")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String)  # "slack" or "whatsapp"
    sender_id = Column(String)
    message_text = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Classification(Base):
    __tablename__ = "classifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"))
    predicted_label = Column(String)
    embedding_score = Column(Float)
    llm_confidence = Column(Float)
    final_confidence = Column(Float)
    reasoning = Column(Text)
    model_version = Column(String, default="gpt-4o-mini")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
