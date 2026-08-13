from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.alias import Alias


class AliasRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(  # noqa: PLR0913
        self,
        *,
        user_id: UUID,
        scope: str,
        original_name: str,
        alias_name: str,
        is_regex: bool,
        priority: int,
    ) -> Alias:
        alias = Alias(
            user_id=user_id,
            scope=scope,
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
        scope: str,
        original_name: str,
        alias_name: str,
        exclude_id: UUID | None = None,
    ) -> Alias | None:
        stmt = select(Alias).where(
            Alias.user_id == user_id,
            Alias.scope == scope,
            Alias.original_name == original_name,
            Alias.alias_name == alias_name,
        )
        if exclude_id is not None:
            stmt = stmt.where(Alias.id != exclude_id)
        return await self._session.scalar(stmt)

    async def list_all(self, user_id: UUID, scope: str | None = None) -> list[Alias]:
        """Все алиасы пользователя (опционально — одного скоупа).

        Порядок = порядок применения в AliasService.resolve: priority desc,
        затем более длинный original_name. Для стабильной пагинации добиваем
        created_at/id (порядок resolve от этого не меняется).
        """  # noqa: RUF002
        stmt = select(Alias).where(Alias.user_id == user_id)
        if scope is not None:
            stmt = stmt.where(Alias.scope == scope)
        stmt = stmt.order_by(
            Alias.priority.desc(),
            Alias.created_at.asc(),
            Alias.id.asc(),
        )
        return list((await self._session.scalars(stmt)).all())

    async def list_page(
        self,
        *,
        user_id: UUID,
        scope: str | None,
        limit: int,
        offset: int = 0,
        search: str | None = None,
    ) -> tuple[list[Alias], int]:
        """Страница алиасов (offset-пагинация) + общее количество.

        total нужен фронтенду («Загрузить ещё» и счётчик в табе).
        """
        conditions = [Alias.user_id == user_id]
        if scope is not None:
            conditions.append(Alias.scope == scope)
        if search:
            q = f"%{search}%"
            conditions.append((Alias.original_name.ilike(q)) | (Alias.alias_name.ilike(q)))

        stmt = (
            select(Alias)
            .where(*conditions)
            .order_by(
                Alias.priority.desc(),
                Alias.created_at.asc(),
                Alias.id.asc(),
            )
            .limit(limit)
            .offset(offset)
        )
        items = list((await self._session.scalars(stmt)).all())

        count_stmt = select(func.count(Alias.id)).where(*conditions)
        total = int((await self._session.execute(count_stmt)).scalar_one())
        return items, total

    async def update(self, alias: Alias, **fields: object) -> Alias:
        for field, value in fields.items():
            setattr(alias, field, value)
        await self._session.commit()
        await self._session.refresh(alias)
        return alias

    async def delete(self, alias: Alias) -> None:
        await self._session.delete(alias)
        await self._session.commit()
