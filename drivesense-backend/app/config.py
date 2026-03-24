from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_env: str = "development"
    cors_origins: str = "*"

    # LLM
    llm_provider: str = "openai"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    google_gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-pro"

    # Google Maps
    google_maps_api_key: str = ""

    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/drivesense"

    # Localization
    default_currency: str = "USD"
    default_region: str = "United States"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
