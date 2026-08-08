from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.receipt import Receipt
from src.models.transaction import Transaction


class TransactionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, tx: Transaction) -> Transaction:
        self._session.add(tx)
        await self._session.commit()
        await self._session.refresh(tx)
        return tx

    async def create_many(
        self,
        receipt_id: UUID,
        transactions: list[Transaction],
    ) -> list[Transaction]:
        if not transactions:
            return []
        for tx in transactions:
            tx.receipt_id = receipt_id
        self._session.add_all(transactions)
        await self._session.commit()
        return transactions

    async def list_by_receipt(self, receipt_id: UUID) -> list[Transaction]:
        stmt = (
            select(Transaction)
            .where(Transaction.receipt_id == receipt_id)
            .order_by(Transaction.position.asc(), Transaction.id.asc())
        )
        return list((await self._session.scalars(stmt)).all())

    async def list_by_receipts(self, receipt_ids: list[UUID]) -> list[Transaction]:
        if not receipt_ids:
            return []
        stmt = (
            select(Transaction)
            .where(Transaction.receipt_id.in_(receipt_ids))
            .order_by(Transaction.position.asc(), Transaction.id.asc())
        )
        return list((await self._session.scalars(stmt)).all())

    async def get_by_id(self, tx_id: UUID) -> Transaction | None:
        return await self._session.get(Transaction, tx_id)

    async def get_owned(self, user_id: UUID, tx_id: UUID) -> Transaction | None:
        stmt = select(Transaction).where(
            Transaction.id == tx_id,
            Transaction.user_id == user_id,
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
        tag_id: UUID | None = None,
        search: str | None = None,
    ) -> list[tuple[Transaction, str | None]]:
        """Страница транзакций + seller_name из чека (left join, без N+1)."""
        conditions: list[object] = [Transaction.user_id == user_id]
        if date_from is not None:
            conditions.append(Transaction.check_datetime >= date_from)
        if date_to is not None:
            conditions.append(Transaction.check_datetime <= date_to)
        if tag_id is not None:
            conditions.append(Transaction.tag_id == tag_id)
        if search:
            conditions.append(Transaction.name.ilike(f"%{search}%"))
        if cursor is not None:
            cursor_created_at, cursor_id = cursor
            conditions.append(
                or_(
                    Transaction.created_at < cursor_created_at,
                    and_(
                        Transaction.created_at == cursor_created_at,
                        Transaction.id < cursor_id,
                    ),
                ),
            )
        stmt = (
            select(Transaction, Receipt.seller_name)
            .outerjoin(Receipt, Receipt.id == Transaction.receipt_id)
            .order_by(Transaction.created_at.desc(), Transaction.id.desc())
            .limit(limit)
        )
        if conditions:
            stmt = stmt.where(*conditions)
        rows = (await self._session.execute(stmt)).all()
        return [(tx, seller_name) for tx, seller_name in rows]

    async def update(self, tx: Transaction, **fields: object) -> Transaction:
        for field, value in fields.items():
            setattr(tx, field, value)
        await self._session.commit()
        await self._session.refresh(tx)
        return tx

    async def delete(self, tx: Transaction) -> None:
        await self._session.delete(tx)
        await self._session.commit()
