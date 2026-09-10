from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from src.core.cursor import decode_cursor, encode_cursor
from src.models.receipt import Receipt
from src.models.user import User
from src.repositories.alias import AliasRepository
from src.repositories.receipt import ReceiptRepository
from src.schemas.receipt import (
    ReceiptCreate,
    ReceiptManualCreate,
    ReceiptParseRequest,
    ReceiptUpdate,
)
from src.services.aliases import AliasService
from src.services.proverkacheka import ProverkachekaClient, ProverkachekaError
from src.services.receipt_parser import (
    NormalizedReceipt,
    ReceiptParseError,
    normalize_proverkacheka,
)
from src.services.sellers import SellerService
from src.services.transaction import TransactionService

# Остальные поля (receipt_number, seller_inn, cashback, balance_after) nullable —
# явный null их очищает (см. pitfall: exclude_unset + null).
_RECEIPT_NON_NULLABLE = frozenset(
    {"operation_type", "seller_name", "check_datetime", "total_sum"},
)


class ReceiptService:
    """Чек — «коробка» транзакций: владелец, продавец, сумма, QR.

    Сами транзакции (минимальная единица учёта) создаются через
    TransactionService.
    """

    def __init__(
        self,
        repo: ReceiptRepository,
        transaction_service: TransactionService,
        alias_repo: AliasRepository,
        seller_service: SellerService,
        proverkacheka: ProverkachekaClient | None = None,
    ) -> None:
        self._repo = repo
        self._transaction_service = transaction_service
        self._alias_repo = alias_repo
        self._seller_service = seller_service
        self._proverkacheka = proverkacheka

    async def parse(
        self,
        user: User,
        data: ReceiptParseRequest,
    ) -> tuple[NormalizedReceipt, str]:
        normalized = await self._load_normalized(user, data)
        seller = await self._seller_service.get_or_create_required(
            user.id,
            normalized.seller_name,
        )
        seller_name = (
            seller.normalized_name if seller is not None else normalized.seller_name
        )
        await self._resolve_items(user.id, normalized.items)
        return normalized, seller_name

    async def create(self, user: User, data: ReceiptCreate) -> Receipt:
        normalized = await self._load_normalized(user, data)
        if normalized.qr is not None:
            existing = await self._repo.get_by_qr(user.id, normalized.qr)
            if existing is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Этот чек уже добавлен",
                )
        await self._transaction_service.ensure_new_receipt(
            user.id,
            len(normalized.items),
        )
        seller = await self._seller_service.get_or_create_required(
            user.id,
            normalized.seller_name,
        )
        # Seller creation can commit and release the first quota lock.
        await self._transaction_service.ensure_new_receipt(
            user.id,
            len(normalized.items),
        )

        receipt = await self._repo.create(
            user_id=user.id,
            qr=normalized.qr,
            receipt_number=normalized.receipt_number,
            operation_type=normalized.operation_type,
            seller_id=seller.id,
            seller_inn=normalized.seller_inn,
            check_datetime=normalized.check_datetime,
            total_sum=normalized.total_sum,
            cashback=data.cashback,
            balance_after=data.balance_after,
            raw_json=normalized.raw_json,
        )
        # транзакции — ответственность TransactionService
        try:
            await self._transaction_service.create_for_receipt(receipt, normalized.items)
        except Exception:
            await self._repo.delete(receipt)
            await self._seller_service.delete_if_unused(user.id, seller.id)
            raise
        return receipt

    async def create_manual(
        self,
        user: User,
        data: ReceiptManualCreate,
    ) -> Receipt:
        """Ручной чек: без QR/raw_json, без дедупликации по QR.

        Транзакции маппятся в ReceiptItemData и создаются TransactionService
        (конструирование ORM — только там).
        """
        await self._transaction_service.ensure_new_receipt(
            user.id,
            len(data.transactions or []),
        )
        seller = await self._seller_service.get_or_create_required(
            user.id,
            data.seller_name,
        )
        await self._transaction_service.ensure_new_receipt(
            user.id,
            len(data.transactions or []),
        )

        receipt = await self._repo.create(
            user_id=user.id,
            qr=None,
            receipt_number=data.receipt_number,
            operation_type=data.operation_type,
            seller_id=seller.id,
            seller_inn=data.seller_inn,
            check_datetime=data.check_datetime,
            total_sum=data.total_sum,
            cashback=data.cashback,
            balance_after=data.balance_after,
            raw_json={},
        )
        # транзакции ручного чека — ответственность TransactionService
        try:
            await self._transaction_service.create_manual_for_receipt(
                receipt,
                data.transactions or [],
            )
        except Exception:
            await self._repo.delete(receipt)
            await self._seller_service.delete_if_unused(user.id, seller.id)
            raise
        return receipt

    async def update(
        self,
        user: User,
        receipt_id: UUID,
        data: ReceiptUpdate,
    ) -> Receipt:
        receipt = await self._repo.get(user.id, receipt_id)
        if receipt is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Чек не найден",
            )
        fields = data.model_dump(exclude_unset=True)
        if not fields:
            return receipt
        null_required = sorted(
            f for f in fields if fields[f] is None and f in _RECEIPT_NON_NULLABLE
        )
        if null_required:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Поля не могут быть null: {', '.join(null_required)}",
            )
        previous_seller_id = receipt.seller_id
        if "seller_name" in fields:
            seller_name = fields["seller_name"].strip()
            seller = await self._seller_service.get_or_create_required(
                user.id,
                seller_name,
            )
            fields.pop("seller_name", None)
            fields["seller_id"] = seller.id if seller is not None else None
        updated = await self._repo.update(receipt, **fields)
        if (
            "seller_name" in data.model_fields_set
            and previous_seller_id != updated.seller_id
        ):
            await self._seller_service.delete_if_unused(user.id, previous_seller_id)
        return updated

    async def list_all(  # noqa: PLR0913
        self,
        user: User,
        *,
        limit: int,
        cursor: str | None,
        date_from: datetime | None,
        date_to: datetime | None,
        seller: str | None,
        search: str | None = None,
    ) -> tuple[list[Receipt], str | None]:
        cursor_tuple = decode_cursor(cursor) if cursor is not None else None
        items = await self._repo.list_cursor(
            user_id=user.id,
            limit=limit + 1,  # +1 строка = детект «есть ещё»
            cursor=cursor_tuple,
            date_from=date_from,
            date_to=date_to,
            seller=seller,
            search=search,
        )
        has_more = len(items) > limit
        items = items[:limit]
        next_cursor = (
            encode_cursor(items[-1].created_at, items[-1].id)
            if has_more and items
            else None
        )
        return items, next_cursor

    async def get(self, user: User, receipt_id: UUID) -> Receipt:
        receipt = await self._repo.get(user.id, receipt_id)
        if receipt is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Чек не найден",
            )
        return receipt

    async def delete(self, user: User, receipt_id: UUID) -> None:
        receipt = await self.get(user, receipt_id)
        await self._repo.delete(receipt)

    async def _load_normalized(
        self,
        user: User,
        data: ReceiptParseRequest,
    ) -> NormalizedReceipt:
        if data.raw_json is not None:
            return self._normalize_payload(data.raw_json, qr_override=data.qr)

        if data.qr is not None:
            if self._proverkacheka is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Сервис загрузки чеков proverkacheka не настроен",
                )
            token = user.proverkacheka_token
            if not token:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=(
                        "Токен proverkacheka не настроен — укажите его в профиле "  # noqa: RUF001
                        "(PUT /auth/me/proverkacheka-token)"
                    ),
                )
            try:
                payload = await self._proverkacheka.fetch(data.qr, token=token)
            except ProverkachekaError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=str(exc),
                ) from exc
            return self._normalize_payload(payload, qr_override=data.qr)

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Передайте данные чека (raw_json) или QR для загрузки",
        )

    @staticmethod
    def _normalize_payload(
        payload: dict,
        *,
        qr_override: str | None,
    ) -> NormalizedReceipt:
        try:
            return normalize_proverkacheka(payload, qr_override=qr_override)
        except ReceiptParseError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    async def _resolve_items(
        self,
        user_id: UUID,
        items: list,
    ) -> None:
        """Apply product aliases to preview values;
        persisted rows keep source fields."""
        if self._alias_repo is None or not items:
            return
        aliases = await self._alias_repo.list_all(user_id, scope="product")
        for item in items:
            item.name = AliasService.resolve(aliases, item.name)
