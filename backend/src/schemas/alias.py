from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

AliasScopeLiteral = Literal["seller", "product"]


class AliasCreate(BaseModel):
    original_name: str = Field(min_length=1, max_length=255)
    alias_name: str = Field(min_length=1, max_length=255)
    # 'seller' — магазины, 'product' — товары (позиции транзакций)
    scope: AliasScopeLiteral = "seller"
    is_regex: bool = False
    priority: int = Field(default=0, ge=0, le=1000)


class AliasUpdate(BaseModel):
    original_name: str | None = Field(default=None, min_length=1, max_length=255)
    alias_name: str | None = Field(default=None, min_length=1, max_length=255)
    scope: AliasScopeLiteral | None = None
    is_regex: bool | None = None
    priority: int | None = Field(default=None, ge=0, le=1000)


class AliasResponse(BaseModel):
    id: UUID
    scope: AliasScopeLiteral
    original_name: str
    alias_name: str
    is_regex: bool
    priority: int
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }


class AliasApplyRequest(BaseModel):
    """POST /api/v1/aliases/apply: применить все алиасы (или одного scope)."""

    scope: AliasScopeLiteral | None = None


class AliasApplyResult(BaseModel):
    """Сколько записей переименовано при применении алиасов."""

    # seller: названия магазинов в чеках и ручных транзакциях
    seller_updated_receipts: int = 0
    seller_updated_transactions: int = 0
    # product: названия позиций транзакций
    product_updated: int = 0
