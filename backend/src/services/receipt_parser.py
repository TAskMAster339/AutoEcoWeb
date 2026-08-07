"""Чистая логика чеков: разбор QR ФНС и нормализация ответа proverkacheka.

Единицы измерения (важно):
- суммы в JSON чека (items[].sum / items[].price, totalSum, nds10, nds18) —
  в КОПЕЙКАХ;
- сумма в QR-строке (s=...) — в РУБЛЯХ.

Нормализация всегда приводит к рублям (Decimal, 2 знака).

Функции в этом модуле не трогают БД — только чистые преобразования,
покрытые тестами (tests/test_receipt_parser.py).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

__all__ = [
    "FiscalQr",
    "NormalizedReceipt",
    "ReceiptItemData",
    "ReceiptParseError",
    "normalize_product_name",
    "normalize_proverkacheka",
    "parse_fiscal_time",
    "parse_qr_raw",
]


class ReceiptParseError(ValueError):
    """Некорректные данные чека (QR-строка или ответ сервиса чеков)."""


_QR_FIELD_RE = re.compile(r"^([a-z]+)=([^&]*)$", re.IGNORECASE)
_QR_TIME_RE = re.compile(r"^(\d{8})[tT](\d{4})$")

# Типы операций ФНС: 1 приход, 2 расход, 3 возврат прихода, 4 возврат расхода
_VALID_OPERATION_TYPES = {1, 2, 3, 4}

# itemsQuantityMeasure (ФФД 1.05): 0 — штуки, 1 — литры, 2 — кг, ...
_MEASURE_UNITS: dict[int, str] = {
    0: "шт",
    1: "л",
    2: "кг",
    3: "т",
    4: "см³",
    5: "м³",
    6: "м²",
    7: "м",
    8: "у.е.",  # noqa: RUF001
    9: "Гкал",
    10: "усл.",
}


@dataclass(frozen=True)
class FiscalQr:
    """Разобранная QR-строка чека (t, s, fn, i, fp, n)."""

    check_time: str  # '20260215t1902'
    sum_rub: Decimal  # сумма в рублях (s=...)
    fn: str  # заводской номер фискального накопителя
    fd: int  # номер фискального документа (i=...)
    fp: int  # фискальный признак (fp=...)
    operation_type: int  # n=...: 1..4


@dataclass
class ReceiptItemData:
    name: str
    price: Decimal  # рубуль за единицу
    quantity: Decimal
    sum: Decimal  # рубулей всего по позиции
    nds: int | None  # ставка НДС по коду ФНС (1..5) или None
    unit: str = "шт"  # из itemsQuantityMeasure: шт/кг/л/м/...


@dataclass
class NormalizedReceipt:
    """Чек, приведённый к полям сущности receipts."""

    qr: str | None
    receipt_number: str | None
    operation_type: int
    seller_name: str
    seller_inn: str | None
    check_datetime: datetime
    total_sum: Decimal
    items: list[ReceiptItemData]
    raw_json: dict
    # Фискальная идентичность (для будущего dedupe по fn+fd+fp)
    fiscal_drive_number: str | None
    fiscal_document_number: int | None
    fiscal_sign: int | None


def _clean(value: object) -> str | None:
    """Обрезает пробелы и схлопывает внутренние повторные пробелы."""
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def _to_decimal(value: object) -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ReceiptParseError("Некорректное числовое поле чека") from exc


def _unit_from_measure(value: object) -> str:
    """itemsQuantityMeasure -> единица измерения (см. ФФД 1.05)."""
    try:
        code = int(str(value))
    except (TypeError, ValueError):
        return "шт"
    return _MEASURE_UNITS.get(code, f"код {code}")


def normalize_product_name(name: str) -> str:
    """Имя товара для сопоставления/группировки: без регистра и повторов пробелов."""
    cleaned = _clean(name)
    return cleaned.lower() if cleaned else ""


def parse_qr_raw(qr: str) -> FiscalQr:
    """Разбирает QR-строку ФНС вида
    `t=20260215t1902&s=1522.95&fn=7386440800034399&i=20448&fp=453488490&n=1`.
    """
    fields: dict[str, str] = {}
    for part in qr.split("&"):
        part = part.strip()  # noqa: PLW2901
        if not part:
            continue
        match = _QR_FIELD_RE.match(part)
        if match is None:
            raise ReceiptParseError("Некорректный QR-код чека")
        fields[match.group(1).lower()] = match.group(2)

    missing = {"t", "s", "fn", "i", "fp", "n"} - fields.keys()
    if missing:
        raise ReceiptParseError("Некорректный QR-код чека")

    try:
        sum_rub = _to_decimal(fields["s"])
        fd = int(fields["i"])
        fp = int(fields["fp"])
        operation_type = int(fields["n"])
    except (ValueError, ReceiptParseError) as exc:
        raise ReceiptParseError("Некорректный QR-код чека") from exc

    if operation_type not in _VALID_OPERATION_TYPES:
        raise ReceiptParseError("Некорректный QR-код чека")

    return FiscalQr(
        check_time=fields["t"],
        sum_rub=sum_rub,
        fn=fields["fn"].strip(),
        fd=fd,
        fp=fp,
        operation_type=operation_type,
    )


def parse_fiscal_time(value: str) -> datetime:
    """'20260215t1902' (QR) или ISO '2026-02-15T19:02:00' (JSON) -> UTC datetime.

    ФНС передаёт локальное время продавца без часового пояса; нормализуем
    как UTC (в документации сервиса чеков таймзона не сообщается).
    """
    text = value.strip()
    match = _QR_TIME_RE.match(text)
    if match is not None:
        raw = f"{match.group(1)}{match.group(2)}"
        try:
            return datetime.strptime(raw, "%Y%m%d%H%M").replace(tzinfo=timezone.utc)
        except ValueError as exc:
            raise ReceiptParseError("Некорректная дата чека") from exc

    try:
        parsed = datetime.fromisoformat(text)
    except ValueError as exc:
        raise ReceiptParseError("Некорректная дата чека") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def normalize_proverkacheka(  # noqa: C901
    payload: dict,
    *,
    qr_override: str | None = None,
) -> NormalizedReceipt:
    if not isinstance(payload, dict):
        raise ReceiptParseError("Пустой ответ сервиса чеков")

    data = payload.get("data")
    check = data.get("json") if isinstance(data, dict) else None
    request = payload.get("request")
    if not isinstance(check, dict) or not check:
        raise ReceiptParseError("В ответе нет данных чека")  # noqa: RUF001
    if not isinstance(request, dict):
        request = {}

    seller_name = _clean(check.get("user"))
    if not seller_name:
        raise ReceiptParseError("В чеке нет продавца")  # noqa: RUF001

    total_sum = _to_decimal(check.get("totalSum", 0)) / 100
    total_sum = total_sum.quantize(Decimal("0.01"))

    items: list[ReceiptItemData] = []
    for raw in check.get("items") or []:
        name = _clean(raw.get("name") if isinstance(raw, dict) else None)
        if not name:
            continue
        items.append(
            ReceiptItemData(
                name=name,
                price=_to_decimal(raw.get("price", 0)) / 100,
                quantity=_to_decimal(raw.get("quantity", 1)),
                sum=_to_decimal(raw.get("sum", 0)) / 100,
                nds=raw.get("nds"),
                unit=_unit_from_measure(raw.get("itemsQuantityMeasure")),
            ),
        )

    qr = _clean(qr_override) or _clean(request.get("qrraw"))

    operation_type = check.get("operationType")
    if operation_type is None and qr:
        try:
            operation_type = parse_qr_raw(qr).operation_type
        except ReceiptParseError:
            operation_type = None
    if operation_type not in _VALID_OPERATION_TYPES:
        operation_type = 1

    raw_datetime = check.get("dateTime")
    if not raw_datetime and qr:
        try:
            raw_datetime = parse_qr_raw(qr).check_time
        except ReceiptParseError:
            raw_datetime = None
    if not raw_datetime:
        raise ReceiptParseError("В чеке нет даты")  # noqa: RUF001
    check_datetime = parse_fiscal_time(str(raw_datetime))

    return NormalizedReceipt(
        qr=qr,
        receipt_number=(
            str(check["requestNumber"])
            if check.get("requestNumber") is not None
            else None
        ),
        operation_type=int(operation_type),
        seller_name=seller_name,
        seller_inn=_clean(check.get("userInn")),
        check_datetime=check_datetime,
        total_sum=total_sum,
        items=items,
        raw_json=payload,
        fiscal_drive_number=_clean(check.get("fiscalDriveNumber")),
        fiscal_document_number=check.get("fiscalDocumentNumber"),
        fiscal_sign=check.get("fiscalSign"),
    )
