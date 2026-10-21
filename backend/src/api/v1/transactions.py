import base64
import binascii
from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from src.core.dependencies import CurrentUser, TransactionSvc
from src.schemas.pagination import CursorPage
from src.schemas.transaction import (
    StoreResponse,
    TransactionCreate,
    TransactionBulkUpdate,
    TransactionBulkUpdateResult,
    TransactionOut,
    TransactionSummary,
    TransactionUpdate,
)

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


def _encode_cursor(value: datetime, transaction_id: UUID) -> str:
    raw = f"{value.isoformat()}|{transaction_id}".encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        timestamp, transaction_id = base64.urlsafe_b64decode(padded).decode().split("|", 1)
        return datetime.fromisoformat(timestamp), UUID(transaction_id)
    except (ValueError, UnicodeDecodeError, binascii.Error) as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid cursor") from error


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
    cursor: str | None = Query(None, max_length=256),
    include_total: bool = Query(True),
    date_from: date | None = Query(None),  # noqa: B008
    date_to: date | None = Query(None),  # noqa: B008
    tag_ids: list[UUID] | None = Query(None),  # noqa: B008
    untagged: bool = Query(False),
    search: str | None = Query(None, max_length=255),
    seller_names: list[str] | None = Query(None, max_length=255),  # noqa: B008
    amount_min: Decimal | None = Query(None, ge=0),  # noqa: B008
    amount_max: Decimal | None = Query(None, ge=0),  # noqa: B008
    operation_kind: Literal["income", "expense"] | None = Query(None),
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
    if cursor is not None and (offset != 0 or sort_by != "date" or sort_dir != "asc"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Cursor requires offset=0 and date ascending sort",
        )
    after_datetime, after_id = _decode_cursor(cursor) if cursor is not None else (None, None)
    rows, total = await transaction_service.list_page(
        _current_user,
        limit=limit,
        offset=offset,
        date_from=_day_bounds(date_from, end_of_day=False) if date_from else None,
        date_to=_day_bounds(date_to, end_of_day=True) if date_to else None,
        tag_ids=tag_ids,
        untagged=untagged,
        search=search,
        seller_names=seller_names,
        amount_min=amount_min,
        amount_max=amount_max,
        operation_kind=operation_kind,
        sort_by=sort_by,
        sort_dir=sort_dir,
        after_datetime=after_datetime,
        after_id=after_id,
        include_total=include_total,
    )
    next_cursor = None
    if sort_by == "date" and sort_dir == "asc" and len(rows) == limit:
        last_transaction = rows[-1][0]
        next_cursor = _encode_cursor(last_transaction.check_datetime, last_transaction.id)
    return CursorPage[TransactionOut](
        items=[
            TransactionOut.from_model(tx, seller_name=seller_name_, balance=balance)
            for tx, seller_name_, balance in rows
        ],
        next_cursor=next_cursor,
        total=total,
    )


@router.get("/summary", response_model=TransactionSummary)
async def get_summary(  # noqa: PLR0913
    _current_user: CurrentUser,
    transaction_service: TransactionSvc,
    date_from: date | None = Query(None),  # noqa: B008
    date_to: date | None = Query(None),  # noqa: B008
    tag_ids: list[UUID] | None = Query(None),  # noqa: B008
    untagged: bool = Query(False),
    search: str | None = Query(None, max_length=255),
    seller_names: list[str] | None = Query(None, max_length=255),  # noqa: B008
    amount_min: Decimal | None = Query(None, ge=0),  # noqa: B008
    amount_max: Decimal | None = Query(None, ge=0),  # noqa: B008
    operation_kind: Literal["income", "expense"] | None = Query(None),
) -> TransactionSummary:
    """Показатели за период (или за всё время, если дат нет) — считает SQL."""
    return await transaction_service.summary(
        _current_user,
        date_from=_day_bounds(date_from, end_of_day=False) if date_from else None,
        date_to=_day_bounds(date_to, end_of_day=True) if date_to else None,
        tag_ids=tag_ids,
        untagged=untagged,
        search=search,
        seller_names=seller_names,
        amount_min=amount_min,
        amount_max=amount_max,
        operation_kind=operation_kind,
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


@router.patch("/bulk", response_model=TransactionBulkUpdateResult)
async def bulk_update_transactions(
    data: TransactionBulkUpdate,
    _current_user: CurrentUser,
    transaction_service: TransactionSvc,
) -> TransactionBulkUpdateResult:
    updated = await transaction_service.bulk_update(_current_user, data)
    return TransactionBulkUpdateResult(updated=updated)


@router.patch("/{transaction_id}", response_model=TransactionOut)
async def update_transaction(
    transaction_id: UUID,
    data: TransactionUpdate,
    _current_user: CurrentUser,
    transaction_service: TransactionSvc,
) -> TransactionOut:
    tx = await transaction_service.update(_current_user, transaction_id, data)
    return await transaction_service.to_out(_current_user, tx)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: UUID,
    _current_user: CurrentUser,
    transaction_service: TransactionSvc,
) -> None:
    await transaction_service.delete(_current_user, transaction_id)
