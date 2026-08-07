import base64
import binascii
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status

_SEP = "|"


def encode_cursor(created_at: datetime, user_id: UUID) -> str:
    """Кодирует (created_at, user_id) в непрозрачный курсор. Всегда в UTC.

    sqlite отдаёт naive datetime (tz не хранится) — трактуем его как UTC,
    иначе astimezone(utc) посчитает его локальным временем и сдвинет курсор.
    """  # noqa: RUF002
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    created_at_utc = created_at.astimezone(timezone.utc)
    raw = f"{created_at_utc.isoformat()}{_SEP}{user_id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    """Декодирует курсор; мусор -> 422, а не 500."""  # noqa: RUF002
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        created_at_str, user_id_str = raw.split(_SEP, 1)
        created_at = datetime.fromisoformat(created_at_str)
        if created_at.tzinfo is None:  # sqlite отдаёт naive
            created_at = created_at.replace(tzinfo=timezone.utc)
        return created_at, UUID(user_id_str)
    except (binascii.Error, ValueError, UnicodeDecodeError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Некорректный cursor",
        ) from None
