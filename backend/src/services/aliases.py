import re
from uuid import UUID

from fastapi import HTTPException, status
from src.models.alias import Alias
from src.models.user import User
from src.repositories.alias import AliasRepository
from src.schemas.alias import AliasCreate, AliasUpdate


class AliasService:
    def __init__(self, repo: AliasRepository) -> None:
        self._repo = repo

    async def list_all(self, user: User) -> list[Alias]:
        return await self._repo.list_all(user.id)

    async def create(self, user: User, data: AliasCreate) -> Alias:
        original = data.original_name.strip()
        alias_name = data.alias_name.strip()
        if data.is_regex:
            try:
                re.compile(original)
            except re.error as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Некорректное регулярное выражение",
                ) from exc
        duplicate = await self._repo.get_duplicate(user.id, original, alias_name)
        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Такой алиас уже существует",
            )
        return await self._repo.create(
            user_id=user.id,
            original_name=original,
            alias_name=alias_name,
            is_regex=data.is_regex,
            priority=data.priority,
        )

    async def update(self, user: User, alias_id: UUID, data: AliasUpdate) -> Alias:
        alias = await self._get_or_404(user.id, alias_id)
        changes = data.model_dump(exclude_unset=True)
        if not changes:
            return alias
        if "original_name" in changes:
            changes["original_name"] = changes["original_name"].strip()
        if "alias_name" in changes:
            changes["alias_name"] = changes["alias_name"].strip()
        if changes.get("is_regex", alias.is_regex):
            try:
                re.compile(changes.get("original_name", alias.original_name))
            except re.error as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Некорректное регулярное выражение",
                ) from exc
        duplicate = await self._repo.get_duplicate(
            user.id,
            changes.get("original_name", alias.original_name),
            changes.get("alias_name", alias.alias_name),
            exclude_id=alias.id,
        )
        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Такой алиас уже существует",
            )
        return await self._repo.update(alias, **changes)

    async def delete(self, user: User, alias_id: UUID) -> None:
        alias = await self._get_or_404(user.id, alias_id)
        await self._repo.delete(alias)

    async def _get_or_404(self, user_id: UUID, alias_id: UUID) -> Alias:
        alias = await self._repo.get(user_id, alias_id)
        if alias is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Алиас не найден",
            )
        return alias

    @staticmethod
    def resolve(aliases: list[Alias], raw_name: str) -> str:
        """Приводит сырое имя продавца к алиасу (или возвращает как есть).

        Сначала применяется is_regex (original_name как регулярка),
        иначе — подстрока (регистронезависимо). При нескольких совпадениях
        побеждает больший priority, при равенстве — более длинный original_name.
        """
        best: Alias | None = None
        for alias in aliases:
            if alias.is_regex:
                try:
                    matched = (
                        re.search(alias.original_name, raw_name, re.IGNORECASE)
                        is not None
                    )
                except re.error:
                    matched = False
            else:
                matched = alias.original_name.lower() in raw_name.lower()
            if not matched:
                continue
            if best is None or (
                alias.priority,
                len(alias.original_name),
            ) > (best.priority, len(best.original_name)):
                best = alias
        return best.alias_name if best is not None else raw_name
