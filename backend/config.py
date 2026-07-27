from pydantic_settings import BaseSettings, SettingsConfigDict

__all__ = ["settings"]


class Settings(BaseSettings):
    app_name: str = "AutoEcoWebBackend"
    postgres_user: str
    postgres_password: str
    postgres_host: str
    postgres_port: str
    postgres_db_name: str

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
