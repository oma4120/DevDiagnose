from functools import lru_cache

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Substrings that mark a value as a copy of documentation rather than a generated
# secret. A single exact match is not enough, because .env.example can be edited
# and re-published, and someone will copy whatever placeholder is in it.
PLACEHOLDER_HINTS = ("change_me", "changeme", "change-me", "your-secret", "your_secret", "placeholder", "example")


class Settings(BaseSettings):
    mongo_uri: str = Field(default="", validation_alias=AliasChoices("MONGODB_URI", "MONGO_URI"))
    db_name: str = "devdiagnose"
    # No default on purpose: a missing secret must fail loudly at startup, not
    # silently sign tokens with a value that is published in this repository.
    jwt_secret: str = ""
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Demo dataset. Off by default so a fresh production database never comes up
    # with accounts whose password is published in app/seed.py.
    seed_demo_data: bool = False

    # First-run administrator. Used only when the members collection is empty,
    # which is the only way to obtain the first Admin: there is no self
    # registration and invitations require an existing Admin.
    bootstrap_admin_email: str = ""
    bootstrap_admin_password: str = ""
    bootstrap_admin_name: str = "Admin"

    # Invites & email
    app_url: str = "http://localhost:5173"
    invite_ttl_hours: int = 72
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "no-reply@devdiagnose.app"

    # Guards against runaway AI spend and unbounded document growth.
    analyze_cooldown_seconds: int = 20
    max_analyses_per_bug: int = 10

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    @model_validator(mode="after")
    def _validate_secrets(self) -> "Settings":
        if not self.jwt_secret.strip():
            raise ValueError(
                "JWT_SECRET is required. Set a long random value in backend/.env "
                "(e.g. python -c \"import secrets; print(secrets.token_urlsafe(48))\")."
            )
        lowered = self.jwt_secret.lower()
        if any(hint in lowered for hint in PLACEHOLDER_HINTS):
            raise ValueError(
                "JWT_SECRET looks like a placeholder (it contains "
                f"{[h for h in PLACEHOLDER_HINTS if h in lowered][0]!r}). "
                "Generate a random secret before starting the API."
            )
        if len(self.jwt_secret) < 16:
            raise ValueError("JWT_SECRET must be at least 16 characters.")
        if (self.bootstrap_admin_email and not self.bootstrap_admin_password) or (
            self.bootstrap_admin_password and not self.bootstrap_admin_email
        ):
            raise ValueError(
                "BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be set together."
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
