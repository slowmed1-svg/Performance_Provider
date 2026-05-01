import asyncio
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.session import Session, SessionStatus
from app.schemas.session import SessionStartRequest, SessionOut, SessionHistory
from app.core.auth import get_current_user
from app.services import runpod
from app.services.inactivity import terminate_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/start", response_model=SessionOut, status_code=201)
async def start_session(
    body: SessionStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # One active session per user
    result = await db.execute(
        select(Session).where(
            Session.user_id == current_user.id,
            Session.status.in_([SessionStatus.pending, SessionStatus.running]),
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You already have an active session")

    session = Session(
        user_id=current_user.id,
        stripe_payment_intent_id=body.payment_intent_id,
        status=SessionStatus.pending,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    asyncio.create_task(_provision_session(session.id, str(current_user.id)))
    return session


async def _provision_session(session_id, user_id: str):
    """
    Background task: deploy pod → wait for ComfyUI to serve HTTP → update session.
    All errors are caught and written to the session status so the user gets feedback.
    """
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Session).where(Session.id == session_id))
        session = result.scalar_one_or_none()
        if not session:
            return

        try:
            # 1. Request pod from RunPod
            pod_data = await runpod.deploy_pod()
            pod_id = pod_data["id"]
            session.runpod_pod_id = pod_id
            await db.commit()
            logger.info(f"Session {session_id}: pod {pod_id} deployed, waiting for ComfyUI...")

            # 2. Poll until ComfyUI is actually serving HTTP (not just pod RUNNING)
            comfyui_url = await runpod.wait_for_comfyui(pod_id, timeout_seconds=180)

            if not comfyui_url:
                logger.error(f"Session {session_id}: ComfyUI did not become ready in time on pod {pod_id}")
                session.status = SessionStatus.error
                await db.commit()
                # Clean up the pod so user isn't charged
                try:
                    await runpod.terminate_pod(pod_id)
                except Exception:
                    pass
                return

            # 3. Session is live
            now = datetime.now(timezone.utc)
            session.kasm_url = comfyui_url
            session.kasm_session_id = pod_id  # reuse field for pod_id reference
            session.status = SessionStatus.running
            session.started_at = now
            session.last_heartbeat = now
            await db.commit()
            logger.info(f"Session {session_id}: ready at {comfyui_url}")

        except Exception as e:
            logger.error(f"Session {session_id}: provision failed — {e}", exc_info=True)
            session.status = SessionStatus.error
            await db.commit()


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/{session_id}", status_code=204)
async def stop_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == SessionStatus.terminated:
        raise HTTPException(status_code=400, detail="Session already terminated")
    await terminate_session(session, db)


@router.put("/{session_id}/heartbeat", status_code=204)
async def heartbeat(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session or session.status != SessionStatus.running:
        raise HTTPException(status_code=404, detail="No running session found")
    session.last_heartbeat = datetime.now(timezone.utc)
    await db.commit()


@router.get("", response_model=list[SessionHistory])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session)
        .where(Session.user_id == current_user.id)
        .order_by(Session.created_at.desc())
    )
    sessions = result.scalars().all()
    out = []
    for s in sessions:
        item = SessionHistory.model_validate(s)
        if s.billing_record:
            item.duration_minutes = float(s.billing_record.duration_minutes)
            item.amount_eur = float(s.billing_record.amount_eur)
        out.append(item)
    return out
