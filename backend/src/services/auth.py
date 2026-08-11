import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from src.core.config import settings
from src.core.enums.email_code_purpose import EmailCodePurpose
from src.core.enums.user_status import UserStatus
from src.core.security import (
    create_access_token,
    generate_email_code,
    hash_email_code,
    hash_password,
    verify_password,
)
from src.models.email_code import EmailCode
from src.models.user import User
from src.repositories.email_code import EmailCodeRepository
from src.repositories.refresh_token import RefreshTokenRepository
from src.repositories.user import UserRepository
from src.schemas.auth import LoginResponse, TokenPair
from src.schemas.user import UserCreate, UserLogin
from src.services.email import EmailService


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class AuthService:
    def __init__(
        self,
        user_repo: UserRepository,
        refresh_repo: RefreshTokenRepository,
        email_code_repo: EmailCodeRepository,
        email_service: EmailService,
    ) -> None:
        self._users = user_repo
        self._tokens = refresh_repo
        self._codes = email_code_repo
        self._email = email_service

    # ---------- Регистрация и подтверждение почты ----------

    async def register(self, data: UserCreate) -> User:
        """Создаёт пользователя (status=pending) и отправляет 6-значный код на почту."""
        email = data.email.lower()
        existing = await self._users.get_by_email(email)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Пользователь с таким email уже существует",  # noqa: RUF001
            )
        user = await self._users.create(
            email=email,
            password_hash=hash_password(data.password),
        )
        try:
            await self._send_code(user, EmailCodePurpose.VERIFY_EMAIL)
        except HTTPException:
            # Письмо не ушло (например, SMTP недоступен) — не оставляем
            # пользователя в БД: иначе повторная регистрация вернёт 409.
            await self._users.delete(user)
            raise
        return user

    async def verify_email(self, email: str, code: str) -> User:
        """Подтверждает почту: pending → verified. Вход всё ещё закрыт до активации."""
        user = await self._get_by_email(email)
        if user.status == UserStatus.BLOCKED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Аккаунт заблокирован",
            )
        if user.status != UserStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Почта уже подтверждена",
            )
        email_code = await self._validate_code(
            user,
            EmailCodePurpose.VERIFY_EMAIL,
            code,
        )
        await self._codes.mark_used(email_code)
        return await self._users.update(user, status=UserStatus.VERIFIED)

    async def resend_verification(self, email: str) -> None:
        """Новый код подтверждения. Несуществующий email — тихий успех."""
        user = await self._users.get_by_email(email.lower())
        if user is None:
            return
        if user.status == UserStatus.BLOCKED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Аккаунт заблокирован",
            )
        if user.status != UserStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Почта уже подтверждена",
            )
        await self._send_code(user, EmailCodePurpose.VERIFY_EMAIL)

    # ---------- Восстановление пароля ----------

    async def request_password_reset(self, email: str) -> None:
        """Отправляет код сброса пароля. Несуществующий email — тихий успех
        (защита от перечисления зарегистрированных адресов)."""  # noqa: RUF002
        user = await self._users.get_by_email(email.lower())
        if user is None:
            return
        await self._send_code(user, EmailCodePurpose.RESET_PASSWORD)

    async def verify_reset_code(self, email: str, code: str) -> None:
        """Проверяет код сброса (без побочных эффектов)
        — для шага «ввести новый пароль»."""  # noqa: RUF002
        user = await self._get_by_email(email)
        await self._validate_code(user, EmailCodePurpose.RESET_PASSWORD, code)

    async def reset_password(self, email: str, code: str, new_password: str) -> None:
        """Меняет пароль по коду и отзывает все сессии пользователя."""
        user = await self._get_by_email(email)
        email_code = await self._validate_code(
            user,
            EmailCodePurpose.RESET_PASSWORD,
            code,
        )
        await self._codes.mark_used(email_code)
        await self._users.update(user, password_hash=hash_password(new_password))
        await self._tokens.revoke_all_for_user(user.id)

    # ---------- Логин / токены ----------

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
                detail="Текущий пароль неверен",
            )
        if current_password == new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Новый пароль должен отличаться от текущего",
            )
        updated = await self._users.update(
            user,
            password_hash=hash_password(new_password),
        )
        await self._tokens.revoke_all_for_user(user.id)
        return await self._issue_tokens(updated)

    # ---------- Внутренние помощники ----------

    async def _send_code(self, user: User, purpose: EmailCodePurpose) -> None:
        code = generate_email_code()
        # Новый запрос аннулирует все прежние коды этого пользователя/назначения
        await self._codes.invalidate_all_for_user(user.id, purpose)
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.email_code_ttl_minutes,
        )
        await self._codes.create(
            user.id,
            hash_email_code(code),
            purpose,
            expires_at,
        )
        await self._email.send_code(user.email, purpose, code)

    async def _validate_code(
        self,
        user: User,
        purpose: EmailCodePurpose,
        code: str,
    ) -> EmailCode:
        code = code.strip()
        if not code.isdigit() or len(code) != 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Код должен состоять из 6 цифр",
            )
        email_code = await self._codes.get_active(user.id, purpose)
        if email_code is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Код недействителен или истёк — запросите новый",
            )
        if hash_email_code(code) != email_code.code_hash:
            await self._codes.bump_attempts(email_code)
            if email_code.attempts >= settings.email_code_max_attempts:
                await self._codes.mark_used(email_code)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Слишком много неверных попыток — запросите новый код",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный код",
            )
        return email_code

    async def _get_by_email(self, email: str) -> User:
        user = await self._users.get_by_email(email.lower())
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден",
            )
        return user

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
        if user.status == UserStatus.VERIFIED:
            # Как и неактивный: вход закрыт до активации администратором
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Аккаунт не активирован администратором",
            )
