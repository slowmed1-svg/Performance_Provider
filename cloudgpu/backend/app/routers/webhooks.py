from fastapi import APIRouter, Request, HTTPException, Header
from app.services.stripe_service import verify_webhook
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/stripe")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    payload = await request.body()
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        event = verify_webhook(payload, stripe_signature)
    except Exception as e:
        logger.warning(f"Stripe webhook verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    logger.info(f"Stripe event received: {event_type}")

    if event_type == "payment_intent.succeeded":
        # Payment confirmed — session provisioning is already triggered by /sessions/start
        # This webhook serves as a double-confirmation and audit log
        payment_intent = event["data"]["object"]
        logger.info(f"PaymentIntent succeeded: {payment_intent['id']}")

    elif event_type == "payment_intent.payment_failed":
        payment_intent = event["data"]["object"]
        logger.warning(f"PaymentIntent failed: {payment_intent['id']}")
        # TODO: mark corresponding session as error if still pending

    return {"status": "ok"}
