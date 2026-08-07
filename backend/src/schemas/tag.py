from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    icon: str | None = Field(default=None, max_length=64)


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    # Явный null очищает иконку (exclude_unset=True в сервисе)
    icon: str | None = Field(default=None, max_length=64)


class TagResponse(BaseModel):
    id: UUID
    name: str
    color: str
    icon: str | None
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }
