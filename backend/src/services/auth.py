import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from src.core.config import settings
from src.core.enums.user_status import UserStatus
from src.core.security import create_access_token, hash_password, verify_password
from src.models.user import User
from src.repositories.refresh_token import RefreshTokenRepository
from src.repositories.user import UserRepository
from src.schemas.auth import LoginResponse, TokenPair
from src.schemas.user import UserLogin


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class AuthService:
    def __init__(
        self,
        user_repo: UserRepository,
        refresh_repo: RefreshTokenRepository,
    ) -> None:
        self._users = user_repo
        self._tokens = refresh_repo

    async def login(self, data: UserLogin) -> LoginResponse:
        user = await self._users.get_by_email(data.email.lower())
        if user is None or not verify_password(data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный email или пароль",
            )
        self._ensure_can_auth(user)
        return await self._issue_tokens(user)

    async def refresh(self, raw_token: str) -> TokenPair:
        token = await self._tokens.get_active(_hash_refresh_token(raw_token))
        if token is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh-токен недействителен или отозван",
            )
        user = await self._users.get(token.user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Пользователь не найден",
            )
        self._ensure_can_auth(user)

        await self._tokens.revoke(token)
        return await self._issue_tokens(user)

    async def logout(self, raw_token: str) -> None:
        token = await self._tokens.get_active(_hash_refresh_token(raw_token))
        if token is not None:
            await self._tokens.revoke(token)

    async def change_password(
        self,
        user: User,
        current_password: str,
        new_password: str,
    ) -> LoginResponse:
        """Смена пароля: проверка текущего, отзыв всех сессий, ротация токенов.

        Текущая сессия не вылетает (выдаётся свежая пара токенов и новые
        куки), все остальные устройства — выходят.
        """
        if not verify_password(current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Текущий пароль неверен",  # noqa: RUF001
            )
        if current_password == new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Новый пароль должен отличаться от текущего",  # noqa: RUF001
            )
        updated = await self._users.update(
            user,
            password_hash=hash_password(new_password),
        )
        await self._tokens.revoke_all_for_user(user.id)
        return await self._issue_tokens(updated)

    async def _issue_tokens(self, user: User) -> LoginResponse:
        access_token = create_access_token(user.id)
        raw_refresh = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.refresh_token_expire_days,
        )
        await self._tokens.create(
            user.id,
            _hash_refresh_token(raw_refresh),
            expires_at,
        )
        return LoginResponse(
            access_token=access_token,
            refresh_token=raw_refresh,
            user=user,
        )

    @staticmethod
    def _ensure_can_auth(user: User) -> None:
        if user.status == UserStatus.BLOCKED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Аккаунт заблокирован",
            )
        if user.status == UserStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Аккаунт не подтверждён",
            )
