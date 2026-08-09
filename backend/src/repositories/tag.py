from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.tag import Tag


class TagRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        user_id: UUID,
        name: str,
        color: str,
        icon: str | None,
    ) -> Tag:
        tag = Tag(user_id=user_id, name=name, color=color, icon=icon)
        self._session.add(tag)
        await self._session.commit()
        await self._session.refresh(tag)
        return tag

    async def get(self, user_id: UUID, tag_id: UUID) -> Tag | None:
        stmt = select(Tag).where(Tag.id == tag_id, Tag.user_id == user_id)
        return await self._session.scalar(stmt)

    async def get_by_name(self, user_id: UUID, name: str) -> Tag | None:
        stmt = select(Tag).where(Tag.user_id == user_id, Tag.name == name)
        return await self._session.scalar(stmt)

    async def list_all(self, user_id: UUID) -> list[Tag]:
        stmt = (
            select(Tag)
            .where(Tag.user_id == user_id)
            .order_by(Tag.created_at.asc(), Tag.id.asc())
        )
        return list((await self._session.scalars(stmt)).all())

    async def list_page(
        self,
        user_id: UUID,
        *,
        limit: int,
        offset: int,
    ) -> tuple[list[Tag], int]:
        base = select(Tag).where(Tag.user_id == user_id)
        items_stmt = (
            base.order_by(Tag.created_at.asc(), Tag.id.asc())
            .limit(limit)
            .offset(offset)
        )
        items = list((await self._session.scalars(items_stmt)).all())
        count_stmt = select(func.count(Tag.id)).where(Tag.user_id == user_id)
        total = int((await self._session.execute(count_stmt)).scalar_one())
        return items, total

    async def update(self, tag: Tag, **fields: object) -> Tag:
        for field, value in fields.items():
            setattr(tag, field, value)
        await self._session.commit()
        await self._session.refresh(tag)
        return tag

    async def delete(self, tag: Tag) -> None:
        await self._session.delete(tag)
        await self._session.commit()
