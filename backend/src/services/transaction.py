from datetime import datetime, timedelta
from decimal import Decimal
from statistics import mean, median, pstdev
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
    AnalyticsByCategory,
    AnalyticsByStore,
    AnalyticsDaily,
    AnalyticsIndicators,
    AnalyticsResponse,
    AnalyticsWeekday,
    PriceChartResponse,
    PricePoint,
)
from src.schemas.transaction import (
    StoreResponse,
    TransactionCreate,
    TransactionInReceipt,
    TransactionManualIn,
    TransactionSummary,
    TransactionUpdate,
)
from src.services.aliases import AliasService
from src.services.receipt_parser import ReceiptItemData, normalize_product_name
from src.services.sellers import SellerService

# NOT NULL колонки transactions: явный null в PATCH → 422.
# tag_id НЕ входит в набор — явный null снимает тег.  # noqa: RUF003
_TRANSACTION_NON_NULLABLE = frozenset(
    {"name", "amount", "operation_type", "datetime"},
)

_SCOPE_PRODUCT = "product"


def _money2(value: float) -> Decimal:
    """float → Decimal с 2 знаками: без хвостов плавающей точки ('45.00', не '45.0')."""  # noqa: RUF002
    return Decimal(str(round(value, 2))).quantize(Decimal("0.01"))


def _least_squares_trend(values: list[Decimal]) -> list[Decimal | None]:
    """Линейный тренд (МНК) по индексам; None, если точек < 2."""  # noqa: RUF002
    n = len(values)
    if n < 2:  # noqa: PLR2004
        return [None] * n
    xs = list(range(n))
    x_mean = (n - 1) / 2
    y_mean = float(sum(values)) / n
    num = sum((x - x_mean) * (float(v) - y_mean) for x, v in zip(xs, values))
    den = sum((x - x_mean) ** 2 for x in xs)
    slope = num / den if den else 0.0
    intercept = y_mean - slope * x_mean
    return [Decimal(round(slope * x + intercept, 2)) for x in xs]


def _build_indicators(
    stores: list[tuple[str, Decimal]],
    categories: list[tuple[UUID, str, str, Decimal, int]],
    weekdays: list[tuple[int, Decimal, int]],
    stores_income: list[tuple[str, Decimal]],
) -> AnalyticsIndicators:
    """Индикаторы: максимумы по сумме (магазины/доходы) и по count (категории/дни)."""
    top_store = (
        AnalyticsByStore(store=stores[0][0], value=stores[0][1]) if stores else None
    )
    top_category = None
    if categories:
        tag_id_, name, color, value, count_ = max(
            categories,
            key=lambda c: (c[4], c[3]),
        )
        top_category = AnalyticsByCategory(
            tag_id=tag_id_,
            tag_name=name,
            tag_color=color,
            value=value,
            count=count_,
        )
    top_weekday = None
    if weekdays:
        wd, value, count_ = max(weekdays, key=lambda w: (w[2], w[1]))
        # Пустой период (все дни по 0) — индикатор не показываем
        if count_ > 0:
            top_weekday = AnalyticsWeekday(weekday=wd, value=value, count=count_)
    top_income = (
        AnalyticsByStore(store=stores_income[0][0], value=stores_income[0][1])
        if stores_income
        else None
    )
    return AnalyticsIndicators(
        top_store=top_store,
        top_category=top_category,
        top_weekday=top_weekday,
        top_income_source=top_income,
    )


class TransactionService:
    """Транзакции — минимальная единица учёта.

    Транзакция может быть привязана к чеку («коробке») или существовать
    сама по себе (ручной ввод). Владение — напрямую по user_id.
    """  # noqa: RUF002

    def __init__(
        self,
        tx_repo: TransactionRepository,
        receipt_repo: ReceiptRepository,
        tag_repo: TagRepository,
        alias_repo: AliasRepository,
        seller_service: SellerService,
    ) -> None:
        self._tx_repo = tx_repo
        self._receipt_repo = receipt_repo
        self._tag_repo = tag_repo
        self._alias_repo = alias_repo
        self._seller_service = seller_service

    # ---------- применение алиасов при создании ----------

    async def _resolve_name(self, user_id: UUID, name: str) -> tuple[str, UUID | None]:
        """Товарный алиас применяется к названию позиции при сохранении."""
        if self._alias_repo is None:
            return name, None
        aliases = await self._alias_repo.list_all(user_id, scope=_SCOPE_PRODUCT)
        if not aliases:
            return name, None
        resolved = AliasService.resolve_with_alias(aliases, name)
        return resolved.value, resolved.alias.id if resolved.alias is not None else None

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
        aliases = (
            await self._alias_repo.list_all(receipt.user_id, scope=_SCOPE_PRODUCT)
            if self._alias_repo is not None
            else []
        )
        transactions = self._build_for_receipt(receipt, items)
        for tx in transactions:
            resolved = AliasService.resolve_with_alias(aliases, tx.name)
            tx.normalized_name = normalize_product_name(resolved.value)
            tx.name_alias_id = resolved.alias.id if resolved.alias is not None else None
        return await self._tx_repo.create_many(receipt.id, transactions)

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
        name, name_alias_id = await self._resolve_name(user.id, original_name)
        tx = Transaction(
            user_id=user.id,
            receipt_id=receipt_id,
            position=position,
            name=original_name,
            normalized_name=normalize_product_name(name),
            name_alias_id=name_alias_id,
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
        name, name_alias_id = await self._resolve_name(user.id, original_name)
        seller = (
            await self._seller_service.get_or_create(user.id, data.seller_name)
            if data.seller_name is not None and self._seller_service is not None
            else None
        )
        tx = Transaction(
            user_id=user.id,
            receipt_id=None,
            position=None,
            name=original_name,
            normalized_name=normalize_product_name(name),
            name_alias_id=name_alias_id,
            seller_id=seller.id if seller is not None else None,
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
        tag_ids: list[UUID] | None = None,
        search: str | None = None,
        seller_names: list[str] | None = None,
        sort_by: str = "date",
        sort_dir: str = "desc",
    ) -> tuple[list[tuple[Transaction, str | None, Decimal]], int]:
        """Страница транзакций (offset) + эффективный продавец + баланс + total.

        offset-пагинация нужна бесконечному скроллу AG Grid (startRow/endRow).
        """
        return await self._tx_repo.list_page(
            user_id=user.id,
            limit=limit,
            offset=offset,
            date_from=date_from,
            date_to=date_to,
            tag_ids=tag_ids,
            search=search,
            seller_names=seller_names,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )

    async def summary(  # noqa: PLR0913
        self,
        user: User,
        *,
        date_from: datetime | None,
        date_to: datetime | None,
        tag_ids: list[UUID] | None,
        search: str | None,
        seller_names: list[str] | None,
    ) -> TransactionSummary:
        """Показатели за период: суммы, счётчик, дельты, тренд, opening.

        Дельты — разница с предыдущим окном той же длины (для «Этот месяц»
        это прошлый месяц, как считал клиент). Без дат («Всё время») — None.
        """  # noqa: RUF002
        income, expenses, count = await self._tx_repo.aggregate(
            user_id=user.id,
            date_from=date_from,
            date_to=date_to,
            tag_ids=tag_ids,
            search=search,
            seller_names=seller_names,
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
            tag_ids=tag_ids,
            search=search,
            seller_names=seller_names,
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
                tag_ids=tag_ids,
                search=search,
                seller_names=seller_names,
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
        tag_ids: list[UUID] | None,
        search: str | None,
        seller_names: list[str] | None,
    ) -> AnalyticsResponse:
        """Аналитика за период: по дням, магазинам (расходы/доходы),
        категориям, дням недели + индикаторы (SQL GROUP BY + Python)."""
        daily = await self._tx_repo.daily_breakdown(
            user_id=user.id,
            date_from=date_from,
            date_to=date_to,
            tag_ids=tag_ids,
            search=search,
            seller_names=seller_names,
        )
        stores = await self._tx_repo.by_store(
            user_id=user.id,
            date_from=date_from,
            date_to=date_to,
            tag_ids=tag_ids,
            search=search,
            seller_names=seller_names,
        )
        stores_income = await self._tx_repo.by_store_income(
            user_id=user.id,
            date_from=date_from,
            date_to=date_to,
            tag_ids=tag_ids,
            search=search,
            seller_names=seller_names,
        )
        categories = await self._tx_repo.by_category(
            user_id=user.id,
            date_from=date_from,
            date_to=date_to,
            tag_ids=tag_ids,
            search=search,
            seller_names=seller_names,
        )
        weekdays = await self._tx_repo.by_weekday(
            user_id=user.id,
            date_from=date_from,
            date_to=date_to,
            tag_ids=tag_ids,
            search=search,
            seller_names=seller_names,
        )

        trend = _least_squares_trend([e for _, e, _, _ in daily])
        daily_rows = [
            AnalyticsDaily(
                day=day_,
                expenses=expenses,
                income=income,
                count=count_,
                trend=t,
            )
            for (day_, expenses, income, count_), t in zip(daily, trend)
        ]

        return AnalyticsResponse(
            daily=daily_rows,
            by_store=[
                AnalyticsByStore(store=store, value=value) for store, value in stores
            ],
            by_store_income=[
                AnalyticsByStore(store=store, value=value)
                for store, value in stores_income
            ],
            by_category=[
                AnalyticsByCategory(
                    tag_id=tag_id_,
                    tag_name=name,
                    tag_color=color,
                    value=value,
                    count=count_,
                )
                for tag_id_, name, color, value, count_ in categories
            ],
            by_weekday=[
                AnalyticsWeekday(weekday=wd, value=value, count=count_)
                for wd, value, count_ in weekdays
            ],
            indicators=_build_indicators(stores, categories, weekdays, stores_income),
        )

    async def price_chart(
        self,
        user: User,
        *,
        name: str,
        is_regex: bool,
        date_from: datetime | None,
        date_to: datetime | None,
    ) -> PriceChartResponse:
        """График цен товара: точки (день×магазин, средняя цена) и статистика.

        Источник цены единый для всего матча, без смешивания масштабов:
        - если у ВСЕХ покупок заполнен price — берём price;
        - если хотя бы у одной price отсутствует — берём amount у всех
          (amount заполнен всегда). Статистика (avg/median/stddev) — по
          индивидуальным значениям; stddev популяционное (pstdev).
        """  # noqa: RUF002
        if not name.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Укажите название товара",
            )
        rows = await self._tx_repo.price_points(
            user_id=user.id,
            name=name.strip(),
            is_regex=is_regex,
            date_from=date_from,
            date_to=date_to,
        )
        if not rows:
            return PriceChartResponse(
                points=[],
                stores=[],
                avg_price=Decimal("0"),
                median_price=Decimal("0"),
                stddev=Decimal("0"),
                count=0,
            )
        # Единый источник цены для всего матча
        use_price = all(price is not None for _, price, _, _, _ in rows)
        effective: list[tuple[str, str | None, Decimal, str]] = []
        for day_, price, amount, store, transaction_name in rows:
            value = price if use_price and price is not None else amount
            effective.append((str(day_), store, value, transaction_name))
        prices = [value for _, _, value, _ in effective]

        per_day: dict[tuple[str, str | None], list[tuple[Decimal, str]]] = {}
        store_order: list[str | None] = []
        for day_, store, price, transaction_name in effective:
            key = (day_, store)
            per_day.setdefault(key, []).append((price, transaction_name))
            if store not in store_order:
                store_order.append(store)

        points = [
            PricePoint(
                day=day_,
                price=_money2(float(sum(price for price, _ in values)) / len(values)),
                count=len(values),
                store=store,
                names=list(dict.fromkeys(name for _, name in values)),
            )
            for (day_, store), values in sorted(per_day.items())
        ]
        f_prices = [float(p) for p in prices]
        return PriceChartResponse(
            points=points,
            stores=store_order,
            avg_price=_money2(mean(f_prices)),
            median_price=_money2(median(f_prices)),
            stddev=_money2(pstdev(f_prices)),
            count=len(prices),
        )

    async def stores(self, user: User) -> list[StoreResponse]:
        """Магазины пользователя с alias/display/filter значениями."""  # noqa: RUF002
        rows = (
            await self._seller_service.list_stores(user.id)
            if self._seller_service is not None
            else []
        )
        return [
            StoreResponse(
                seller_id=seller_id,
                seller_name=raw,
                normalized_seller_name=normalized,
                alias_id=alias_id,
                alias_name=alias_name,
                filter_value=normalized,
            )
            for seller_id, raw, normalized, alias_id, alias_name in rows
        ]

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
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Поля не могут быть null: {', '.join(null_required)}",
            )
        if "name" in fields:
            # normalized_name пересчитывается при смене названия
            name, alias_id = await self._resolve_name(user.id, fields["name"])
            fields["normalized_name"] = normalize_product_name(name)
            fields["name_alias_id"] = alias_id
        # В API поле называется datetime, а ORM-атрибут — check_datetime
        # (колонка БД также называется datetime). Без маппинга setattr создаёт
        # обычный transient-атрибут, поэтому дата после перезагрузки возвращалась прежней.
        if "datetime" in fields:
            fields["check_datetime"] = fields.pop("datetime")
        previous_seller_id = tx.seller_id
        if "seller_name" in fields:
            seller_name = fields.pop("seller_name")
            seller = None
            if seller_name is not None and self._seller_service is not None:
                seller = await self._seller_service.get_or_create(user.id, seller_name)
            fields["seller_id"] = seller.id if seller is not None else None
        if "comment" in fields and fields["comment"] is not None:
            # пустой комментарий — то же, что «нет комментария»
            fields["comment"] = fields["comment"].strip() or None
        if fields.get("tag_id") is not None:
            await self._ensure_tag(user.id, fields["tag_id"])
        updated = await self._tx_repo.update(tx, **fields)
        if "seller_name" in data.model_fields_set and previous_seller_id is not None:
            await self._seller_service.delete_if_unused(user.id, previous_seller_id)
        return updated

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
