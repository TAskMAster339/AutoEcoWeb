import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
    String,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from src.models.base import BaseModel


class Receipt(BaseModel):
    __tablename__ = "receipts"
    __table_args__ = (
        Index("ix_receipts_user_created", "user_id", "created_at", "id"),
        Index(
            "uq_receipts_user_qr",
            "user_id",
            "qr",
            unique=True,
            postgresql_where=text("qr IS NOT NULL"),
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # Сырая строка QR ФНС: t=...&s=...&fn=...&i=...&fp=...&n=...
    qr: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
    )

    # «Чек № 48» — requestNumber из данных чека
    receipt_number: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
    )

    # 1 = приход, 2 = расход, 3/4 = возвраты
    operation_type: Mapped[int] = mapped_column(
        SmallInteger,
        default=1,
        nullable=False,
    )

    # Исходное имя продавца из чека — не меняется алиасами.
    seller_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # Отображаемое имя продавца после применения алиасов.
    normalized_seller_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    seller_inn: Mapped[str | None] = mapped_column(
        String(12),
        nullable=True,
    )

    check_datetime: Mapped[datetime] = mapped_column(
        "datetime",
        DateTime(timezone=True),
        nullable=False,
    )

    total_sum: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    cashback: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2),
        nullable=True,
    )

    balance_after: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2),
        nullable=True,
    )

    raw_json: Mapped[dict | None] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )
