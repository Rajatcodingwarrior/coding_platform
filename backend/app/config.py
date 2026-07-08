import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    MONGODB_URI: str = "mongodb+srv://khumbhu2003_db_user:rajat12345@cluster0.ngyiqzn.mongodb.net/"
    DB_NAME: str = "coding_portal"
    JWT_SECRET: str = "4f3306aa7f9d4e06a5fe4ccb6dae3ffd_coding_portal_jwt_secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
