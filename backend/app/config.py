import os
from pydantic_settings import BaseSettings

# Resolve the .env path relative to the backend project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE_PATH = os.path.join(BASE_DIR, ".env")


class Settings(BaseSettings):
    MONGODB_URI: str = "mongodb+srv://khumbhu2003_db_user:rajat12345@cluster0.ngyiqzn.mongodb.net/"
    DB_NAME: str = "coding_portal"
    JWT_SECRET: str = "4f3306aa7f9d4e06a5fe4ccb6dae3ffd_coding_portal_jwt_secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    CORS_ALLOWED_ORIGINS: str = "*"

    class Config:
        env_file = ENV_FILE_PATH
        extra = "ignore"


settings = Settings()
