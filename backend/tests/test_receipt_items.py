"""ReceiptItemRepository и ReceiptItemService: работа с позициями через FK.

Позиции чека не висят на Receipt (relationship удалён) — доступ только
через ReceiptItemRepository (колонка receipt_id) и ReceiptItemService
(проверка владения через чек).
"""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException
from src.models.receipt import Receipt
from src.models.receipt_item import ReceiptItem
from src.repositories.alias import AliasRepository
from src.repositories.receipt import ReceiptRepository
from src.repositories.receipt_item import ReceiptItemRepository
from src.repositories.tag import TagRepository
from src.repositories.user import UserRepository
from src.services.receipt_item import ReceiptItemService
from src.services.receipt_parser import ReceiptItemData
from src.services.receipts import ReceiptService
from src.schemas.receipt import (
    ReceiptCreate,
    ReceiptItemManualIn,
    ReceiptItemUpdate,
    ReceiptManualCreate,
)

QR = "t=20260215t1902&s=1522.95&fn=9287443100363998&i=20448&fp=453488490&n=1"


def _sample_payload() -> dict:
    return {
        "code": 1,
        "data": {
            "json": {
                "user": 'АКЦИОНЕРНОЕ ОБЩЕСТВО "ТОРГОВЫЙ ДОМ ПЕРЕКРЕСТОК"',
                "userInn": "7728029110",
                "requestNumber": 48,
                "operationType": 1,
                "dateTime": "2026-02-15T19:02:00",
                "totalSum": 152295,
                "items": [
                    {
                        "sum": 10999,
                        "name": "Я САМАЯ Диски ватные 120шт",
                        "price": 10999,
                        "quantity": 1,
                        "itemsQuantityMeasure": 0,
                    },
                    {"sum": 15203, "name": "Бананы 1кг", "price": 15203, "quantity": 1.086, "itemsQuantityMeasure": 2},
                ],
            }
        },
    }


async def _make_user(repo: UserRepository, email: str = "owner@test.ru"):
    return await repo.create(email=email, password_hash="x" * 60)


async def _make_receipt(
    session, user, *, qr: str = QR
) -> tuple[ReceiptRepository, ReceiptItemRepository, Receipt]:
    """Создаёт чек с 2 позициями, возвращает репозитории и чек."""
    receipt_repo = ReceiptRepository(session)
    item_repo = ReceiptItemRepository(session)
    item_service = ReceiptItemService(
        item_repo,
        receipt_repo,
        TagRepository(session),
    )
    service = ReceiptService(
        receipt_repo,
        item_service,
        AliasRepository(session),
    )
    receipt = await service.create(user, ReceiptCreate(qr=qr, raw_json=_sample_payload()))
    return receipt_repo, item_repo, receipt


# ---------- ReceiptItemRepository ----------


async def test_create_many_and_list_by_receipt(session):
    user = await _make_user(UserRepository(session))
    _, item_repo, receipt = await _make_receipt(session, user)

    items = await item_repo.list_by_receipt(receipt.id)
    assert len(items) == 2  # noqa: PLR2004
    assert all(item.receipt_id == receipt.id for item in items)
    assert items[0].product_name == "Я САМАЯ Диски ватные 120шт"
    assert items[1].unit == "кг"

    # чужой/несуществующий чек — пустой список
    assert await item_repo.list_by_receipt(uuid4()) == []


async def test_create_many_empty(session):
    user = await _make_user(UserRepository(session))
    _, item_repo, receipt = await _make_receipt(session, user)
    assert await item_repo.create_many(receipt.id, []) == []
    assert len(await item_repo.list_by_receipt(receipt.id)) == 2  # noqa: PLR2004


async def test_list_by_receipts_single_query(session):
    user = await _make_user(UserRepository(session))
    _, item_repo, receipt = await _make_receipt(session, user)

    assert await item_repo.list_by_receipts([]) == []
    items = await item_repo.list_by_receipts([receipt.id])
    assert len(items) == 2  # noqa: PLR2004
    assert all(item.receipt_id == receipt.id for item in items)


async def test_get_by_id_and_update(session):
    user = await _make_user(UserRepository(session))
    _, item_repo, receipt = await _make_receipt(session, user)
    item = (await item_repo.list_by_receipt(receipt.id))[0]

    assert (await item_repo.get_by_id(item.id)).id == item.id
    assert await item_repo.get_by_id(uuid4()) is None

    updated = await item_repo.update(item, tag_id=None)
    assert updated.tag_id is None


# ---------- ReceiptItemService ----------


async def test_service_list_by_receipt_checks_ownership(session):
    user = await _make_user(UserRepository(session))
    other = await UserRepository(session).create(
        email="other@test.ru", password_hash="x" * 60
    )
    _, item_repo, receipt = await _make_receipt(session, user)
    service = ReceiptItemService(item_repo, ReceiptRepository(session))

    items = await service.list_by_receipt(user, receipt.id)
    assert len(items) == 2  # noqa: PLR2004

    # чужой чек → 404
    with pytest.raises(HTTPException) as exc:
        await service.list_by_receipt(other, receipt.id)
    assert exc.value.status_code == 404  # noqa: PLR2004

    # несуществующий чек → 404
    with pytest.raises(HTTPException) as exc:
        await service.list_by_receipt(user, uuid4())
    assert exc.value.status_code == 404  # noqa: PLR2004


async def test_service_set_tag(session):
    user = await _make_user(UserRepository(session))
    _, item_repo, receipt = await _make_receipt(session, user)
    tag_repo = TagRepository(session)
    tag = await tag_repo.create(
        user_id=user.id, name="Продукты", color="#7c3aed", icon=None
    )
    service = ReceiptItemService(item_repo, ReceiptRepository(session), tag_repo)
    item = (await item_repo.list_by_receipt(receipt.id))[0]

    tagged = await service.set_tag(user, item.id, tag.id)
    assert tagged.tag_id == tag.id

    # снятие тега
    untagged = await service.set_tag(user, item.id, None)
    assert untagged.tag_id is None


async def test_service_set_tag_rejects_foreign_tag(session):
    user = await _make_user(UserRepository(session))
    other = await UserRepository(session).create(
        email="other@test.ru", password_hash="x" * 60
    )
    _, item_repo, receipt = await _make_receipt(session, user)
    tag_repo = TagRepository(session)
    other_tag = await tag_repo.create(
        user_id=other.id, name="Чужой", color="#000000", icon=None
    )
    service = ReceiptItemService(item_repo, ReceiptRepository(session), tag_repo)
    item = (await item_repo.list_by_receipt(receipt.id))[0]

    with pytest.raises(HTTPException) as exc:
        await service.set_tag(user, item.id, other_tag.id)
    assert exc.value.status_code == 404  # noqa: PLR2004


async def test_service_set_tag_rejects_foreign_item(session):
    user = await _make_user(UserRepository(session))
    other = await UserRepository(session).create(
        email="other@test.ru", password_hash="x" * 60
    )
    _, item_repo, receipt = await _make_receipt(session, user)
    service = ReceiptItemService(item_repo, ReceiptRepository(session))

    item = (await item_repo.list_by_receipt(receipt.id))[0]
    with pytest.raises(HTTPException) as exc:
        await service.set_tag(other, item.id, None)
    assert exc.value.status_code == 404  # noqa: PLR2004

    with pytest.raises(HTTPException) as exc:
        await service.set_tag(user, uuid4(), None)
    assert exc.value.status_code == 404  # noqa: PLR2004


# ---------- create_for_receipt: конструирование позиций в сервисе ----------


async def test_service_create_for_receipt(session):
    """ReceiptItemService конструирует позиции из данных парсера и сохраняет."""
    user = await _make_user(UserRepository(session))
    receipt_repo = ReceiptRepository(session)
    item_repo = ReceiptItemRepository(session)
    service = ReceiptItemService(item_repo, receipt_repo)

    # чек без позиций — напрямую через репозиторий (позиции добавим сами)
    receipt = await receipt_repo.create(
        user_id=user.id,
        qr=QR,
        receipt_number="48",
        operation_type=1,
        seller_name="ПЕРЕКРЕСТОК",
        seller_inn="7728029110",
        check_datetime=datetime(2026, 2, 15, 19, 2, tzinfo=timezone.utc),
        total_sum=Decimal("1522.95"),
        cashback=None,
        balance_after=None,
        raw_json={},
    )

    created = await service.create_for_receipt(
        receipt.id,
        [
            ReceiptItemData(
                name="Молоко  2.5%",
                price=Decimal("60"),
                quantity=Decimal("1"),
                sum=Decimal("60"),
                nds=1,
            ),
            ReceiptItemData(
                name="Хлеб нарезной",
                price=Decimal("40"),
                quantity=Decimal("1"),
                sum=Decimal("40"),
                nds=1,
                unit="кг",
            ),
        ],
    )
    assert len(created) == 2  # noqa: PLR2004
    assert created[0].position == 0
    assert created[0].normalized_name == "молоко 2.5%"  # схлопнуты пробелы, lowercase
    assert created[1].position == 1
    assert created[1].unit == "кг"

    # сохранено в БД, порядок по position
    saved = await item_repo.list_by_receipt(receipt.id)
    assert [i.position for i in saved] == [0, 1]
    assert saved[0].normalized_name == "молоко 2.5%"


# ---------- update / delete позиции (точечный CRUD) ----------


async def test_service_update_item_patches_fields_and_tag(session):
    user = await _make_user(UserRepository(session))
    receipt_repo, item_repo, receipt = await _make_receipt(session, user)
    service = ReceiptItemService(item_repo, receipt_repo, TagRepository(session))
    item = (await item_repo.list_by_receipt(receipt.id))[0]

    # точечные поля: применяются только присланные
    updated = await service.update(
        user,
        receipt.id,
        item.id,
        ReceiptItemUpdate(product_name="БАНАНЫ", quantity=Decimal("2")),
    )
    assert updated.product_name == "БАНАНЫ"
    assert updated.normalized_name == "бананы"  # пересчитан из product_name
    assert updated.quantity == Decimal("2")
    # не присланные поля не тронуты
    assert updated.price == item.price
    assert updated.unit == item.unit
    assert updated.total_price == item.total_price

    # пустой PATCH — no-op
    noop = await service.update(user, receipt.id, item.id, ReceiptItemUpdate())
    assert noop.product_name == "БАНАНЫ"

    # tag_id: установка и снятие (явный null снимает тег)
    tag = await TagRepository(session).create(
        user_id=user.id, name="Фрукты", color="#7c3aed", icon=None
    )
    tagged = await service.update(
        user, receipt.id, item.id, ReceiptItemUpdate(tag_id=tag.id)
    )
    assert tagged.tag_id == tag.id
    untagged = await service.update(
        user, receipt.id, item.id, ReceiptItemUpdate(tag_id=None)
    )
    assert untagged.tag_id is None

    # чужой тег → 404
    other = await _make_user(UserRepository(session), email="other@test.ru")
    other_tag = await TagRepository(session).create(
        user_id=other.id, name="Чужой", color="#000000", icon=None
    )
    with pytest.raises(HTTPException) as exc:
        await service.update(
            user, receipt.id, item.id, ReceiptItemUpdate(tag_id=other_tag.id)
        )
    assert exc.value.status_code == 404  # noqa: PLR2004


async def test_service_update_item_ownership(session):
    owner = await _make_user(UserRepository(session))
    other = await _make_user(UserRepository(session), email="other@test.ru")
    receipt_repo, item_repo, receipt = await _make_receipt(session, owner)
    service = ReceiptItemService(item_repo, receipt_repo, TagRepository(session))
    item = (await item_repo.list_by_receipt(receipt.id))[0]

    # чужой юзер → 404 (владение через чек)
    with pytest.raises(HTTPException) as exc:
        await service.update(
            other, receipt.id, item.id, ReceiptItemUpdate(product_name="X")
        )
    assert exc.value.status_code == 404  # noqa: PLR2004

    # позиция из другого чека → 404 по пути /receipts/{this}/items/{foreign}
    _, _, other_receipt = await _make_receipt(
        session, owner, qr="t=20260216t1902&s=1522.95&fn=9287443100363998&i=20449&fp=453488491&n=1"
    )
    foreign_item = (await item_repo.list_by_receipt(other_receipt.id))[0]
    with pytest.raises(HTTPException) as exc:
        await service.update(
            owner, receipt.id, foreign_item.id, ReceiptItemUpdate(product_name="X")
        )
    assert exc.value.status_code == 404  # noqa: PLR2004


async def test_service_delete_item(session):
    owner = await _make_user(UserRepository(session))
    other = await _make_user(UserRepository(session), email="other@test.ru")
    receipt_repo, item_repo, receipt = await _make_receipt(session, owner)
    service = ReceiptItemService(item_repo, receipt_repo)
    item = (await item_repo.list_by_receipt(receipt.id))[0]

    # чужой юзер → 404
    with pytest.raises(HTTPException) as exc:
        await service.delete(other, receipt.id, item.id)
    assert exc.value.status_code == 404  # noqa: PLR2004

    # удаление позиции: чек жив, позиция ушла
    await service.delete(owner, receipt.id, item.id)
    remaining = await item_repo.list_by_receipt(receipt.id)
    assert len(remaining) == 1  # noqa: PLR2004
    assert remaining[0].id != item.id
    assert await receipt_repo.get(owner.id, receipt.id) is not None

    # повторное удаление → 404
    with pytest.raises(HTTPException) as exc:
        await service.delete(owner, receipt.id, item.id)
    assert exc.value.status_code == 404  # noqa: PLR2004


# ---------- добавление позиций в существующий чек (ручной ввод) ----------


async def test_service_add_manual_items_continues_position(session):
    user = await _make_user(UserRepository(session))
    receipt_repo, item_repo, receipt = await _make_receipt(session, user)
    service = ReceiptItemService(item_repo, receipt_repo, TagRepository(session))

    added = await service.add_manual_items(
        user,
        receipt.id,
        [
            ReceiptItemManualIn(product_name="Сыр", price=Decimal("90"), quantity=Decimal("1")),
            ReceiptItemManualIn(product_name="Кефир", price=Decimal("50"), quantity=Decimal("1")),
        ],
    )
    assert len(added) == 2  # noqa: PLR2004
    # нумерация продолжается после существующих (0,1 → 2,3)
    assert added[0].position == 2  # noqa: PLR2004
    assert added[1].position == 3  # noqa: PLR2004
    assert added[0].normalized_name == "сыр"
    assert added[0].total_price == Decimal("90.00")

    saved = await item_repo.list_by_receipt(receipt.id)
    assert [i.position for i in saved] == [0, 1, 2, 3]

    # чужой юзер → 404
    other = await _make_user(UserRepository(session), email="other@test.ru")
    with pytest.raises(HTTPException) as exc:
        await service.add_manual_items(
            other,
            receipt.id,
            [ReceiptItemManualIn(product_name="X", price=Decimal("1"))],
        )
    assert exc.value.status_code == 404  # noqa: PLR2004

    # несуществующий чек → 404
    with pytest.raises(HTTPException) as exc:
        await service.add_manual_items(
            user,
            uuid4(),
            [ReceiptItemManualIn(product_name="X", price=Decimal("1"))],
        )
    assert exc.value.status_code == 404  # noqa: PLR2004


async def test_service_add_manual_items_empty_receipt(session):
    """В пустой чек позиции добавляются с position=0."""
    user = await _make_user(UserRepository(session))
    receipt_repo = ReceiptRepository(session)
    item_repo = ReceiptItemRepository(session)
    item_service = ReceiptItemService(item_repo, receipt_repo, TagRepository(session))
    service = ReceiptService(
        receipt_repo,
        item_service,
        AliasRepository(session),
    )
    receipt = await service.create_manual(
        user,
        ReceiptManualCreate(seller_name="Киоск", total_sum=Decimal("10.00")),
    )

    added = await item_service.add_manual_items(
        user,
        receipt.id,
        [ReceiptItemManualIn(product_name="Вода", price=Decimal("30"))],
    )
    assert added[0].position == 0
    assert len(await item_repo.list_by_receipt(receipt.id)) == 1  # noqa: PLR2004
