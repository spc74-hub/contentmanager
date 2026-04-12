from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://spcadmin:PASSWORD@spcapps-postgres:5432/content_manager"
    youtube_client_id: str = ""
    youtube_client_secret: str = ""
    frontend_url: str = "http://localhost:5173"
    secret_key: str = "change-me-in-production"
    ollama_url: str = "http://localhost:11434"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
