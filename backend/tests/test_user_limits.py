from decimal import Decimal
from http import HTTPStatus

import pytest
from fastapi import HTTPException
from src.repositories.alias import AliasRepository
from src.repositories.receipt import ReceiptRepository
from src.repositories.seller import SellerRepository
from src.repositories.tag import TagRepository
from src.repositories.transaction import TransactionRepository
from src.repositories.user import UserRepository
from src.repositories.user_limits import UserLimitsRepository
from src.schemas.alias import AliasCreate
from src.schemas.tag import TagCreate
from src.schemas.transaction import TransactionCreate
from src.schemas.user_limits import UserLimitsUpdate
from src.services.aliases import AliasService
from src.services.sellers import SellerService
from src.services.tags import TagService
from src.services.transaction import TransactionService
from src.services.user_limits import UserLimitsService


async def _user(session):
    return await UserRepository(session).create(
        email="limits@example.com",
        password_hash="x" * 60,
    )


def _limits(session) -> UserLimitsService:
    return UserLimitsService(UserLimitsRepository(session))


async def test_user_creation_adds_default_limits(session):
    user = await _user(session)
    overview = await _limits(session).overview(user.id)

    assert overview.limits.max_tags == 25
    assert overview.limits.max_seller_aliases == 100
    assert overview.limits.max_product_aliases == 100
    assert overview.limits.max_receipts == 10_000
    assert overview.limits.max_transactions == 50_000
    assert overview.limits.max_receipt_items == 500
    assert overview.limits.max_import_rows == 5_000
    assert overview.usage.tags == 0


async def test_lower_limit_keeps_existing_tags_and_blocks_only_new(session):
    user = await _user(session)
    limits = _limits(session)
    tags = TagService(TagRepository(session), limits)
    existing = await tags.create(
        user,
        TagCreate(name="Еда", color="#3B82F6"),
    )
    await limits.update(user.id, UserLimitsUpdate(max_tags=1))

    with pytest.raises(HTTPException) as exc_info:
        await tags.create(
            user,
            TagCreate(name="Транспорт", color="#16A34A"),
        )

    assert exc_info.value.status_code == HTTPStatus.CONFLICT
    assert await TagRepository(session).get(user.id, existing.id) is not None
    assert (await limits.overview(user.id)).usage.tags == 1


async def test_admin_limit_update_rejects_null(session):
    user = await _user(session)

    with pytest.raises(HTTPException) as exc_info:
        await _limits(session).update(user.id, UserLimitsUpdate(max_tags=None))

    assert exc_info.value.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert (await _limits(session).overview(user.id)).limits.max_tags == 25


async def test_alias_limits_are_independent_per_scope(session):
    user = await _user(session)
    limits = _limits(session)
    await limits.update(
        user.id,
        UserLimitsUpdate(max_seller_aliases=1, max_product_aliases=1),
    )
    alias_repo = AliasRepository(session)
    aliases = AliasService(
        alias_repo,
        SellerService(SellerRepository(session), alias_repo),
        TransactionRepository(session),
        ReceiptRepository(session),
        limits,
    )
    await aliases.create(
        user,
        AliasCreate(original_name="магазин", alias_name="Магазин", scope="seller"),
    )
    await aliases.create(
        user,
        AliasCreate(original_name="молоко", alias_name="Молоко", scope="product"),
    )

    with pytest.raises(HTTPException) as exc_info:
        await aliases.create(
            user,
            AliasCreate(original_name="кафе", alias_name="Кафе", scope="seller"),
        )

    assert exc_info.value.status_code == HTTPStatus.CONFLICT
    overview = await limits.overview(user.id)
    assert overview.usage.seller_aliases == 1
    assert overview.usage.product_aliases == 1


async def test_transaction_and_operation_limits_are_enforced(session):
    user = await _user(session)
    limits = _limits(session)
    await limits.update(
        user.id,
        UserLimitsUpdate(
            max_transactions=1,
            max_receipt_items=1,
            max_import_rows=2,
        ),
    )
    alias_repo = AliasRepository(session)
    transactions = TransactionService(
        TransactionRepository(session),
        ReceiptRepository(session),
        TagRepository(session),
        alias_repo,
        SellerService(SellerRepository(session), alias_repo),
        limits,
    )
    await transactions.create_standalone(
        user,
        TransactionCreate(name="Первая", amount=Decimal("10.00")),
    )

    with pytest.raises(HTTPException) as tx_error:
        await transactions.create_standalone(
            user,
            TransactionCreate(name="Вторая", amount=Decimal("20.00")),
        )
    with pytest.raises(HTTPException) as receipt_error:
        await transactions.ensure_new_receipt(user.id, 2)
    with pytest.raises(HTTPException) as import_error:
        await limits.ensure_import_rows(user.id, 3)

    assert tx_error.value.status_code == HTTPStatus.CONFLICT
    assert "одном чеке" in str(receipt_error.value.detail)
    assert "не более 2 строк" in str(import_error.value.detail)
