import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from src.models.base import BaseModel


class AutoTaggingModelState(BaseModel):
    """Persisted metadata for a derived in-memory personal model."""

    __tablename__ = "auto_tagging_model_states"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(32), default="stale", nullable=False)
    algorithm_version: Mapped[str] = mapped_column(String(32), nullable=False)
    trained_revision: Mapped[int] = mapped_column(Integer, default=-1, nullable=False)
    trained_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    training_examples: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    validation_examples: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    distinct_tags: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    supported_tags: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    precision: Mapped[float | None] = mapped_column(Float)
    coverage: Mapped[float | None] = mapped_column(Float)
    macro_f1: Mapped[float | None] = mapped_column(Float)
    store_baseline_precision: Mapped[float | None] = mapped_column(Float)
    threshold: Mapped[float | None] = mapped_column(Float)
    per_tag_metrics: Mapped[list[dict]] = mapped_column(JSON, default=list, nullable=False)
