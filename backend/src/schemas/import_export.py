"""Схемы импорта/экспорта данных (универсальный формат).

Канонический формат (источник истины — экспорт приложения):
    Дата | Категория | Магазин | Описание | Количество | Единица |
    Цена | Комментарий | Теги | Доход | Расход

- Доход/Расход: одна из колонок заполнена числом >= 0, вторая пуста.
  Для нулевой операции направление задаётся заполненной колонкой.
- Теги: имена через запятую.
- Дата: YYYY-MM-DD (экспорт) или дата Excel.
"""

import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class ExportRow(BaseModel):
    date: datetime.date
    category: str
    store: str
    description: str
    quantity: Decimal
    unit: str
    price: Decimal
    comment: str
    tags: str
    income: Decimal | None
    expense: Decimal | None


class ExportOptions(BaseModel):
    date_from: datetime.date | None = None
    date_to: datetime.date | None = None
    format: str = Field(default="xlsx", pattern="^(xlsx|csv)$")

    @model_validator(mode="after")
    def validate_range(self):
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("date_from не может быть позже date_to")
        return self


class ImportRowPreview(BaseModel):
    """Нормализованная строка для предпросмотра перед импортом."""

    row_number: int
    date: datetime.date | None = None
    category: str = ""
    store: str = ""
    description: str = ""
    quantity: Decimal | None = None
    unit: str = "шт."
    price: Decimal | None = None
    comment: str = ""
    tags: list[str] = Field(default_factory=list)
    income: Decimal | None = None
    expense: Decimal | None = None
    operation_kind: Literal["income", "expense"] | None = None
    errors: list[str] = Field(default_factory=list)


class ImportPreviewResponse(BaseModel):
    rows: list[ImportRowPreview]
    total_rows: int
    valid_rows: int
    invalid_rows: int


class ImportRowIn(BaseModel):
    date: datetime.date
    category: str = ""
    store: str = ""
    description: str = ""
    quantity: Decimal = Field(default=Decimal("1"), gt=0, max_digits=12, decimal_places=3)
    unit: str = "шт."
    price: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    comment: str = ""
    tags: list[str] = Field(default_factory=list)
    income: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    expense: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    operation_kind: Literal["income", "expense"] | None = None

    @model_validator(mode="after")
    def validate_amount(self):
        income_present = "income" in self.model_fields_set
        expense_present = "expense" in self.model_fields_set

        if self.income > 0 and self.expense > 0:
            raise ValueError("Одновременно Доход и Расход не допускаются")

        inferred_kind: Literal["income", "expense"] | None = None
        if self.income > 0:
            inferred_kind = "income"
        elif self.expense > 0:
            inferred_kind = "expense"
        elif income_present != expense_present:
            inferred_kind = "income" if income_present else "expense"

        if inferred_kind is not None:
            if self.operation_kind is not None and self.operation_kind != inferred_kind:
                raise ValueError("Тип операции не соответствует колонке Доход/Расход")
            self.operation_kind = inferred_kind
        elif self.operation_kind is None:
            raise ValueError("Для нулевой суммы явно укажите тип операции")

        return self


class ImportRequest(BaseModel):
    rows: list[ImportRowIn]


class ImportResult(BaseModel):
    imported: int
    skipped: int
    errors: list[str] = Field(default_factory=list)
