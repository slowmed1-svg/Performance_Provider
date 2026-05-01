from pydantic import BaseModel
import uuid
from datetime import datetime


class BillingRecordOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    duration_minutes: float
    amount_eur: float
    created_at: datetime

    model_config = {"from_attributes": True}


class PaymentIntentCreate(BaseModel):
    amount_eur: float = 10.00


class PaymentIntentOut(BaseModel):
    client_secret: str
    payment_intent_id: str
