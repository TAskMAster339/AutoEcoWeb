from datetime import date, datetime, time, timezone
from uuid import UUID

from fastapi import APIRouter, Query, status
from src.core.dependencies import (
    AliasRepo,
    CurrentUser,
    Proverkacheka,
    ReceiptRepo,
    TransactionRepo,
    TransactionSvc,
)
from src.schemas.pagination import CursorPage
from src.schemas.receipt import (
    ReceiptCreate,
    ReceiptManualCreate,
    ReceiptParseRequest,
    ReceiptPreviewOut,
    ReceiptResponse,
    ReceiptUpdate,
)
from src.schemas.transaction import TransactionInReceipt, TransactionOut
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
    transaction_service: TransactionSvc,
    alias_repo: AliasRepo,
    proverkacheka: Proverkacheka,
) -> ReceiptPreviewOut:
    normalized, seller_name = await ReceiptService(
        receipt_repo,
        transaction_service,
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
    tx_repo: TransactionRepo,
    transaction_service: TransactionSvc,
) -> ReceiptResponse:
    receipt = await ReceiptService(
        receipt_repo,
        transaction_service,
    ).create_manual(current_user, data)
    transactions = await tx_repo.list_by_receipt(receipt.id)
    return ReceiptResponse.from_model(receipt, transactions=transactions)


@router.post("", response_model=ReceiptResponse, status_code=status.HTTP_201_CREATED)
async def create_receipt(  # noqa: PLR0913
    data: ReceiptCreate,
    current_user: CurrentUser,
    receipt_repo: ReceiptRepo,
    tx_repo: TransactionRepo,
    transaction_service: TransactionSvc,
    alias_repo: AliasRepo,
    proverkacheka: Proverkacheka,
) -> ReceiptResponse:
    receipt = await ReceiptService(
        receipt_repo,
        transaction_service,
        alias_repo,
        proverkacheka,
    ).create(current_user, data)
    transactions = await tx_repo.list_by_receipt(receipt.id)
    return ReceiptResponse.from_model(receipt, transactions=transactions)


@router.get("", response_model=CursorPage[ReceiptResponse])
async def list_receipts(  # noqa: PLR0913
    _current_user: CurrentUser,
    receipt_repo: ReceiptRepo,
    tx_repo: TransactionRepo,
    transaction_service: TransactionSvc,
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = Query(None),
    date_from: date | None = Query(None),  # noqa: B008
    date_to: date | None = Query(None),  # noqa: B008
    seller: str | None = Query(None, max_length=255),
) -> CursorPage[ReceiptResponse]:
    receipts, next_cursor = await ReceiptService(
        receipt_repo,
        transaction_service,
    ).list_all(
        _current_user,
        limit=limit,
        cursor=cursor,
        date_from=_day_bounds(date_from, end_of_day=False) if date_from else None,
        date_to=_day_bounds(date_to, end_of_day=True) if date_to else None,
        seller=seller,
    )
    # транзакции всех чеков страницы — одним запросом (без N+1)
    receipt_transactions = await tx_repo.list_by_receipts([r.id for r in receipts])
    by_receipt: dict[UUID, list] = {}
    for tx in receipt_transactions:
        if tx.receipt_id is not None:
            by_receipt.setdefault(tx.receipt_id, []).append(tx)
    return CursorPage[ReceiptResponse](
        items=[
            ReceiptResponse.from_model(
                r,
                transactions=by_receipt.get(r.id, []),
            )
            for r in receipts
        ],
        next_cursor=next_cursor,
    )


@router.get("/{receipt_id}", response_model=ReceiptResponse)
async def get_receipt(
    receipt_id: UUID,
    _current_user: CurrentUser,
    receipt_repo: ReceiptRepo,
    tx_repo: TransactionRepo,
    transaction_service: TransactionSvc,
) -> ReceiptResponse:
    receipt = await ReceiptService(
        receipt_repo,
        transaction_service,
    ).get(_current_user, receipt_id)
    transactions = await tx_repo.list_by_receipt(receipt.id)
    return ReceiptResponse.from_model(receipt, transactions=transactions)


@router.post(
    "/{receipt_id}/transactions",
    response_model=TransactionOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_receipt_transaction(
    receipt_id: UUID,
    data: TransactionInReceipt,
    _current_user: CurrentUser,
    transaction_service: TransactionSvc,
) -> TransactionOut:
    """Добавляет транзакцию в существующий чек (нумерация продолжается)."""
    tx = await transaction_service.add_to_receipt(
        _current_user,
        receipt_id,
        data,
    )
    return TransactionOut.from_model(tx)


@router.patch("/{receipt_id}", response_model=ReceiptResponse)
async def update_receipt(
    receipt_id: UUID,
    data: ReceiptUpdate,
    _current_user: CurrentUser,
    receipt_repo: ReceiptRepo,
    tx_repo: TransactionRepo,
    transaction_service: TransactionSvc,
) -> ReceiptResponse:
    receipt = await ReceiptService(
        receipt_repo,
        transaction_service,
    ).update(_current_user, receipt_id, data)
    transactions = await tx_repo.list_by_receipt(receipt.id)
    return ReceiptResponse.from_model(receipt, transactions=transactions)


@router.delete("/{receipt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_receipt(
    receipt_id: UUID,
    _current_user: CurrentUser,
    receipt_repo: ReceiptRepo,
    transaction_service: TransactionSvc,
) -> None:
    await ReceiptService(
        receipt_repo,
        transaction_service,
    ).delete(_current_user, receipt_id)
