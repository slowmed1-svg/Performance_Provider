import logging
import logging.config
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import text

from app.config import get_settings
from app.database import engine
from app.routers import auth, sessions, webhooks, billing
from app.services.inactivity import check_inactive_sessions

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {"format": "%(asctime)s %(levelname)-8s %(name)s  %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "default"},
    },
    "root": {"level": "INFO", "handlers": ["console"]},
    "loggers": {
        "apscheduler": {"level": "WARNING"},
        "sqlalchemy.engine": {"level": "WARNING"},
    },
}
logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger(__name__)

settings = get_settings()
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate critical config on startup — fail fast rather than on first request
    _validate_settings()

    # Verify database is reachable
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Database connection OK")
    except Exception as e:
        logger.critical(f"Cannot connect to database: {e}")
        raise

    scheduler.add_job(check_inactive_sessions, "interval", minutes=1, id="inactivity_check")
    scheduler.start()
    logger.info("CloudGPU API started")

    yield

    scheduler.shutdown()
    await engine.dispose()
    logger.info("CloudGPU API stopped")


def _validate_settings():
    errors = []
    if not settings.runpod_api_key or not settings.runpod_api_key.startswith("rp_"):
        errors.append("RUNPOD_API_KEY missing or invalid (must start with rp_)")
    if not settings.stripe_secret_key or not settings.stripe_secret_key.startswith("sk_"):
        errors.append("STRIPE_SECRET_KEY missing or invalid (must start with sk_)")
    if not settings.stripe_webhook_secret or not settings.stripe_webhook_secret.startswith("whsec_"):
        errors.append("STRIPE_WEBHOOK_SECRET missing or invalid (must start with whsec_)")
    if not settings.secret_key or settings.secret_key == "change-me-generate-with-openssl-rand-hex-32":
        errors.append("SECRET_KEY must be set to a random value")
    if errors:
        for e in errors:
            logger.critical(f"Config error: {e}")
        raise RuntimeError(f"Invalid configuration: {'; '.join(errors)}")
    logger.info("Configuration validated OK")


app = FastAPI(title="CloudGPU API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(webhooks.router)
app.include_router(billing.router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
