from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field
from src.core.enums.user_role import UserRole
from src.core.enums.user_status import UserStatus


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    role: UserRole
    status: UserStatus

    model_config = {
        "from_attributes": True,
    }


class UserUpdate(BaseModel):
    email: str | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


class ProverkachekaTokenUpdate(BaseModel):
    """Тело PUT /auth/me/proverkacheka-token."""

    token: str = Field(min_length=1, max_length=256)


class ProverkachekaTokenStatus(BaseModel):
    """Признак наличия токена — сам токен в ответе не отдаётся."""

    has_token: bool


class AdminUserUpdate(BaseModel):
    role: UserRole | None = None
    status: UserStatus | None = None


class UserAdminResponse(UserResponse):
    created_at: datetime
    updated_at: datetime
