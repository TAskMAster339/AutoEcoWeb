from pydantic import BaseModel, Field


class UserLimitsResponse(BaseModel):
    max_tags: int
    max_seller_aliases: int
    max_product_aliases: int
    max_receipts: int
    max_transactions: int
    max_receipt_items: int
    max_import_rows: int

    model_config = {"from_attributes": True}


class UserLimitsUpdate(BaseModel):
    max_tags: int | None = Field(default=None, ge=0, le=1_000_000)
    max_seller_aliases: int | None = Field(default=None, ge=0, le=1_000_000)
    max_product_aliases: int | None = Field(default=None, ge=0, le=1_000_000)
    max_receipts: int | None = Field(default=None, ge=0, le=10_000_000)
    max_transactions: int | None = Field(default=None, ge=0, le=100_000_000)
    max_receipt_items: int | None = Field(default=None, ge=0, le=100_000)
    max_import_rows: int | None = Field(default=None, ge=0, le=1_000_000)


class UserUsageResponse(BaseModel):
    tags: int
    seller_aliases: int
    product_aliases: int
    receipts: int
    transactions: int


class UserLimitsOverview(BaseModel):
    limits: UserLimitsResponse
    usage: UserUsageResponse
