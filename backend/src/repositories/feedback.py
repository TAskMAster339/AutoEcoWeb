from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.feedback import Feedback


class FeedbackRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        user_id: UUID,
        email: str,
        subject: str,
        message: str,
    ) -> Feedback:
        item = Feedback(user_id=user_id, email=email, subject=subject, message=message)
        self._session.add(item)
        await self._session.commit()
        await self._session.refresh(item)
        return item

    async def list_page(
        self,
        *,
        status: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Feedback], int]:
        conditions = [Feedback.status == status] if status else []
        stmt = select(Feedback).order_by(Feedback.created_at.desc(), Feedback.id.desc())
        count_stmt = select(func.count()).select_from(Feedback)
        if conditions:
            stmt = stmt.where(*conditions)
            count_stmt = count_stmt.where(*conditions)
        stmt = stmt.offset(offset).limit(limit)
        items = list((await self._session.scalars(stmt)).all())
        total = int((await self._session.scalar(count_stmt)) or 0)
        return items, total

    async def list_all(self, status: str | None = None) -> list[Feedback]:
        items, _ = await self.list_page(status=status, limit=100, offset=0)
        return items

    async def list_by_user(self, user_id: UUID) -> list[Feedback]:
        stmt = (
            select(Feedback)
            .where(Feedback.user_id == user_id)
            .order_by(Feedback.created_at.desc())
        )
        return list((await self._session.scalars(stmt)).all())

    async def get(self, feedback_id: UUID) -> Feedback | None:
        return await self._session.scalar(
            select(Feedback).where(Feedback.id == feedback_id),
        )

    async def answer(self, item: Feedback, *, reply: str, admin_id: UUID) -> Feedback:
        item.admin_reply = reply
        item.replied_by_id = admin_id
        item.replied_at = datetime.now(timezone.utc)
        item.status = "answered"
        await self._session.commit()
        await self._session.refresh(item)
        return item

    async def close(self, item: Feedback) -> Feedback:
        item.status = "closed"
        await self._session.commit()
        await self._session.refresh(item)
        return item
