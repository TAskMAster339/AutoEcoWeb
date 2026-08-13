from typing import cast
from uuid import UUID

from sqlalchemy import Table, bindparam, delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from src.models.alias import Alias
from src.models.seller import Seller


class SellerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        user_id: UUID,
        name: str,
        normalized_name: str,
        seller_alias_id: UUID | None,
    ) -> Seller:
        seller = Seller(
            user_id=user_id,
            name=name,
            normalized_name=normalized_name,
            seller_alias_id=seller_alias_id,
        )
        self._session.add(seller)
        await self._session.commit()
        await self._session.refresh(seller)
        return seller

    async def get_or_create(
        self,
        *,
        user_id: UUID,
        name: str,
        normalized_name: str,
        seller_alias_id: UUID | None,
    ) -> Seller:
        existing = await self.get_by_name(user_id, name)
        if existing is not None:
            return existing
        try:
            return await self.create(
                user_id=user_id,
                name=name,
                normalized_name=normalized_name,
                seller_alias_id=seller_alias_id,
            )
        except IntegrityError:
            await self._session.rollback()
            seller = await self.get_by_name(user_id, name)
            if seller is None:
                raise
            return seller

    async def get_by_name(self, user_id: UUID, name: str) -> Seller | None:
        stmt = select(Seller).where(Seller.user_id == user_id, Seller.name == name)
        return await self._session.scalar(stmt)

    async def get_by_id(self, user_id: UUID, seller_id: UUID) -> Seller | None:
        return await self._session.scalar(
            select(Seller).where(Seller.user_id == user_id, Seller.id == seller_id),
        )

    async def save(self, seller: Seller) -> Seller:
        await self._session.commit()
        await self._session.refresh(seller)
        return seller

    async def list_name_columns(
        self,
        user_id: UUID,
    ) -> list[tuple[UUID, str, str, UUID | None]]:
        stmt = select(
            Seller.id,
            Seller.name,
            Seller.normalized_name,
            Seller.seller_alias_id,
        ).where(Seller.user_id == user_id)
        return [tuple(row) for row in (await self._session.execute(stmt)).all()]

    async def bulk_update_normalized(
        self,
        changes: list[tuple[UUID, str, UUID | None]],
    ) -> None:
        if not changes:
            return
        table = cast(Table, Seller.__table__)
        stmt = (
            update(table)
            .where(table.c.id == bindparam("pk_seller_id"))
            .values(
                normalized_name=bindparam("new_normalized"),
                seller_alias_id=bindparam("new_alias_id"),
            )
            .execution_options(synchronize_session=False)
        )
        await self._session.execute(
            stmt,
            [
                {
                    "pk_seller_id": sid,
                    "new_normalized": normalized,
                    "new_alias_id": alias_id,
                }
                for sid, normalized, alias_id in changes
            ],
        )
        await self._session.commit()

    async def list_stores(
        self,
        user_id: UUID,
    ) -> list[tuple[UUID, str, str, UUID | None, str | None]]:
        stmt = (
            select(
                Seller.id,
                Seller.name,
                Seller.normalized_name,
                Seller.seller_alias_id,
                Alias.alias_name,
            )
            .outerjoin(Alias, Alias.id == Seller.seller_alias_id)
            .where(Seller.user_id == user_id)
            .order_by(Seller.normalized_name.asc(), Seller.id.asc())
        )
        return [tuple(row) for row in (await self._session.execute(stmt)).all()]

    async def list_management(
        self,
        user_id: UUID,
    ) -> list[tuple[UUID, str, str, UUID | None, str | None, int, int]]:
        from src.models.receipt import Receipt
        from src.models.transaction import Transaction

        effective_seller = aliased(Seller, name="effective_seller")
        receipt_seller = aliased(Seller, name="management_receipt_seller")
        transaction_count = (
            select(func.count(Transaction.id))
            .outerjoin(Receipt, Receipt.id == Transaction.receipt_id)
            .join(
                effective_seller,
                effective_seller.id
                == func.coalesce(Transaction.seller_id, Receipt.seller_id),
            )
            .where(
                Transaction.user_id == user_id,
                effective_seller.normalized_name == Seller.normalized_name,
            )
            .correlate(Seller)
            .scalar_subquery()
        )
        receipt_count = (
            select(func.count(Receipt.id))
            .join(receipt_seller, receipt_seller.id == Receipt.seller_id)
            .where(
                Receipt.user_id == user_id,
                receipt_seller.normalized_name == Seller.normalized_name,
            )
            .correlate(Seller)
            .scalar_subquery()
        )
        stmt = (
            select(
                Seller.id,
                Seller.name,
                Seller.normalized_name,
                Seller.seller_alias_id,
                Alias.alias_name,
                transaction_count,
                receipt_count,
            )
            .outerjoin(Alias, Alias.id == Seller.seller_alias_id)
            .where(Seller.user_id == user_id)
            .order_by(Seller.normalized_name.asc(), Seller.id.asc())
        )
        return [tuple(row) for row in (await self._session.execute(stmt)).all()]

    async def update_source_name(self, seller: Seller, name: str) -> Seller:
        seller.name = name
        seller.normalized_name = name
        seller.seller_alias_id = None
        await self._session.commit()
        await self._session.refresh(seller)
        return seller

    async def delete_if_unused(self, seller: Seller) -> bool:
        from src.models.receipt import Receipt
        from src.models.transaction import Transaction

        transaction_exists = await self._session.scalar(
            select(Transaction.id).where(Transaction.seller_id == seller.id).limit(1),
        )
        receipt_exists = await self._session.scalar(
            select(Receipt.id).where(Receipt.seller_id == seller.id).limit(1),
        )
        if transaction_exists is not None or receipt_exists is not None:
            return False
        await self._session.execute(delete(Seller).where(Seller.id == seller.id))
        await self._session.commit()
        return True
