"""Транзакции — минимальная единица учёта (сервис + репозиторий)."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from http import HTTPStatus


import pytest
from fastapi import HTTPException
from src.api.v1.transactions import update_transaction
from src.models.receipt import Receipt

from src.models.user import User
from src.repositories.receipt import ReceiptRepository
from src.repositories.alias import AliasRepository
from src.repositories.seller import SellerRepository
from src.repositories.tag import TagRepository
from src.repositories.transaction import TransactionRepository
from src.repositories.user import UserRepository
from src.schemas.alias import AliasCreate
from src.schemas.tag import TagCreate
from src.schemas.transaction import (
    TransactionCreate,
    TransactionInReceipt,
    TransactionManualIn,
    TransactionOut,
    TransactionUpdate,
)
from src.services.aliases import AliasService
from src.services.receipt_parser import ReceiptItemData
from src.services.tags import TagService
from src.services.transaction import TransactionService
from src.services.sellers import SellerService


async def _make_user(session) -> User:
    return await UserRepository(session).create(
        email="owner@test.ru",
        password_hash="x" * 60,
    )


async def _make_receipt(session, user: User) -> Receipt:
    seller = await SellerService(
        SellerRepository(session), AliasRepository(session)
    ).get_or_create(user.id, "ПЕРЕКРЕСТОК")
    return await ReceiptRepository(session).create(
        user_id=user.id,
        qr="t=20260215T1902&s=100.00&fn=9288000100123456&i=20448&fp=1234567890&n=1",
        receipt_number="48",
        operation_type=1,
        seller_id=seller.id,
        seller_inn="7728029110",
        check_datetime=datetime(2026, 2, 15, 19, 2, tzinfo=timezone.utc),
        total_sum=Decimal("100.00"),
        cashback=None,
        balance_after=None,
        raw_json={},
    )


def _tx_service(session) -> TransactionService:
    alias_repo = AliasRepository(session)
    return TransactionService(
        TransactionRepository(session),
        ReceiptRepository(session),
        TagRepository(session),
        alias_repo,
        SellerService(SellerRepository(session), alias_repo),
    )


def _item(name: str, price: str, quantity: str = "1") -> ReceiptItemData:
    return ReceiptItemData(
        name=name,
        price=Decimal(price),
        quantity=Decimal(quantity),
        sum=Decimal(price) * Decimal(quantity),
        nds=None,
        unit="шт",
    )


async def test_tag_lists_include_user_transaction_counts(session):
    user = await _make_user(session)
    tag_service = TagService(TagRepository(session))
    food = await tag_service.create(user, TagCreate(name="Еда", color="#3B82F6"))
    empty = await tag_service.create(
        user, TagCreate(name="Без операций", color="#16A34A")
    )
    tx_service = _tx_service(session)

    for name in ("Хлеб", "Молоко"):
        await tx_service.create_standalone(
            user,
            TransactionCreate(name=name, amount=Decimal("10.00"), tag_id=food.id),
        )

    all_tags = await tag_service.list_all(user)
    assert {tag.id: count for tag, count in all_tags} == {food.id: 2, empty.id: 0}

    page, total = await tag_service.list_page(user, limit=1, offset=0)
    assert total == 2  # noqa: PLR2004
    assert len(page) == 1
    assert page[0][1] == {food.id: 2, empty.id: 0}[page[0][0].id]


# ---------- поиск с учётом товарных алиасов ----------


def _alias_service(session) -> AliasService:
    alias_repo = AliasRepository(session)
    return AliasService(
        alias_repo,
        SellerService(SellerRepository(session), alias_repo),
        TransactionRepository(session),
        ReceiptRepository(session),
    )


async def test_list_page_search_uses_effective_name_after_alias(session):
    """Алиас «хлеб → батон»: поиск «батон» находит и переименованные записи,
    поиск «хлеб» НЕ возвращает записи с применённым алиасом."""
    user = await _make_user(session)
    service = _tx_service(session)

    khleb = await service.create_standalone(
        user,
        TransactionCreate(
            name="Хлеб",
            amount=Decimal("30.00"),
            datetime=datetime(2026, 1, 10, tzinfo=timezone.utc),
        ),
    )
    baton = await service.create_standalone(
        user,
        TransactionCreate(
            name="Батон НАРЕЗНОЙ",
            amount=Decimal("45.00"),
            datetime=datetime(2026, 1, 11, tzinfo=timezone.utc),
        ),
    )
    borodinsky = await service.create_standalone(
        user,
        TransactionCreate(
            name="Хлеб Бородинский",
            amount=Decimal("70.00"),
            datetime=datetime(2026, 1, 12, tzinfo=timezone.utc),
        ),
    )

    # Алиас применяется и к уже сохранённым записям (apply_scope внутри create).
    # ^хлеб$ — только точное «Хлеб»; «Хлеб Бородинский» остаётся без алиаса.
    await _alias_service(session).create(
        user,
        AliasCreate(
            scope="product",
            original_name="^хлеб$",
            alias_name="батон",
            is_regex=True,
        ),
    )

    async def _ids(q: str) -> set:
        rows, _ = await service.list_page(
            user,
            limit=50,
            offset=0,
            date_from=None,
            date_to=None,
            tag_ids=None,
            search=q,
            seller_names=None,
            sort_by="date",
            sort_dir="desc",
        )
        return {tx.id for tx, _, _ in rows}

    # «батон» — и настоящие батоны, и переименованные «Хлеб» (normalized = «батон»)
    assert await _ids("батон") == {khleb.id, baton.id}
    # «хлеб» — только записи БЕЗ алиаса; переименованные не всплывают
    assert await _ids("хлеб") == {borodinsky.id}


async def test_price_chart_search_uses_effective_name_after_alias(session):
    """Ценовой график ищет так же: «батон» находит переименованные «Хлеб»,
    «хлеб» — не находит записи с применённым алиасом (подстрока и regex)."""
    user = await _make_user(session)
    service = _tx_service(session)

    await service.create_standalone(
        user,
        TransactionCreate(
            name="Хлеб",
            amount=Decimal("30.00"),
            price=Decimal("30.00"),
            quantity=Decimal("1"),
            datetime=datetime(2026, 1, 10, tzinfo=timezone.utc),
        ),
    )
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Батон НАРЕЗНОЙ",
            amount=Decimal("45.00"),
            price=Decimal("45.00"),
            quantity=Decimal("1"),
            datetime=datetime(2026, 1, 11, tzinfo=timezone.utc),
        ),
    )
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Хлеб Бородинский",
            amount=Decimal("70.00"),
            price=Decimal("70.00"),
            quantity=Decimal("1"),
            datetime=datetime(2026, 1, 12, tzinfo=timezone.utc),
        ),
    )

    await _alias_service(session).create(
        user,
        AliasCreate(
            scope="product",
            original_name="^хлеб$",
            alias_name="батон",
            is_regex=True,
        ),
    )

    repo = TransactionRepository(session)

    def _names(points) -> set[str]:
        return {name for _day, _price, _amount, _store, name in points}

    # подстрока: «батон» находит переименованный «Хлеб», «хлеб» — только без алиаса
    points = await repo.price_points(user_id=user.id, name="батон", is_regex=False)
    assert _names(points) == {"Хлеб", "Батон НАРЕЗНОЙ"}
    points = await repo.price_points(user_id=user.id, name="хлеб", is_regex=False)
    assert _names(points) == {"Хлеб Бородинский"}

    # regex-режим — та же семантика
    points = await repo.price_points(user_id=user.id, name="батон", is_regex=True)
    assert _names(points) == {"Хлеб", "Батон НАРЕЗНОЙ"}
    points = await repo.price_points(user_id=user.id, name="хлеб", is_regex=True)
    assert _names(points) == {"Хлеб Бородинский"}


# ---------- создание из чека ----------


async def test_create_for_receipt_sets_owner_position_and_inherits(session):
    user = await _make_user(session)
    receipt = await _make_receipt(session, user)
    service = _tx_service(session)

    txs = await service.create_for_receipt(
        receipt,
        [_item("Молоко", "60.00"), _item("Хлеб", "30.00")],
    )
    assert len(txs) == 2  # noqa: PLR2004
    first, second = txs
    # владелец и «коробка» проставлены напрямую
    assert first.user_id == user.id
    assert first.receipt_id == receipt.id
    # позиция — порядок в чеке
    assert first.position == 0
    assert second.position == 1
    # тип операции и дата унаследованы от чека
    assert first.operation_type == 1
    assert first.check_datetime == receipt.check_datetime
    # поля маппятся: product_name → name, total_price → amount
    assert first.name == "Молоко"
    assert first.normalized_name == "молоко"
    assert first.amount == Decimal("60.00")
    assert first.quantity == Decimal("1")
    assert first.unit == "шт"
    assert first.price == Decimal("60.00")
    assert first.tag_id is None


async def test_create_for_receipt_empty_items(session):
    user = await _make_user(session)
    receipt = await _make_receipt(session, user)
    assert await _tx_service(session).create_for_receipt(receipt, []) == []


async def test_create_manual_for_receipt(session):
    user = await _make_user(session)
    receipt = await _make_receipt(session, user)
    service = _tx_service(session)

    txs = await service.create_manual_for_receipt(
        receipt,
        [
            TransactionManualIn(
                name="Молоко", price=Decimal("60"), quantity=Decimal("2")
            ),
            TransactionManualIn(
                name="Хлеб",
                price=Decimal("30"),
                quantity=Decimal("1"),
                amount=Decimal("35.00"),
            ),
        ],
    )
    assert len(txs) == 2  # noqa: PLR2004
    assert txs[0].amount == Decimal("120.00")  # price * quantity
    assert txs[1].amount == Decimal("35.00")  # задан явно
    assert txs[0].unit == "шт"


# ---------- добавление в существующий чек ----------


async def test_add_to_receipt_continues_position(session):
    user = await _make_user(session)
    receipt = await _make_receipt(session, user)
    service = _tx_service(session)
    await service.create_for_receipt(receipt, [_item("Молоко", "60.00")])

    tx = await service.add_to_receipt(
        user,
        receipt.id,
        TransactionInReceipt(name="Хлеб", amount=Decimal("30.00")),
    )
    assert tx.position == 1  # нумерация продолжается
    assert tx.receipt_id == receipt.id
    assert tx.operation_type == receipt.operation_type
    assert tx.check_datetime == receipt.check_datetime
    assert tx.user_id == user.id


async def test_add_to_receipt_rejects_other_users_receipt(session):
    user = await _make_user(session)
    other = await UserRepository(session).create(
        email="other@test.ru",
        password_hash="x" * 60,
    )
    receipt = await _make_receipt(session, user)
    service = _tx_service(session)

    with pytest.raises(HTTPException) as exc_info:
        await service.add_to_receipt(
            other,
            receipt.id,
            TransactionInReceipt(name="Чужое", amount=Decimal("1")),
        )
    assert exc_info.value.status_code == 404  # noqa: PLR2004


# ---------- ручные транзакции без чека ----------


async def test_create_standalone_without_receipt(session):
    user = await _make_user(session)
    service = _tx_service(session)

    tx = await service.create_standalone(
        user,
        TransactionCreate(
            name="Зарплата",
            amount=Decimal("50000.00"),
            operation_type=3,  # возврат/доход
            datetime=datetime(2026, 3, 1, tzinfo=timezone.utc),
        ),
    )
    assert tx.user_id == user.id
    assert tx.receipt_id is None  # главное: транзакция может жить без чека
    assert tx.position is None
    assert tx.quantity is None  # nullable для ручного ввода
    assert tx.unit is None
    assert tx.price is None
    assert tx.operation_type == 3  # noqa: PLR2004
    assert tx.normalized_name == "зарплата"


async def test_create_standalone_allows_zero_amount_and_price(session):
    user = await _make_user(session)
    tx = await _tx_service(session).create_standalone(
        user,
        TransactionCreate(
            name="Подарок",
            amount=Decimal("0.00"),
            price=Decimal("0.00"),
            quantity=Decimal("1"),
        ),
    )
    assert tx.amount == Decimal("0.00")
    assert tx.price == Decimal("0.00")


async def test_create_standalone_with_tag(session):
    user = await _make_user(session)
    tag = await TagService(TagRepository(session)).create(
        user,
        TagCreate(name="Доходы", color="#10B981"),
    )
    tx = await _tx_service(session).create_standalone(
        user,
        TransactionCreate(
            name="Подработка",
            amount=Decimal("3000.00"),
            tag_id=tag.id,
        ),
    )
    assert tx.tag_id == tag.id


async def test_create_standalone_comment_defaults_empty(session):
    """Комментарий необязателен: без него — None, с пустой строкой — None."""
    user = await _make_user(session)
    service = _tx_service(session)

    no_comment = await service.create_standalone(
        user,
        TransactionCreate(name="Без комментария", amount=Decimal("10.00")),
    )
    assert no_comment.comment is None

    empty_comment = await service.create_standalone(
        user,
        TransactionCreate(
            name="Пустой комментарий", amount=Decimal("10.00"), comment="   "
        ),
    )
    assert empty_comment.comment is None


async def test_create_standalone_with_comment(session):
    user = await _make_user(session)
    tx = await _tx_service(session).create_standalone(
        user,
        TransactionCreate(
            name="Подарок",
            amount=Decimal("999.00"),
            comment="  Подарок маме на день рождения  ",
        ),
    )
    assert tx.comment == "Подарок маме на день рождения"


async def test_update_comment_set_and_clear(session):
    user = await _make_user(session)
    service = _tx_service(session)
    tx = await service.create_standalone(
        user,
        TransactionCreate(name="Без комментария", amount=Decimal("10.00")),
    )
    assert tx.comment is None

    # установить
    updated = await service.update(
        user,
        tx.id,
        TransactionUpdate(comment="Записать на работу"),
    )
    assert updated.comment == "Записать на работу"

    # очистить явным null
    cleared = await service.update(
        user,
        tx.id,
        TransactionUpdate(comment=None),
    )
    assert cleared.comment is None


async def test_create_standalone_foreign_tag_404(session):
    user = await _make_user(session)
    other = await UserRepository(session).create(
        email="other@test.ru",
        password_hash="x" * 60,
    )
    foreign_tag = await TagService(TagRepository(session)).create(
        other,
        TagCreate(name="Чужой тег", color="#FF0000"),
    )
    service = _tx_service(session)
    with pytest.raises(HTTPException) as exc_info:
        await service.create_standalone(
            user,
            TransactionCreate(
                name="X",
                amount=Decimal("1"),
                tag_id=foreign_tag.id,
            ),
        )
    assert exc_info.value.status_code == 404  # noqa: PLR2004


# ---------- обновление ----------


async def test_update_renames_and_recomputes_normalized(session):
    user = await _make_user(session)
    tx = await _tx_service(session).create_standalone(
        user,
        TransactionCreate(name="Молоко", amount=Decimal("60.00")),
    )

    updated = await _tx_service(session).update(
        user,
        tx.id,
        TransactionUpdate(name="Молоко 3.2%", amount=Decimal("70.00")),
    )
    assert updated.name == "Молоко 3.2%"
    assert updated.normalized_name == "молоко 3.2%"  # пересчитан
    assert updated.amount == Decimal("70.00")


async def test_update_tag_set_and_clear(session):
    user = await _make_user(session)
    tag = await TagService(TagRepository(session)).create(
        user,
        TagCreate(name="Продукты", color="#3B82F6"),
    )
    tx = await _tx_service(session).create_standalone(
        user,
        TransactionCreate(name="Молоко", amount=Decimal("60.00")),
    )
    service = _tx_service(session)

    tagged = await service.update(user, tx.id, TransactionUpdate(tag_id=tag.id))
    assert tagged.tag_id == tag.id

    # явный null на tag_id — легальное снятие тега, не 422
    cleared = await service.update(user, tx.id, TransactionUpdate(tag_id=None))
    assert cleared.tag_id is None


async def test_update_null_on_not_null_returns_422(session):
    user = await _make_user(session)
    tx = await _tx_service(session).create_standalone(
        user,
        TransactionCreate(name="Молоко", amount=Decimal("60.00")),
    )
    service = _tx_service(session)

    for bad in (
        TransactionUpdate(name=None),
        TransactionUpdate(amount=None),
        TransactionUpdate(operation_type=None),
        TransactionUpdate(datetime=None),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await service.update(user, tx.id, bad)
        assert exc_info.value.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    # пустой PATCH — no-op
    again = await service.update(user, tx.id, TransactionUpdate())
    assert again.name == "Молоко"


async def test_update_other_users_transaction_404(session):
    user = await _make_user(session)
    other = await UserRepository(session).create(
        email="other@test.ru",
        password_hash="x" * 60,
    )
    tx = await _tx_service(session).create_standalone(
        user,
        TransactionCreate(name="Молоко", amount=Decimal("60.00")),
    )
    with pytest.raises(HTTPException) as exc_info:
        await _tx_service(session).update(
            other,
            tx.id,
            TransactionUpdate(name="Чужое"),
        )
    assert exc_info.value.status_code == 404  # noqa: PLR2004


# ---------- удаление ----------


async def test_delete(session):
    user = await _make_user(session)
    tx = await _tx_service(session).create_standalone(
        user,
        TransactionCreate(name="Молоко", amount=Decimal("60.00")),
    )
    service = _tx_service(session)
    await service.delete(user, tx.id)
    assert await TransactionRepository(session).get_by_id(tx.id) is None


async def test_delete_other_users_transaction_404(session):
    user = await _make_user(session)
    other = await UserRepository(session).create(
        email="other@test.ru",
        password_hash="x" * 60,
    )
    tx = await _tx_service(session).create_standalone(
        user,
        TransactionCreate(name="Молоко", amount=Decimal("60.00")),
    )
    with pytest.raises(HTTPException) as exc_info:
        await _tx_service(session).delete(other, tx.id)
    assert exc_info.value.status_code == 404  # noqa: PLR2004


# ---------- список / пагинация / фильтры ----------


async def test_list_page_offset_paginates(session):
    user = await _make_user(session)
    service = _tx_service(session)
    for i in range(5):
        await service.create_standalone(
            user,
            TransactionCreate(
                name=f"Транзакция {i}",
                amount=Decimal(i),
                datetime=datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(days=i),
            ),
        )

    rows1, total = await service.list_page(user, limit=2, offset=0)
    rows2, total2 = await service.list_page(user, limit=2, offset=2)
    rows3, total3 = await service.list_page(user, limit=2, offset=4)
    assert len(rows1) == 2 and total == 5  # noqa: PLR2004
    assert len(rows2) == 2 and total2 == 5  # noqa: PLR2004
    assert len(rows3) == 1 and total3 == 5  # noqa: PLR2004
    ids = (
        {tx.id for tx, _, _ in rows1}
        | {tx.id for tx, _, _ in rows2}
        | {tx.id for tx, _, _ in rows3}
    )
    assert len(ids) == 5  # noqa: PLR2004


async def test_list_and_summary_filter_by_amount_range(session):
    user = await _make_user(session)
    service = _tx_service(session)
    for name, amount in (("Подарок", "0.00"), ("Кофе", "100.00"), ("Покупка", "1000.00")):
        await service.create_standalone(
            user,
            TransactionCreate(name=name, amount=Decimal(amount)),
        )

    rows, total = await service.list_page(
        user,
        limit=50,
        amount_min=Decimal("100.00"),
        amount_max=Decimal("1000.00"),
    )
    assert total == 2  # границы включаются
    assert {tx.name for tx, _, _ in rows} == {"Кофе", "Покупка"}

    summary = await service.summary(
        user,
        date_from=None,
        date_to=None,
        tag_ids=None,
        search=None,
        seller_names=None,
        amount_min=Decimal("100.00"),
        amount_max=Decimal("1000.00"),
    )
    assert summary.transactions == 2  # noqa: PLR2004
    assert summary.expenses == Decimal("1100.00")


async def test_list_and_summary_filter_by_operation_kind(session):
    user = await _make_user(session)
    service = _tx_service(session)
    expense = await service.create_standalone(
        user,
        TransactionCreate(name="Покупка", amount=Decimal("100.00"), operation_type=1),
    )
    income = await service.create_standalone(
        user,
        TransactionCreate(name="Возврат", amount=Decimal("50.00"), operation_type=2),
    )

    income_rows, income_total = await service.list_page(
        user,
        limit=50,
        operation_kind="income",
    )
    assert income_total == 1
    assert income_rows[0][0].id == income.id

    expense_rows, expense_total = await service.list_page(
        user,
        limit=50,
        operation_kind="expense",
    )
    assert expense_total == 1
    assert expense_rows[0][0].id == expense.id

    summary = await service.summary(
        user,
        date_from=None,
        date_to=None,
        tag_ids=None,
        search=None,
        seller_names=None,
        operation_kind="income",
    )
    assert summary.transactions == 1
    assert summary.income == Decimal("50.00")
    assert summary.expenses == Decimal("0")


async def test_list_page_filters_by_date_tag_search(session):
    user = await _make_user(session)
    tag = await TagService(TagRepository(session)).create(
        user,
        TagCreate(name="Продукты", color="#3B82F6"),
    )
    service = _tx_service(session)
    jan = await service.create_standalone(
        user,
        TransactionCreate(
            name="Молоко",
            amount=Decimal("60.00"),
            datetime=datetime(2026, 1, 10, tzinfo=timezone.utc),
            tag_id=tag.id,
        ),
    )
    feb = await service.create_standalone(
        user,
        TransactionCreate(
            name="Хлеб",
            amount=Decimal("30.00"),
            datetime=datetime(2026, 2, 10, tzinfo=timezone.utc),
        ),
    )

    async def _list(**kwargs):
        params = {
            "date_from": None,
            "date_to": None,
            "tag_ids": None,
            "search": None,
            "seller_names": None,
            "sort_by": "date",
            "sort_dir": "desc",
        }
        params.update(kwargs)
        rows, _total = await service.list_page(user, limit=50, offset=0, **params)
        return rows

    rows = await _list(date_from=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert {tx.id for tx, _, _ in rows} == {jan.id, feb.id}

    rows = await _list(date_to=datetime(2026, 1, 31, 23, 59, tzinfo=timezone.utc))
    assert {tx.id for tx, _, _ in rows} == {jan.id}

    rows = await _list(tag_ids=[tag.id])
    assert {tx.id for tx, _, _ in rows} == {jan.id}

    # sqlite: lower() не знает кириллицу — ищем подстроку в нижнем регистре
    rows = await _list(search="леб")
    assert {tx.id for tx, _, _ in rows} == {feb.id}


async def test_list_page_filters_by_seller_name(session):
    user = await _make_user(session)
    service = _tx_service(session)
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Такси", amount=Decimal("500.00"), seller_name="Яндекс Такси"
        ),
    )
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Метро", amount=Decimal("62.00"), seller_name="Метрополитен"
        ),
    )
    # свой магазин
    rows, total = await service.list_page(
        user, limit=50, offset=0, seller_names=["Метрополитен"]
    )
    assert total == 1 and rows[0][0].name == "Метро"  # noqa: PLR2004
    # магазин из чека (COALESCE)
    receipt = await _make_receipt(session, user)
    await service.create_for_receipt(receipt, [_item("Молоко", "60.00")])
    rows2, total2 = await service.list_page(
        user, limit=50, offset=0, seller_names=["ПЕРЕКРЕСТОК"]
    )
    assert total2 == 1 and rows2[0][0].name == "Молоко"  # noqa: PLR2004
    # мультивыбор магазинов: IN по списку (свой + из чека)
    rows3, total3 = await service.list_page(
        user,
        limit=50,
        offset=0,
        seller_names=["Метрополитен", "ПЕРЕКРЕСТОК"],
    )
    assert total3 == 2  # noqa: PLR2004
    assert {row[0].name for row in rows3} == {"Метро", "Молоко"}


async def test_list_page_filters_by_multiple_tags(session):
    user = await _make_user(session)
    tag_service = TagService(TagRepository(session))
    food = await tag_service.create(user, TagCreate(name="Еда", color="#3B82F6"))
    fun = await tag_service.create(user, TagCreate(name="Развлечения", color="#F59E0B"))
    service = _tx_service(session)
    tx_food = await service.create_standalone(
        user,
        TransactionCreate(name="Молоко", amount=Decimal("60.00"), tag_id=food.id),
    )
    tx_fun = await service.create_standalone(
        user,
        TransactionCreate(name="Steam", amount=Decimal("500.00"), tag_id=fun.id),
    )
    await service.create_standalone(
        user,
        TransactionCreate(name="Без тега", amount=Decimal("30.00")),
    )
    # один тег — как раньше
    rows, total = await service.list_page(user, limit=50, offset=0, tag_ids=[food.id])
    assert total == 1 and rows[0][0].id == tx_food.id  # noqa: PLR2004
    # мультивыбор тегов: IN по списку
    rows, total = await service.list_page(
        user, limit=50, offset=0, tag_ids=[food.id, fun.id]
    )
    assert total == 2  # noqa: PLR2004
    assert {row[0].id for row in rows} == {tx_food.id, tx_fun.id}

    rows, total = await service.list_page(user, limit=50, offset=0, untagged=True)
    assert total == 1
    assert rows[0][0].name == "Без тега"

    summary = await service.summary(
        user,
        date_from=None,
        date_to=None,
        tag_ids=None,
        search=None,
        seller_names=None,
        untagged=True,
    )
    assert summary.transactions == 1
    assert summary.expenses == Decimal("30.00")


async def test_list_page_search_covers_comment_and_store(session):
    user = await _make_user(session)
    service = _tx_service(session)
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Кофе", amount=Decimal("300.00"), comment="зерна для капучинатора"
        ),
    )
    await service.create_standalone(
        user,
        TransactionCreate(name="Хлеб", amount=Decimal("30.00"), seller_name="Булочная"),
    )
    rows, total = await service.list_page(
        user, limit=50, offset=0, search="капучинатор"
    )
    assert total == 1 and rows[0][0].name == "Кофе"  # noqa: PLR2004
    rows, total = await service.list_page(user, limit=50, offset=0, search="улочн")
    assert total == 1 and rows[0][0].name == "Хлеб"  # noqa: PLR2004


async def test_list_page_balance_is_running_total(session):
    user = await _make_user(session)
    service = _tx_service(session)
    # расход 100 → баланс -100; доход 50 → баланс -50 (всевременной итог)
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Покупка",
            amount=Decimal("100.00"),
            datetime=datetime(2026, 1, 1, tzinfo=timezone.utc),
        ),
    )
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Возврат",
            amount=Decimal("50.00"),
            operation_type=2,
            datetime=datetime(2026, 1, 2, tzinfo=timezone.utc),
        ),
    )
    rows, _ = await service.list_page(
        user, limit=10, offset=0, sort_by="date", sort_dir="asc"
    )
    by_name = {tx.name: Decimal(str(balance)) for tx, _, balance in rows}
    assert by_name["Покупка"] == Decimal("-100.00")
    assert by_name["Возврат"] == Decimal("-50.00")


async def test_list_page_sorts_by_name_and_price(session):
    user = await _make_user(session)
    service = _tx_service(session)
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Apple",
            amount=Decimal("10.00"),
            price=Decimal("10.00"),
            quantity=Decimal("1"),
            datetime=datetime(2026, 1, 1, tzinfo=timezone.utc),
        ),
    )
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Banana",
            amount=Decimal("1000.00"),
            price=Decimal("1000.00"),
            quantity=Decimal("1"),
            datetime=datetime(2026, 1, 2, tzinfo=timezone.utc),
        ),
    )
    rows, _ = await service.list_page(
        user, limit=10, offset=0, sort_by="name", sort_dir="asc"
    )
    assert [tx.name for tx, _, _ in rows] == ["Apple", "Banana"]
    rows, _ = await service.list_page(
        user, limit=10, offset=0, sort_by="price", sort_dir="desc"
    )
    assert [tx.name for tx, _, _ in rows] == ["Banana", "Apple"]


async def test_list_page_joins_seller_name(session):
    user = await _make_user(session)
    receipt = await _make_receipt(session, user)
    service = _tx_service(session)
    await service.create_for_receipt(receipt, [_item("Молоко", "60.00")])
    await service.create_standalone(
        user,
        TransactionCreate(name="Ручная", amount=Decimal("10.00")),
    )
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Ручная с магазином",
            seller_name="Пятёрочка",
            amount=Decimal("20.00"),
        ),
    )

    rows, _ = await service.list_page(user, limit=50, offset=0)
    # финальный seller_name: свой у транзакции, иначе — из чека (from_model)
    by_name = {
        tx.name: TransactionOut.from_model(
            tx, seller_name=seller, balance=balance
        ).seller_name
        for tx, seller, balance in rows
    }
    # из чека — продавец чека; ручная без магазина — None; ручная с магазином — свой
    assert by_name["Молоко"] == "ПЕРЕКРЕСТОК"
    assert by_name["Ручная"] is None
    assert by_name["Ручная с магазином"] == "Пятёрочка"


# ---------- сводка за период (SQL-агрегация) ----------


async def test_summary_period_income_expenses_and_deltas(session):
    user = await _make_user(session)
    service = _tx_service(session)
    # январь: расход 100, доход 50; февраль: расход 30
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Покупка",
            amount=Decimal("100.00"),
            datetime=datetime(2026, 1, 10, tzinfo=timezone.utc),
        ),
    )
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Возврат",
            amount=Decimal("50.00"),
            operation_type=2,
            datetime=datetime(2026, 1, 20, tzinfo=timezone.utc),
        ),
    )
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Покупка фев",
            amount=Decimal("30.00"),
            datetime=datetime(2026, 2, 10, tzinfo=timezone.utc),
        ),
    )

    s = await service.summary(
        user,
        date_from=datetime(2026, 1, 1, tzinfo=timezone.utc),
        date_to=datetime(2026, 1, 31, 23, 59, 59, tzinfo=timezone.utc),
        tag_ids=None,
        search=None,
        seller_names=None,
    )
    assert s.income == Decimal("50.00")
    assert s.expenses == Decimal("100.00")
    assert s.balance == Decimal("-50.00")
    assert s.transactions == 2  # noqa: PLR2004
    # дельты: предыдущее окно той же длины (декабрь) пустое → разница = сами суммы
    assert s.income_delta == Decimal("50.00")
    assert s.expenses_delta == Decimal("100.00")
    # тренд: стартует с opening (0) и идёт по дням
    assert s.balance_trend == [Decimal("-100.00"), Decimal("-50.00")]


async def test_summary_opening_balance(session):
    user = await _make_user(session)
    service = _tx_service(session)
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Старое",
            amount=Decimal("200.00"),
            datetime=datetime(2025, 12, 31, tzinfo=timezone.utc),
        ),
    )
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Новое",
            amount=Decimal("100.00"),
            datetime=datetime(2026, 1, 5, tzinfo=timezone.utc),
        ),
    )
    s = await service.summary(
        user,
        date_from=datetime(2026, 1, 1, tzinfo=timezone.utc),
        date_to=datetime(2026, 1, 31, tzinfo=timezone.utc),
        tag_ids=None,
        search=None,
        seller_names=None,
    )
    assert s.opening_balance == Decimal("-200.00")
    assert s.expenses == Decimal("100.00")
    assert s.balance == Decimal("-300.00")


async def test_summary_all_time_no_deltas(session):
    user = await _make_user(session)
    service = _tx_service(session)
    await service.create_standalone(
        user,
        TransactionCreate(name="Покупка", amount=Decimal("100.00")),
    )
    s = await service.summary(
        user,
        date_from=None,
        date_to=None,
        tag_ids=None,
        search=None,
        seller_names=None,
    )
    assert s.expenses == Decimal("100.00")
    assert s.opening_balance == Decimal("0")
    assert s.income_delta is None
    assert s.expenses_delta is None


# ---------- аналитика и магазины ----------


async def test_analytics_grouping(session):
    user = await _make_user(session)
    tag = await TagService(TagRepository(session)).create(
        user,
        TagCreate(name="Продукты", color="#3B82F6"),
    )
    service = _tx_service(session)
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Молоко",
            amount=Decimal("60.00"),
            tag_id=tag.id,
            datetime=datetime(2026, 1, 10, tzinfo=timezone.utc),
        ),
    )
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Возврат",
            amount=Decimal("20.00"),
            operation_type=2,
            tag_id=tag.id,
            datetime=datetime(2026, 1, 10, tzinfo=timezone.utc),
        ),
    )
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Такси",
            amount=Decimal("500.00"),
            seller_name="Яндекс Такси",
            datetime=datetime(2026, 1, 11, tzinfo=timezone.utc),
        ),
    )

    a = await service.analytics(
        user,
        date_from=None,
        date_to=None,
        tag_ids=None,
        search=None,
        seller_names=None,
    )
    daily = {d.day: (d.expenses, d.income, d.count) for d in a.daily}
    assert daily["2026-01-10"] == (Decimal("60.00"), Decimal("20.00"), 2)
    assert daily["2026-01-11"] == (Decimal("500.00"), Decimal("0"), 1)
    by_store = {s.store: s.value for s in a.by_store}
    assert by_store["Яндекс Такси"] == Decimal("500.00")
    by_category = {t.tag_name: (t.value, t.count) for t in a.by_category}
    assert by_category["Продукты"] == (Decimal("60.00"), 1)  # только расходы
    assert len(a.by_weekday) == 7
    by_weekday = {w.weekday: (w.value, w.count) for w in a.by_weekday}
    # 2026-01-10 — суббота, 2026-01-11 — воскресенье
    assert by_weekday[6] == (Decimal("60.00"), 1)
    assert by_weekday[7] == (Decimal("500.00"), 1)
    assert by_weekday[1] == (Decimal("0"), 0)  # понедельник пуст
    ind = a.indicators
    assert ind.top_store is not None and ind.top_store.store == "Яндекс Такси"
    assert ind.top_store.value == Decimal("500.00")
    assert ind.top_category is not None and ind.top_category.tag_name == "Продукты"
    assert ind.top_category.count == 1
    assert ind.top_weekday is not None and ind.top_weekday.weekday == 7
    assert ind.top_income_source is None  # доходов с магазином нет


async def test_price_chart_substring(session):
    user = await _make_user(session)
    service = _tx_service(session)
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Хлеб Бородинский",
            amount=Decimal("45.00"),
            price=Decimal("45.00"),
            quantity=Decimal("1"),
            seller_name="Пятёрочка",
            datetime=datetime(2026, 1, 10, tzinfo=timezone.utc),
        ),
    )
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Батон",
            amount=Decimal("50.00"),
            price=Decimal("50.00"),
            seller_name="Магнит",
            datetime=datetime(2026, 1, 12, tzinfo=timezone.utc),
        ),
    )
    await service.create_standalone(
        user,
        TransactionCreate(  # не матчится: другой товар
            name="Молоко",
            amount=Decimal("80.00"),
            price=Decimal("80.00"),
            datetime=datetime(2026, 1, 13, tzinfo=timezone.utc),
        ),
    )
    r = await service.price_chart(
        user,
        name="хлеб",
        is_regex=False,
        date_from=None,
        date_to=None,
    )
    assert r.count == 1
    assert r.points[0].day == "2026-01-10"
    assert r.points[0].store == "Пятёрочка"
    assert r.points[0].price == Decimal("45.00")
    assert r.points[0].names == ["Хлеб Бородинский"]
    assert r.avg_price == Decimal("45.00")
    assert r.median_price == Decimal("45.00")
    assert r.stddev == Decimal("0.00")


async def test_price_chart_regex(session):
    user = await _make_user(session)
    service = _tx_service(session)
    for name, price in [
        ("Молоко 3,2%", "70.00"),
        ("Молоко 2,5%", "60.00"),
        ("Кефир", "55.00"),
    ]:
        await service.create_standalone(
            user,
            TransactionCreate(
                name=name,
                amount=Decimal(price),
                price=Decimal(price),
                quantity=Decimal("1"),
                datetime=datetime(2026, 1, 10, tzinfo=timezone.utc),
            ),
        )
    r = await service.price_chart(
        user,
        name=r"^Молоко",
        is_regex=True,
        date_from=None,
        date_to=None,
    )
    assert r.count == 2
    assert r.avg_price == Decimal("65.00")
    assert r.median_price == Decimal("65.00")
    assert r.stddev == Decimal("5.00")


async def test_price_chart_uses_amount_when_no_price(session):
    """Нет price ни у одной покупки — цена = amount у всех."""
    user = await _make_user(session)
    service = _tx_service(session)
    for amount, day in [("45.00", 10), ("50.00", 12), ("48.00", 14)]:
        await service.create_standalone(
            user,
            TransactionCreate(
                name="Хлеб",
                amount=Decimal(amount),
                price=None,  # транзакции без цены
                quantity=Decimal("1"),
                datetime=datetime(2026, 1, day, tzinfo=timezone.utc),
            ),
        )
    r = await service.price_chart(
        user,
        name="хлеб",
        is_regex=False,
        date_from=None,
        date_to=None,
    )
    assert r.count == 3
    assert {p.price for p in r.points} == {
        Decimal("45.00"),
        Decimal("50.00"),
        Decimal("48.00"),
    }
    assert r.avg_price == Decimal("47.67")
    assert r.median_price == Decimal("48.00")
    assert r.stddev == Decimal("2.05")


async def test_price_chart_no_mix_price_and_amount(session):
    """Хоть у одной покупки нет price — у ВСЕХ берётся amount (без смешивания)."""
    user = await _make_user(session)
    service = _tx_service(session)
    # у первой price = 100, у остальных price=None; amount у всех заполнен
    for price, amount, day in [
        ("100.00", "40.00", 10),
        (None, "60.00", 12),
        (None, "50.00", 14),
    ]:
        await service.create_standalone(
            user,
            TransactionCreate(
                name="Хлеб",
                amount=Decimal(amount),
                price=Decimal(price) if price is not None else None,
                quantity=Decimal("1"),
                datetime=datetime(2026, 1, day, tzinfo=timezone.utc),
            ),
        )
    r = await service.price_chart(
        user,
        name="хлеб",
        is_regex=False,
        date_from=None,
        date_to=None,
    )
    assert r.count == 3
    # price 100 нигде не должен фигурировать: график целиком по amount
    assert {p.price for p in r.points} == {
        Decimal("40.00"),
        Decimal("60.00"),
        Decimal("50.00"),
    }
    assert r.avg_price == Decimal("50.00")
    assert r.median_price == Decimal("50.00")
    assert r.stddev == Decimal("8.16")


async def test_price_chart_glob_wildcards(session):
    """*биойогурт* — wildcard-стиль: ищется подстрока, а не 422."""
    user = await _make_user(session)
    service = _tx_service(session)
    for name, amount, day in [
        ("Биойогурт", "55.00", 10),
        ("Биойогурт клубничный", "62.00", 12),
        ("Снежок биойогурт", "30.00", 14),
        ("Хлеб", "45.00", 15),  # не матчится
    ]:
        await service.create_standalone(
            user,
            TransactionCreate(
                name=name,
                amount=Decimal(amount),
                price=Decimal(amount),
                quantity=Decimal("1"),
                datetime=datetime(2026, 1, day, tzinfo=timezone.utc),
            ),
        )
    r = await service.price_chart(
        user,
        name="*биойогурт*",
        is_regex=True,
        date_from=None,
        date_to=None,
    )
    assert r.count == 3
    assert r.avg_price == Decimal("49.00")  # (55+62+30)/3
    # все точки — только биойогурты, хлеб исключён
    assert {p.day for p in r.points} == {"2026-01-10", "2026-01-12", "2026-01-14"}


async def test_price_chart_question_wildcard(session):
    user = await _make_user(session)
    service = _tx_service(session)
    for name, day in [("Сыр 200г", 10), ("Сыр 500г", 11), ("Сыр 1000г", 12)]:
        await service.create_standalone(
            user,
            TransactionCreate(
                name=name,
                amount=Decimal("50.00"),
                price=Decimal("50.00"),
                quantity=Decimal("1"),
                datetime=datetime(2026, 1, day, tzinfo=timezone.utc),
            ),
        )
    r = await service.price_chart(
        user,
        name="сыр ?00г",
        is_regex=True,
        date_from=None,
        date_to=None,
    )
    assert r.count == 2
    assert {name for point in r.points for name in point.names} == {
        "Сыр 200г",
        "Сыр 500г",
    }


async def test_price_chart_invalid_regex(session):
    user = await _make_user(session)
    service = _tx_service(session)
    with pytest.raises(HTTPException) as exc:
        await service.price_chart(
            user,
            name="[",
            is_regex=True,
            date_from=None,
            date_to=None,
        )
    assert exc.value.status_code == 422  # HTTPStatus.UNPROCESSABLE_CONTENT


async def test_stores_distinct(session):
    user = await _make_user(session)
    receipt = await _make_receipt(session, user)
    service = _tx_service(session)
    await service.create_for_receipt(receipt, [_item("Молоко", "60.00")])
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Такси", amount=Decimal("500.00"), seller_name="Яндекс Такси"
        ),
    )
    await service.create_standalone(
        user,
        TransactionCreate(
            name="Ещё такси", amount=Decimal("300.00"), seller_name="Яндекс Такси"
        ),
    )
    stores = await service.stores(user)
    assert {store.filter_value for store in stores} == {"ПЕРЕКРЕСТОК", "Яндекс Такси"}


async def test_update_seller_name(session):
    user = await _make_user(session)
    service = _tx_service(session)
    tx = await service.create_standalone(
        user,
        TransactionCreate(name="Проезд", amount=Decimal("62.00")),
    )
    # поставить магазин
    tx = await service.update(
        user,
        tx.id,
        TransactionUpdate(seller_name="Метрополитен"),
    )
    assert tx.seller.name == "Метрополитен"
    assert tx.seller.normalized_name == "Метрополитен"
    assert TransactionOut.from_model(tx).seller_name == "Метрополитен"
    # PATCH другого поля не должен восприниматься как очистка магазина.
    tx = await service.update(user, tx.id, TransactionUpdate(comment="Вечерняя поездка"))
    assert TransactionOut.from_model(tx).seller_name == "Метрополитен"
    # снять магазин явным null
    tx = await service.update(user, tx.id, TransactionUpdate(seller_name=None))
    assert tx.seller is None


async def test_update_receipt_transaction_keeps_inherited_aliased_seller(session):
    """Both tag-only and full edits return the seller inherited from the receipt."""
    user = await _make_user(session)
    alias = await _alias_service(session).create(
        user,
        AliasCreate(original_name="перекресток", alias_name="Мой магазин"),
    )
    receipt = await _make_receipt(session, user)
    service = _tx_service(session)
    tx = (await service.create_for_receipt(receipt, [_item("Молоко", "60.00")]))[0]
    tag = await TagService(TagRepository(session)).create(
        user,
        TagCreate(name="Еда", color="#3B82F6"),
    )

    quick_tag_response = await update_transaction(
        tx.id,
        TransactionUpdate(tag_id=tag.id),
        user,
        service,
    )
    assert quick_tag_response.seller_name == "Мой магазин"
    assert quick_tag_response.normalized_seller_name == "Мой магазин"
    assert quick_tag_response.seller_name_alias_id == alias.id
    assert quick_tag_response.seller_name_alias_name == "Мой магазин"

    full_edit_response = await update_transaction(
        tx.id,
        TransactionUpdate(comment="Покупка на неделю"),
        user,
        service,
    )
    assert full_edit_response.seller_name == "Мой магазин"
    assert full_edit_response.seller_name_alias_id == alias.id
