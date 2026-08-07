from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AliasCreate(BaseModel):
    original_name: str = Field(min_length=1, max_length=255)
    alias_name: str = Field(min_length=1, max_length=255)
    is_regex: bool = False
    priority: int = Field(default=0, ge=0, le=1000)


class AliasUpdate(BaseModel):
    original_name: str | None = Field(default=None, min_length=1, max_length=255)
    alias_name: str | None = Field(default=None, min_length=1, max_length=255)
    is_regex: bool | None = None
    priority: int | None = Field(default=None, ge=0, le=1000)


class AliasResponse(BaseModel):
    id: UUID
    original_name: str
    alias_name: str
    is_regex: bool
    priority: int
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }
