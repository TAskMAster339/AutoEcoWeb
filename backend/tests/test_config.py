import pytest
from pydantic import ValidationError

from src.core.config import Settings


def settings_values(**overrides: object) -> dict[str, object]:
    values = {
        "app_env": "production",
        "postgres_user": "test",
        "postgres_password": "test",
        "postgres_host": "localhost",
        "postgres_port": 5432,
        "postgres_db_name": "test",
        "jwt_secret": "a-production-secret-that-is-long-enough",
        "cookie_secure": True,
        "smtp_host": "smtp.example.com",
        "smtp_username": "mailer@example.com",
        "smtp_password": "smtp-secret",
        "smtp_from": "mailer@example.com",
    }
    return values | overrides


def test_production_configuration_accepts_secure_values():
    loaded = Settings(_env_file=None, **settings_values())

    assert loaded.app_env == "production"


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({"jwt_secret": "very_secret_key"}, "JWT_SECRET"),
        ({"jwt_secret": "replace-with-a-unique-random-secret"}, "JWT_SECRET"),
        ({"cookie_secure": False}, "COOKIE_SECURE"),
        ({"smtp_password": None}, "SMTP_PASSWORD"),
    ],
)
def test_production_configuration_rejects_unsafe_values(overrides, expected):
    with pytest.raises(ValidationError, match=expected):
        Settings(_env_file=None, **settings_values(**overrides))


def test_development_keeps_local_email_fallback_available():
    loaded = Settings(
        _env_file=None,
        **settings_values(
            app_env="development",
            jwt_secret="local-only",
            cookie_secure=False,
            smtp_host=None,
            smtp_username=None,
            smtp_password=None,
            smtp_from=None,
        ),
    )

    assert loaded.app_env == "development"
