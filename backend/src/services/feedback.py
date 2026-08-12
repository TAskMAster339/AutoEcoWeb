from uuid import UUID

from fastapi import HTTPException, status
from src.models.feedback import Feedback
from src.repositories.feedback import FeedbackRepository
from src.services.email import EmailService


class FeedbackService:
    def __init__(self, repo: FeedbackRepository, email: EmailService) -> None:
        self._repo = repo
        self._email = email

    async def create(
        self,
        *,
        user_id: UUID,
        email: str,
        subject: str,
        message: str,
    ) -> Feedback:
        item = await self._repo.create(
            user_id=user_id,
            email=email,
            subject=subject.strip(),
            message=message.strip(),
        )
        await self._email.send_feedback_received(item.email, item.subject)
        return item

    async def answer(self, item: Feedback, reply: str, admin_id: UUID) -> Feedback:
        result = await self._repo.answer(item, reply=reply.strip(), admin_id=admin_id)
        await self._email.send_feedback_answer(
            result.email,
            result.subject,
            result.admin_reply or "",
        )
        return result

    async def get_or_404(self, feedback_id: UUID) -> Feedback:
        item = await self._repo.get(feedback_id)
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Обращение не найдено",
            )
        return item
