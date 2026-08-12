from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class FeedbackCreate(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=10, max_length=10000)


class FeedbackAnswer(BaseModel):
    reply: str = Field(min_length=1, max_length=10000)


class FeedbackResponse(BaseModel):
    id: UUID
    user_id: UUID
    email: str
    subject: str
    message: str
    status: str
    admin_reply: str | None
    replied_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FeedbackPageResponse(BaseModel):
    items: list[FeedbackResponse]
    total: int
    limit: int
    offset: int

    model_config = {"from_attributes": True}
