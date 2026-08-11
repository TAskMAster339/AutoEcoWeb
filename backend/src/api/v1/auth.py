from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from src.core.config import settings
from src.core.cookies import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from src.core.dependencies import (
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
from src.services.user import UserService

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


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
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
) -> User:
    """Регистрация: создаёт пользователя (status=pending) и отправляет
    6-значный код подтверждения на почту."""
    return await _auth_service(
        user_repo,
        refresh_repo,
        code_repo,
        email_service,
    ).register(data)


@router.post("/verify-email", response_model=UserResponse)
async def verify_email(
    data: VerifyEmailRequest,
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
) -> User:
    """Подтверждение почты кодом из письма: pending → verified."""
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
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
) -> None:
    """Новый код подтверждения почты (старые коды аннулируются)."""
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
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
) -> None:
    """Запрос восстановления пароля: отправляет код на почту.

    Всегда отвечает 204 — не раскрывает, существует ли такой email.
    """
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
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
) -> None:
    """Проверка кода восстановления (без побочных эффектов)."""
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
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
) -> None:
    """Смена пароля по коду: код одноразовый, все сессии отзываются."""
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
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
    response: Response,
) -> User:
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
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
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
    user_repo: UserRepo,
    refresh_repo: RefreshRepo,
    code_repo: EmailCodeRepo,
    email_service: EmailSvc,
) -> TokenPair:
    return await _auth_service(user_repo, refresh_repo, code_repo, email_service).login(
        UserLogin(email=form.username, password=form.password),
    )
