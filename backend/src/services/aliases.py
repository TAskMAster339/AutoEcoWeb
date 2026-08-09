import re
from uuid import UUID

from fastapi import HTTPException, status
from src.models.alias import Alias
from src.models.user import User
from src.repositories.alias import AliasRepository
from src.repositories.receipt import ReceiptRepository
from src.repositories.transaction import TransactionRepository
from src.schemas.alias import AliasApplyResult, AliasCreate, AliasUpdate
from src.services.receipt_parser import normalize_product_name

# Значения scope (совпадают с src/core/enums/alias_scope.py)  # noqa: RUF003
_SCOPE_PRODUCT = "product"
_SCOPE_SELLER = "seller"


class AliasResolution:
    """Resolved display value and the alias that produced it."""

    def __init__(self, value: str, alias: Alias | None = None) -> None:
        self.value = value
        self.alias = alias


class AliasService:
    def __init__(
        self,
        repo: AliasRepository,
        tx_repo: TransactionRepository | None = None,
        receipt_repo: ReceiptRepository | None = None,
    ) -> None:
        self._repo = repo
        self._tx_repo = tx_repo
        self._receipt_repo = receipt_repo

    async def list_all(self, user: User) -> list[Alias]:
        return await self._repo.list_all(user.id)

    async def list_page(
        self,
        user: User,
        *,
        scope: str | None,
        limit: int,
        offset: int = 0,
    ) -> tuple[list[Alias], int]:
        """Страница алиасов (offset) + total — для CursorPage."""
        return await self._repo.list_page(
            user_id=user.id,
            scope=scope,
            limit=limit,
            offset=offset,
        )

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
        duplicate = await self._repo.get_duplicate(
            user.id,
            data.scope,
            original,
            alias_name,
        )
        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Такой алиас уже существует",
            )
        alias = await self._repo.create(
            user_id=user.id,
            scope=data.scope,
            original_name=original,
            alias_name=alias_name,
            is_regex=data.is_regex,
            priority=data.priority,
        )
        # Новый алиас сразу применяется к уже сохранённым записям
        await self.apply_scope(user.id, data.scope)
        return alias

    async def update(self, user: User, alias_id: UUID, data: AliasUpdate) -> Alias:
        alias = await self._get_or_404(user.id, alias_id)
        previous_scope = alias.scope
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
            changes.get("scope", alias.scope),
            changes.get("original_name", alias.original_name),
            changes.get("alias_name", alias.alias_name),
            exclude_id=alias.id,
        )
        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Такой алиас уже существует",
            )
        alias = await self._repo.update(alias, **changes)
        # Изменённый алиас тоже применяется к существующим записям
        await self.apply_scope(user.id, changes.get("scope", alias.scope))
        if previous_scope != alias.scope:
            await self.apply_scope(user.id, previous_scope, rebuild_empty=True)
        return alias

    async def delete(self, user: User, alias_id: UUID) -> None:
        alias = await self._get_or_404(user.id, alias_id)
        await self._repo.delete(alias)
        # Rebuild normalized values from immutable source columns after removal.
        # This also handles the last alias in a scope and preserves any other
        # aliases that still match the same transaction.
        remaining = await self._repo.list_all(user.id, scope=alias.scope)
        if alias.scope == _SCOPE_PRODUCT and self._tx_repo is not None:
            rows = await self._tx_repo.list_name_columns(user.id)
            await self._tx_repo.bulk_update_names(
                [
                    (
                        tx_id,
                        name,
                        normalize_product_name(resolved.value),
                        resolved.alias.id if resolved.alias else None,
                    )
                    for tx_id, name in rows
                    for resolved in [AliasService.resolve_with_alias(remaining, name)]
                ],
            )
        elif (
            alias.scope == _SCOPE_SELLER
            and self._tx_repo is not None
            and self._receipt_repo is not None
        ):
            receipt_rows = await self._receipt_repo.list_seller_columns(user.id)
            await self._receipt_repo.bulk_update_sellers(
                [
                    (
                        receipt_id,
                        resolved.value,
                        resolved.alias.id if resolved.alias else None,
                    )
                    for receipt_id, seller in receipt_rows
                    for resolved in [AliasService.resolve_with_alias(remaining, seller)]
                ],
            )
            tx_rows = await self._tx_repo.list_seller_columns(user.id)
            await self._tx_repo.bulk_update_sellers(
                [
                    (
                        tx_id,
                        resolved.value,
                        resolved.alias.id if resolved.alias else None,
                    )
                    for tx_id, seller in tx_rows
                    for resolved in [AliasService.resolve_with_alias(remaining, seller)]
                ],
            )

    async def _get_or_404(self, user_id: UUID, alias_id: UUID) -> Alias:
        alias = await self._repo.get(user_id, alias_id)
        if alias is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Алиас не найден",
            )
        return alias

    # ---------- применение к существующим записям ----------

    @staticmethod
    def resolve(aliases: list[Alias], raw_name: str) -> str:
        """Приводит сырое имя (продавца или товара) к алиасу (или как есть).

        Сначала применяется is_regex (original_name как регулярка),
        иначе — подстрока (регистронезависимо). При нескольких совпадениях
        побеждает больший priority, при равенстве — более длинный original_name.
        """
        return AliasService.resolve_with_alias(aliases, raw_name).value

    @staticmethod
    def resolve_with_alias(aliases: list[Alias], raw_name: str) -> AliasResolution:
        """Resolve from the immutable source and retain the winning alias."""
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
        return AliasResolution(best.alias_name if best is not None else raw_name, best)

    async def apply_scope(
        self,
        user_id: UUID,
        scope: str,
        *,
        rebuild_empty: bool = False,
    ) -> AliasApplyResult:
        """Применить ВСЕ алиасы скоупа к существующим записям.

        Один проход: читаем только нужные колонки, считаем изменения
        в Python (та же логика, что у resolve), пишем одним bulk-update.
        """  # noqa: RUF002
        aliases = await self._repo.list_all(user_id, scope=scope)
        if self._tx_repo is None or self._receipt_repo is None:
            return AliasApplyResult()

        if not aliases and rebuild_empty:
            if scope == _SCOPE_PRODUCT:
                rows = await self._tx_repo.list_name_columns(user_id)
                await self._tx_repo.bulk_update_names(
                    [
                        (tx_id, name, normalize_product_name(name), None)
                        for tx_id, name in rows
                    ],
                )
                return AliasApplyResult(product_updated=len(rows))
            receipt_rows = await self._receipt_repo.list_seller_columns(user_id)
            await self._receipt_repo.bulk_update_sellers(
                [(receipt_id, seller, None) for receipt_id, seller in receipt_rows],
            )
            tx_rows = await self._tx_repo.list_seller_columns(user_id)
            await self._tx_repo.bulk_update_sellers(
                [(tx_id, seller, None) for tx_id, seller in tx_rows],
            )
            return AliasApplyResult(
                seller_updated_receipts=len(receipt_rows),
                seller_updated_transactions=len(tx_rows),
            )

        if scope == _SCOPE_PRODUCT:
            rows = await self._tx_repo.list_name_columns(user_id)
            changes = [
                (
                    tx_id,
                    name,
                    normalize_product_name(resolved.value),
                    resolved.alias.id if resolved.alias else None,
                )
                for tx_id, name in rows
                for resolved in [AliasService.resolve_with_alias(aliases, name)]
                if resolved.value != name or resolved.alias is not None
            ]
            await self._tx_repo.bulk_update_names(changes)
            return AliasApplyResult(product_updated=len(changes))

        result = AliasApplyResult()
        receipt_rows = await self._receipt_repo.list_seller_columns(user_id)
        receipt_changes = [
            (receipt_id, resolved.value, resolved.alias.id if resolved.alias else None)
            for receipt_id, seller in receipt_rows
            for resolved in [AliasService.resolve_with_alias(aliases, seller)]
            if resolved.value != seller or resolved.alias is not None
        ]
        await self._receipt_repo.bulk_update_sellers(receipt_changes)
        result.seller_updated_receipts = len(receipt_changes)

        tx_rows = await self._tx_repo.list_seller_columns(user_id)
        tx_changes = [
            (tx_id, resolved.value, resolved.alias.id if resolved.alias else None)
            for tx_id, seller in tx_rows
            for resolved in [AliasService.resolve_with_alias(aliases, seller)]
            if resolved.value != seller or resolved.alias is not None
        ]
        await self._tx_repo.bulk_update_sellers(tx_changes)
        result.seller_updated_transactions = len(tx_changes)
        return result

    async def apply_all(self, user_id: UUID, scope: str | None) -> AliasApplyResult:
        """POST /aliases/apply: применить все алиасы (одного скоупа или оба)."""  # noqa: RUF002
        result = AliasApplyResult()
        if scope is None or scope == _SCOPE_SELLER:
            seller = await self.apply_scope(user_id, _SCOPE_SELLER)
            result.seller_updated_receipts = seller.seller_updated_receipts
            result.seller_updated_transactions = seller.seller_updated_transactions
        if scope is None or scope == _SCOPE_PRODUCT:
            product = await self.apply_scope(user_id, _SCOPE_PRODUCT)
            result.product_updated = product.product_updated
        return result
