from uuid import UUID

from pydantic import BaseModel, Field


class SellerResponse(BaseModel):
    seller_id: UUID
    seller_name: str
    normalized_seller_name: str
    alias_id: UUID | None = None
    alias_name: str | None = None
    transaction_count: int
    receipt_count: int
    filter_value: str


class SellerUpdate(BaseModel):
    seller_name: str = Field(min_length=1, max_length=255)


class SellerDeleteResponse(BaseModel):
    deleted: bool = True
    seller_id: UUID
    seller_name: str
