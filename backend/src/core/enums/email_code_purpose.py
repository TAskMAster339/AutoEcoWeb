from enum import Enum


class EmailCodePurpose(str, Enum):
    """Назначение одноразового кода, отправленного на почту."""

    VERIFY_EMAIL = "verify_email"
    RESET_PASSWORD = "reset_password"
