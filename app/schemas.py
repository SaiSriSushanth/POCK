from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any

class LabelBase(BaseModel):
    name: str
    description: str

class LabelCreate(LabelBase):
    pass

class Label(LabelBase):
    id: UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class MessageBase(BaseModel):
    phone: str
    message_text: str

class MessageCreate(MessageBase):
    pass

class Message(MessageBase):
    id: UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ClassificationBase(BaseModel):
    predicted_label: str
    embedding_score: float
    llm_confidence: float
    final_confidence: float
    reasoning: str

class ClassificationCreate(ClassificationBase):
    message_id: UUID

class Classification(ClassificationBase):
    id: UUID
    message_id: UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# --- Webhook Schemas for Docs ---

class WhatsAppText(BaseModel):
    body: str

class WhatsAppMessage(BaseModel):
    from_phone: str = Field("", alias="from")
    type: str
    text: Optional[WhatsAppText] = None

class WebhookValue(BaseModel):
    messages: Optional[List[Dict[str, Any]]] = None

class WebhookChange(BaseModel):
    value: WebhookValue

class WebhookEntry(BaseModel):
    id: Optional[str] = None
    changes: List[WebhookChange]

class WebhookPayload(BaseModel):
    object: str
    entry: List[WebhookEntry]
