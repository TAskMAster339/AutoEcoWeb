from datetime import UTC, datetime
from decimal import Decimal

import pytest
from fastapi import HTTPException

from src.models.transaction import Transaction
from src.repositories.alias import AliasRepository
from src.repositories.receipt import ReceiptRepository
from src.repositories.seller import SellerRepository
from src.services.sellers import SellerService


@pytest.fixture
def seller_service(session) -> SellerService:
    return SellerService(SellerRepository(session), AliasRepository(session))


async def test_get_or_create_creates_and_dedups(seller_service, user):
    first = await seller_service.get_or_create(user.id, "Пятёрочка")
    second = await seller_service.get_or_create(user.id, "Пятёрочка")
    assert first is not None and second is not None
    assert first.id == second.id
    assert first.name == "Пятёрочка"
    assert first.normalized_name == "Пятёрочка"


async def test_get_or_create_strips_blank(seller_service, user):
    assert await seller_service.get_or_create(user.id, "   ") is None
    assert await seller_service.get_or_create(user.id, "") is None


async def test_get_or_create_required_rejects_blank(seller_service, user):
    with pytest.raises(HTTPException) as exc_info:
        await seller_service.get_or_create_required(user.id, "   ")
    assert exc_info.value.status_code == 422


async def test_get_or_create_applies_seller_alias(seller_service, session, user):
    await AliasRepository(session).create(
        user_id=user.id,
        scope="seller",
        original_name="пятёр",
        alias_name="Пятерочка",
        is_regex=False,
        priority=0,
    )
    seller = await seller_service.get_or_create(user.id, "Пятёрочка №1")
    assert seller is not None
    assert seller.normalized_name == "Пятерочка"
    assert seller.seller_alias_id is not None


async def test_reapply_updates_normalized_from_aliases(seller_service, session, user):
    seller = await seller_service.get_or_create(user.id, "Перекресток")
    await AliasRepository(session).create(
        user_id=user.id,
        scope="seller",
        original_name="перекр",
        alias_name="ПЕРЕКРЕСТОК",
        is_regex=False,
        priority=0,
    )
    changed = await seller_service.reapply(user.id)
    assert seller is not None and seller.id in changed
    await session.refresh(seller)
    assert seller.normalized_name == "ПЕРЕКРЕСТОК"


async def test_reapply_after_alias_delete_restores_source(
    seller_service, session, user
):
    seller = await seller_service.get_or_create(user.id, "Пятёрочка")
    alias = await AliasRepository(session).create(
        user_id=user.id,
        scope="seller",
        original_name="пят",
        alias_name="5ka",
        is_regex=False,
        priority=0,
    )
    await seller_service.reapply(user.id)
    await session.refresh(seller)
    assert seller.normalized_name == "5ka"
    await AliasRepository(session).delete(alias)
    await seller_service.reapply(user.id, rebuild_empty=True)
    await session.refresh(seller)
    assert seller.normalized_name == "Пятёрочка"
    assert seller.seller_alias_id is None


async def test_management_count_includes_receipt_transactions_for_aliased_seller(
    seller_service, session, user
):
    await AliasRepository(session).create(
        user_id=user.id,
        scope="seller",
        original_name="пятёр",
        alias_name="Пятерочка",
        is_regex=False,
        priority=0,
    )
    seller = await seller_service.get_or_create(user.id, "Пятёрочка №1")
    assert seller is not None
    receipt = await ReceiptRepository(session).create(
        user_id=user.id,
        qr=None,
        receipt_number=None,
        operation_type=1,
        seller_id=seller.id,
        seller_inn=None,
        check_datetime=datetime(2026, 8, 14, tzinfo=UTC),
        total_sum=Decimal("100.00"),
        cashback=None,
        balance_after=None,
        raw_json={},
    )
    session.add_all(
        [
            Transaction(
                user_id=user.id,
                receipt_id=receipt.id,
                seller_id=None,
                name="Товар из чека",
                normalized_name="Товар из чека",
                amount=Decimal("60.00"),
                operation_type=1,
                check_datetime=receipt.check_datetime,
            ),
            Transaction(
                user_id=user.id,
                receipt_id=None,
                seller_id=seller.id,
                name="Ручной товар",
                normalized_name="Ручной товар",
                amount=Decimal("40.00"),
                operation_type=1,
                check_datetime=receipt.check_datetime,
            ),
        ],
    )
    await session.commit()

    rows = await seller_service.list_management(user.id)
    row = next(item for item in rows if item[0] == seller.id)

    assert row[5] == 2
    assert row[6] == 1


async def test_management_alias_count_matches_normalized_store_filter(
    seller_service, session, user
):
    await AliasRepository(session).create(
        user_id=user.id,
        scope="seller",
        original_name="пятёр",
        alias_name="Пятерочка",
        is_regex=False,
        priority=0,
    )
    first = await seller_service.get_or_create(user.id, "Пятёрочка №1")
    second = await seller_service.get_or_create(user.id, "Пятёрочка №2")
    assert first is not None and second is not None
    for index, seller in enumerate((first, second)):
        session.add(
            Transaction(
                user_id=user.id,
                receipt_id=None,
                seller_id=seller.id,
                name=f"Товар {index}",
                normalized_name=f"Товар {index}",
                amount=Decimal("10.00"),
                operation_type=1,
                check_datetime=datetime(2026, 8, 14, tzinfo=UTC),
            ),
        )
    await session.commit()

    rows = await seller_service.list_management(user.id)
    aliased_rows = [row for row in rows if row[2] == "Пятерочка"]

    assert len(aliased_rows) == 2
    assert {row[5] for row in aliased_rows} == {2}
