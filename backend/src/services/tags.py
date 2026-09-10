from uuid import UUID

from fastapi import HTTPException, status
from src.models.tag import Tag
from src.models.user import User
from src.repositories.tag import TagRepository
from src.schemas.tag import TagCreate, TagUpdate
from src.services.user_limits import UserLimitsService


class TagService:
    def __init__(
        self,
        repo: TagRepository,
        limits_service: UserLimitsService | None = None,
    ) -> None:
        self._repo = repo
        self._limits = limits_service

    async def list_all(self, user: User) -> list[tuple[Tag, int]]:
        return await self._repo.list_all_with_counts(user.id)

    async def list_page(
        self, user: User, *, limit: int, offset: int
    ) -> tuple[list[tuple[Tag, int]], int]:
        return await self._repo.list_page_with_counts(user.id, limit=limit, offset=offset)

    async def create(self, user: User, data: TagCreate) -> Tag:
        name = data.name.strip()
        duplicate = await self._repo.get_by_name(user.id, name)
        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Тег с таким названием уже существует",  # noqa: RUF001
            )
        if self._limits is not None:
            await self._limits.ensure_tags(user.id)
        return await self._repo.create(
            user_id=user.id,
            name=name,
            color=data.color,
            icon=data.icon,
        )

    async def update(self, user: User, tag_id: UUID, data: TagUpdate) -> Tag:
        tag = await self._get_or_404(user.id, tag_id)
        changes = data.model_dump(exclude_unset=True)
        if not changes:
            return tag
        if "name" in changes:
            name = changes["name"].strip()
            duplicate = await self._repo.get_by_name(user.id, name)
            if duplicate is not None and duplicate.id != tag.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Тег с таким названием уже существует",  # noqa: RUF001
                )
            changes["name"] = name
        return await self._repo.update(tag, **changes)

    async def delete(self, user: User, tag_id: UUID) -> None:
        tag = await self._get_or_404(user.id, tag_id)
        await self._repo.delete(tag)

    async def _get_or_404(self, user_id: UUID, tag_id: UUID) -> Tag:
        tag = await self._repo.get(user_id, tag_id)
        if tag is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Тег не найден",  # noqa: RUF001
            )
        return tag
