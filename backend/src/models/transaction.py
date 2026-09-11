import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.models.alias import Alias
from src.models.base import BaseModel
from src.models.seller import Seller


class Transaction(BaseModel):
    """Минимальная единица учёта: одна операция (покупка/доход).

    Может принадлежать чеку (receipt_id — «коробка»), а может быть
    самостоятельной (введена пользователем вручную, receipt_id = None).
    """  # noqa: RUF002

    __tablename__ = "transactions"
    __table_args__ = (
        Index("ix_transactions_receipt", "receipt_id"),
        Index("ix_transactions_tag", "tag_id"),
        Index("ix_transactions_user_created", "user_id", "created_at", "id"),
        Index("ix_transactions_name_alias_id", "name_alias_id"),
        Index("ix_transactions_seller_id", "seller_id"),
        Index(
            "ix_transactions_user_tag_source_updated",
            "user_id",
            "tag_source",
            "updated_at",
        ),
        CheckConstraint(
            "tag_source IS NULL OR tag_source IN ('manual', 'auto')",
            name="ck_transactions_tag_source",
        ),
        CheckConstraint(
            "tag_confidence IS NULL OR (tag_confidence >= 0 AND tag_confidence <= 1)",
            name="ck_transactions_tag_confidence",
        ),
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

    seller_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("sellers.id", ondelete="SET NULL"),
        nullable=True,
    )
    seller: Mapped[Seller | None] = relationship("Seller", lazy="joined")

    name_alias_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("aliases.id", ondelete="SET NULL"),
        nullable=True,
    )
    name_alias: Mapped[Alias | None] = relationship(
        "Alias",
        foreign_keys=[name_alias_id],
        lazy="joined",
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

    # Необязательный комментарий пользователя; по умолчанию пустой
    comment: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
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

    # Источник текущего тега. Автоматические назначения не используются
    # как обучающие примеры, пока пользователь не заменит тег вручную.
    tag_source: Mapped[str | None] = mapped_column(String(16), nullable=True)
    tag_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
