from fastapi import APIRouter
from src.core.dependencies import CurrentUser, UserLimitsSvc
from src.schemas.user_limits import UserLimitsOverview

router = APIRouter(prefix="/api/v1/limits", tags=["limits"])


@router.get("/me", response_model=UserLimitsOverview)
async def get_my_limits(
    current_user: CurrentUser,
    limits_service: UserLimitsSvc,
) -> UserLimitsOverview:
    return await limits_service.overview(current_user.id)
