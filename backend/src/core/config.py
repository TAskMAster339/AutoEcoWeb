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

    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
