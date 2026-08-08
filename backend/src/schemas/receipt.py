from datetime import datetime as dt
from datetime import timezone
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator
from src.models.receipt import Receipt
from src.schemas.transaction import TransactionManualIn, TransactionOut
from src.services.receipt_parser import (
    NormalizedReceipt,
    ReceiptParseError,
    normalize_proverkacheka,
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
    transactions: list[TransactionManualIn] | None = None


class ReceiptPreviewOut(BaseModel):
    qr: str | None
    receipt_number: str | None
    operation_type: int
    seller_name: str
    seller_inn: str | None
    datetime: dt
    total_sum: Decimal
    transactions: list[TransactionOut]

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
            transactions=[
                TransactionOut.from_parsed(item, datetime=receipt.check_datetime)
                for item in receipt.items
            ],
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
        transactions: list | None = None,
    ) -> "ReceiptResponse":
        if transactions is None:
            parsed: list[TransactionOut] = []
            if receipt.raw_json:
                # Легаси-чеки, созданные до появления транзакций
                try:
                    parsed = [
                        TransactionOut.from_parsed(
                            item,
                            datetime=receipt.check_datetime,
                        )
                        for item in normalize_proverkacheka(receipt.raw_json).items
                    ]
                except ReceiptParseError:
                    parsed = []
        else:
            parsed = [TransactionOut.from_model(tx) for tx in transactions]
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
            transactions=parsed,
        )
