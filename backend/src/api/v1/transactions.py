from datetime import date, datetime, time, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Query, status
from src.core.dependencies import CurrentUser, TransactionSvc
from src.schemas.pagination import CursorPage
from src.schemas.transaction import (
    StoreResponse,
    TransactionCreate,
    TransactionOut,
    TransactionSummary,
    TransactionUpdate,
)

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


def _day_bounds(day: date, end_of_day: bool) -> datetime:  # noqa: FBT001
    if end_of_day:
        return datetime.combine(day, time.max, tzinfo=timezone.utc)
    return datetime.combine(day, time.min, tzinfo=timezone.utc)


@router.get("", response_model=CursorPage[TransactionOut])
async def list_transactions(  # noqa: PLR0913
    _current_user: CurrentUser,
    transaction_service: TransactionSvc,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    date_from: date | None = Query(None),  # noqa: B008
    date_to: date | None = Query(None),  # noqa: B008
    tag_id: UUID | None = Query(None),  # noqa: B008
    search: str | None = Query(None, max_length=255),
    seller_name: str | None = Query(None, max_length=255),
    sort_by: Literal[
        "date",
        "name",
        "store",
        "quantity",
        "price",
        "income",
        "expense",
        "balance",
        "comment",
    ] = "date",
    sort_dir: Literal["asc", "desc"] = "asc",
) -> CursorPage[TransactionOut]:
    """Страница транзакций: offset-пагинация (для бесконечного скролла),
    все фильтры считаются в БД, баланс строки — оконная функция."""
    rows, total = await transaction_service.list_page(
        _current_user,
        limit=limit,
        offset=offset,
        date_from=_day_bounds(date_from, end_of_day=False) if date_from else None,
        date_to=_day_bounds(date_to, end_of_day=True) if date_to else None,
        tag_id=tag_id,
        search=search,
        seller_name=seller_name,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    return CursorPage[TransactionOut](
        items=[
            TransactionOut.from_model(tx, seller_name=seller_name_, balance=balance)
            for tx, seller_name_, balance in rows
        ],
        total=total,
    )


@router.get("/summary", response_model=TransactionSummary)
async def get_summary(  # noqa: PLR0913
    _current_user: CurrentUser,
    transaction_service: TransactionSvc,
    date_from: date | None = Query(None),  # noqa: B008
    date_to: date | None = Query(None),  # noqa: B008
    tag_id: UUID | None = Query(None),  # noqa: B008
    search: str | None = Query(None, max_length=255),
    seller_name: str | None = Query(None, max_length=255),
) -> TransactionSummary:
    """Показатели за период (или за всё время, если дат нет) — считает SQL."""
    return await transaction_service.summary(
        _current_user,
        date_from=_day_bounds(date_from, end_of_day=False) if date_from else None,
        date_to=_day_bounds(date_to, end_of_day=True) if date_to else None,
        tag_id=tag_id,
        search=search,
        seller_name=seller_name,
    )


@router.get("/stores", response_model=list[StoreResponse])
async def list_stores(
    _current_user: CurrentUser,
    transaction_service: TransactionSvc,
) -> list[StoreResponse]:
    """Все магазины пользователя (свои + из чеков) — для фильтра."""  # noqa: RUF002
    return await transaction_service.stores(_current_user)


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    data: TransactionCreate,
    _current_user: CurrentUser,
    transaction_service: TransactionSvc,
) -> TransactionOut:
    """Ручная транзакция без чека — минимальная единица учёта."""
    tx = await transaction_service.create_standalone(_current_user, data)
    return TransactionOut.from_model(tx)


@router.patch("/{transaction_id}", response_model=TransactionOut)
async def update_transaction(
    transaction_id: UUID,
    data: TransactionUpdate,
    _current_user: CurrentUser,
    transaction_service: TransactionSvc,
) -> TransactionOut:
    tx = await transaction_service.update(_current_user, transaction_id, data)
    return TransactionOut.from_model(tx)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: UUID,
    _current_user: CurrentUser,
    transaction_service: TransactionSvc,
) -> None:
    await transaction_service.delete(_current_user, transaction_id)
