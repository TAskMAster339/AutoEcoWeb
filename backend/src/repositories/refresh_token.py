from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.refresh_token import RefreshToken


class RefreshTokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        user_id: UUID,
        token_hash: str,
        expires_at: datetime,
        family_id: UUID | None = None,
    ) -> RefreshToken:
        token = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            family_id=family_id or uuid4(),
        )
        self._session.add(token)
        await self._session.flush()
        await self._session.refresh(token)
        return token

    async def get_active(self, token_hash: str) -> RefreshToken | None:
        stmt = (
            select(RefreshToken)
            .where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > datetime.now(timezone.utc),
            )
            .with_for_update()
        )
        return await self._session.scalar(stmt)

    async def get_for_rotation(self, token_hash: str) -> RefreshToken | None:
        """Lock even a recently rotated token so grace reuse is atomic."""
        stmt = (
            select(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .with_for_update()
        )
        return await self._session.scalar(stmt)

    async def mark_rotated(
        self,
        token: RefreshToken,
        *,
        replaced_by_hash: str,
        grace_expires_at: datetime,
    ) -> None:
        token.revoked_at = datetime.now(timezone.utc)
        token.replaced_by_hash = replaced_by_hash
        token.grace_expires_at = grace_expires_at
        await self._session.flush()

    async def revoke(self, token: RefreshToken) -> None:
        token.revoked_at = datetime.now(timezone.utc)
        await self._session.flush()

    async def revoke_all_for_user(self, user_id: UUID) -> None:
        """Отзывает ВСЕ активные refresh-токены пользователя (смена пароля)."""
        await self._session.execute(
            update(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.now(timezone.utc))
        )
        await self._session.flush()
