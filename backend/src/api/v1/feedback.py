from uuid import UUID

from fastapi import APIRouter, Query, status
from src.core.dependencies import CurrentAdmin, CurrentUser, EmailSvc, FeedbackRepo
from src.models.feedback import Feedback
from src.schemas.feedback import (
    FeedbackAnswer,
    FeedbackCreate,
    FeedbackPageResponse,
    FeedbackResponse,
)
from src.services.feedback import FeedbackService

router = APIRouter(prefix="/api/v1", tags=["feedback"])


def _service(repo: FeedbackRepo, email: EmailSvc) -> FeedbackService:
    return FeedbackService(repo, email)


@router.post(
    "/feedback",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_feedback(
    data: FeedbackCreate,
    current_user: CurrentUser,
    repo: FeedbackRepo,
    email: EmailSvc,
) -> Feedback:
    return await _service(repo, email).create(
        user_id=current_user.id,
        email=current_user.email,
        subject=data.subject,
        message=data.message,
    )


@router.get("/feedback", response_model=FeedbackPageResponse)
async def list_feedback(
    _admin: CurrentAdmin,
    repo: FeedbackRepo,
    status_filter: str | None = Query("open", alias="status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> FeedbackPageResponse:
    normalized_status = None if status_filter in (None, "", "all") else status_filter
    items, total = await repo.list_page(
        status=normalized_status,
        limit=limit,
        offset=offset,
    )
    return FeedbackPageResponse(
        items=[FeedbackResponse.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/feedback/me", response_model=list[FeedbackResponse])
async def list_my_feedback(
    current_user: CurrentUser,
    repo: FeedbackRepo,
) -> list[Feedback]:
    return await repo.list_by_user(current_user.id)


@router.post("/feedback/{feedback_id}/answer", response_model=FeedbackResponse)
async def answer_feedback(
    feedback_id: UUID,
    data: FeedbackAnswer,
    admin: CurrentAdmin,
    repo: FeedbackRepo,
    email: EmailSvc,
) -> Feedback:
    item = await _service(repo, email).get_or_404(feedback_id)
    return await _service(repo, email).answer(item, data.reply, admin.id)


@router.post("/feedback/{feedback_id}/close", response_model=FeedbackResponse)
async def close_feedback(
    feedback_id: UUID,
    _admin: CurrentAdmin,
    repo: FeedbackRepo,
    email: EmailSvc,
) -> Feedback:
    item = await _service(repo, email).get_or_404(feedback_id)
    return await repo.close(item)
