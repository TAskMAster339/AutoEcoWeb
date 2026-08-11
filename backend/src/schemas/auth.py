from pydantic import BaseModel, EmailStr, Field
from src.schemas.user import UserResponse


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginResponse(TokenPair):
    user: UserResponse


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class PasswordChange(BaseModel):
    """Тело POST /auth/change-password — смена пароля с проверкой текущего."""  # noqa: RUF002

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class VerifyEmailRequest(BaseModel):
    """Тело POST /auth/verify-email — подтверждение почты 6-значным кодом."""

    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class ResendVerificationRequest(BaseModel):
    """Тело POST /auth/verify-email/resend — новый код подтверждения."""

    email: EmailStr


class PasswordRecoveryRequest(BaseModel):
    """Тело POST /auth/password-recovery/request — запрос кода сброса."""  # noqa: RUF002

    email: EmailStr


class PasswordRecoveryVerify(BaseModel):
    """Тело POST /auth/password-recovery/verify — проверка кода сброса."""  # noqa: RUF002

    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class PasswordReset(BaseModel):
    """Тело POST /auth/password-recovery/reset — смена пароля по коду."""

    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=128)
