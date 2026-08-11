from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.enums.email_code_purpose import EmailCodePurpose
from src.models.email_code import EmailCode


class EmailCodeRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        user_id: UUID,
        code_hash: str,
        purpose: EmailCodePurpose,
        expires_at: datetime,
    ) -> EmailCode:
        code = EmailCode(
            user_id=user_id,
            code_hash=code_hash,
            purpose=purpose,
            expires_at=expires_at,
        )
        self._session.add(code)
        await self._session.commit()
        await self._session.refresh(code)
        return code

    async def get_active(
        self,
        user_id: UUID,
        purpose: EmailCodePurpose,
    ) -> EmailCode | None:
        """Последний активный (неиспользованный, не истёкший) код пользователя."""
        stmt = (
            select(EmailCode)
            .where(
                EmailCode.user_id == user_id,
                EmailCode.purpose == purpose,
                EmailCode.used_at.is_(None),
                EmailCode.expires_at > datetime.now(timezone.utc),
            )
            .order_by(EmailCode.created_at.desc(), EmailCode.id.desc())
            .limit(1)
        )
        return await self._session.scalar(stmt)

    async def invalidate_all_for_user(
        self,
        user_id: UUID,
        purpose: EmailCodePurpose,
    ) -> None:
        """Аннулирует все прежние коды пользователя
        (новый запрос = старые недействительны)."""
        await self._session.execute(
            update(EmailCode)
            .where(
                EmailCode.user_id == user_id,
                EmailCode.purpose == purpose,
                EmailCode.used_at.is_(None),
            )
            .values(used_at=datetime.now(timezone.utc)),
        )
        await self._session.commit()

    async def mark_used(self, code: EmailCode) -> None:
        code.used_at = datetime.now(timezone.utc)
        await self._session.commit()

    async def bump_attempts(self, code: EmailCode) -> None:
        code.attempts += 1
        await self._session.commit()
