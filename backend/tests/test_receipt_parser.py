"""Чистая логика чеков: QR ФНС + нормализация proverkacheka.

Сэмпл payload повторяет реальный ответ proverkacheka.com
(чек «Перекрёсток» от 2026-02-15, 1522.95 ₽).
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from src.services.receipt_parser import (
    ReceiptParseError,
    normalize_product_name,
    normalize_proverkacheka,
    parse_fiscal_time,
    parse_qr_raw,
)

QR = "t=20260215t1902&s=1522.95&fn=7386440800034399&i=20448&fp=453488490&n=1"


def sample_payload() -> dict:
    return {
        "code": 1,
        "data": {
            "json": {
                "user": 'АКЦИОНЕРНОЕ ОБЩЕСТВО "ТОРГОВЫЙ ДОМ ПЕРЕКРЕСТОК"',
                "items": [
                    {
                        "nds": 1,
                        "sum": 10999,
                        "name": "Я САМАЯ Диски ватные      120шт",
                        "price": 10999,
                        "quantity": 1,
                        "itemsQuantityMeasure": 0,
                    },
                    {
                        "nds": 2,
                        "sum": 8599,
                        "name": "Батон НАРЕЗНОЙ  в/с нарез. 400г",
                        "price": 8599,
                        "quantity": 1,
                    },
                    {
                        "nds": 1,
                        "sum": 15203,
                        "name": "Бананы                      1кг",
                        "price": 13999,
                        "quantity": 1.086,
                        "itemsQuantityMeasure": 2,
                    },
                ],
                "userInn": "7728029110  ",
                "dateTime": "2026-02-15T19:02:00",
                "operationType": 1,
                "requestNumber": 48,
                "totalSum": 152295,
                "fiscalDriveNumber": "7386440800034399",
                "fiscalDocumentNumber": 20448,
                "fiscalSign": 453488490,
            },
            "html": "<table></table>",
        },
        "request": {
            "qrraw": QR,
            "manual": {
                "fn": "7386440800034399",
                "fd": "20448",
                "fp": "453488490",
                "check_time": "20260215t1902",
                "type": "1",
                "sum": "1522.95",
            },
        },
    }


# ---------- QR ----------


def test_parse_qr_raw_valid():
    qr = parse_qr_raw(QR)
    assert qr.check_time == "20260215t1902"
    assert qr.sum_rub == Decimal("1522.95")
    assert qr.fn == "7386440800034399"
    assert qr.fd == 20448
    assert qr.fp == 453488490
    assert qr.operation_type == 1


def test_parse_qr_raw_case_insensitive_keys():
    qr = parse_qr_raw(
        "T=20260215T1902&S=1522.95&FN=7386440800034399&I=20448&FP=453488490&N=1"
    )
    assert qr.check_time == "20260215T1902"
    assert qr.operation_type == 1


def test_parse_qr_raw_missing_field():
    with pytest.raises(ReceiptParseError):
        parse_qr_raw(
            "t=20260215t1902&s=1522.95&fn=7386440800034399&i=20448&fp=453488490"
        )


def test_parse_qr_raw_invalid_operation_type():
    with pytest.raises(ReceiptParseError):
        parse_qr_raw(QR.replace("n=1", "n=9"))


def test_parse_qr_raw_garbage():
    with pytest.raises(ReceiptParseError):
        parse_qr_raw("не-qr")


# ---------- время ----------


def test_parse_fiscal_time_qr_format():
    assert parse_fiscal_time("20260215t1902") == datetime(
        2026, 2, 15, 19, 2, tzinfo=timezone.utc
    )


def test_parse_fiscal_time_iso_without_tz():
    assert parse_fiscal_time("2026-02-15T19:02:00") == datetime(
        2026, 2, 15, 19, 2, tzinfo=timezone.utc
    )


def test_parse_fiscal_time_iso_with_tz_preserved():
    parsed = parse_fiscal_time("2026-02-15T19:02:00+03:00")
    assert parsed.utcoffset() == timedelta(hours=3)


def test_parse_fiscal_time_garbage():
    with pytest.raises(ReceiptParseError):
        parse_fiscal_time("не дата")


# ---------- нормализация payload ----------


def test_normalize_sample_receipt():
    receipt = normalize_proverkacheka(sample_payload())
    assert receipt.seller_name == 'АКЦИОНЕРНОЕ ОБЩЕСТВО "ТОРГОВЫЙ ДОМ ПЕРЕКРЕСТОК"'
    assert receipt.seller_inn == "7728029110"
    assert receipt.receipt_number == "48"
    assert receipt.operation_type == 1
    assert receipt.qr == QR
    assert receipt.total_sum == Decimal("1522.95")
    assert receipt.check_datetime == datetime(2026, 2, 15, 19, 2, tzinfo=timezone.utc)
    assert receipt.fiscal_drive_number == "7386440800034399"
    assert receipt.fiscal_document_number == 20448
    assert receipt.fiscal_sign == 453488490

    # копейки -> рубли; имена очищены от повторных пробелов
    assert len(receipt.items) == 3
    first = receipt.items[0]
    assert first.name == "Я САМАЯ Диски ватные 120шт"
    assert first.price == Decimal("109.99")
    assert first.sum == Decimal("109.99")
    assert first.quantity == Decimal("1")
    assert first.nds == 1
    assert first.unit == "шт"  # itemsQuantityMeasure: 0

    banana = receipt.items[2]
    assert banana.price == Decimal("139.99")
    assert banana.quantity == Decimal("1.086")
    assert banana.sum == Decimal("152.03")
    assert banana.unit == "кг"  # itemsQuantityMeasure: 2


def test_item_unit_default_when_measure_missing():
    receipt = normalize_proverkacheka(sample_payload())
    assert receipt.items[1].unit == "шт"  # без itemsQuantityMeasure


def test_item_unit_unknown_measure():
    payload = sample_payload()
    payload["data"]["json"]["items"][0]["itemsQuantityMeasure"] = 42
    receipt = normalize_proverkacheka(payload)
    assert receipt.items[0].unit == "код 42"


def test_normalize_product_name():
    assert (
        normalize_product_name("  Я САМАЯ   Диски ватные   120шт ")
        == "я самая диски ватные 120шт"
    )
    assert normalize_product_name("Молоко") == "молоко"
    assert normalize_product_name("   ") == ""


def test_normalize_qr_override():
    payload = sample_payload()
    payload["request"]["qrraw"] = ""
    receipt = normalize_proverkacheka(payload, qr_override="t=1&s=2&fn=3&i=4&fp=5&n=1")
    assert receipt.qr == "t=1&s=2&fn=3&i=4&fp=5&n=1"


def test_normalize_operation_type_from_qr_when_json_missing():
    payload = sample_payload()
    del payload["data"]["json"]["operationType"]
    receipt = normalize_proverkacheka(payload)
    assert receipt.operation_type == 1  # из n=1 в QR


def test_normalize_missing_seller():
    payload = sample_payload()
    payload["data"]["json"]["user"] = "   "
    with pytest.raises(ReceiptParseError):
        normalize_proverkacheka(payload)


def test_normalize_empty_payload():
    with pytest.raises(ReceiptParseError):
        normalize_proverkacheka({})
