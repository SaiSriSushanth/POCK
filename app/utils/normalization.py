from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from uuid import UUID

class NormalizedMessage(BaseModel):
    source: str  # "slack" | "whatsapp" | "instagram" | "messenger"
    sender_id: str
    text: str
    timestamp: datetime = datetime.now()
    business_id: Optional[UUID] = None
