from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.enums.user_role import UserRole
from src.core.enums.user_status import UserStatus
from src.models.user import User
from src.models.user_limits import UserLimits


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, email: str, password_hash: str) -> User:
        user = User(email=email, password_hash=password_hash)
        user.limits = UserLimits()
        self._session.add(user)
        await self._session.commit()
        await self._session.refresh(user)
        return user

    async def get(self, user_id: UUID) -> User | None:
        stmt = select(User).where(User.id == user_id)
        return await self._session.scalar(stmt)

    async def list_cursor(
        self,
        *,
        limit: int,
        cursor: tuple[datetime, UUID] | None = None,
        role: UserRole | None = None,
        status: UserStatus | None = None,
        q: str | None = None,
    ) -> list[User]:
        conditions: list[object] = []
        if role is not None:
            conditions.append(User.role == role)
        if status is not None:
            conditions.append(User.status == status)
        if q:
            conditions.append(User.email.ilike(f"%{q.lower()}%"))
        if cursor is not None:
            cursor_created_at, cursor_id = cursor
            conditions.append(
                or_(
                    User.created_at < cursor_created_at,
                    and_(User.created_at == cursor_created_at, User.id < cursor_id),
                ),
            )
        stmt = select(User)
        if conditions:
            stmt = stmt.where(*conditions)
        stmt = stmt.order_by(User.created_at.desc(), User.id.desc()).limit(limit)
        return list((await self._session.scalars(stmt)).all())

    async def count_admins(self) -> int:
        stmt = select(User).where(User.role == UserRole.ADMIN)
        return len(list((await self._session.scalars(stmt)).all()))

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        return await self._session.scalar(stmt)

    async def update(self, user: User, **fields: object) -> User:
        for field, value in fields.items():
            setattr(user, field, value)
        await self._session.commit()
        await self._session.refresh(user)
        return user

    async def delete(self, user: User) -> None:
        await self._session.delete(user)
        await self._session.commit()
