from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

__all__ = ["settings"]


class Settings(BaseSettings):
    app_name: str = "AutoEco Backend"

    debug: bool = False

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

    # Клиент proverkacheka.com (см. src/services/proverkacheka.py).
    # Токена в settings НЕТ — каждый пользователь хранит свой в БД  # noqa: RUF003
    # (users.proverkacheka_token) и задаёт через PUT /auth/me/proverkacheka-token.
    proverkacheka_url: str = Field(
        default="https://proverkacheka.com/api/v1/check/get",
        validation_alias=AliasChoices("PROVERKACHECKA_URL", "PROVERKA_URL"),
    )

    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

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


settings = Settings()
