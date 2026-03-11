from pydantic import BaseModel
from datetime import datetime

class NormalizedMessage(BaseModel):
    source: str  # "slack" | "whatsapp"
    sender_id: str
    text: str
    timestamp: datetime = datetime.now()
