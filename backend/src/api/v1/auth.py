from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from src.core.config import settings
from src.core.cookies import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from src.core.dependencies import CurrentUser, RefreshRepo, UserRepo
from src.models.user import User
from src.schemas.auth import (
    LogoutRequest,
    PasswordChange,
    RefreshRequest,
    TokenPair,
)
from src.schemas.user import (
    ProverkachekaTokenStatus,
    ProverkachekaTokenUpdate,
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
)
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


@router.post("/login", response_model=UserResponse)
async def login(
    data: UserLogin,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    response: Response,
) -> User:
    tokens = await AuthService(user_repo, refresh_repo).login(data)
    set_auth_cookies(
        response,
        tokens.access_token,
        tokens.refresh_token,
        settings.cookie_secure,
    )
    return tokens.user


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    request: Request,
    response: Response,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    data: RefreshRequest | None = None,
) -> TokenPair:
    raw = data.refresh_token if data else request.cookies.get(REFRESH_COOKIE)
    if not raw:
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh-токен отсутствует",
        )
    try:
        tokens = await AuthService(user_repo, refresh_repo).refresh(raw)
    except HTTPException:
        clear_auth_cookies(response)
        raise
    set_auth_cookies(
        response,
        tokens.access_token,
        tokens.refresh_token,
        settings.cookie_secure,
    )
    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    data: LogoutRequest | None = None,
) -> None:
    raw = data.refresh_token if data else request.cookies.get(REFRESH_COOKIE)
    if raw:
        try:  # noqa: SIM105
            await AuthService(user_repo, refresh_repo).logout(raw)
        except Exception:
            pass  # best-effort: cookie cleanup must still happen
    clear_auth_cookies(response)


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


@router.get("/me/proverkacheka-token", response_model=ProverkachekaTokenStatus)
async def get_proverkacheka_token(
    current_user: CurrentUser,
) -> ProverkachekaTokenStatus:
    return ProverkachekaTokenStatus(has_token=bool(current_user.proverkacheka_token))


@router.put("/me/proverkacheka-token", response_model=ProverkachekaTokenStatus)
async def update_proverkacheka_token(
    data: ProverkachekaTokenUpdate,
    current_user: CurrentUser,
    repo: UserRepo,
) -> ProverkachekaTokenStatus:
    user = await UserService(repo).update_proverkacheka_token(current_user, data.token)
    return ProverkachekaTokenStatus(has_token=bool(user.proverkacheka_token))


@router.post("/change-password", response_model=UserResponse)
async def change_password(
    data: PasswordChange,
    current_user: CurrentUser,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    response: Response,
) -> UserResponse:
    """Смена пароля: проверка текущего, отзыв всех прочих сессий, ротация кук."""
    tokens = await AuthService(user_repo, refresh_repo).change_password(
        current_user,
        data.current_password,
        data.new_password,
    )
    set_auth_cookies(
        response,
        tokens.access_token,
        tokens.refresh_token,
        settings.cookie_secure,
    )
    return tokens.user


@router.post("/token", response_model=TokenPair)
async def token(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
) -> TokenPair:
    return await AuthService(user_repo, refresh_repo).login(
        UserLogin(email=form.username, password=form.password),
    )
