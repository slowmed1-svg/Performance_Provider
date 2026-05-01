from pydantic import BaseModel
import uuid
from datetime import datetime
from app.models.session import SessionStatus


class SessionStartRequest(BaseModel):
    payment_intent_id: str


class SessionOut(BaseModel):
    id: uuid.UUID
    status: SessionStatus
    kasm_url: str | None
    started_at: datetime | None
    last_heartbeat: datetime | None

    model_config = {"from_attributes": True}


class SessionHistory(BaseModel):
    id: uuid.UUID
    status: SessionStatus
    started_at: datetime | None
    terminated_at: datetime | None
    duration_minutes: float | None = None
    amount_eur: float | None = None

    model_config = {"from_attributes": True}
