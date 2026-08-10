from datetime import date, datetime, time, timezone
from uuid import UUID

from fastapi import APIRouter, Query
from src.core.dependencies import CurrentUser, TransactionSvc
from src.schemas.analytics import AnalyticsResponse, PriceChartResponse

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


def _day_bounds(day: date, end_of_day: bool) -> datetime:  # noqa: FBT001
    if end_of_day:
        return datetime.combine(day, time.max, tzinfo=timezone.utc)
    return datetime.combine(day, time.min, tzinfo=timezone.utc)


@router.get("", response_model=AnalyticsResponse)
async def get_analytics(  # noqa: PLR0913
    _current_user: CurrentUser,
    transaction_service: TransactionSvc,
    date_from: date | None = Query(None),  # noqa: B008
    date_to: date | None = Query(None),  # noqa: B008
    tag_ids: list[UUID] | None = Query(None),  # noqa: B008
    search: str | None = Query(None, max_length=255),
    seller_names: list[str] | None = Query(None, max_length=255),  # noqa: B008
) -> AnalyticsResponse:
    """Аналитика за период: по дням, магазинам, категориям — считает SQL."""
    return await transaction_service.analytics(
        _current_user,
        date_from=_day_bounds(date_from, end_of_day=False) if date_from else None,
        date_to=_day_bounds(date_to, end_of_day=True) if date_to else None,
        tag_ids=tag_ids,
        search=search,
        seller_names=seller_names,
    )


@router.get("/price-chart", response_model=PriceChartResponse)
async def get_price_chart(  # noqa: PLR0913
    _current_user: CurrentUser,
    transaction_service: TransactionSvc,
    name: str = Query(min_length=1, max_length=255),  # noqa: B008
    is_regex: bool = Query(False),  # noqa: B008
    date_from: date | None = Query(None),  # noqa: B008
    date_to: date | None = Query(None),  # noqa: B008
) -> PriceChartResponse:
    """График цен товара (подстрока или regex) — считает бэкенд."""
    return await transaction_service.price_chart(
        _current_user,
        name=name,
        is_regex=is_regex,
        date_from=_day_bounds(date_from, end_of_day=False) if date_from else None,
        date_to=_day_bounds(date_to, end_of_day=True) if date_to else None,
    )
