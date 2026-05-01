import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.models.session import Session, SessionStatus
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def terminate_session(session: Session, db: AsyncSession) -> None:
    """Terminate a session: stop the pod, compute billing, capture payment."""
    from app.services import runpod
    from app.services.stripe_service import capture_payment
    from app.models.billing import BillingRecord

    try:
        if session.runpod_pod_id:
            await runpod.terminate_pod(session.runpod_pod_id)
            logger.info(f"Session {session.id}: pod {session.runpod_pod_id} terminated")
    except Exception as e:
        logger.warning(f"Session {session.id}: pod termination error — {e}")

    now = datetime.now(timezone.utc)
    session.status = SessionStatus.terminated
    session.terminated_at = now

    if session.started_at and session.stripe_payment_intent_id:
        started = session.started_at.replace(tzinfo=timezone.utc) if session.started_at.tzinfo is None else session.started_at
        raw_minutes = (now - started).total_seconds() / 60
        billable_minutes = max(raw_minutes, 5)  # 5-minute minimum
        amount_eur = round(billable_minutes * settings.price_per_minute_eur, 2)

        try:
            charge_id = await capture_payment(session.stripe_payment_intent_id, amount_eur)
            record = BillingRecord(
                session_id=session.id,
                user_id=session.user_id,
                duration_minutes=round(billable_minutes, 2),
                amount_eur=amount_eur,
                stripe_charge_id=charge_id,
            )
            db.add(record)
            logger.info(f"Session {session.id}: charged €{amount_eur} for {billable_minutes:.1f} min")
        except Exception as e:
            logger.error(f"Session {session.id}: Stripe capture failed — {e}")

    await db.commit()


async def check_inactive_sessions() -> None:
    """APScheduler job: auto-terminate sessions idle for > threshold."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.inactivity_timeout_minutes)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Session).where(
                Session.status == SessionStatus.running,
                Session.last_heartbeat < cutoff,
            )
        )
        stale = result.scalars().all()
        for session in stale:
            logger.info(f"Auto-terminating inactive session {session.id} (last heartbeat: {session.last_heartbeat})")
            await terminate_session(session, db)
