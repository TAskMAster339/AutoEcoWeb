from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class AnalyticsDaily(BaseModel):
    day: str
    expenses: Decimal
    income: Decimal
    count: int = 0
    # Значение линейного тренда (МНК) для дня; None, когда точек < 2
    trend: Decimal | None = None


class AnalyticsByStore(BaseModel):
    store: str
    value: Decimal


class AnalyticsByCategory(BaseModel):
    tag_id: UUID
    tag_name: str
    tag_color: str
    value: Decimal
    count: int = 0


class AnalyticsWeekday(BaseModel):
    # 1..7, ISO (1 = Пн)
    weekday: int
    value: Decimal
    count: int


class AnalyticsIndicators(BaseModel):
    top_store: AnalyticsByStore | None = None
    top_category: AnalyticsByCategory | None = None
    top_weekday: AnalyticsWeekday | None = None
    top_income_source: AnalyticsByStore | None = None


class AnalyticsResponse(BaseModel):
    daily: list[AnalyticsDaily] = Field(default_factory=list)
    by_store: list[AnalyticsByStore] = Field(default_factory=list)
    by_store_income: list[AnalyticsByStore] = Field(default_factory=list)
    by_category: list[AnalyticsByCategory] = Field(default_factory=list)
    by_weekday: list[AnalyticsWeekday] = Field(default_factory=list)
    indicators: AnalyticsIndicators = Field(default_factory=AnalyticsIndicators)


class PricePoint(BaseModel):
    day: str
    # Средняя цена за день в магазине
    price: Decimal
    count: int
    store: str | None


class PriceChartResponse(BaseModel):
    points: list[PricePoint] = Field(default_factory=list)
    # Уникальные магазины в порядке появления (для легенды/палитры)
    stores: list[str | None] = Field(default_factory=list)
    avg_price: Decimal
    median_price: Decimal
    stddev: Decimal
    count: int = 0
