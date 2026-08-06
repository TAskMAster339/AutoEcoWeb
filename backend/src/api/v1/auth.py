from fastapi import APIRouter, status
from src.core.dependencies import CurrentUser, RefreshRepo, UserRepo
from src.models.user import User
from src.schemas.auth import LoginResponse, LogoutRequest, RefreshRequest, TokenPair
from src.schemas.user import UserCreate, UserLogin, UserResponse, UserUpdate
from src.services.auth import AuthService
from src.services.user import UserService

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(data: UserCreate, repo: UserRepo) -> User:
    return await UserService(repo).register(data)


@router.post("/login", response_model=LoginResponse)
async def login(
    data: UserLogin,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
) -> LoginResponse:
    return await AuthService(user_repo, refresh_repo).login(data)


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    data: RefreshRequest,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
) -> TokenPair:
    return await AuthService(user_repo, refresh_repo).refresh(data.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    data: LogoutRequest,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
) -> None:
    await AuthService(user_repo, refresh_repo).logout(data.refresh_token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUser) -> User:
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    current_user: CurrentUser,
    repo: UserRepo,
) -> UserResponse:
    return await UserService(repo).update_profile(current_user, data)
