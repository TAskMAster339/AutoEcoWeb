from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.receipt_item import ReceiptItem


class ReceiptItemRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_many(
        self,
        receipt_id: UUID,
        items: list[ReceiptItem],
    ) -> list[ReceiptItem]:
        if not items:
            return []
        for item in items:
            item.receipt_id = receipt_id
        self._session.add_all(items)
        await self._session.commit()
        return items

    async def list_by_receipt(self, receipt_id: UUID) -> list[ReceiptItem]:
        stmt = (
            select(ReceiptItem)
            .where(ReceiptItem.receipt_id == receipt_id)
            .order_by(ReceiptItem.position.asc(), ReceiptItem.id.asc())
        )
        return list((await self._session.scalars(stmt)).all())

    async def list_by_receipts(self, receipt_ids: list[UUID]) -> list[ReceiptItem]:
        if not receipt_ids:
            return []
        stmt = (
            select(ReceiptItem)
            .where(ReceiptItem.receipt_id.in_(receipt_ids))
            .order_by(ReceiptItem.position.asc(), ReceiptItem.id.asc())
        )
        return list((await self._session.scalars(stmt)).all())

    async def get_by_id(self, item_id: UUID) -> ReceiptItem | None:
        return await self._session.get(ReceiptItem, item_id)

    async def update(self, item: ReceiptItem, **fields: object) -> ReceiptItem:
        for field, value in fields.items():
            setattr(item, field, value)
        await self._session.commit()
        await self._session.refresh(item)
        return item

    async def delete(self, item: ReceiptItem) -> None:
        await self._session.delete(item)
        await self._session.commit()
