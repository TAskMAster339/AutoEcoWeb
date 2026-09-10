from uuid import UUID

from fastapi import HTTPException, status
from src.models.user_limits import UserLimits
from src.repositories.user_limits import UserLimitsRepository, UserUsage
from src.schemas.user_limits import UserLimitsOverview, UserLimitsResponse, UserLimitsUpdate, UserUsageResponse


class UserLimitsService:
    def __init__(self, repo: UserLimitsRepository) -> None:
        self._repo = repo

    async def overview(self, user_id: UUID) -> UserLimitsOverview:
        limits = await self._repo.get_or_create(user_id)
        usage = await self._repo.usage(user_id)
        return UserLimitsOverview(
            limits=UserLimitsResponse.model_validate(limits),
            usage=UserUsageResponse(**usage.__dict__),
        )

    async def update(self, user_id: UUID, data: UserLimitsUpdate) -> UserLimits:
        limits = await self._repo.get_or_create(user_id)
        fields = data.model_dump(exclude_unset=True)
        if not fields:
            return limits
        null_fields = sorted(field for field, value in fields.items() if value is None)
        if null_fields:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Лимиты не могут быть null: {', '.join(null_fields)}",
            )
        return await self._repo.update(limits, **fields)

    async def ensure_tags(self, user_id: UUID, additional: int = 1) -> None:
        limits, usage = await self._locked_usage(user_id)
        self._ensure("тегов", usage.tags, additional, limits.max_tags)

    async def ensure_aliases(self, user_id: UUID, scope: str, additional: int = 1) -> None:
        limits, usage = await self._locked_usage(user_id)
        if scope == "seller":
            self._ensure("алиасов магазинов", usage.seller_aliases, additional, limits.max_seller_aliases)
        else:
            self._ensure("алиасов товаров", usage.product_aliases, additional, limits.max_product_aliases)

    async def ensure_transactions(self, user_id: UUID, additional: int = 1) -> None:
        limits, usage = await self._locked_usage(user_id)
        self._ensure("транзакций", usage.transactions, additional, limits.max_transactions)

    async def ensure_receipt(self, user_id: UUID, item_count: int) -> None:
        limits, usage = await self._locked_usage(user_id)
        self._ensure("чеков", usage.receipts, 1, limits.max_receipts)
        self._ensure_receipt_items(item_count, limits.max_receipt_items)
        self._ensure("транзакций", usage.transactions, item_count, limits.max_transactions)

    async def ensure_receipt_batch(self, user_id: UUID, item_count: int) -> None:
        limits, usage = await self._locked_usage(user_id)
        self._ensure_receipt_items(item_count, limits.max_receipt_items)
        self._ensure("транзакций", usage.transactions, item_count, limits.max_transactions)

    async def ensure_receipt_item(self, user_id: UUID, receipt_id: UUID) -> None:
        limits, usage = await self._locked_usage(user_id)
        current_items = await self._repo.receipt_item_count(receipt_id)
        self._ensure_receipt_items(current_items + 1, limits.max_receipt_items)
        self._ensure("транзакций", usage.transactions, 1, limits.max_transactions)

    async def ensure_import_rows(self, user_id: UUID, row_count: int) -> None:
        limits = await self._repo.get_or_create(user_id, for_update=True)
        if row_count > limits.max_import_rows:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"За один импорт можно добавить не более {limits.max_import_rows} строк",
            )

    async def _locked_usage(self, user_id: UUID) -> tuple[UserLimits, UserUsage]:
        limits = await self._repo.get_or_create(user_id, for_update=True)
        return limits, await self._repo.usage(user_id)

    @staticmethod
    def _ensure(label: str, current: int, additional: int, maximum: int) -> None:
        if additional <= 0:
            return
        if current + additional <= maximum:
            return
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Достигнут лимит: {label} — {current} из {maximum}. Удалите лишнее или обратитесь к администратору.",
        )

    @staticmethod
    def _ensure_receipt_items(item_count: int, maximum: int) -> None:
        if item_count <= maximum:
            return
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"В одном чеке может быть не более {maximum} позиций",
        )
