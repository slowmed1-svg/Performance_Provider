from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    runpod_api_key: str
    runpod_gpu_type: str = "NVIDIA GeForce RTX 4090"
    runpod_image_name: str = "msloukia/cloudgpu-comfyui:latest"

    stripe_secret_key: str
    stripe_webhook_secret: str

    price_per_hour_eur: float = 2.00
    raw_gpu_cost_usd_hr: float = 0.74
    inactivity_timeout_minutes: int = 15
    pre_auth_hold_eur: float = 10.00

    frontend_url: str = "http://localhost:5173"

    @property
    def price_per_minute_eur(self) -> float:
        return self.price_per_hour_eur / 60

    @property
    def minimum_charge_eur(self) -> float:
        return self.price_per_minute_eur * 5


@lru_cache
def get_settings() -> Settings:
    return Settings()
