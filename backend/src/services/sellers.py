from uuid import UUID

from fastapi import HTTPException, status
from src.models.seller import Seller
from src.repositories.alias import AliasRepository
from src.repositories.seller import SellerRepository
from src.services.aliases import AliasService

_SCOPE_SELLER = "seller"


class SellerService:
    """Centralized seller identity, alias resolution, and reapplication."""

    def __init__(self, repo: SellerRepository, alias_repo: AliasRepository) -> None:
        self._repo = repo
        self._alias_repo = alias_repo

    async def get_or_create(self, user_id: UUID, raw_name: str) -> Seller | None:
        name = raw_name.strip()
        if not name:
            return None
        existing = await self._repo.get_by_name(user_id, name)
        if existing is not None:
            return existing
        normalized, alias_id = await self._resolve(user_id, name)
        return await self._repo.get_or_create(
            user_id=user_id,
            name=name,
            normalized_name=normalized,
            seller_alias_id=alias_id,
        )

    async def get_or_create_required(self, user_id: UUID, raw_name: str) -> Seller:
        """Return a seller or reject a blank required seller name."""
        seller = await self.get_or_create(user_id, raw_name)
        if seller is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Название продавца не может быть пустым",
            )
        return seller

    async def list_stores(
        self, user_id: UUID
    ) -> list[tuple[UUID, str, str, UUID | None, str | None]]:
        return await self._repo.list_stores(user_id)

    async def list_management(self, user_id: UUID):
        return await self._repo.list_management(user_id)

    async def get_owned(self, user_id: UUID, seller_id: UUID) -> Seller:
        seller = await self._repo.get_by_id(user_id, seller_id)
        if seller is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Магазин не найден"
            )
        return seller

    async def update(self, user_id: UUID, seller_id: UUID, raw_name: str) -> Seller:
        name = raw_name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Название магазина не может быть пустым",
            )
        seller = await self.get_owned(user_id, seller_id)
        duplicate = await self._repo.get_by_name(user_id, name)
        if duplicate is not None and duplicate.id != seller.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Такой магазин уже существует",
            )
        normalized, alias_id = await self._resolve(user_id, name)
        seller.name = name
        seller.normalized_name = normalized
        seller.seller_alias_id = alias_id
        await self._repo.save(seller)
        return seller

    async def delete(self, user_id: UUID, seller_id: UUID) -> None:
        seller = await self.get_owned(user_id, seller_id)
        if not await self._repo.delete_if_unused(seller):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Нельзя удалить магазин, пока он используется",
            )

    async def delete_if_unused(self, user_id: UUID, seller_id: UUID) -> None:
        seller = await self._repo.get_by_id(user_id, seller_id)
        if seller is not None:
            await self._repo.delete_if_unused(seller)

    async def reapply(
        self, user_id: UUID, *, rebuild_empty: bool = False
    ) -> list[UUID]:
        aliases = await self._alias_repo.list_all(user_id, scope=_SCOPE_SELLER)
        rows = await self._repo.list_name_columns(user_id)
        if not rows or (not aliases and not rebuild_empty):
            return []
        changes: list[tuple[UUID, str, UUID | None]] = []
        for seller_id, name, current_value, current_alias_id in rows:
            resolved = AliasService.resolve_with_alias(aliases, name)
            value = resolved.value
            alias_id = resolved.alias.id if resolved.alias is not None else None
            if value != current_value or alias_id != current_alias_id:
                changes.append((seller_id, value, alias_id))
        await self._repo.bulk_update_normalized(changes)
        return [seller_id for seller_id, _value, _alias_id in changes]

    async def _resolve(self, user_id: UUID, name: str) -> tuple[str, UUID | None]:
        aliases = await self._alias_repo.list_all(user_id, scope=_SCOPE_SELLER)
        if not aliases:
            return name, None
        resolved = AliasService.resolve_with_alias(aliases, name)
        return resolved.value, resolved.alias.id if resolved.alias is not None else None
