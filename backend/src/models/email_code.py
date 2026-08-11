import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from src.core.enums.email_code_purpose import EmailCodePurpose
from src.models.base import BaseModel


def _enum_values(enum_cls: type) -> list[str]:
    return [member.value for member in enum_cls]


class EmailCode(BaseModel):
    """Одноразовый код подтверждения (подтверждение почты / сброс пароля).

    Хранится только SHA-256 хэш кода — сам код в БД не попадает.
    """  # noqa: RUF002

    __tablename__ = "email_codes"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    code_hash: Mapped[str] = mapped_column(
        String(64),
        index=True,
        nullable=False,
    )

    purpose: Mapped[EmailCodePurpose] = mapped_column(
        Enum(EmailCodePurpose, values_callable=_enum_values),
        nullable=False,
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
