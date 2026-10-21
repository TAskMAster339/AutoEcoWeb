from typing import Literal, Self
from urllib.parse import urlsplit

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

__all__ = ["Settings", "settings"]


class Settings(BaseSettings):
    app_name: str = "AutoEco Backend"
    app_env: Literal["development", "test", "production"]

    debug: bool = False
    # Docker gateway DNS name; empty disables trust in forwarded IP headers.
    trusted_proxy_hosts: str = "nginx"

    postgres_user: str
    postgres_password: str
    postgres_host: str
    postgres_port: int
    postgres_db_name: str

    jwt_secret: str
    jwt_algorithm: str = "HS256"

    cookie_secure: bool = False

    # Публичный адрес фронтенда для ссылок из email.
    app_url: str = "https://autoeco.mooo.com"
    # Comma-separated extra browser origins. APP_URL is always included.
    cors_origins: str = "http://localhost:5173"

    # Клиент proverkacheka.com (см. src/services/proverkacheka.py).
    # Токена в settings НЕТ — каждый пользователь хранит свой в БД  # noqa: RUF003
    # (users.proverkacheka_token) и задаёт через PUT /auth/me/proverkacheka-token.
    proverkacheka_url: str = Field(
        default="https://proverkacheka.com/api/v1/check/get",
        validation_alias=AliasChoices("PROVERKACHECKA_URL", "PROVERKA_URL"),
    )
    # Separate base64-encoded 32-byte KEK for envelope-encrypted user tokens.
    proverkacheka_encryption_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "PROVERKACHECKA_ENCRYPTION_KEY",
            "PROVERKACHEKA_ENCRYPTION_KEY",
        ),
    )

    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30
    refresh_token_grace_seconds: int = 10

    # ---- SMTP (письма кодами подтверждения / восстановления пароля)
    # Если SMTP_HOST пуст — письма не отправляются, код пишется в лог бэкенда
    # (удобно для локальной разработки без почтового сервера).
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    # Gmail: STARTTLS на порту 587; для SSL-портов (465) выставить smtp_ssl=true
    smtp_starttls: bool = True
    smtp_ssl: bool = False

    # ---- Коды подтверждения по email ----
    email_code_ttl_minutes: int = 15
    # Максимум неудачных попыток ввода, после чего код аннулируется
    email_code_max_attempts: int = 5

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_production_security(self) -> Self:
        if self.app_env != "production":
            return self

        errors: list[str] = []
        weak_secrets = {
            "very_secret_key",
            "test-secret",
            "change-me",
            "replace-me",
        }
        normalized_secret = self.jwt_secret.strip().lower()
        is_placeholder = normalized_secret.startswith(("change-", "replace-"))
        if (
            len(self.jwt_secret) < 32
            or normalized_secret in weak_secrets
            or is_placeholder
        ):
            errors.append("JWT_SECRET must be a unique value of at least 32 characters")
        if not self.cookie_secure:
            errors.append("COOKIE_SECURE must be true")

        missing_smtp = [
            name
            for name, value in {
                "SMTP_HOST": self.smtp_host,
                "SMTP_USERNAME": self.smtp_username,
                "SMTP_PASSWORD": self.smtp_password,
                "SMTP_FROM": self.smtp_from,
            }.items()
            if not value
        ]
        if missing_smtp:
            errors.append(f"SMTP is incomplete ({', '.join(missing_smtp)})")

        if errors:
            raise ValueError("Unsafe production configuration: " + "; ".join(errors))
        return self

    @property
    def allowed_origins(self) -> list[str]:
        values = [self.app_url, *self.cors_origins.split(",")]
        origins: list[str] = []
        for value in values:
            parsed = urlsplit(value.strip())
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                continue
            origin = f"{parsed.scheme}://{parsed.netloc}"
            if origin not in origins:
                origins.append(origin)
        return origins


settings = Settings()
