from datetime import datetime
from decimal import Decimal
from typing import cast
from uuid import UUID

from sqlalchemy import (
    Table,
    bindparam,
    case,
    func,
    nulls_last,
    or_,
    select,
    update,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement
from src.models.receipt import Receipt
from src.models.tag import Tag
from src.models.transaction import Transaction

# ФНС: 1=приход/покупка (расход), 2=расход/возврат (доход),
#      3=возврат прихода (доход), 4=возврат расхода (расход)
_INCOME_TYPES = (2, 3)
_EXPENSE_TYPES = (1, 4)

# sort_by (colId из AG Grid) → SQL-выражение. Только whitelist: пользовательский
# ввод в ORDER BY не попадает никогда.
_SORTABLE = {
    "date": Transaction.check_datetime,
    "store": func.coalesce(
        Transaction.normalized_seller_name,
        Receipt.normalized_seller_name,
    ),
    "name": Transaction.name,
    "quantity": Transaction.quantity,
    "price": Transaction.price,
    "income": case(
        (Transaction.operation_type.in_(_INCOME_TYPES), Transaction.amount),
        else_=None,
    ),
    "expense": case(
        (Transaction.operation_type.in_(_EXPENSE_TYPES), Transaction.amount),
        else_=None,
    ),
    "comment": Transaction.comment,
}

# Колонки, где NULL допустим → NULLS LAST при любой сортировке
_NULLS_LAST = frozenset(
    {"store", "quantity", "price", "income", "expense", "comment", "balance"},
)


def _filters(
    *,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    tag_id: UUID | None = None,
    search: str | None = None,
    seller_name: str | None = None,
) -> list[ColumnElement[bool]]:
    """Общие WHERE-условия списка и агрегатов (требуют left join receipts).

    user_id добавляет вызывающий — у агрегатов и списка он свой контекст.
    Поиск покрывает name/comment/магазин (как раньше фильтровал клиент).
    """  # noqa: RUF002
    conditions: list[ColumnElement[bool]] = []
    if date_from is not None:
        conditions.append(Transaction.check_datetime >= date_from)  # type: ignore[arg-type]
    if date_to is not None:
        conditions.append(Transaction.check_datetime <= date_to)  # type: ignore[arg-type]
    if tag_id is not None:
        conditions.append(Transaction.tag_id == tag_id)  # type: ignore[arg-type]
    if seller_name is not None:
        conditions.append(
            func.coalesce(
                Transaction.normalized_seller_name,
                Receipt.normalized_seller_name,
            )
            == seller_name,
        )  # type: ignore[arg-type]
    if search:
        q = f"%{search}%"
        conditions.append(
            or_(
                Transaction.name.ilike(q),
                Transaction.comment.ilike(q),
                func.coalesce(
                    Transaction.normalized_seller_name,
                    Receipt.normalized_seller_name,
                ).ilike(q),
            ),  # type: ignore[arg-type]
        )
    return conditions


class TransactionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, tx: Transaction) -> Transaction:
        self._session.add(tx)
        await self._session.commit()
        await self._session.refresh(tx)
        return tx

    async def create_many(
        self,
        receipt_id: UUID,
        transactions: list[Transaction],
    ) -> list[Transaction]:
        if not transactions:
            return []
        for tx in transactions:
            tx.receipt_id = receipt_id
        self._session.add_all(transactions)
        await self._session.commit()
        return transactions

    async def create_many_standalone(
        self,
        transactions: list[Transaction],
    ) -> list[Transaction]:
        """Ручные транзакции без чека (импорт): bulk-insert, receipt_id = None."""
        if not transactions:
            return []
        self._session.add_all(transactions)
        await self._session.commit()
        return transactions

    async def list_by_receipt(self, receipt_id: UUID) -> list[Transaction]:
        stmt = (
            select(Transaction)
            .where(Transaction.receipt_id == receipt_id)
            .order_by(Transaction.position.asc(), Transaction.id.asc())
        )
        return list((await self._session.scalars(stmt)).all())

    async def list_all(
        self,
        user_id: UUID,
    ) -> list[tuple[Transaction, str | None]]:
        """Все транзакции пользователя + seller_name из чека (для экспорта)."""  # noqa: RUF002
        stmt = (
            select(Transaction, Receipt.normalized_seller_name)
            .outerjoin(Receipt, Receipt.id == Transaction.receipt_id)
            .where(Transaction.user_id == user_id)
            .order_by(Transaction.check_datetime.asc(), Transaction.id.asc())
        )
        rows = (await self._session.execute(stmt)).all()
        return [(tx, seller_name) for tx, seller_name in rows]

    async def list_by_receipts(self, receipt_ids: list[UUID]) -> list[Transaction]:
        if not receipt_ids:
            return []
        stmt = (
            select(Transaction)
            .where(Transaction.receipt_id.in_(receipt_ids))
            .order_by(Transaction.position.asc(), Transaction.id.asc())
        )
        return list((await self._session.scalars(stmt)).all())

    async def get_by_id(self, tx_id: UUID) -> Transaction | None:
        return await self._session.get(Transaction, tx_id)

    async def get_owned(self, user_id: UUID, tx_id: UUID) -> Transaction | None:
        stmt = select(Transaction).where(
            Transaction.id == tx_id,
            Transaction.user_id == user_id,
        )
        return await self._session.scalar(stmt)

    async def list_page(  # noqa: PLR0913
        self,
        *,
        user_id: UUID,
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
        """Страница транзакций (offset) + seller_name из чека + нарастающий баланс.

        Баланс — оконная функция по ВСЕМ транзакциям пользователя; фильтры,
        сортировка и пагинация применяются снаружи. offset-пагинация нужна
        бесконечному скроллу AG Grid (startRow/endRow), keyset её не умеет.
        """  # noqa: RUF002
        conditions: list[ColumnElement[bool]] = [
            Transaction.user_id == user_id,  # type: ignore[arg-type]
            *_filters(
                date_from=date_from,
                date_to=date_to,
                tag_id=tag_id,
                search=search,
                seller_name=seller_name,
            ),
        ]

        balance_subq = (
            select(
                Transaction.id.label("tx_id"),
                func.sum(
                    case(
                        (
                            Transaction.operation_type.in_(_INCOME_TYPES),
                            Transaction.amount,
                        ),
                        else_=-Transaction.amount,
                    ),
                )
                .over(order_by=[Transaction.check_datetime, Transaction.id])
                .label("balance"),
            )
            .where(Transaction.user_id == user_id)
            .subquery()
        )

        order_col: ColumnElement = _SORTABLE.get(sort_by, Transaction.check_datetime)  # type: ignore[assignment]
        if sort_by == "balance":
            order_col = balance_subq.c.balance
        order_expr = order_col.asc() if sort_dir == "asc" else order_col.desc()
        if sort_by in _NULLS_LAST:
            order_expr = nulls_last(order_expr)

        stmt = (
            select(Transaction, Receipt.seller_name, balance_subq.c.balance)
            .outerjoin(Receipt, Receipt.id == Transaction.receipt_id)
            .outerjoin(balance_subq, balance_subq.c.tx_id == Transaction.id)
            .where(*conditions)
            .order_by(order_expr, Transaction.id.desc())
            .limit(limit)
            .offset(offset)
        )
        rows = (await self._session.execute(stmt)).all()

        count_stmt = (
            select(func.count(Transaction.id))
            .outerjoin(Receipt, Receipt.id == Transaction.receipt_id)
            .where(*conditions)
        )
        total = int((await self._session.execute(count_stmt)).scalar_one())

        return [
            (tx, seller_name_, balance) for tx, seller_name_, balance in rows
        ], total

    async def aggregate(  # noqa: PLR0913
        self,
        *,
        user_id: UUID,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        tag_id: UUID | None = None,
        search: str | None = None,
        seller_name: str | None = None,
    ) -> tuple[Decimal, Decimal, int]:
        """income, expenses, count за период — SQL-агрегация с фильтрами."""  # noqa: RUF002
        stmt = (
            select(
                func.coalesce(
                    func.sum(Transaction.amount).filter(
                        Transaction.operation_type.in_(_INCOME_TYPES),
                    ),
                    0,
                ),
                func.coalesce(
                    func.sum(Transaction.amount).filter(
                        Transaction.operation_type.in_(_EXPENSE_TYPES),
                    ),
                    0,
                ),
                func.count(Transaction.id),
            )
            .outerjoin(Receipt, Receipt.id == Transaction.receipt_id)
            .where(
                Transaction.user_id == user_id,
                *_filters(
                    date_from=date_from,
                    date_to=date_to,
                    tag_id=tag_id,
                    search=search,
                    seller_name=seller_name,
                ),
            )
        )
        income, expenses, count = (await self._session.execute(stmt)).one()
        return Decimal(income or 0), Decimal(expenses or 0), int(count)

    async def opening_balance(self, user_id: UUID, before: datetime) -> Decimal:
        """Нетто-баланс всех транзакций ДО даты (без тег/поиск/магазин-фильтров).

        Нужен колонке «Баланс»: нарастающий итог периода стартует с него.
        """  # noqa: RUF002
        stmt = select(
            func.coalesce(
                func.sum(Transaction.amount).filter(
                    Transaction.operation_type.in_(_INCOME_TYPES),
                ),
                0,
            )
            - func.coalesce(
                func.sum(Transaction.amount).filter(
                    Transaction.operation_type.in_(_EXPENSE_TYPES),
                ),
                0,
            ),
        ).where(Transaction.user_id == user_id, Transaction.check_datetime < before)
        value = (await self._session.execute(stmt)).scalar_one()
        return Decimal(value or 0)

    async def daily_net(  # noqa: PLR0913
        self,
        *,
        user_id: UUID,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        tag_id: UUID | None = None,
        search: str | None = None,
        seller_name: str | None = None,
    ) -> list[tuple[str, Decimal]]:
        """День -> нетто, по возрастанию дней."""
        day = func.date(Transaction.check_datetime)
        stmt = (
            select(
                day,
                func.coalesce(
                    func.sum(Transaction.amount).filter(
                        Transaction.operation_type.in_(_INCOME_TYPES),
                    ),
                    0,
                )
                - func.coalesce(
                    func.sum(Transaction.amount).filter(
                        Transaction.operation_type.in_(_EXPENSE_TYPES),
                    ),
                    0,
                ),
            )
            .outerjoin(Receipt, Receipt.id == Transaction.receipt_id)
            .where(
                Transaction.user_id == user_id,
                *_filters(
                    date_from=date_from,
                    date_to=date_to,
                    tag_id=tag_id,
                    search=search,
                    seller_name=seller_name,
                ),
            )
            .group_by(day)
            .order_by(day)
        )
        rows = (await self._session.execute(stmt)).all()
        return [(str(day_), Decimal(net or 0)) for day_, net in rows]

    async def daily_breakdown(  # noqa: PLR0913
        self,
        *,
        user_id: UUID,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        tag_id: UUID | None = None,
        search: str | None = None,
        seller_name: str | None = None,
    ) -> list[tuple[str, Decimal, Decimal]]:
        """День -> для графика «Расходы по дням»."""
        day = func.date(Transaction.check_datetime)
        stmt = (
            select(
                day,
                func.coalesce(
                    func.sum(Transaction.amount).filter(
                        Transaction.operation_type.in_(_EXPENSE_TYPES),
                    ),
                    0,
                ),
                func.coalesce(
                    func.sum(Transaction.amount).filter(
                        Transaction.operation_type.in_(_INCOME_TYPES),
                    ),
                    0,
                ),
            )
            .outerjoin(Receipt, Receipt.id == Transaction.receipt_id)
            .where(
                Transaction.user_id == user_id,
                *_filters(
                    date_from=date_from,
                    date_to=date_to,
                    tag_id=tag_id,
                    search=search,
                    seller_name=seller_name,
                ),
            )
            .group_by(day)
            .order_by(day)
        )
        rows = (await self._session.execute(stmt)).all()
        return [(str(day_), Decimal(e or 0), Decimal(i or 0)) for day_, e, i in rows]

    async def by_store(  # noqa: PLR0913
        self,
        *,
        user_id: UUID,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        tag_id: UUID | None = None,
        search: str | None = None,
        seller_name: str | None = None,
    ) -> list[tuple[str, Decimal]]:
        """Магазин -> расходы, по убыванию."""
        store = func.coalesce(
            Transaction.normalized_seller_name,
            Receipt.normalized_seller_name,
        )
        stmt = (
            select(
                store,
                func.coalesce(
                    func.sum(Transaction.amount).filter(
                        Transaction.operation_type.in_(_EXPENSE_TYPES),
                    ),
                    0,
                ),
            )
            .outerjoin(Receipt, Receipt.id == Transaction.receipt_id)
            .where(
                Transaction.user_id == user_id,
                store.is_not(None),
                *_filters(
                    date_from=date_from,
                    date_to=date_to,
                    tag_id=tag_id,
                    search=search,
                    seller_name=seller_name,
                ),
            )
            .group_by(store)
            .order_by(
                func.sum(Transaction.amount)
                .filter(Transaction.operation_type.in_(_EXPENSE_TYPES))
                .desc(),
            )
        )
        rows = (await self._session.execute(stmt)).all()
        return [(str(s), Decimal(v or 0)) for s, v in rows]

    async def by_tag(  # noqa: PLR0913
        self,
        *,
        user_id: UUID,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        tag_id: UUID | None = None,
        search: str | None = None,
        seller_name: str | None = None,
    ) -> list[tuple[UUID, str, str, Decimal]]:
        """Тег -> сумма, по убыванию.

        Возвращает (tag_id, tag_name, tag_color, value).
        """  # noqa: RUF002
        stmt = (
            select(
                Transaction.tag_id,
                Tag.name,
                Tag.color,
                func.coalesce(func.sum(Transaction.amount), 0),
            )
            .join(Tag, Tag.id == Transaction.tag_id)
            .where(
                Transaction.user_id == user_id,
                Transaction.tag_id.is_not(None),
                *_filters(
                    date_from=date_from,
                    date_to=date_to,
                    tag_id=tag_id,
                    search=search,
                    seller_name=seller_name,
                ),
            )
            .group_by(Transaction.tag_id, Tag.name, Tag.color)
            .order_by(func.sum(Transaction.amount).desc())
        )
        rows = (await self._session.execute(stmt)).all()
        return [
            (UUID(str(tag_id_)), name, color, Decimal(v or 0))
            for tag_id_, name, color, v in rows
        ]

    async def distinct_sellers(self, user_id: UUID) -> list[str]:
        """Все магазины пользователя (свои + из чеков) — чипсы фильтра."""  # noqa: RUF002
        store = func.coalesce(
            Transaction.normalized_seller_name,
            Receipt.normalized_seller_name,
        )
        stmt = (
            select(store)
            .outerjoin(Receipt, Receipt.id == Transaction.receipt_id)
            .where(Transaction.user_id == user_id, store.is_not(None))
            .distinct()
            .order_by(store)
        )
        return [str(s) for s in (await self._session.scalars(stmt)).all()]

    async def update(self, tx: Transaction, **fields: object) -> Transaction:
        for field, value in fields.items():
            setattr(tx, field, value)
        await self._session.commit()
        await self._session.refresh(tx)
        return tx

    async def delete(self, tx: Transaction) -> None:
        await self._session.delete(tx)
        await self._session.commit()

    # ---------- применение алиасов ----------

    async def list_name_columns(self, user_id: UUID) -> list[tuple[UUID, str]]:
        """(id, name) всех транзакций пользователя — для применения
        товарных алиасов (один лёгкий запрос вместо N+1)."""
        stmt = select(Transaction.id, Transaction.name).where(
            Transaction.user_id == user_id,
        )
        return [(row[0], row[1]) for row in (await self._session.execute(stmt)).all()]

    async def list_seller_columns(self, user_id: UUID) -> list[tuple[UUID, str]]:
        """(id, исходное seller_name) ручных транзакций с магазином — для применения
        алиасов продавцов (у транзакций из чеков магазин живёт на чеке)."""  # noqa: RUF002
        stmt = select(Transaction.id, Transaction.seller_name).where(
            Transaction.user_id == user_id,
            Transaction.seller_name.is_not(None),
        )
        return [
            (row[0], row[1])
            for row in (await self._session.execute(stmt)).all()
            if row[1] is not None
        ]

    async def bulk_update_names(
        self,
        changes: list[tuple[UUID, str, str]],
    ) -> None:
        """Bulk-обновление normalized_name, не меняя исходное name.

        changes: (id, original_name, normalized_name). Исходное name хранится
        неизменно и позволяет пересчитать значение после удаления алиаса.
        """
        if not changes:
            return
        # Core-таблица: executemany без ORM-синхронизации сессии
        table = cast(Table, Transaction.__table__)
        stmt = (
            update(table)
            .where(table.c.id == bindparam("tx_id"))
            .values(
                normalized_name=bindparam("new_normalized"),
            )
        )
        await self._session.execute(
            stmt,
            [
                {"tx_id": tx_id, "new_normalized": normalized}
                for tx_id, _name, normalized in changes
            ],
        )
        await self._session.commit()

    async def bulk_update_sellers(
        self,
        changes: list[tuple[UUID, str]],
    ) -> None:
        """Bulk-обновление normalized_seller_name."""
        if not changes:
            return
        # Core-таблица: executemany без ORM-синхронизации сессии
        table = cast(Table, Transaction.__table__)
        stmt = (
            update(table)
            .where(table.c.id == bindparam("tx_id"))
            .values(normalized_seller_name=bindparam("new_seller"))
        )
        await self._session.execute(
            stmt,
            [{"tx_id": tx_id, "new_seller": seller} for tx_id, seller in changes],
        )
        await self._session.commit()
