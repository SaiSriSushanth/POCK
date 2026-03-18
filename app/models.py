import uuid
from sqlalchemy import Column, String, Float, Text, DateTime, ForeignKey, Boolean, ARRAY, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from .database import Base


class Business(Base):
    __tablename__ = "businesses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    facebook_user_id = Column(Text)
    whatsapp_waba_id = Column(Text)
    whatsapp_phone_number = Column(Text)
    instagram_account_id = Column(Text)
    page_id = Column(Text)
    slack_team_id = Column(Text)
    access_token = Column(Text, nullable=False, default="")  # encrypted at rest
    token_expires_at = Column(DateTime(timezone=True))
    plan = Column(String, default="free")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False)
    email = Column(Text, unique=True, nullable=False)
    name = Column(Text)
    hashed_password = Column(Text, nullable=False)
    role = Column(String, default="agent")  # 'admin' | 'agent' | 'viewer'
    custom_role_id = Column(UUID(as_uuid=True), ForeignKey("custom_roles.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CustomRole(Base):
    __tablename__ = "custom_roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False)
    display_name = Column(Text)
    email = Column(Text)
    phone = Column(Text)
    tags = Column(ARRAY(Text), default=[])
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ContactChannel(Base):
    __tablename__ = "contact_channels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=False)
    channel = Column(String, nullable=False)   # 'whatsapp' | 'instagram' | 'messenger' | 'slack'
    external_id = Column(Text, nullable=False)  # platform-specific sender ID

    __table_args__ = (UniqueConstraint("channel", "external_id", name="uq_contact_channel_external"),)


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"))
    source = Column(String)   # 'whatsapp' | 'slack' | 'instagram' | 'messenger'
    status = Column(String, default="open")  # 'open' | 'pending' | 'resolved'
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("team_members.id"))
    priority = Column(String)  # 'high' | 'medium' | 'low'
    last_message_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InternalNote(Base):
    __tablename__ = "internal_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("team_members.id"), nullable=False)
    note_text = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Label(Base):
    __tablename__ = "labels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"))  # NULL = global default labels
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    embedding = Column(Vector(1536))
    embedding_model = Column(String, default="text-embedding-3-small")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"))
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"))
    source = Column(String)
    sender_id = Column(String)
    message_text = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Classification(Base):
    __tablename__ = "classifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"))
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"))
    predicted_label = Column(String)
    embedding_score = Column(Float)
    llm_confidence = Column(Float)
    final_confidence = Column(Float)
    reasoning = Column(Text)
    draft_reply = Column(Text)
    model_version = Column(String, default="gpt-4o-mini")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False)
    name = Column(String, nullable=False)
    trigger_label = Column(String, nullable=False)   # label name that triggers this rule
    action_type = Column(String, nullable=False)      # 'assign_to_role' | 'set_priority' | 'set_status' | 'auto_reply'
    action_value = Column(Text, nullable=False)       # role_id | 'high'/'medium'/'low' | 'open'/'pending'/'resolved' | reply text
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
