import stripe
from app.config import get_settings

settings = get_settings()
stripe.api_key = settings.stripe_secret_key


async def create_payment_intent(amount_eur: float, customer_id: str | None = None) -> dict:
    """Create a manual-capture PaymentIntent (pre-auth hold)."""
    amount_cents = int(amount_eur * 100)
    kwargs = {
        "amount": amount_cents,
        "currency": "eur",
        "capture_method": "manual",
        "metadata": {"platform": "cloudgpu"},
    }
    if customer_id:
        kwargs["customer"] = customer_id

    intent = stripe.PaymentIntent.create(**kwargs)
    return {"client_secret": intent.client_secret, "payment_intent_id": intent.id}


async def capture_payment(payment_intent_id: str, amount_eur: float) -> str:
    """Capture the actual charge amount after session ends."""
    amount_cents = int(amount_eur * 100)
    intent = stripe.PaymentIntent.capture(
        payment_intent_id,
        amount_to_capture=amount_cents,
    )
    return intent.charges.data[0].id if intent.charges.data else intent.id


async def cancel_payment_intent(payment_intent_id: str) -> None:
    """Cancel (release hold) if session never started."""
    stripe.PaymentIntent.cancel(payment_intent_id)


async def create_stripe_customer(email: str) -> str:
    customer = stripe.Customer.create(email=email)
    return customer.id


def verify_webhook(payload: bytes, sig_header: str) -> stripe.Event:
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.stripe_webhook_secret
    )
