from datetime import datetime as dt
from datetime import timezone
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator
from src.models.receipt import Receipt
from src.models.receipt_item import ReceiptItem
from src.services.receipt_parser import (
    NormalizedReceipt,
    ReceiptItemData,
    ReceiptParseError,
    normalize_product_name,
    normalize_proverkacheka,
)


class ReceiptItemOut(BaseModel):
    """Позиция чека: preview (id/tag_id = None) и сохранённая (из БД)."""

    id: UUID | None = None
    product_name: str
    normalized_name: str
    quantity: Decimal
    unit: str = "шт"
    price: Decimal
    total_price: Decimal
    nds: int | None = None
    tag_id: UUID | None = None

    @classmethod
    def from_parsed(cls, item: ReceiptItemData) -> "ReceiptItemOut":
        return cls(
            product_name=item.name,
            normalized_name=normalize_product_name(item.name),
            quantity=item.quantity,
            unit=item.unit,
            price=item.price,
            total_price=item.sum,
            nds=item.nds,
        )

    @classmethod
    def from_model(cls, item: ReceiptItem) -> "ReceiptItemOut":
        return cls(
            id=item.id,
            product_name=item.product_name,
            normalized_name=item.normalized_name,
            quantity=item.quantity,
            unit=item.unit,
            price=item.price,
            total_price=item.total_price,
            tag_id=item.tag_id,
        )


class ReceiptParseRequest(BaseModel):
    qr: str | None = Field(default=None, max_length=512)
    raw_json: dict | None = None

    @model_validator(mode="after")
    def _strip_qr(self) -> "ReceiptParseRequest":
        if self.qr is not None:
            self.qr = self.qr.strip() or None
        return self


class ReceiptCreate(ReceiptParseRequest):
    cashback: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    balance_after: Decimal | None = Field(
        default=None,
        max_digits=12,
        decimal_places=2,
    )


class ReceiptUpdate(BaseModel):
    """Точечное обновление чека: применяются только присланные поля.

    qr/raw_json не редактируются (qr — ключ дедупликации).
    """

    receipt_number: str | None = Field(default=None, max_length=64)
    operation_type: int | None = Field(default=None, ge=1, le=4)
    seller_name: str | None = Field(default=None, min_length=1, max_length=255)
    seller_inn: str | None = Field(default=None, max_length=12)
    check_datetime: dt | None = None
    total_sum: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    cashback: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    balance_after: Decimal | None = Field(
        default=None,
        max_digits=12,
        decimal_places=2,
    )


class ReceiptItemUpdate(BaseModel):
    """Точечное обновление позиции: применяются только присланные поля.

    position (порядок в чеке) не редактируется.
    """

    product_name: str | None = Field(default=None, min_length=1, max_length=255)
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
    total_price: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    tag_id: UUID | None = None


class ReceiptItemManualIn(BaseModel):
    """Позиция ручного чека: total_price = price * quantity, если не задан."""

    product_name: str = Field(min_length=1, max_length=255)
    quantity: Decimal = Field(
        default=Decimal("1"),
        ge=0,
        max_digits=12,
        decimal_places=3,
    )
    unit: str = Field(default="шт", min_length=1, max_length=16)
    price: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    total_price: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )

    @model_validator(mode="after")
    def _default_total(self) -> "ReceiptItemManualIn":
        if self.total_price is None:
            self.total_price = self.price * self.quantity
        return self


class ReceiptManualCreate(BaseModel):
    seller_name: str = Field(min_length=1, max_length=255)
    total_sum: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    check_datetime: dt = Field(
        default_factory=lambda: dt.now(timezone.utc),
    )
    receipt_number: str | None = Field(default=None, max_length=64)
    seller_inn: str | None = Field(default=None, max_length=12)
    operation_type: int = Field(default=1, ge=1, le=4)
    cashback: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    balance_after: Decimal | None = Field(
        default=None,
        max_digits=12,
        decimal_places=2,
    )
    items: list[ReceiptItemManualIn] | None = None


class ReceiptItemsManualCreate(BaseModel):
    items: list[ReceiptItemManualIn] = Field(min_length=1)


class ReceiptPreviewOut(BaseModel):
    qr: str | None
    receipt_number: str | None
    operation_type: int
    seller_name: str
    seller_inn: str | None
    datetime: dt
    total_sum: Decimal
    items: list[ReceiptItemOut]

    @classmethod
    def from_normalized(
        cls,
        receipt: NormalizedReceipt,
        seller_name: str,
    ) -> "ReceiptPreviewOut":
        return cls(
            qr=receipt.qr,
            receipt_number=receipt.receipt_number,
            operation_type=receipt.operation_type,
            seller_name=seller_name,
            seller_inn=receipt.seller_inn,
            datetime=receipt.check_datetime,
            total_sum=receipt.total_sum,
            items=[ReceiptItemOut.from_parsed(item) for item in receipt.items],
        )


class ReceiptResponse(ReceiptPreviewOut):
    id: UUID
    cashback: Decimal | None = None
    balance_after: Decimal | None = None
    created_at: dt

    @classmethod
    def from_model(
        cls,
        receipt: Receipt,
        items: list[ReceiptItem] | None = None,
    ) -> "ReceiptResponse":
        if items is None:
            parsed_items: list[ReceiptItemOut] = []
            if receipt.raw_json:
                # Легаси-чеки, созданные до появления таблицы receipt_items
                try:
                    parsed_items = [
                        ReceiptItemOut.from_parsed(item)
                        for item in normalize_proverkacheka(receipt.raw_json).items
                    ]
                except ReceiptParseError:
                    parsed_items = []
        else:
            parsed_items = [ReceiptItemOut.from_model(item) for item in items]
        return cls(
            id=receipt.id,
            qr=receipt.qr,
            receipt_number=receipt.receipt_number,
            operation_type=receipt.operation_type,
            seller_name=receipt.seller_name,
            seller_inn=receipt.seller_inn,
            datetime=receipt.check_datetime,
            total_sum=receipt.total_sum,
            cashback=receipt.cashback,
            balance_after=receipt.balance_after,
            created_at=receipt.created_at,
            items=parsed_items,
        )
