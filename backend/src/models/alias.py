import uuid

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column
from src.models.base import BaseModel


class Alias(BaseModel):

    __tablename__ = "aliases"
    __table_args__ = (
        Index("ix_aliases_user_created", "user_id", "created_at", "id"),
        UniqueConstraint(
            "user_id",
            "original_name",
            "alias_name",
            name="uq_aliases_user_pair",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    original_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    alias_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    is_regex: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    priority: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
