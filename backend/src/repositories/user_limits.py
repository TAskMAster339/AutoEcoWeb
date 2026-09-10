from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.alias import Alias
from src.models.receipt import Receipt
from src.models.tag import Tag
from src.models.transaction import Transaction
from src.models.user_limits import UserLimits


@dataclass(frozen=True)
class UserUsage:
    tags: int
    seller_aliases: int
    product_aliases: int
    receipts: int
    transactions: int


class UserLimitsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, user_id: UUID, *, for_update: bool = False) -> UserLimits | None:
        stmt = select(UserLimits).where(UserLimits.user_id == user_id)
        if for_update:
            stmt = stmt.with_for_update()
        return await self._session.scalar(stmt)

    async def get_or_create(
        self,
        user_id: UUID,
        *,
        for_update: bool = False,
    ) -> UserLimits:
        limits = await self.get(user_id, for_update=for_update)
        if limits is not None:
            return limits
        limits = UserLimits(user_id=user_id)
        self._session.add(limits)
        await self._session.commit()
        await self._session.refresh(limits)
        return limits

    async def usage(self, user_id: UUID) -> UserUsage:
        row = (
            await self._session.execute(
                select(
                    select(func.count(Tag.id))
                    .where(Tag.user_id == user_id)
                    .scalar_subquery(),
                    select(func.count(Alias.id))
                    .where(Alias.user_id == user_id, Alias.scope == "seller")
                    .scalar_subquery(),
                    select(func.count(Alias.id))
                    .where(Alias.user_id == user_id, Alias.scope == "product")
                    .scalar_subquery(),
                    select(func.count(Receipt.id))
                    .where(Receipt.user_id == user_id)
                    .scalar_subquery(),
                    select(func.count(Transaction.id))
                    .where(Transaction.user_id == user_id)
                    .scalar_subquery(),
                ),
            )
        ).one()
        return UserUsage(*(int(value) for value in row))

    async def receipt_item_count(self, receipt_id: UUID) -> int:
        stmt = select(func.count(Transaction.id)).where(Transaction.receipt_id == receipt_id)
        return int((await self._session.execute(stmt)).scalar_one())

    async def update(self, limits: UserLimits, **fields: object) -> UserLimits:
        for field, value in fields.items():
            setattr(limits, field, value)
        await self._session.commit()
        await self._session.refresh(limits)
        return limits
