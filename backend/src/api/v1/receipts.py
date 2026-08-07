from datetime import date, datetime, time, timezone
from uuid import UUID

from fastapi import APIRouter, Query, status
from src.core.dependencies import (
    AliasRepo,
    CurrentUser,
    Proverkacheka,
    ReceiptItemRepo,
    ReceiptItemSvc,
    ReceiptRepo,
)
from src.schemas.pagination import CursorPage
from src.schemas.receipt import (
    ReceiptCreate,
    ReceiptItemOut,
    ReceiptItemsManualCreate,
    ReceiptItemUpdate,
    ReceiptManualCreate,
    ReceiptParseRequest,
    ReceiptPreviewOut,
    ReceiptResponse,
    ReceiptUpdate,
)
from src.services.receipts import ReceiptService

router = APIRouter(prefix="/api/v1/receipts", tags=["receipts"])


def _day_bounds(day: date, end_of_day: bool) -> datetime:  # noqa: FBT001
    if end_of_day:
        return datetime.combine(day, time.max, tzinfo=timezone.utc)
    return datetime.combine(day, time.min, tzinfo=timezone.utc)


@router.post("/parse", response_model=ReceiptPreviewOut)
async def parse_receipt(  # noqa: PLR0913
    data: ReceiptParseRequest,
    current_user: CurrentUser,
    receipt_repo: ReceiptRepo,
    item_service: ReceiptItemSvc,
    alias_repo: AliasRepo,
    proverkacheka: Proverkacheka,
) -> ReceiptPreviewOut:
    normalized, seller_name = await ReceiptService(
        receipt_repo,
        item_service,
        alias_repo,
        proverkacheka,
    ).parse(current_user, data)
    return ReceiptPreviewOut.from_normalized(normalized, seller_name)


@router.post(
    "/manual",
    response_model=ReceiptResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_manual_receipt(
    data: ReceiptManualCreate,
    current_user: CurrentUser,
    receipt_repo: ReceiptRepo,
    item_repo: ReceiptItemRepo,
    item_service: ReceiptItemSvc,
) -> ReceiptResponse:
    receipt = await ReceiptService(
        receipt_repo,
        item_service,
    ).create_manual(current_user, data)
    items = await item_repo.list_by_receipt(receipt.id)
    return ReceiptResponse.from_model(receipt, items=items)


@router.post("", response_model=ReceiptResponse, status_code=status.HTTP_201_CREATED)
async def create_receipt(  # noqa: PLR0913
    data: ReceiptCreate,
    current_user: CurrentUser,
    receipt_repo: ReceiptRepo,
    item_repo: ReceiptItemRepo,
    item_service: ReceiptItemSvc,
    alias_repo: AliasRepo,
    proverkacheka: Proverkacheka,
) -> ReceiptResponse:
    receipt = await ReceiptService(
        receipt_repo,
        item_service,
        alias_repo,
        proverkacheka,
    ).create(current_user, data)
    items = await item_repo.list_by_receipt(receipt.id)
    return ReceiptResponse.from_model(receipt, items=items)


@router.get("", response_model=CursorPage[ReceiptResponse])
async def list_receipts(  # noqa: PLR0913
    _current_user: CurrentUser,
    receipt_repo: ReceiptRepo,
    item_repo: ReceiptItemRepo,
    item_service: ReceiptItemSvc,
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = Query(None),
    date_from: date | None = Query(None),  # noqa: B008
    date_to: date | None = Query(None),  # noqa: B008
    seller: str | None = Query(None, max_length=255),
) -> CursorPage[ReceiptResponse]:
    items, next_cursor = await ReceiptService(
        receipt_repo,
        item_service,
    ).list_all(
        _current_user,
        limit=limit,
        cursor=cursor,
        date_from=_day_bounds(date_from, end_of_day=False) if date_from else None,
        date_to=_day_bounds(date_to, end_of_day=True) if date_to else None,
        seller=seller,
    )
    # позиции всех чеков страницы — одним запросом (без N+1)
    receipt_items = await item_repo.list_by_receipts([r.id for r in items])
    by_receipt: dict[UUID, list] = {}
    for item in receipt_items:
        by_receipt.setdefault(item.receipt_id, []).append(item)
    return CursorPage[ReceiptResponse](
        items=[
            ReceiptResponse.from_model(r, items=by_receipt.get(r.id, [])) for r in items
        ],
        next_cursor=next_cursor,
    )


@router.get("/{receipt_id}", response_model=ReceiptResponse)
async def get_receipt(
    receipt_id: UUID,
    _current_user: CurrentUser,
    receipt_repo: ReceiptRepo,
    item_repo: ReceiptItemRepo,
    item_service: ReceiptItemSvc,
) -> ReceiptResponse:
    receipt = await ReceiptService(
        receipt_repo,
        item_service,
    ).get(_current_user, receipt_id)
    items = await item_repo.list_by_receipt(receipt.id)
    return ReceiptResponse.from_model(receipt, items=items)


@router.post(
    "/{receipt_id}/items",
    response_model=list[ReceiptItemOut],
    status_code=status.HTTP_201_CREATED,
)
async def add_receipt_items(
    receipt_id: UUID,
    data: ReceiptItemsManualCreate,
    _current_user: CurrentUser,
    item_service: ReceiptItemSvc,
) -> list[ReceiptItemOut]:
    """Добавляет позиции в существующий чек (нумерация продолжается)."""
    items = await item_service.add_manual_items(
        _current_user,
        receipt_id,
        data.items,
    )
    return [ReceiptItemOut.from_model(item) for item in items]


@router.patch("/{receipt_id}", response_model=ReceiptResponse)
async def update_receipt(
    receipt_id: UUID,
    data: ReceiptUpdate,
    _current_user: CurrentUser,
    receipt_repo: ReceiptRepo,
    item_repo: ReceiptItemRepo,
    item_service: ReceiptItemSvc,
) -> ReceiptResponse:
    receipt = await ReceiptService(
        receipt_repo,
        item_service,
    ).update(_current_user, receipt_id, data)
    items = await item_repo.list_by_receipt(receipt.id)
    return ReceiptResponse.from_model(receipt, items=items)


@router.patch("/{receipt_id}/items/{item_id}", response_model=ReceiptItemOut)
async def update_receipt_item(
    receipt_id: UUID,
    item_id: UUID,
    data: ReceiptItemUpdate,
    _current_user: CurrentUser,
    item_service: ReceiptItemSvc,
) -> ReceiptItemOut:
    item = await item_service.update(_current_user, receipt_id, item_id, data)
    return ReceiptItemOut.from_model(item)


@router.delete(
    "/{receipt_id}/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_receipt_item(
    receipt_id: UUID,
    item_id: UUID,
    _current_user: CurrentUser,
    item_service: ReceiptItemSvc,
) -> None:
    await item_service.delete(_current_user, receipt_id, item_id)


@router.delete("/{receipt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_receipt(
    receipt_id: UUID,
    _current_user: CurrentUser,
    receipt_repo: ReceiptRepo,
    item_repo: ReceiptItemRepo,
    item_service: ReceiptItemSvc,
) -> None:
    await ReceiptService(
        receipt_repo,
        item_service,
    ).delete(_current_user, receipt_id)
