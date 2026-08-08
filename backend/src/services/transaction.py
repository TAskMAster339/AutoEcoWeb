from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from src.core.cursor import decode_cursor, encode_cursor
from src.models.receipt import Receipt
from src.models.transaction import Transaction
from src.models.user import User
from src.repositories.receipt import ReceiptRepository
from src.repositories.tag import TagRepository
from src.repositories.transaction import TransactionRepository
from src.schemas.transaction import (
    TransactionCreate,
    TransactionInReceipt,
    TransactionManualIn,
    TransactionUpdate,
)
from src.services.receipt_parser import ReceiptItemData, normalize_product_name

# NOT NULL колонки transactions: явный null в PATCH → 422.
# tag_id НЕ входит в набор — явный null снимает тег (легальная операция).
_TRANSACTION_NON_NULLABLE = frozenset(
    {"name", "amount", "operation_type", "datetime"}
)


class TransactionService:
    """Транзакции — минимальная единица учёта.

    Транзакция может быть привязана к чеку («коробке») или существовать
    сама по себе (ручной ввод). Владение — напрямую по user_id.
    """

    def __init__(
        self,
        tx_repo: TransactionRepository,
        receipt_repo: ReceiptRepository | None = None,
        tag_repo: TagRepository | None = None,
    ) -> None:
        self._tx_repo = tx_repo
        self._receipt_repo = receipt_repo
        self._tag_repo = tag_repo

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
        position = max((t.position for t in existing if t.position is not None), default=-1) + 1
        tx = Transaction(
            user_id=user.id,
            receipt_id=receipt_id,
            position=position,
            name=data.name,
            normalized_name=normalize_product_name(data.name),
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
        tx = Transaction(
            user_id=user.id,
            receipt_id=None,
            position=None,
            name=data.name,
            normalized_name=normalize_product_name(data.name),
            seller_name=data.seller_name,
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

    # ---------- чтение / обновление / удаление ----------

    async def list_all(  # noqa: PLR0913
        self,
        user: User,
        *,
        limit: int,
        cursor: str | None,
        date_from: datetime | None,
        date_to: datetime | None,
        tag_id: UUID | None,
        search: str | None,
    ) -> tuple[list[tuple[Transaction, str | None]], str | None]:
        cursor_tuple = decode_cursor(cursor) if cursor is not None else None
        rows = await self._tx_repo.list_cursor(
            user_id=user.id,
            limit=limit + 1,  # +1 строка = детект «есть ещё»
            cursor=cursor_tuple,
            date_from=date_from,
            date_to=date_to,
            tag_id=tag_id,
            search=search,
        )
        has_more = len(rows) > limit
        rows = rows[:limit]
        next_cursor = (
            encode_cursor(rows[-1][0].created_at, rows[-1][0].id)
            if has_more and rows
            else None
        )
        return rows, next_cursor

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
