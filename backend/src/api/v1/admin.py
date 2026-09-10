from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from src.core.dependencies import CurrentAdmin, UserLimitsSvc, UserRepo, get_current_admin
from src.core.enums.user_role import UserRole
from src.core.enums.user_status import UserStatus
from src.models.user import User
from src.schemas.pagination import CursorPage
from src.schemas.user import AdminUserUpdate, UserAdminResponse
from src.schemas.user_limits import UserLimitsResponse, UserLimitsUpdate
from src.services.user import AdminUserService

router = APIRouter(
    prefix="/api/v1/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_admin)],
)


async def _get_user_or_404(repo: UserRepo, user_id: UUID) -> User:
    user = await repo.get(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )
    return user


@router.get("/users", response_model=CursorPage[UserAdminResponse])
async def list_users(  # noqa: PLR0913
    _current_admin: CurrentAdmin,
    repo: UserRepo,
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = Query(None),
    role: UserRole | None = Query(None),  # noqa: B008
    user_status: UserStatus | None = Query(None, alias="status"),  # noqa: B008
    q: str | None = Query(None, max_length=100),
) -> CursorPage[UserAdminResponse]:
    items, next_cursor = await AdminUserService(repo).list_users(
        limit=limit,
        cursor=cursor,
        role=role,
        status=user_status,
        q=q,
    )
    return CursorPage[UserAdminResponse](items=items, next_cursor=next_cursor)


@router.get("/users/{user_id}", response_model=UserAdminResponse)
async def get_user(user_id: UUID, _current_admin: CurrentAdmin, repo: UserRepo) -> User:
    return await _get_user_or_404(repo, user_id)


@router.patch("/users/{user_id}", response_model=UserAdminResponse)
async def update_user(
    user_id: UUID,
    data: AdminUserUpdate,
    current_admin: CurrentAdmin,
    repo: UserRepo,
) -> User:
    target = await _get_user_or_404(repo, user_id)
    return await AdminUserService(repo).update_user(current_admin, target, data)


@router.patch("/users/{user_id}/limits", response_model=UserLimitsResponse)
async def update_user_limits(
    user_id: UUID,
    data: UserLimitsUpdate,
    _current_admin: CurrentAdmin,
    repo: UserRepo,
    limits_service: UserLimitsSvc,
) -> UserLimitsResponse:
    await _get_user_or_404(repo, user_id)
    limits = await limits_service.update(user_id, data)
    return UserLimitsResponse.model_validate(limits)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    current_admin: CurrentAdmin,
    repo: UserRepo,
) -> None:
    target = await _get_user_or_404(repo, user_id)
    await AdminUserService(repo).delete_user(current_admin, target)
