from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.billing import BillingRecord
from app.schemas.billing import BillingRecordOut, PaymentIntentCreate, PaymentIntentOut
from app.core.auth import get_current_user
from app.services.stripe_service import create_payment_intent
from app.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/billing", tags=["billing"])


@router.post("/payment-intent", response_model=PaymentIntentOut)
async def create_intent(
    body: PaymentIntentCreate,
    current_user: User = Depends(get_current_user),
):
    """Creates a pre-auth hold before launching a session."""
    result = await create_payment_intent(
        amount_eur=settings.pre_auth_hold_eur,
        customer_id=current_user.stripe_customer_id,
    )
    return PaymentIntentOut(**result)


@router.get("/history", response_model=list[BillingRecordOut])
async def billing_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BillingRecord)
        .where(BillingRecord.user_id == current_user.id)
        .order_by(BillingRecord.created_at.desc())
    )
    return result.scalars().all()
