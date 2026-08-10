import uuid

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.models.alias import Alias
from src.models.base import BaseModel


class Seller(BaseModel):
    """Магазин: immutable source name plus alias-resolved display value."""

    __tablename__ = "sellers"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_sellers_user_name"),
        Index("ix_sellers_user_created", "user_id", "created_at", "id"),
        Index("ix_sellers_seller_alias_id", "seller_alias_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False)
    seller_alias_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("aliases.id", ondelete="SET NULL"),
        nullable=True,
    )
    seller_alias: Mapped[Alias | None] = relationship(
        "Alias",
        foreign_keys=[seller_alias_id],
        lazy="joined",
    )
