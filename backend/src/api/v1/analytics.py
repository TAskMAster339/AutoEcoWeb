from datetime import date, datetime, time, timezone
from uuid import UUID

from fastapi import APIRouter, Query
from src.core.dependencies import CurrentUser, TransactionSvc
from src.schemas.analytics import AnalyticsResponse

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
    tag_id: UUID | None = Query(None),
    search: str | None = Query(None, max_length=255),
    seller_name: str | None = Query(None, max_length=255),
) -> AnalyticsResponse:
    """Аналитика за период: по дням, по магазинам, по тегам — считает SQL."""
    return await transaction_service.analytics(
        _current_user,
        date_from=_day_bounds(date_from, end_of_day=False) if date_from else None,
        date_to=_day_bounds(date_to, end_of_day=True) if date_to else None,
        tag_id=tag_id,
        search=search,
        seller_name=seller_name,
    )
