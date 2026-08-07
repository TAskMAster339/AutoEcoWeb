from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.cookies import ACCESS_COOKIE
from src.core.database import get_db
from src.core.enums.user_role import UserRole
from src.core.enums.user_status import UserStatus
from src.core.security import decode_access_token
from src.models.user import User
from src.repositories.refresh_token import RefreshTokenRepository
from src.repositories.user import UserRepository

DBSession = Annotated[AsyncSession, Depends(get_db)]


async def get_user_repo(session: DBSession) -> UserRepository:
    return UserRepository(session)


UserRepo = Annotated[UserRepository, Depends(get_user_repo)]


async def get_refresh_repo(session: DBSession) -> RefreshTokenRepository:
    return RefreshTokenRepository(session)


RefreshRepo = Annotated[RefreshTokenRepository, Depends(get_refresh_repo)]


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/token",
    auto_error=False,  # нет заголовка → None (не 401), куку читаем сами
)


async def get_current_user(
    request: Request,
    repo: UserRepo,
    bearer_token: Annotated[str | None, Depends(oauth2_scheme)] = None,
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить credentials",  # noqa: RUF001
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1) Браузер: кука autoeco_access приходит сама, JS её не касается
    token = request.cookies.get(ACCESS_COOKIE)

    # 2) Фолбэк: Swagger и API-клиенты шлют Authorization: Bearer <token>
    if token is None:
        token = bearer_token

    if token is None:
        raise credentials_error

    try:
        user_id = decode_access_token(token)
    except (JWTError, ValueError):
        raise credentials_error  # noqa: B904

    user = await repo.get(user_id)
    if user is None:
        raise credentials_error

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт неактивен или заблокирован",
        )

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_current_admin(current_user: CurrentUser) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуются права администратора",
        )
    return current_user


CurrentAdmin = Annotated[User, Depends(get_current_admin)]
