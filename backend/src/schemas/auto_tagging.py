from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

AutoTaggingStatus = Literal[
    "disabled",
    "insufficient_data",
    "stale",
    "training",
    "ready",
    "degraded",
    "error",
]


class AutoTaggingSettingsUpdate(BaseModel):
    enabled: bool


class AutoTaggingTagMetric(BaseModel):
    tag_id: UUID
    tag_name: str
    training_examples: int
    validation_examples: int
    precision: float | None = None
    recall: float | None = None
    supported: bool


class AutoTaggingStatusResponse(BaseModel):
    enabled: bool
    status: AutoTaggingStatus
    current_revision: int
    trained_revision: int | None = None
    algorithm_version: str
    trained_at: datetime | None = None
    training_examples: int
    validation_examples: int
    distinct_tags: int
    supported_tags: int
    minimum_training_examples: int
    minimum_examples_per_tag: int
    target_precision: float
    precision: float | None = None
    coverage: float | None = None
    macro_f1: float | None = None
    store_baseline_precision: float | None = None
    threshold: float | None = None
    per_tag_metrics: list[AutoTaggingTagMetric] = Field(default_factory=list)
