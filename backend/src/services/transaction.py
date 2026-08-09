from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from src.models.receipt import Receipt
from src.models.transaction import Transaction
from src.models.user import User
from src.repositories.alias import AliasRepository
from src.repositories.receipt import ReceiptRepository
from src.repositories.tag import TagRepository
from src.repositories.transaction import TransactionRepository
from src.schemas.analytics import (
    AnalyticsByStore,
    AnalyticsByTag,
    AnalyticsDaily,
    AnalyticsResponse,
)
from src.schemas.transaction import (
    TransactionCreate,
    TransactionInReceipt,
    TransactionManualIn,
    TransactionSummary,
    TransactionUpdate,
)
from src.services.aliases import AliasService
from src.services.receipt_parser import ReceiptItemData, normalize_product_name

# NOT NULL колонки transactions: явный null в PATCH → 422.
# tag_id НЕ входит в набор — явный null снимает тег.  # noqa: RUF003
_TRANSACTION_NON_NULLABLE = frozenset(
    {"name", "amount", "operation_type", "datetime"},
)

_SCOPE_PRODUCT = "product"
_SCOPE_SELLER = "seller"


class TransactionService:
    """Транзакции — минимальная единица учёта.

    Транзакция может быть привязана к чеку («коробке») или существовать
    сама по себе (ручной ввод). Владение — напрямую по user_id.
    """  # noqa: RUF002

    def __init__(
        self,
        tx_repo: TransactionRepository,
        receipt_repo: ReceiptRepository | None = None,
        tag_repo: TagRepository | None = None,
        alias_repo: AliasRepository | None = None,
    ) -> None:
        self._tx_repo = tx_repo
        self._receipt_repo = receipt_repo
        self._tag_repo = tag_repo
        self._alias_repo = alias_repo

    # ---------- применение алиасов при создании ----------

    async def _resolve_name(self, user_id: UUID, name: str) -> str:
        """Товарный алиас применяется к названию позиции при сохранении."""
        if self._alias_repo is None:
            return name
        aliases = await self._alias_repo.list_all(user_id, scope=_SCOPE_PRODUCT)
        return AliasService.resolve(aliases, name) if aliases else name

    async def _resolve_seller(self, user_id: UUID, seller: str | None) -> str | None:
        """Алиас продавца применяется к магазину ручной транзакции."""
        if seller is None or self._alias_repo is None:
            return seller
        aliases = await self._alias_repo.list_all(user_id, scope=_SCOPE_SELLER)
        return AliasService.resolve(aliases, seller) if aliases else seller

    async def _apply_product_aliases(
        self,
        user_id: UUID,
        items: list[ReceiptItemData],
    ) -> list[ReceiptItemData]:
        """Применяет товарные алиасы к позициям чека (один запрос алиасов)."""
        if self._alias_repo is None or not items:
            return items
        aliases = await self._alias_repo.list_all(user_id, scope=_SCOPE_PRODUCT)
        if not aliases:
            return items
        for item in items:
            resolved = AliasService.resolve(aliases, item.name)
            if resolved != item.name:
                item.name = resolved
        return items

    # ---------- создание из чеков ----------

    def _build_for_receipt(
        self,
        receipt: Receipt,
        items: list[ReceiptItemData],
    ) -> list[Transaction]:
        """Конструирование транзакций чека — только здесь (и в add_to_receipt)."""
        return [
            Transaction(
                user_id=receipt.user_id,
                position=index,
                name=item.name,
                normalized_name=normalize_product_name(item.name),
                quantity=item.quantity,
                unit=item.unit,
                price=item.price,
                amount=item.sum,
                operation_type=receipt.operation_type,
                check_datetime=receipt.check_datetime,
            )
            for index, item in enumerate(items)
        ]

    async def create_for_receipt(
        self,
        receipt: Receipt,
        items: list[ReceiptItemData],
    ) -> list[Transaction]:
        # товарные алиасы применяются к позициям ДО сохранения
        items = await self._apply_product_aliases(receipt.user_id, items)
        return await self._tx_repo.create_many(
            receipt.id,
            self._build_for_receipt(receipt, items),
        )

    async def create_manual_for_receipt(
        self,
        receipt: Receipt,
        items: list[TransactionManualIn],
    ) -> list[Transaction]:
        """Ручные позиции чека (схема) → данные парсера → транзакции."""
        data = [
            ReceiptItemData(
                name=item.name,
                price=item.price if item.price is not None else Decimal("0"),
                quantity=item.quantity if item.quantity is not None else Decimal("1"),
                sum=item.amount if item.amount is not None else Decimal("0"),
                nds=None,
                unit=item.unit if item.unit is not None else "шт",
            )
            for item in items
        ]
        return await self.create_for_receipt(receipt, data)

    async def add_to_receipt(
        self,
        user: User,
        receipt_id: UUID,
        data: TransactionInReceipt,
    ) -> Transaction:
        """Одна транзакция в существующий чек (нумерация продолжается)."""
        if self._receipt_repo is None:
            raise RuntimeError("receipt_repo не передан в TransactionService")
        receipt = await self._receipt_repo.get(user.id, receipt_id)
        if receipt is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Чек не найден",
            )
        existing = await self._tx_repo.list_by_receipt(receipt_id)
        position = (
            max((t.position for t in existing if t.position is not None), default=-1)
            + 1
        )
        original_name = data.name
        name = await self._resolve_name(user.id, original_name)
        tx = Transaction(
            user_id=user.id,
            receipt_id=receipt_id,
            position=position,
            name=original_name,
            normalized_name=normalize_product_name(name),
            quantity=data.quantity,
            unit=data.unit,
            price=data.price,
            amount=data.amount,
            operation_type=receipt.operation_type,
            check_datetime=receipt.check_datetime,
            tag_id=data.tag_id,
        )
        if data.tag_id is not None:
            await self._ensure_tag(user.id, data.tag_id)
        return await self._tx_repo.create(tx)

    # ---------- ручные (без чека) ----------

    async def create_standalone(
        self,
        user: User,
        data: TransactionCreate,
    ) -> Transaction:
        """Ручная транзакция без чека (POST /api/v1/transactions)."""
        if data.tag_id is not None:
            await self._ensure_tag(user.id, data.tag_id)
        # алиасы применяются к отображаемым normalized-полям, исходные
        # значения сохраняются для последующего отката.
        original_name = data.name
        name = await self._resolve_name(user.id, original_name)
        original_seller = data.seller_name
        seller_name = await self._resolve_seller(user.id, original_seller)
        tx = Transaction(
            user_id=user.id,
            receipt_id=None,
            position=None,
            name=original_name,
            normalized_name=normalize_product_name(name),
            seller_name=original_seller,
            normalized_seller_name=seller_name,
            quantity=data.quantity,
            unit=data.unit,
            price=data.price,
            amount=data.amount,
            operation_type=data.operation_type,
            check_datetime=data.datetime,
            tag_id=data.tag_id,
            comment=data.comment,
        )
        return await self._tx_repo.create(tx)

    # ---------- чтение / агрегаты / обновление / удаление ----------

    async def list_page(  # noqa: PLR0913
        self,
        user: User,
        *,
        limit: int,
        offset: int = 0,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        tag_id: UUID | None = None,
        search: str | None = None,
        seller_name: str | None = None,
        sort_by: str = "date",
        sort_dir: str = "desc",
    ) -> tuple[list[tuple[Transaction, str | None, Decimal]], int]:
        """Страница транзакций (offset) + seller_name из чека + баланс + total.

        offset-пагинация нужна бесконечному скроллу AG Grid (startRow/endRow).
        """
        return await self._tx_repo.list_page(
            user_id=user.id,
            limit=limit,
            offset=offset,
            date_from=date_from,
            date_to=date_to,
            tag_id=tag_id,
            search=search,
            seller_name=seller_name,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )

    async def summary(  # noqa: PLR0913
        self,
        user: User,
        *,
        date_from: datetime | None,
        date_to: datetime | None,
        tag_id: UUID | None,
        search: str | None,
        seller_name: str | None,
    ) -> TransactionSummary:
        """Показатели за период: суммы, счётчик, дельты, тренд, opening.

        Дельты — разница с предыдущим окном той же длины (для «Этот месяц»
        это прошлый месяц, как считал клиент). Без дат («Всё время») — None.
        """  # noqa: RUF002
        income, expenses, count = await self._tx_repo.aggregate(
            user_id=user.id,
            date_from=date_from,
            date_to=date_to,
            tag_id=tag_id,
            search=search,
            seller_name=seller_name,
        )
        opening = (
            await self._tx_repo.opening_balance(user.id, date_from)
            if date_from is not None
            else Decimal("0")
        )
        days = await self._tx_repo.daily_net(
            user_id=user.id,
            date_from=date_from,
            date_to=date_to,
            tag_id=tag_id,
            search=search,
            seller_name=seller_name,
        )
        trend: list[Decimal] = []
        acc = opening
        for _day, net in days:
            acc += net
            trend.append(acc)

        income_delta = expenses_delta = None
        if date_from is not None and date_to is not None:
            span = date_to - date_from
            prev_to = date_from - timedelta(seconds=1)
            prev_from = prev_to - span
            prev_income, prev_expenses, _ = await self._tx_repo.aggregate(
                user_id=user.id,
                date_from=prev_from,
                date_to=prev_to,
                tag_id=tag_id,
                search=search,
                seller_name=seller_name,
            )
            income_delta = income - prev_income
            expenses_delta = expenses - prev_expenses

        return TransactionSummary(
            balance=opening + income - expenses,
            opening_balance=opening,
            income=income,
            expenses=expenses,
            transactions=count,
            income_delta=income_delta,
            expenses_delta=expenses_delta,
            balance_trend=trend,
        )

    async def analytics(  # noqa: PLR0913
        self,
        user: User,
        *,
        date_from: datetime | None,
        date_to: datetime | None,
        tag_id: UUID | None,
        search: str | None,
        seller_name: str | None,
    ) -> AnalyticsResponse:
        """Аналитика за период: по дням, по магазинам, по тегам (SQL GROUP BY)."""
        daily = await self._tx_repo.daily_breakdown(
            user_id=user.id,
            date_from=date_from,
            date_to=date_to,
            tag_id=tag_id,
            search=search,
            seller_name=seller_name,
        )
        stores = await self._tx_repo.by_store(
            user_id=user.id,
            date_from=date_from,
            date_to=date_to,
            tag_id=tag_id,
            search=search,
            seller_name=seller_name,
        )
        tags = await self._tx_repo.by_tag(
            user_id=user.id,
            date_from=date_from,
            date_to=date_to,
            tag_id=tag_id,
            search=search,
            seller_name=seller_name,
        )
        return AnalyticsResponse(
            daily=[
                AnalyticsDaily(day=day, expenses=expenses, income=income)
                for day, expenses, income in daily
            ],
            by_store=[
                AnalyticsByStore(store=store, value=value) for store, value in stores
            ],
            by_tag=[
                AnalyticsByTag(
                    tag_id=tag_id_,
                    tag_name=name,
                    tag_color=color,
                    value=value,
                )
                for tag_id_, name, color, value in tags
            ],
        )

    async def stores(self, user: User) -> list[str]:
        """Все магазины пользователя (свои + из чеков) — чипсы фильтра."""  # noqa: RUF002
        return await self._tx_repo.distinct_sellers(user.id)

    async def get(self, user: User, tx_id: UUID) -> Transaction:
        tx = await self._tx_repo.get_owned(user.id, tx_id)
        if tx is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Транзакция не найдена",
            )
        return tx

    async def update(
        self,
        user: User,
        tx_id: UUID,
        data: TransactionUpdate,
    ) -> Transaction:
        tx = await self.get(user, tx_id)
        fields = data.model_dump(exclude_unset=True)
        if not fields:
            return tx
        null_required = sorted(
            f for f in fields if fields[f] is None and f in _TRANSACTION_NON_NULLABLE
        )
        if null_required:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Поля не могут быть null: {', '.join(null_required)}",
            )
        if "name" in fields:
            # normalized_name пересчитывается при смене названия
            fields["normalized_name"] = normalize_product_name(fields["name"])
        if fields.get("seller_name") is not None:
            # пустая строка магазина — то же, что «не указан»
            fields["seller_name"] = fields["seller_name"].strip() or None
        if "comment" in fields and fields["comment"] is not None:
            # пустой комментарий — то же, что «нет комментария»
            fields["comment"] = fields["comment"].strip() or None
        if fields.get("tag_id") is not None:
            await self._ensure_tag(user.id, fields["tag_id"])
        return await self._tx_repo.update(tx, **fields)

    async def delete(self, user: User, tx_id: UUID) -> None:
        tx = await self.get(user, tx_id)
        await self._tx_repo.delete(tx)

    # ---------- helpers ----------

    async def _ensure_tag(self, user_id: UUID, tag_id: UUID) -> None:
        if self._tag_repo is None:
            return
        tag = await self._tag_repo.get(user_id, tag_id)
        if tag is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Тег не найден",  # noqa: RUF001
            )
