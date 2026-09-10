import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.models.base import BaseModel

DEFAULT_MAX_TAGS = 25
DEFAULT_MAX_SELLER_ALIASES = 100
DEFAULT_MAX_PRODUCT_ALIASES = 100
DEFAULT_MAX_RECEIPTS = 10_000
DEFAULT_MAX_TRANSACTIONS = 50_000
DEFAULT_MAX_RECEIPT_ITEMS = 500
DEFAULT_MAX_IMPORT_ROWS = 5_000


class UserLimits(BaseModel):
    """Per-user creation quotas. Existing data is never removed on reduction."""

    __tablename__ = "user_limits"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_limits_user_id"),
        CheckConstraint("max_tags >= 0", name="ck_user_limits_max_tags_nonnegative"),
        CheckConstraint(
            "max_seller_aliases >= 0",
            name="ck_user_limits_max_seller_aliases_nonnegative",
        ),
        CheckConstraint(
            "max_product_aliases >= 0",
            name="ck_user_limits_max_product_aliases_nonnegative",
        ),
        CheckConstraint("max_receipts >= 0", name="ck_user_limits_max_receipts_nonnegative"),
        CheckConstraint(
            "max_transactions >= 0",
            name="ck_user_limits_max_transactions_nonnegative",
        ),
        CheckConstraint(
            "max_receipt_items >= 0",
            name="ck_user_limits_max_receipt_items_nonnegative",
        ),
        CheckConstraint(
            "max_import_rows >= 0",
            name="ck_user_limits_max_import_rows_nonnegative",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    max_tags: Mapped[int] = mapped_column(Integer, default=DEFAULT_MAX_TAGS, nullable=False)
    max_seller_aliases: Mapped[int] = mapped_column(
        Integer,
        default=DEFAULT_MAX_SELLER_ALIASES,
        nullable=False,
    )
    max_product_aliases: Mapped[int] = mapped_column(
        Integer,
        default=DEFAULT_MAX_PRODUCT_ALIASES,
        nullable=False,
    )
    max_receipts: Mapped[int] = mapped_column(
        Integer,
        default=DEFAULT_MAX_RECEIPTS,
        nullable=False,
    )
    max_transactions: Mapped[int] = mapped_column(
        Integer,
        default=DEFAULT_MAX_TRANSACTIONS,
        nullable=False,
    )
    max_receipt_items: Mapped[int] = mapped_column(
        Integer,
        default=DEFAULT_MAX_RECEIPT_ITEMS,
        nullable=False,
    )
    max_import_rows: Mapped[int] = mapped_column(
        Integer,
        default=DEFAULT_MAX_IMPORT_ROWS,
        nullable=False,
    )

    user = relationship("User", back_populates="limits")
