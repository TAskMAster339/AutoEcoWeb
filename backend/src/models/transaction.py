import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column
from src.models.base import BaseModel


class Transaction(BaseModel):
    """Минимальная единица учёта: одна операция (покупка/доход).

    Может принадлежать чеку (receipt_id — «коробка»), а может быть
    самостоятельной (введена пользователем вручную, receipt_id = None).
    """

    __tablename__ = "transactions"
    __table_args__ = (
        Index("ix_transactions_receipt", "receipt_id"),
        Index("ix_transactions_tag", "tag_id"),
        Index("ix_transactions_user_created", "user_id", "created_at", "id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # «Коробка»: чек, из которого пришла транзакция; None — ручная
    receipt_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("receipts.id", ondelete="CASCADE"),
        nullable=True,
    )

    # Магазин ручной транзакции; у транзакций из чеков берётся из чека (None)
    seller_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    normalized_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # Порядок в чеке (0, 1, 2, …); None для ручных транзакций
    position: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    quantity: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 3),
        nullable=True,
    )

    unit: Mapped[str | None] = mapped_column(
        String(16),
        nullable=True,
    )

    price: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2),
        nullable=True,
    )

    # Денежная сумма транзакции (бывш. total_price позиции)
    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    # 1 = приход/покупка (расход), 2 = расход/возврат (доход), 3/4 = возвраты
    operation_type: Mapped[int] = mapped_column(
        SmallInteger,
        default=1,
        nullable=False,
    )

    check_datetime: Mapped[datetime] = mapped_column(
        "datetime",
        DateTime(timezone=True),
        nullable=False,
    )

    tag_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("tags.id", ondelete="SET NULL"),
        nullable=True,
    )
