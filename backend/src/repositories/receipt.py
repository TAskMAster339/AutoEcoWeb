from datetime import datetime
from decimal import Decimal
from typing import cast
from uuid import UUID

from sqlalchemy import Table, and_, bindparam, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.receipt import Receipt


class ReceiptRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(  # noqa: PLR0913
        self,
        *,
        user_id: UUID,
        qr: str | None,
        receipt_number: str | None,
        operation_type: int,
        seller_name: str,
        normalized_seller_name: str | None = None,
        seller_name_alias_id: UUID | None = None,
        seller_inn: str | None = None,
        check_datetime: datetime,
        total_sum: Decimal,
        cashback: Decimal | None,
        balance_after: Decimal | None,
        raw_json: dict,
    ) -> Receipt:
        receipt = Receipt(
            user_id=user_id,
            qr=qr,
            receipt_number=receipt_number,
            operation_type=operation_type,
            seller_name=seller_name,
            normalized_seller_name=normalized_seller_name or seller_name,
            seller_name_alias_id=seller_name_alias_id,
            seller_inn=seller_inn,
            check_datetime=check_datetime,
            total_sum=total_sum,
            cashback=cashback,
            balance_after=balance_after,
            raw_json=raw_json,
        )
        self._session.add(receipt)
        await self._session.commit()
        await self._session.refresh(receipt)
        return receipt

    async def get(self, user_id: UUID, receipt_id: UUID) -> Receipt | None:
        stmt = select(Receipt).where(
            Receipt.id == receipt_id,
            Receipt.user_id == user_id,
        )
        return await self._session.scalar(stmt)

    async def get_by_qr(self, user_id: UUID, qr: str) -> Receipt | None:
        stmt = select(Receipt).where(
            Receipt.user_id == user_id,
            Receipt.qr == qr,
        )
        return await self._session.scalar(stmt)

    async def list_cursor(  # noqa: PLR0913
        self,
        *,
        user_id: UUID,
        limit: int,
        cursor: tuple[datetime, UUID] | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        seller: str | None = None,
    ) -> list[Receipt]:
        conditions: list[object] = [Receipt.user_id == user_id]
        if date_from is not None:
            conditions.append(Receipt.check_datetime >= date_from)
        if date_to is not None:
            conditions.append(Receipt.check_datetime <= date_to)
        if seller:
            conditions.append(Receipt.seller_name.ilike(f"%{seller}%"))
        if cursor is not None:
            cursor_created_at, cursor_id = cursor
            conditions.append(
                or_(
                    Receipt.created_at < cursor_created_at,
                    and_(
                        Receipt.created_at == cursor_created_at,
                        Receipt.id < cursor_id,
                    ),
                ),
            )
        stmt = select(Receipt)
        if conditions:
            stmt = stmt.where(*conditions)
        stmt = stmt.order_by(Receipt.created_at.desc(), Receipt.id.desc()).limit(limit)
        return list((await self._session.scalars(stmt)).all())

    async def update(self, receipt: Receipt, **fields: object) -> Receipt:
        for field, value in fields.items():
            setattr(receipt, field, value)
        await self._session.commit()
        await self._session.refresh(receipt)
        return receipt

    async def delete(self, receipt: Receipt) -> None:
        await self._session.delete(receipt)
        await self._session.commit()

    # ---------- применение алиасов продавцов ----------

    async def list_seller_columns(self, user_id: UUID) -> list[tuple[UUID, str]]:
        """(id, исходное seller_name) всех чеков пользователя."""
        stmt = select(Receipt.id, Receipt.seller_name).where(
            Receipt.user_id == user_id,
        )
        return [(row[0], row[1]) for row in (await self._session.execute(stmt)).all()]

    async def bulk_update_sellers(
        self,
        changes: list[tuple[UUID, str, UUID | None]],
    ) -> None:
        """Bulk-обновление normalized_seller_name."""
        if not changes:
            return
        # Core-таблица: executemany без ORM-синхронизации сессии
        table = cast(Table, Receipt.__table__)
        stmt = (
            update(table)
            .where(table.c.id == bindparam("receipt_id"))
            .values(
                normalized_seller_name=bindparam("new_seller"),
                seller_name_alias_id=bindparam("new_alias_id"),
            )
        )
        await self._session.execute(
            stmt,
            [
                {
                    "receipt_id": receipt_id,
                    "new_seller": seller,
                    "new_alias_id": alias_id,
                }
                for receipt_id, seller, alias_id in changes
            ],
        )
        await self._session.commit()
