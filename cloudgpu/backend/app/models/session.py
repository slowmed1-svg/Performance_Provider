import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Enum as SAEnum, func, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class SessionStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    terminated = "terminated"
    error = "error"


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    runpod_pod_id: Mapped[str | None] = mapped_column(String(255))
    kasm_session_id: Mapped[str | None] = mapped_column(String(255))
    kasm_url: Mapped[str | None] = mapped_column(Text)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[SessionStatus] = mapped_column(
        SAEnum(SessionStatus), default=SessionStatus.pending, nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    terminated_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_heartbeat: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="sessions")
    billing_record: Mapped["BillingRecord | None"] = relationship(back_populates="session")
