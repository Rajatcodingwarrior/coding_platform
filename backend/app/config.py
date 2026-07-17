import os
from pydantic_settings import BaseSettings

# Resolve the .env path relative to the backend project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE_PATH = os.path.join(BASE_DIR, ".env")


class Settings(BaseSettings):
    MONGODB_URI: str = ""
    DB_NAME: str = "coding_portal"
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    CORS_ALLOWED_ORIGINS: str = "*"
    CRON_SECRET: str = "default_cron_secret_key_12345"

    # For Pydantic v2 compatibility
    model_config = {
        "env_file": ENV_FILE_PATH,
        "extra": "ignore"
    }


settings = Settings()
