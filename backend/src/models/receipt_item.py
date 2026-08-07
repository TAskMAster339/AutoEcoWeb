import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Index, Integer, Numeric, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from src.models.base import BaseModel


class ReceiptItem(BaseModel):
    __tablename__ = "receipt_items"
    __table_args__ = (
        Index("ix_receipt_items_receipt", "receipt_id"),
        Index("ix_receipt_items_tag", "tag_id"),
    )

    receipt_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("receipts.id", ondelete="CASCADE"),
        nullable=False,
    )

    product_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    normalized_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # Порядок позиции в чеке (0, 1, 2, …) — из items[] ответа proverkacheka
    position: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        default=1,
        nullable=False,
    )

    unit: Mapped[str] = mapped_column(
        String(16),
        default="шт",
        nullable=False,
    )

    price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    total_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    tag_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("tags.id", ondelete="SET NULL"),
        nullable=True,
    )
