from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.alias import Alias


class AliasRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        user_id: UUID,
        original_name: str,
        alias_name: str,
        is_regex: bool,
        priority: int,
    ) -> Alias:
        alias = Alias(
            user_id=user_id,
            original_name=original_name,
            alias_name=alias_name,
            is_regex=is_regex,
            priority=priority,
        )
        self._session.add(alias)
        await self._session.commit()
        await self._session.refresh(alias)
        return alias

    async def get(self, user_id: UUID, alias_id: UUID) -> Alias | None:
        stmt = select(Alias).where(Alias.id == alias_id, Alias.user_id == user_id)
        return await self._session.scalar(stmt)

    async def get_duplicate(
        self,
        user_id: UUID,
        original_name: str,
        alias_name: str,
        exclude_id: UUID | None = None,
    ) -> Alias | None:
        stmt = select(Alias).where(
            Alias.user_id == user_id,
            Alias.original_name == original_name,
            Alias.alias_name == alias_name,
        )
        if exclude_id is not None:
            stmt = stmt.where(Alias.id != exclude_id)
        return await self._session.scalar(stmt)

    async def list_all(self, user_id: UUID) -> list[Alias]:
        stmt = (
            select(Alias)
            .where(Alias.user_id == user_id)
            .order_by(Alias.priority.desc(), Alias.created_at.asc(), Alias.id.asc())
        )
        return list((await self._session.scalars(stmt)).all())

    async def update(self, alias: Alias, **fields: object) -> Alias:
        for field, value in fields.items():
            setattr(alias, field, value)
        await self._session.commit()
        await self._session.refresh(alias)
        return alias

    async def delete(self, alias: Alias) -> None:
        await self._session.delete(alias)
        await self._session.commit()
