"""Схемы импорта/экспорта данных (универсальный формат).

Канонический формат (источник истины — экспорт приложения):
    Дата | Категория | Магазин | Описание | Количество | Единица |
    Цена | Комментарий | Доход | Расход

- Дата: Excel-дата или текст DD.MM.YYYY / YYYY-MM-DD.
- Категория: имя тега; пусто = без тега. Отсутствующие теги создаются
  автоматически при импорте.
- Магазин: необязательно; становится seller_name транзакции.
- Описание: название транзакции (обязательно).
- Доход/Расход: ровно одно поле заполнено и > 0.

Лишние колонки в файле игнорируются, порядок колонок не важен.
"""

import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator


def _strip(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


class ImportRowPreview(BaseModel):
    """Строка файла после парсинга (предпросмотр). Не валидируется строго —
    ошибки строки собираются в `errors`, чтобы фронт показал их до импорта."""  # noqa: RUF002

    index: int
    date: datetime.date | None = None
    category: str | None = None
    store: str | None = None
    description: str = ""
    quantity: Decimal | None = None
    unit: str | None = None
    price: Decimal | None = None
    comment: str | None = None
    income: Decimal = Decimal("0")
    expense: Decimal = Decimal("0")
    errors: list[str] = []


class ImportPreview(BaseModel):
    rows: list[ImportRowPreview]
    total: int
    valid: int
    invalid: int


class ImportRowIn(BaseModel):
    """Строка, подтверждённая пользователем в предпросмотре (POST /import)."""

    date: datetime.date
    category: str | None = Field(default=None, max_length=100)
    store: str | None = Field(default=None, max_length=255)
    description: str = Field(min_length=1, max_length=255)
    quantity: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=3)
    unit: str | None = Field(default=None, max_length=16)
    price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    comment: str | None = Field(default=None, max_length=1000)
    income: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    expense: Decimal = Field(
        default=Decimal("0"),
        ge=0,
        max_digits=12,
        decimal_places=2,
    )

    @field_validator("category", "store", "unit", "comment", mode="before")
    @classmethod
    def _clean_optional(cls, value: object) -> str | None:
        if value is None:
            return None
        return _strip(str(value))

    @field_validator("description", mode="before")
    @classmethod
    def _clean_description(cls, value: object) -> str:
        return (str(value).strip()) or ""

    @model_validator(mode="after")
    def _validate_amount(self) -> "ImportRowIn":
        if self.income > 0 and self.expense > 0:
            raise ValueError("Заполните только одно из полей Доход/Расход")
        if self.income <= 0 and self.expense <= 0:
            raise ValueError("Укажите сумму: Доход или Расход")
        return self


class ImportRequest(BaseModel):
    rows: list[ImportRowIn] = Field(min_length=1, max_length=10000)


class ImportErrorItem(BaseModel):
    index: int
    message: str


class ImportResult(BaseModel):
    imported: int
    errors: list[ImportErrorItem] = []
    tags_created: list[str] = []
