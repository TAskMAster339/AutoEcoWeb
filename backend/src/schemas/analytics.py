from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class AnalyticsDaily(BaseModel):
    day: str
    expenses: Decimal
    income: Decimal


class AnalyticsByStore(BaseModel):
    store: str
    value: Decimal


class AnalyticsByTag(BaseModel):
    tag_id: UUID
    tag_name: str
    tag_color: str
    value: Decimal


class AnalyticsResponse(BaseModel):
    daily: list[AnalyticsDaily] = Field(default_factory=list)
    by_store: list[AnalyticsByStore] = Field(default_factory=list)
    by_tag: list[AnalyticsByTag] = Field(default_factory=list)
