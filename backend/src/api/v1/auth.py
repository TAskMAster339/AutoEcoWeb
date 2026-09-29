import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from src.core.config import settings
from src.core.cookies import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from src.core.dependencies import (
    AuthLimiter,
    CurrentUser,
    EmailCodeRepo,
    EmailSvc,
    RefreshRepo,
    UserRepo,
)
from src.models.user import User
from src.schemas.auth import (
    LogoutRequest,
    PasswordChange,
    PasswordRecoveryRequest,
    PasswordRecoveryVerify,
    PasswordReset,
    RefreshRequest,
    ResendVerificationRequest,
    TokenPair,
    VerifyEmailRequest,
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
from src.services.rate_limit import client_ip
from src.services.user import UserService

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
logger = logging.getLogger(__name__)

_REGISTER_LIMIT = (10, 5, 3600)
_LOGIN_LIMIT = (30, 10, 900)
_CODE_REQUEST_LIMIT = (10, 5, 3600)
_CODE_VERIFY_LIMIT = (30, 10, 900)
_REFRESH_LIMIT = (120, 120, 900)


async def _limit_auth(
    limiter: AuthLimiter,
    request: Request,
    *,
    action: str,
    email: str | None,
    policy: tuple[int, int, int],
) -> None:
    ip_limit, email_limit, window_seconds = policy
    await limiter.check(
        action=action,
        ip=client_ip(request),
        email=email,
        ip_limit=ip_limit,
        email_limit=email_limit,
        window_seconds=window_seconds,
    )


def _auth_service(
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
) -> AuthService:
    return AuthService(user_repo, refresh_repo, code_repo, email_service)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    data: UserCreate,
    request: Request,
    limiter: AuthLimiter,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
) -> User:
    """Регистрация: создаёт пользователя (status=pending) и отправляет
    6-значный код подтверждения на почту."""
    await _limit_auth(
        limiter,
        request,
        action="register",
        email=data.email,
        policy=_REGISTER_LIMIT,
    )
    return await _auth_service(
        user_repo,
        refresh_repo,
        code_repo,
        email_service,
    ).register(data)


@router.post("/verify-email", response_model=UserResponse)
async def verify_email(
    data: VerifyEmailRequest,
    request: Request,
    limiter: AuthLimiter,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
) -> User:
    """Подтверждение почты кодом из письма: pending → verified."""
    await _limit_auth(
        limiter,
        request,
        action="verify_email",
        email=str(data.email),
        policy=_CODE_VERIFY_LIMIT,
    )
    return await _auth_service(
        user_repo,
        refresh_repo,
        code_repo,
        email_service,
    ).verify_email(
        data.email,
        data.code,
    )


@router.post("/verify-email/resend", status_code=status.HTTP_204_NO_CONTENT)
async def resend_verification(
    data: ResendVerificationRequest,
    request: Request,
    limiter: AuthLimiter,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
) -> None:
    """Новый код подтверждения почты (старые коды аннулируются)."""
    await _limit_auth(
        limiter,
        request,
        action="resend_verification",
        email=str(data.email),
        policy=_CODE_REQUEST_LIMIT,
    )
    await _auth_service(
        user_repo,
        refresh_repo,
        code_repo,
        email_service,
    ).resend_verification(
        data.email,
    )


@router.post("/password-recovery/request", status_code=status.HTTP_204_NO_CONTENT)
async def password_recovery_request(
    data: PasswordRecoveryRequest,
    request: Request,
    limiter: AuthLimiter,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
) -> None:
    """Запрос восстановления пароля: отправляет код на почту.

    Всегда отвечает 204 — не раскрывает, существует ли такой email.
    """
    await _limit_auth(
        limiter,
        request,
        action="password_recovery_request",
        email=str(data.email),
        policy=_CODE_REQUEST_LIMIT,
    )
    await _auth_service(
        user_repo,
        refresh_repo,
        code_repo,
        email_service,
    ).request_password_reset(
        data.email,
    )


@router.post("/password-recovery/verify", status_code=status.HTTP_204_NO_CONTENT)
async def password_recovery_verify(
    data: PasswordRecoveryVerify,
    request: Request,
    limiter: AuthLimiter,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
) -> None:
    """Проверка кода восстановления (без побочных эффектов)."""
    await _limit_auth(
        limiter,
        request,
        action="password_recovery_verify",
        email=str(data.email),
        policy=_CODE_VERIFY_LIMIT,
    )
    await _auth_service(
        user_repo,
        refresh_repo,
        code_repo,
        email_service,
    ).verify_reset_code(
        data.email,
        data.code,
    )


@router.post("/password-recovery/reset", status_code=status.HTTP_204_NO_CONTENT)
async def password_recovery_reset(
    data: PasswordReset,
    request: Request,
    limiter: AuthLimiter,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
) -> None:
    """Смена пароля по коду: код одноразовый, все сессии отзываются."""
    await _limit_auth(
        limiter,
        request,
        action="password_recovery_reset",
        email=str(data.email),
        policy=_CODE_VERIFY_LIMIT,
    )
    await _auth_service(
        user_repo,
        refresh_repo,
        code_repo,
        email_service,
    ).reset_password(
        data.email,
        data.code,
        data.new_password,
    )


@router.post("/login", response_model=UserResponse)
async def login(  # noqa: PLR0913
    data: UserLogin,
    request: Request,
    limiter: AuthLimiter,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
    response: Response,
) -> UserResponse:
    await _limit_auth(
        limiter,
        request,
        action="login",
        email=data.email,
        policy=_LOGIN_LIMIT,
    )
    tokens = await _auth_service(
        user_repo,
        refresh_repo,
        code_repo,
        email_service,
    ).login(data)
    set_auth_cookies(
        response,
        tokens.access_token,
        tokens.refresh_token,
        settings.cookie_secure,
    )
    return tokens.user


@router.post("/refresh", response_model=TokenPair)
async def refresh(  # noqa: PLR0913
    request: Request,
    response: Response,
    limiter: AuthLimiter,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
    data: RefreshRequest | None = None,
) -> TokenPair:
    await _limit_auth(
        limiter,
        request,
        action="refresh",
        email=None,
        policy=_REFRESH_LIMIT,
    )
    raw = data.refresh_token if data else request.cookies.get(REFRESH_COOKIE)
    if not raw:
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh-токен отсутствует",
        )
    try:
        tokens = await _auth_service(
            user_repo,
            refresh_repo,
            code_repo,
            email_service,
        ).refresh(raw)
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
async def logout(  # noqa: PLR0913
    request: Request,
    response: Response,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
    data: LogoutRequest | None = None,
) -> None:
    raw = data.refresh_token if data else request.cookies.get(REFRESH_COOKIE)
    if raw:
        try:  # noqa: SIM105
            await _auth_service(
                user_repo,
                refresh_repo,
                code_repo,
                email_service,
            ).logout(raw)
        except Exception as exc:
            logger.warning(
                "Refresh token cleanup failed during logout",
                extra={
                    "event": "auth.logout_cleanup_failed",
                    "error_type": type(exc).__name__,
                },
            )
    clear_auth_cookies(response)


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUser) -> User:
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    current_user: CurrentUser,
    repo: UserRepo,
) -> User:
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
async def change_password(  # noqa: PLR0913
    data: PasswordChange,
    current_user: CurrentUser,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
    response: Response,
) -> UserResponse:
    """Смена пароля: проверка текущего, отзыв всех прочих сессий, ротация кук."""
    tokens = await _auth_service(
        user_repo,
        refresh_repo,
        code_repo,
        email_service,
    ).change_password(
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
    request: Request,
    limiter: AuthLimiter,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
) -> TokenPair:
    await _limit_auth(
        limiter,
        request,
        action="token",
        email=form.username,
        policy=_LOGIN_LIMIT,
    )
    return await _auth_service(user_repo, refresh_repo, code_repo, email_service).login(
        UserLogin(email=form.username, password=form.password),
    )
