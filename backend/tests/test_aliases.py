"""Алиасы со scope: создание, пагинация, применение к существующим записям."""

from decimal import Decimal

from fastapi import HTTPException
from src.repositories.alias import AliasRepository
from src.repositories.receipt import ReceiptRepository
from src.repositories.transaction import TransactionRepository
from src.repositories.user import UserRepository
from src.schemas.alias import AliasApplyRequest, AliasCreate, AliasUpdate
from src.schemas.receipt import ReceiptCreate, ReceiptParseRequest, ReceiptResponse
from src.schemas.transaction import TransactionCreate, TransactionOut
from src.services.aliases import AliasService
from src.services.receipts import ReceiptService
from src.services.transaction import TransactionService
from test_receipts import _create_receipt, _make_user, _service
from test_receipt_parser import QR, sample_payload


def _alias_service(session) -> AliasService:
    return AliasService(
        AliasRepository(session),
        TransactionRepository(session),
        ReceiptRepository(session),
    )


def _tx_service(session) -> TransactionService:
    return TransactionService(
        TransactionRepository(session),
        ReceiptRepository(session),
        None,
        AliasRepository(session),
    )


# ---------- создание и дубликаты ----------


async def test_alias_scope_defaults_to_seller(session):
    user = await _make_user(UserRepository(session))
    service = _alias_service(session)
    alias = await service.create(
        user, AliasCreate(original_name="перекресток", alias_name="Перекрёсток")
    )
    assert alias.scope == "seller"

    product = await service.create(
        user,
        AliasCreate(
            original_name="сырок",
            alias_name="Глазированный сырок",
            scope="product",
        ),
    )
    assert product.scope == "product"


async def test_alias_same_pair_different_scopes_allowed(session):
    user = await _make_user(UserRepository(session))
    service = _alias_service(session)
    await service.create(
        user, AliasCreate(original_name="пятёрочка", alias_name="Пятёрочка")
    )
    # та же пара в другом скоупе — не дубликат
    await service.create(
        user,
        AliasCreate(
            original_name="пятёрочка",
            alias_name="Пятёрочка",
            scope="product",
        ),
    )
    # тот же скоуп — 409
    try:
        await service.create(
            user, AliasCreate(original_name="пятёрочка", alias_name="Пятёрочка")
        )
    except HTTPException as exc:
        assert exc.status_code == 409  # noqa: PLR2004
    else:
        raise AssertionError("ожидался 409 на дубль пары в том же скоупе")


async def test_alias_update_scope_moves_pair(session):
    user = await _make_user(UserRepository(session))
    service = _alias_service(session)
    alias = await service.create(
        user,
        AliasCreate(original_name="сырок", alias_name="Сырок", scope="product"),
    )
    updated = await service.update(
        user,
        alias.id,
        AliasUpdate(scope="seller"),
    )
    assert updated.scope == "seller"


async def test_alias_scope_move_rebuilds_previous_scope(session):
    user = await _make_user(UserRepository(session))
    service = _alias_service(session)
    tx_service = _tx_service(session)
    alias = await service.create(
        user,
        AliasCreate(
            original_name="сырок",
            alias_name="Сырок",
            scope="product",
        ),
    )
    tx = await tx_service.create_standalone(
        user,
        TransactionCreate(name="Сырок 45г", amount=Decimal("10")),
    )
    assert tx.name_alias_id == alias.id
    await service.update(user, alias.id, AliasUpdate(scope="seller"))
    refreshed = await TransactionRepository(session).get_owned(user.id, tx.id)
    assert refreshed is not None
    await session.refresh(refreshed)
    assert refreshed.name_alias_id is None
    assert refreshed.normalized_name == "сырок 45г"


# ---------- пагинация ----------


async def test_alias_list_page_filters_scope_and_totals(session):
    user = await _make_user(UserRepository(session))
    service = _alias_service(session)
    for i in range(5):
        await service.create(
            user,
            AliasCreate(
                original_name=f"магазин {i}",
                alias_name=f"Магазин {i}",
                priority=i,
            ),
        )
    for i in range(3):
        await service.create(
            user,
            AliasCreate(
                original_name=f"товар {i}",
                alias_name=f"Товар {i}",
                scope="product",
                priority=i,
            ),
        )

    items, total = await service.list_page(user, scope="seller", limit=100)
    assert total == 5  # noqa: PLR2004
    assert [a.scope for a in items] == ["seller"] * 5
    # сортировка: priority desc
    assert [a.priority for a in items] == [4, 3, 2, 1, 0]

    page1, total1 = await service.list_page(user, scope="product", limit=2)
    assert total1 == 3  # noqa: PLR2004
    assert len(page1) == 2  # noqa: PLR2004
    page2, _ = await service.list_page(user, scope="product", limit=2, offset=2)
    assert len(page2) == 1

    all_items, all_total = await service.list_page(user, scope=None, limit=100)
    assert all_total == 8  # noqa: PLR2004
    assert len(all_items) == 8  # noqa: PLR2004


# ---------- применение к существующим записям ----------


async def _manual_tx(session, user, *, name: str, seller: str | None = None):
    """Ручная транзакция через сервис без алиасов (raw name сохраняется)."""
    return await TransactionService(
        TransactionRepository(session),
        ReceiptRepository(session),
    ).create_standalone(
        user,
        TransactionCreate(
            name=name,
            seller_name=seller,
            amount=Decimal("100"),
        ),
    )


async def test_product_alias_applies_on_create(session):
    user = await _make_user(UserRepository(session))
    tx = await _manual_tx(
        session,
        user,
        name="РАЭ Сырок тв.гл.с вар.сг.15%45г",
    )
    assert tx.name == "РАЭ Сырок тв.гл.с вар.сг.15%45г"

    service = _alias_service(session)
    await service.create(
        user,
        AliasCreate(
            original_name="РАЭ Сырок",
            alias_name="Глазированный сырок",
            scope="product",
        ),
    )
    # алиас применился к существующей транзакции автоматически
    # (свежее чтение — в identity map сессии объект ещё со старым name)
    updated = await TransactionRepository(session).get_owned(user.id, tx.id)
    await session.refresh(updated)
    assert updated.name == "РАЭ Сырок тв.гл.с вар.сг.15%45г"
    assert updated.normalized_name == "глазированный сырок"
    assert updated.name_alias_id is not None


async def test_product_alias_keeps_alias_foreign_key(session):
    user = await _make_user(UserRepository(session))
    alias_service = _alias_service(session)
    alias = await alias_service.create(
        user,
        AliasCreate(
            original_name="сырок",
            alias_name="Глазированный сырок",
            scope="product",
        ),
    )

    tx_service = TransactionService(
        TransactionRepository(session),
        ReceiptRepository(session),
        None,
        AliasRepository(session),
    )
    tx = await tx_service.create_standalone(
        user,
        TransactionCreate(name="Сырок 45г", amount=Decimal("10")),
    )

    assert tx.name_alias_id == alias.id
    assert tx.normalized_name == "глазированный сырок"


async def test_deleting_alias_clears_foreign_key_without_deleting_transaction(session):
    user = await _make_user(UserRepository(session))
    alias_service = _alias_service(session)
    alias = await alias_service.create(
        user,
        AliasCreate(original_name="сырок", alias_name="Глазированный сырок", scope="product"),
    )
    tx_service = TransactionService(
        TransactionRepository(session),
        ReceiptRepository(session),
        None,
        AliasRepository(session),
    )
    tx = await tx_service.create_standalone(
        user,
        TransactionCreate(name="Сырок 45г", amount=Decimal("10")),
    )

    await alias_service.delete(user, alias.id)
    refreshed = await TransactionRepository(session).get_owned(user.id, tx.id)
    await session.refresh(refreshed)

    assert refreshed is not None
    assert refreshed.name_alias_id is None
    assert refreshed.normalized_name == "сырок 45г"


async def test_apply_all_product_respects_priority(session):
    user = await _make_user(UserRepository(session))
    await _manual_tx(session, user, name="Я САМАЯ Диски ватные 120шт")
    await _manual_tx(session, user, name="Бананы")
    # сидим алиасы напрямую (без авто-применения), чтобы проверить apply_all
    repo = AliasRepository(session)
    await repo.create(
        user_id=user.id,
        scope="product",
        original_name="ватные",
        alias_name="Ватные",
        is_regex=False,
        priority=0,
    )
    await repo.create(
        user_id=user.id,
        scope="product",
        original_name="диски",
        alias_name="Диски",
        is_regex=False,
        priority=5,
    )
    service = _alias_service(session)
    result = await service.apply_all(user.id, AliasApplyRequest().scope)
    assert result.product_updated == 1  # только «диски ватные», бананы не тронуты

    rows = await TransactionRepository(session).list_name_columns(user.id)
    normalized = {(await TransactionRepository(session).get_owned(user.id, tx_id)).normalized_name for tx_id, _ in rows}
    assert normalized == {"диски", "бананы"}
    assert result.product_updated == 1


async def test_apply_seller_scope_updates_receipts_and_manual(session):
    user = await _make_user(UserRepository(session))
    # чек с сырым продавцом + ручная транзакция с сырым магазином
    receipt = await _create_receipt(_service(session), user)
    await _manual_tx(session, user, name="Молоко", seller="перекресток")

    service = _alias_service(session)
    await service.create(
        user, AliasCreate(original_name="перекресток", alias_name="Перекрёсток")
    )

    # свежее чтение (identity map сессии хранит старый объект)
    fresh_receipt = await ReceiptRepository(session).get(user.id, receipt.id)
    await session.refresh(fresh_receipt)
    assert fresh_receipt.seller_name == 'АКЦИОНЕРНОЕ ОБЩЕСТВО "ТОРГОВЫЙ ДОМ ПЕРЕКРЕСТОК"'
    assert fresh_receipt.normalized_seller_name == "Перекрёсток"
    assert fresh_receipt.seller_name_alias_id is not None

    manual = (await TransactionRepository(session).list_seller_columns(user.id))[0]
    manual_tx = await TransactionRepository(session).get_owned(user.id, manual[0])
    assert manual[1] == "перекресток"
    assert manual_tx.seller_name_alias_id is not None


async def test_apply_seller_does_not_touch_products(session):
    """Seller-алиас не должен переименовывать товары (скоуп изолирован)."""
    user = await _make_user(UserRepository(session))
    tx = await _manual_tx(session, user, name="перекресток супермаркет")
    service = _alias_service(session)
    await service.create(
        user, AliasCreate(original_name="перекресток", alias_name="Перекрёсток")
    )
    updated = await TransactionRepository(session).get_owned(user.id, tx.id)
    assert updated.name == "перекресток супермаркет"  # товар не тронут


async def test_receipt_create_applies_product_alias(session):
    user = await _make_user(UserRepository(session))
    service = _alias_service(session)
    await service.create(
        user,
        AliasCreate(
            original_name="диски ватные",
            alias_name="Ватные диски",
            scope="product",
        ),
    )
    # ReceiptService с alias_repo (как в проде): алиасы применяются к позициям
    tx_service = TransactionService(
        TransactionRepository(session),
        ReceiptRepository(session),
        None,
        AliasRepository(session),
    )
    receipt_service = ReceiptService(
        ReceiptRepository(session),
        tx_service,
        AliasRepository(session),
    )
    receipt = await receipt_service.create(
        user,
        ReceiptCreate(qr=QR, raw_json=sample_payload()),
    )
    items = await TransactionRepository(session).list_by_receipt(receipt.id)
    assert items[0].name == "Я САМАЯ Диски ватные 120шт"
    assert items[0].normalized_name == "ватные диски"
    assert items[0].name_alias_id is not None


async def test_receipt_transaction_includes_receipt_seller_alias(session):
    user = await _make_user(UserRepository(session))
    service = _alias_service(session)
    seller_alias = await service.create(
        user,
        AliasCreate(original_name="перекресток", alias_name="Перекрёсток"),
    )
    tx_service = TransactionService(
        TransactionRepository(session),
        ReceiptRepository(session),
        None,
        AliasRepository(session),
    )
    receipt_service = ReceiptService(
        ReceiptRepository(session),
        tx_service,
        AliasRepository(session),
    )
    receipt = await receipt_service.create(
        user,
        ReceiptCreate(qr=QR, raw_json=sample_payload()),
    )
    response = ReceiptResponse.from_model(
        receipt,
        transactions=await TransactionRepository(session).list_by_receipt(receipt.id),
    )
    assert response.transactions[0].seller_name == "Перекрёсток"
    assert response.transactions[0].seller_name_alias_id == seller_alias.id


async def test_parse_preview_applies_product_alias(session):
    user = await _make_user(UserRepository(session))
    service = _alias_service(session)
    await service.create(
        user,
        AliasCreate(
            original_name="диски ватные",
            alias_name="Ватные диски",
            scope="product",
        ),
    )
    # ReceiptService с alias_repo — превью резолвит и продавца, и позиции
    tx_service = TransactionService(
        TransactionRepository(session),
        ReceiptRepository(session),
        None,
        AliasRepository(session),
    )
    receipt_service = ReceiptService(
        ReceiptRepository(session),
        tx_service,
        AliasRepository(session),
    )
    normalized, seller = await receipt_service.parse(
        user,
        ReceiptParseRequest(qr=QR, raw_json=sample_payload()),
    )
    assert seller == 'АКЦИОНЕРНОЕ ОБЩЕСТВО "ТОРГОВЫЙ ДОМ ПЕРЕКРЕСТОК"'
    assert normalized.items[0].name == "Ватные диски"


async def test_manual_transaction_creation_applies_aliases(session):
    user = await _make_user(UserRepository(session))
    service = _alias_service(session)
    await service.create(
        user,
        AliasCreate(original_name="сырок", alias_name="Сырок", scope="product"),
    )
    await service.create(
        user, AliasCreate(original_name="перекресток", alias_name="Перекрёсток")
    )
    tx = await _tx_service(session).create_standalone(
        user,
        TransactionCreate(
            name="РАЭ сырок глазированный",
            seller_name="перекресток №7",
            amount=Decimal("45"),
        ),
    )
    assert tx.name == "РАЭ сырок глазированный"
    assert tx.normalized_name == "сырок"
    assert tx.name_alias_id is not None
    assert tx.seller_name == "перекресток №7"
    assert tx.normalized_seller_name == "Перекрёсток"
    assert tx.seller_name_alias_id is not None


async def test_delete_alias_restores_original_seller_and_product(session):
    user = await _make_user(UserRepository(session))
    service = _alias_service(session)
    tx_service = _tx_service(session)

    seller_alias = await service.create(
        user, AliasCreate(original_name="старый магазин", alias_name="Новый магазин")
    )
    product_alias = await service.create(
        user, AliasCreate(original_name="старый товар", alias_name="Новый товар", scope="product")
    )
    tx = await tx_service.create_standalone(
        user,
        TransactionCreate(
            name="старый товар 1шт",
            seller_name="старый магазин №1",
            amount=Decimal("10"),
        ),
    )
    assert tx.normalized_seller_name == "Новый магазин"
    assert tx.normalized_name == "новый товар"
    assert tx.seller_name_alias_id == seller_alias.id
    assert tx.name_alias_id == product_alias.id

    await service.delete(user, seller_alias.id)
    await service.delete(user, product_alias.id)

    refreshed = await TransactionRepository(session).get_owned(user.id, tx.id)
    assert refreshed is not None
    assert refreshed.seller_name == "старый магазин №1"
    assert refreshed.normalized_seller_name == "Новый магазин"
    assert refreshed.normalized_name == "новый товар"
    assert TransactionOut.from_model(refreshed).seller_name == "Новый магазин"


async def test_apply_all_none_scope_returns_counts(session):
    user = await _make_user(UserRepository(session))
    await _create_receipt(_service(session), user)
    await _manual_tx(session, user, name="товар", seller="перекресток")
    # алиас сидим напрямую — авто-применение при create не сработало
    await AliasRepository(session).create(
        user_id=user.id,
        scope="seller",
        original_name="перекресток",
        alias_name="Перекрёсток",
        is_regex=False,
        priority=0,
    )
    service = _alias_service(session)
    result = await service.apply_all(user.id, None)
    assert result.seller_updated_receipts == 1
    assert result.seller_updated_transactions == 1
    assert result.product_updated == 0


async def test_apply_regex_alias(session):
    user = await _make_user(UserRepository(session))
    await _manual_tx(session, user, name="РАЭ Сырок 45г")
    await _manual_tx(session, user, name="Бананы")
    service = _alias_service(session)
    await service.create(
        user,
        AliasCreate(
            original_name=r"^РАЭ\s+сырок",
            alias_name="Сырок РАЭ",
            scope="product",
            is_regex=True,
        ),
    )
    repo = TransactionRepository(session)
    rows = await repo.list_name_columns(user.id)
    names = {
        (await repo.get_owned(user.id, tx_id)).name for tx_id, _ in rows
    }
    assert names == {"РАЭ Сырок 45г", "Бананы"}
    loaded = [await repo.get_owned(user.id, tx_id) for tx_id, _ in rows]
    assert any(tx.name_alias_id is not None for tx in loaded)


async def test_apply_without_repos_is_noop(session):
    """AliasService без tx/receipt репозиториев (тесты, другие вызовы) — noop."""
    user = await _make_user(UserRepository(session))
    service = AliasService(AliasRepository(session))
    alias = await service.create(
        user,
        AliasCreate(original_name="сырок", alias_name="Сырок", scope="product"),
    )
    assert alias.scope == "product"
