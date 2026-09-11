from fastapi import APIRouter
from src.core.dependencies import AutoTaggingSvc, CurrentUser
from src.schemas.auto_tagging import (
    AutoTaggingSettingsUpdate,
    AutoTaggingStatusResponse,
)

router = APIRouter(prefix="/api/v1/auto-tagging", tags=["auto-tagging"])


@router.get("", response_model=AutoTaggingStatusResponse)
async def get_auto_tagging_status(
    current_user: CurrentUser,
    service: AutoTaggingSvc,
) -> AutoTaggingStatusResponse:
    return await service.status(current_user)


@router.patch("", response_model=AutoTaggingStatusResponse)
async def update_auto_tagging(
    data: AutoTaggingSettingsUpdate,
    current_user: CurrentUser,
    service: AutoTaggingSvc,
) -> AutoTaggingStatusResponse:
    return await service.set_enabled(current_user, data.enabled)


@router.post("/retrain", response_model=AutoTaggingStatusResponse)
async def retrain_auto_tagging(
    current_user: CurrentUser,
    service: AutoTaggingSvc,
) -> AutoTaggingStatusResponse:
    return await service.retrain(current_user)


@router.get("/metrics", response_model=AutoTaggingStatusResponse)
async def get_auto_tagging_metrics(
    current_user: CurrentUser,
    service: AutoTaggingSvc,
) -> AutoTaggingStatusResponse:
    return await service.status(current_user)
