import uuid

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from src.models.base import BaseModel


class Tag(BaseModel):
    __tablename__ = "tags"
    __table_args__ = (
        Index("ix_tags_user_created", "user_id", "created_at", "id"),
        UniqueConstraint("user_id", "name", name="uq_tags_user_name"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    color: Mapped[str] = mapped_column(
        String(7),
        nullable=False,
    )

    icon: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )
