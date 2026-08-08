from datetime import datetime as dt
from datetime import timezone
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator
from src.models.transaction import Transaction
from src.services.receipt_parser import (
    ReceiptItemData,
    normalize_product_name,
)


def _now_utc() -> dt:
    return dt.now(timezone.utc)


class TransactionOut(BaseModel):
    """Транзакция: сохранённая (из БД) или превью (id/tag_id = None).

    seller_name: собственное поле ручной транзакции; для транзакций
    из чеков поле пустое и продавец подтягивается из чека (left join).
    """

    id: UUID | None = None
    receipt_id: UUID | None = None
    name: str
    normalized_name: str
    position: int | None = None
    quantity: Decimal | None = None
    unit: str | None = None
    price: Decimal | None = None
    amount: Decimal
    operation_type: int = 1
    datetime: dt
    tag_id: UUID | None = None
    seller_name: str | None = None
    created_at: dt | None = None

    @classmethod
    def from_parsed(
        cls,
        item: ReceiptItemData,
        datetime: dt | None = None,
    ) -> "TransactionOut":
        return cls(
            name=item.name,
            normalized_name=normalize_product_name(item.name),
            quantity=item.quantity,
            unit=item.unit,
            price=item.price,
            amount=item.sum,
            datetime=datetime if datetime is not None else _now_utc(),
        )

    @classmethod
    def from_model(
        cls,
        tx: Transaction,
        seller_name: str | None = None,
    ) -> "TransactionOut":
        """seller_name: переданный (из чека) используется как fallback,
        если у самой транзакции своего магазина нет."""
        return cls(
            id=tx.id,
            receipt_id=tx.receipt_id,
            name=tx.name,
            normalized_name=tx.normalized_name,
            position=tx.position,
            quantity=tx.quantity,
            unit=tx.unit,
            price=tx.price,
            amount=tx.amount,
            operation_type=tx.operation_type,
            datetime=tx.check_datetime,
            tag_id=tx.tag_id,
            seller_name=tx.seller_name if tx.seller_name is not None else seller_name,
            created_at=tx.created_at,
        )


class TransactionCreate(BaseModel):
    """Ручная транзакция без чека (POST /api/v1/transactions)."""

    name: str = Field(min_length=1, max_length=255)
    seller_name: str | None = Field(default=None, min_length=1, max_length=255)
    amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    quantity: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=3,
    )
    unit: str | None = Field(default=None, min_length=1, max_length=16)
    price: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    operation_type: int = Field(default=1, ge=1, le=4)
    datetime: dt = Field(default_factory=_now_utc)
    tag_id: UUID | None = None

    @model_validator(mode="after")
    def _strip_name(self) -> "TransactionCreate":
        self.name = self.name.strip()
        # пустая строка магазина — то же, что «не указан»
        if self.seller_name is not None:
            self.seller_name = self.seller_name.strip() or None
        return self


class TransactionUpdate(BaseModel):
    """Точечное обновление транзакции: применяются только присланные поля.

    receipt_id и position не редактируются (перемещение между чеками —
    вне скоупа); normalized_name пересчитывается из name.
    """

    name: str | None = Field(default=None, min_length=1, max_length=255)
    seller_name: str | None = Field(default=None, min_length=1, max_length=255)
    quantity: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=3,
    )
    unit: str | None = Field(default=None, min_length=1, max_length=16)
    price: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    amount: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    operation_type: int | None = Field(default=None, ge=1, le=4)
    datetime: dt | None = None
    tag_id: UUID | None = None


class TransactionInReceipt(BaseModel):
    """Транзакция, добавляемая в существующий чек (POST /receipts/{id}/transactions)."""

    name: str = Field(min_length=1, max_length=255)
    amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    quantity: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=3,
    )
    unit: str | None = Field(default=None, min_length=1, max_length=16)
    price: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    tag_id: UUID | None = None

    @model_validator(mode="after")
    def _strip_name(self) -> "TransactionInReceipt":
        self.name = self.name.strip()
        return self


class TransactionManualIn(BaseModel):
    """Позиция ручного чека (POST /receipts/manual): amount = price * quantity, если не задан."""

    name: str = Field(min_length=1, max_length=255)
    quantity: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=3,
    )
    unit: str | None = Field(default=None, min_length=1, max_length=16)
    price: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    amount: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )

    @model_validator(mode="after")
    def _default_amount(self) -> "TransactionManualIn":
        if self.amount is None:
            price = self.price if self.price is not None else Decimal("0")
            quantity = self.quantity if self.quantity is not None else Decimal("1")
            self.amount = price * quantity
        return self
