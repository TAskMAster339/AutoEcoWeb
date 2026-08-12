"""Тесты кодов подтверждения почты и восстановления пароля.

SMTP в тестах не настроен (SMTP_HOST пуст), поэтому письма не отправляются —
используется CapturingEmailService, который перехватывает сгенерированные коды.
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from src.core.enums.email_code_purpose import EmailCodePurpose
from src.core.enums.user_status import UserStatus
from src.core.security import verify_password
from src.repositories.email_code import EmailCodeRepository
from src.repositories.refresh_token import RefreshTokenRepository
from src.repositories.user import UserRepository
from src.schemas.user import UserCreate
from src.services.auth import AuthService
from src.services.email import EmailService


class CapturingEmailService(EmailService):
    """Перехватывает «отправленные» коды вместо реального SMTP."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, EmailCodePurpose, str]] = []

    async def send_code(
        self, to_email: str, purpose: EmailCodePurpose, code: str
    ) -> bool:
        self.sent.append((to_email, purpose, code))
        return False


class FailingEmailService(EmailService):
    """Имитирует недоступный SMTP: отправка письма падает с 502."""

    async def send_code(
        self, to_email: str, purpose: EmailCodePurpose, code: str
    ) -> bool:
        raise HTTPException(
            status_code=502,
            detail="Не удалось отправить письмо — проверьте SMTP-настройки",  # noqa: RUF001
        )


@pytest.fixture
async def email_service():
    return CapturingEmailService()


@pytest.fixture
async def auth(session, email_service):
    return AuthService(
        UserRepository(session),
        RefreshTokenRepository(session),
        EmailCodeRepository(session),
        email_service,
    )


def _last_code(email_service: CapturingEmailService) -> str:
    assert email_service.sent, "код не был «отправлен»"
    return email_service.sent[-1][2]


async def test_register_sends_verification_code_and_keeps_pending(auth, email_service):
    user = await auth.register(
        UserCreate(email="User@Example.com", password="password123")
    )

    assert user.email == "user@example.com"
    assert user.status == UserStatus.PENDING
    assert len(email_service.sent) == 1
    to_email, purpose, code = email_service.sent[0]
    assert to_email == user.email
    assert purpose == EmailCodePurpose.VERIFY_EMAIL
    assert len(code) == 6 and code.isdigit()


async def test_register_duplicate_email_conflicts(auth, email_service):
    await auth.register(UserCreate(email="dup@example.com", password="password123"))

    with pytest.raises(HTTPException) as exc:
        await auth.register(UserCreate(email="dup@example.com", password="password123"))
    assert exc.value.status_code == 409


async def test_register_rolls_back_user_when_email_send_fails(session):
    """Если SMTP недоступен (502) — пользователь не остаётся в БД,
    повторная регистрация с тем же email должна пройти."""
    failing = FailingEmailService()
    auth = AuthService(
        UserRepository(session),
        RefreshTokenRepository(session),
        EmailCodeRepository(session),
        failing,
    )
    with pytest.raises(HTTPException) as exc:
        await auth.register(
            UserCreate(email="rollback@example.com", password="password123")
        )
    assert exc.value.status_code == 502

    repo = UserRepository(session)
    assert await repo.get_by_email("rollback@example.com") is None

    # повторная попытка не должна упасть на «уже существует»
    ok = AuthService(
        UserRepository(session),
        RefreshTokenRepository(session),
        EmailCodeRepository(session),
        CapturingEmailService(),
    )
    user = await ok.register(
        UserCreate(email="rollback@example.com", password="password123")
    )
    assert user.email == "rollback@example.com"


async def test_verify_email_with_wrong_code(auth, email_service):
    user = await auth.register(
        UserCreate(email="v@example.com", password="password123")
    )

    with pytest.raises(HTTPException) as exc:
        await auth.verify_email(user.email, "000000")
    assert exc.value.status_code == 400
    assert "Неверный код" in exc.value.detail


async def test_verify_email_sets_verified_and_consumes_code(
    auth, email_service, session
):
    user = await auth.register(
        UserCreate(email="v@example.com", password="password123")
    )
    code = _last_code(email_service)

    updated = await auth.verify_email(user.email, code)

    assert updated.status == UserStatus.VERIFIED
    # Код одноразовый: активных кодов подтверждения больше нет
    active = await EmailCodeRepository(session).get_active(
        user.id,
        EmailCodePurpose.VERIFY_EMAIL,
    )
    assert active is None
    # Повторный вызов — конфликт: почта уже подтверждена
    with pytest.raises(HTTPException) as exc:
        await auth.verify_email(user.email, code)
    assert exc.value.status_code == 409


async def test_verify_email_twice_conflicts(auth, email_service):
    user = await auth.register(
        UserCreate(email="v2@example.com", password="password123")
    )
    code = _last_code(email_service)
    await auth.verify_email(user.email, code)

    with pytest.raises(HTTPException) as exc:
        await auth.verify_email(user.email, code)
    assert exc.value.status_code == 409

    with pytest.raises(HTTPException) as exc:
        await auth.resend_verification(user.email)
    assert exc.value.status_code == 409


async def test_resend_verification_invalidates_old_code(auth, email_service):
    user = await auth.register(
        UserCreate(email="r@example.com", password="password123")
    )
    old_code = _last_code(email_service)

    await auth.resend_verification(user.email)
    new_code = _last_code(email_service)
    assert new_code != old_code

    with pytest.raises(HTTPException) as exc:
        await auth.verify_email(user.email, old_code)
    assert exc.value.status_code == 400  # старый код аннулирован


async def test_resend_verification_silent_for_unknown_email(auth, email_service):
    await auth.resend_verification("nobody@example.com")  # не должно бросать
    assert email_service.sent == []


async def test_request_password_reset_creates_reset_code(auth, email_service):
    user = await auth.register(
        UserCreate(email="p@example.com", password="password123")
    )
    email_service.sent.clear()

    await auth.request_password_reset(user.email)

    assert len(email_service.sent) == 1
    purpose = email_service.sent[0][1]
    assert purpose == EmailCodePurpose.RESET_PASSWORD


async def test_request_password_reset_silent_for_unknown_email(auth, email_service):
    await auth.request_password_reset("nobody@example.com")
    assert email_service.sent == []


async def test_verify_reset_code(auth, email_service):
    user = await auth.register(
        UserCreate(email="p2@example.com", password="password123")
    )
    await auth.request_password_reset(user.email)
    code = _last_code(email_service)

    await auth.verify_reset_code(user.email, code)  # не бросает

    with pytest.raises(HTTPException) as exc:
        await auth.verify_reset_code(user.email, "123456")
    assert exc.value.status_code == 400


async def test_reset_password_changes_password_revokes_sessions_and_consumes_code(
    auth,
    email_service,
    session,
):
    user = await auth.register(
        UserCreate(email="p3@example.com", password="old-pass-123")
    )
    token_repo = RefreshTokenRepository(session)
    await token_repo.create(
        user.id,
        "hash-of-refresh-token",
        datetime.now(timezone.utc) + timedelta(days=30),
    )
    await auth.request_password_reset(user.email)
    code = _last_code(email_service)

    await auth.reset_password(user.email, code, "new-pass-456")

    await session.refresh(user)
    assert verify_password("new-pass-456", user.password_hash)
    assert not verify_password("old-pass-123", user.password_hash)
    # Все сессии отозваны
    assert await token_repo.get_active("hash-of-refresh-token") is None
    # Код одноразовый
    with pytest.raises(HTTPException) as exc:
        await auth.reset_password(user.email, code, "another-pass-789")
    assert exc.value.status_code == 400


async def test_wrong_code_exhausts_attempts(auth, email_service):
    user = await auth.register(
        UserCreate(email="a@example.com", password="password123")
    )
    await auth.request_password_reset(user.email)
    code = _last_code(email_service)

    for _ in range(4):
        with pytest.raises(HTTPException) as exc:
            await auth.verify_reset_code(user.email, "000000")
        assert exc.value.status_code == 400

    # 5-я неверная попытка аннулирует код
    with pytest.raises(HTTPException) as exc:
        await auth.verify_reset_code(user.email, "000000")
    assert exc.value.status_code == 400
    assert "запросите новый" in exc.value.detail

    # Даже верный код больше не подойдёт
    with pytest.raises(HTTPException) as exc:
        await auth.verify_reset_code(user.email, code)
    assert exc.value.status_code == 400


async def test_login_blocked_for_pending_and_verified(auth, email_service, session):
    from src.schemas.user import UserLogin

    user = await auth.register(
        UserCreate(email="block@example.com", password="password123")
    )

    with pytest.raises(HTTPException) as exc:
        await auth.login(UserLogin(email=user.email, password="password123"))
    assert exc.value.status_code == 403

    code = _last_code(email_service)
    await auth.verify_email(user.email, code)

    login = await auth.login(UserLogin(email=user.email, password="password123"))
    assert login.user.status == UserStatus.VERIFIED


async def test_admin_can_activate_verified_user(auth, email_service, session):
    from src.core.enums.user_role import UserRole
    from src.schemas.user import AdminUserUpdate, UserLogin
    from src.services.user import AdminUserService

    user = await auth.register(
        UserCreate(email="act@example.com", password="password123")
    )
    code = _last_code(email_service)
    await auth.verify_email(user.email, code)
    await session.refresh(user)
    assert user.status == UserStatus.VERIFIED

    admin = await UserRepository(session).create(
        email="admin@example.com",
        password_hash="x",
    )
    await UserRepository(session).update(admin, role=UserRole.ADMIN)
    await AdminUserService(UserRepository(session)).update_user(
        actor=admin,
        target=user,
        data=AdminUserUpdate(status=UserStatus.ACTIVE),
    )
    await session.refresh(user)
    assert user.status == UserStatus.ACTIVE

    tokens = await auth.login(UserLogin(email=user.email, password="password123"))
    assert tokens.access_token
