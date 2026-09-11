from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from src.models.auto_tagging import AutoTaggingModelState
from src.models.receipt import Receipt
from src.models.seller import Seller
from src.models.tag import Tag
from src.models.transaction import Transaction
from src.models.user import User


@dataclass(frozen=True)
class AutoTagTrainingRow:
    tag_id: UUID
    tag_name: str
    raw_name: str
    normalized_name: str
    raw_seller: str | None
    normalized_seller: str | None
    operation_type: int
    amount: Decimal
    check_datetime: datetime


class AutoTaggingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def bump_revision(self, user_id: UUID) -> None:
        await self._session.execute(
            update(User)
            .where(User.id == user_id)
            .values(
                auto_tagging_training_revision=(
                    User.auto_tagging_training_revision + 1
                ),
            ),
        )
        await self._session.commit()

    async def set_enabled(self, user: User, enabled: bool) -> User:
        user.auto_tagging_enabled = enabled
        await self._session.commit()
        await self._session.refresh(user)
        return user

    async def get_state(self, user_id: UUID) -> AutoTaggingModelState | None:
        return await self._session.scalar(
            select(AutoTaggingModelState).where(
                AutoTaggingModelState.user_id == user_id,
            ),
        )

    async def save_state(self, user_id: UUID, **fields: object) -> AutoTaggingModelState:
        state = await self.get_state(user_id)
        if state is None:
            state = AutoTaggingModelState(user_id=user_id, **fields)
            self._session.add(state)
        else:
            for field, value in fields.items():
                setattr(state, field, value)
        await self._session.commit()
        await self._session.refresh(state)
        return state

    async def list_training_rows(
        self,
        user_id: UUID,
        *,
        limit: int,
    ) -> list[AutoTagTrainingRow]:
        own_seller = aliased(Seller)
        receipt_seller = aliased(Seller)
        stmt = (
            select(
                Transaction.tag_id,
                Tag.name,
                Transaction.name,
                Transaction.normalized_name,
                func.coalesce(own_seller.name, receipt_seller.name),
                func.coalesce(
                    own_seller.normalized_name,
                    receipt_seller.normalized_name,
                ),
                Transaction.operation_type,
                Transaction.amount,
                Transaction.check_datetime,
            )
            .join(Tag, Tag.id == Transaction.tag_id)
            .outerjoin(Receipt, Receipt.id == Transaction.receipt_id)
            .outerjoin(own_seller, own_seller.id == Transaction.seller_id)
            .outerjoin(receipt_seller, receipt_seller.id == Receipt.seller_id)
            .where(
                Transaction.user_id == user_id,
                Transaction.tag_id.is_not(None),
                Transaction.tag_source == "manual",
            )
            .order_by(Transaction.check_datetime.desc(), Transaction.id.desc())
            .limit(limit)
        )
        rows = (await self._session.execute(stmt)).all()
        return [
            AutoTagTrainingRow(
                tag_id=tag_id,
                tag_name=tag_name,
                raw_name=raw_name,
                normalized_name=normalized_name,
                raw_seller=raw_seller,
                normalized_seller=normalized_seller,
                operation_type=operation_type,
                amount=amount,
                check_datetime=check_datetime,
            )
            for (
                tag_id,
                tag_name,
                raw_name,
                normalized_name,
                raw_seller,
                normalized_seller,
                operation_type,
                amount,
                check_datetime,
            ) in reversed(rows)
        ]

    async def clear_tag_metadata(self, user_id: UUID, tag_id: UUID) -> bool:
        has_manual = bool(
            await self._session.scalar(
                select(func.count(Transaction.id)).where(
                    Transaction.user_id == user_id,
                    Transaction.tag_id == tag_id,
                    Transaction.tag_source == "manual",
                ),
            ),
        )
        await self._session.execute(
            update(Transaction)
            .where(Transaction.user_id == user_id, Transaction.tag_id == tag_id)
            .values(tag_source=None, tag_confidence=None),
        )
        await self._session.commit()
        return has_manual

    @staticmethod
    def utcnow() -> datetime:
        return datetime.now(timezone.utc)
