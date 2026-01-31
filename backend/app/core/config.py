from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Default to sqlite for local dev; override via .env for Postgres.
    DATABASE_URL: str = "sqlite:///./bar_control.db"
    JWT_SECRET: str = "CHANGE_ME"
    JWT_ALG: str = "HS256"
    JWT_EXPIRES_MIN: int = 720  # 12h
    LOG_RETENTION_DAYS: int = 180
    CORS_ORIGINS: str = "http://localhost:5173"

    SEED_ADMIN_USERNAME: str = "admin"
    SEED_ADMIN_PASSWORD: str = "admin123"
    SEED_ADMIN_NAME: str = "Administrador"

settings = Settings()
