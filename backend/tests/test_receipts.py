"""Репозитории и сервисы: receipts (dedupe, алиасы, пагинация), tags, aliases."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi import HTTPException
from src.models.transaction import Transaction
from src.repositories.alias import AliasRepository
from src.repositories.receipt import ReceiptRepository
from src.repositories.tag import TagRepository
from src.repositories.transaction import TransactionRepository
from src.repositories.user import UserRepository
from src.schemas.alias import AliasCreate
from src.schemas.receipt import (
    ReceiptCreate,
    ReceiptManualCreate,
    ReceiptParseRequest,
    ReceiptUpdate,
)
from src.schemas.tag import TagCreate, TagUpdate
from src.schemas.transaction import TransactionManualIn
from src.services.aliases import AliasService
from src.services.receipts import ReceiptService
from src.services.tags import TagService
from src.services.transaction import TransactionService
from test_receipt_parser import QR, sample_payload


async def _make_user(repo: UserRepository, email: str = "owner@test.ru"):
    return await repo.create(email=email, password_hash="x" * 60)


async def _make_user_with_token(repo: UserRepository, token: str = "user-token"):
    user = await _make_user(repo)
    return await repo.update(user, proverkacheka_token=token)


def _service(session, *, proverkacheka=None):
    """ReceiptService: транзакции создаются через TransactionService."""
    tx_service = TransactionService(
        TransactionRepository(session),
        ReceiptRepository(session),
    )
    return ReceiptService(
        ReceiptRepository(session),
        tx_service,
        proverkacheka=proverkacheka,
    )


async def _create_receipt(service: ReceiptService, user, *, qr: str | None = QR):
    return await service.create(user, ReceiptCreate(qr=qr, raw_json=sample_payload()))


# ---------- receipts ----------


async def test_receipt_create_normalizes(session):
    user = await _make_user(UserRepository(session))
    receipt = await _create_receipt(_service(session), user)

    assert receipt.user_id == user.id
    assert receipt.qr == QR
    assert receipt.seller_name == 'АКЦИОНЕРНОЕ ОБЩЕСТВО "ТОРГОВЫЙ ДОМ ПЕРЕКРЕСТОК"'
    assert receipt.seller_inn == "7728029110"
    assert receipt.total_sum == Decimal("1522.95")
    assert receipt.receipt_number == "48"
    assert receipt.operation_type == 1
    assert receipt.raw_json is not None

    # транзакции чека сохраняются в transactions (связь через FK)
    items = await TransactionRepository(session).list_by_receipt(receipt.id)
    assert len(items) == 3  # noqa: PLR2004
    first = items[0]
    assert first.name == "Я САМАЯ Диски ватные 120шт"
    assert first.normalized_name == "я самая диски ватные 120шт"
    assert first.quantity == Decimal("1")
    assert first.unit == "шт"
    assert first.price == Decimal("109.99")
    assert first.amount == Decimal("109.99")
    assert first.tag_id is None

    banana = items[2]
    assert banana.unit == "кг"
    assert banana.quantity == Decimal("1.086")
    assert banana.amount == Decimal("152.03")


async def test_receipt_create_dedupe_by_qr(session):
    user = await _make_user(UserRepository(session))
    service = _service(session)
    await _create_receipt(service, user)

    try:
        await _create_receipt(service, user)
    except HTTPException as exc:
        assert exc.status_code == 409  # noqa: PLR2004
    else:
        raise AssertionError("ожидался 409 на повторный чек")


async def test_receipt_create_applies_alias(session):
    user = await _make_user(UserRepository(session))
    alias_repo = AliasRepository(session)
    await AliasService(alias_repo).create(
        user,
        AliasCreate(original_name="перекресток", alias_name="Перекрёсток"),
    )
    receipt = await _create_receipt(
        ReceiptService(
            ReceiptRepository(session),
            TransactionService(
                TransactionRepository(session),
                ReceiptRepository(session),
            ),
            alias_repo,
        ),
        user,
    )
    assert receipt.seller_name == 'АКЦИОНЕРНОЕ ОБЩЕСТВО "ТОРГОВЫЙ ДОМ ПЕРЕКРЕСТОК"'
    assert receipt.seller_name_alias_id is not None


async def test_receipt_list_cursor_paginates(session):
    user = await _make_user(UserRepository(session))
    service = _service(session)
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for i in range(3):
        receipt = await _create_receipt(
            service,
            user,
            qr=QR.replace("i=20448", f"i=2044{i}"),
        )
        # sqlite хранит created_at строкой — задаём явно, чтобы keyset сравнивался детерминированно
        receipt.created_at = base + timedelta(seconds=i)
        await session.commit()

    page1, cursor1 = await service.list_all(
        user,
        limit=2,
        cursor=None,
        date_from=None,
        date_to=None,
        seller=None,
    )
    page2, cursor2 = await service.list_all(
        user,
        limit=2,
        cursor=cursor1,
        date_from=None,
        date_to=None,
        seller=None,
    )
    assert len(page1) == 2  # noqa: PLR2004
    assert cursor1 is not None
    assert len(page2) == 1
    assert cursor2 is None
    ids = {r.id for r in page1} | {r.id for r in page2}
    assert len(ids) == 3  # noqa: PLR2004


async def test_receipt_get_and_delete(session):
    user = await _make_user(UserRepository(session))
    service = _service(session)
    receipt = await _create_receipt(service, user)
    tx_ids = [
        tx.id
        for tx in await TransactionRepository(session).list_by_receipt(receipt.id)
    ]

    found = await service.get(user, receipt.id)
    assert found.id == receipt.id
    # транзакции — отдельным запросом через репозиторий транзакций
    assert len(await TransactionRepository(session).list_by_receipt(receipt.id)) == 3  # noqa: PLR2004

    await service.delete(user, receipt.id)
    try:
        await service.get(user, receipt.id)
    except HTTPException as exc:
        assert exc.status_code == 404  # noqa: PLR2004
    else:
        raise AssertionError("ожидался 404 после удаления")

    # транзакции чека удаляются каскадом
    for tx_id in tx_ids:
        assert await session.get(Transaction, tx_id) is None


async def test_receipt_repo_scoped_to_user(session):
    user = await _make_user(UserRepository(session))
    other = await UserRepository(session).create(
        email="other@test.ru", password_hash="x" * 60
    )
    receipt = await _create_receipt(_service(session), user)

    repo = ReceiptRepository(session)
    assert await repo.get(other.id, receipt.id) is None
    assert await repo.get(user.id, receipt.id) is not None


async def test_receipt_create_fetches_by_qr(session):
    """Без raw_json, только QR — чек грузится с proverkacheka токеном пользователя."""
    user = await _make_user_with_token(UserRepository(session), token="user-token-123")

    class FakeClient:
        async def fetch(self, qrraw: str, *, token: str) -> dict:
            assert qrraw == QR
            assert token == "user-token-123"  # персональный токен, не глобальный
            return sample_payload()

    service = ReceiptService(
        ReceiptRepository(session),
        TransactionService(
            TransactionRepository(session),
            ReceiptRepository(session),
        ),
        proverkacheka=FakeClient(),  # type: ignore[arg-type]
    )
    receipt = await service.create(user, ReceiptCreate(qr=QR))
    assert receipt.qr == QR
    assert receipt.total_sum == Decimal("1522.95")
    # транзакции, загруженные с proverkacheka, сохранены через TransactionService
    assert (
        len(await TransactionRepository(session).list_by_receipt(receipt.id)) == 3  # noqa: PLR2004
    )


async def test_receipt_create_qr_without_user_token(session):
    """QR без токена пользователя → 502 с подсказкой, куда его задать."""
    user = await _make_user(UserRepository(session))

    class FakeClient:
        async def fetch(self, qrraw: str, *, token: str) -> dict:
            raise AssertionError("fetch не должен вызываться без токена")

    service = ReceiptService(
        ReceiptRepository(session),
        TransactionService(
            TransactionRepository(session),
            ReceiptRepository(session),
        ),
        proverkacheka=FakeClient(),  # type: ignore[arg-type]
    )
    try:
        await service.create(user, ReceiptCreate(qr=QR))
    except HTTPException as exc:
        assert exc.status_code == 502  # noqa: PLR2004
        assert "proverkacheka-token" in exc.detail
    else:
        raise AssertionError("ожидался 502 без токена пользователя")


async def test_receipt_create_qr_without_client_rejected(session):
    user = await _make_user(UserRepository(session))
    service = _service(session)
    try:
        await service.create(user, ReceiptCreate(qr=QR))
    except HTTPException as exc:
        assert exc.status_code == 422  # noqa: PLR2004
    else:
        raise AssertionError("ожидался 422 без raw_json и без клиента")


async def test_receipt_parse_preview_has_normalized_items(session):
    user = await _make_user(UserRepository(session))
    service = _service(session)
    normalized, seller_name = await service.parse(
        user,
        ReceiptParseRequest(qr=QR, raw_json=sample_payload()),
    )
    assert seller_name == 'АКЦИОНЕРНОЕ ОБЩЕСТВО "ТОРГОВЫЙ ДОМ ПЕРЕКРЕСТОК"'
    assert len(normalized.items) == 3  # noqa: PLR2004
    assert normalized.items[0].unit == "шт"
    assert normalized.items[2].unit == "кг"


# ---------- tags ----------


async def test_tag_crud_and_duplicate(session):
    user = await _make_user(UserRepository(session))
    service = TagService(TagRepository(session))

    tag = await service.create(user, TagCreate(name="Продукты", color="#3B82F6"))
    assert tag.name == "Продукты"

    try:
        await service.create(user, TagCreate(name="Продукты", color="#FF0000"))
    except HTTPException as exc:
        assert exc.status_code == 409  # noqa: PLR2004
    else:
        raise AssertionError("ожидался 409 на дубль тега")

    updated = await service.update(user, tag.id, TagUpdate(name="Еда"))
    assert updated.name == "Еда"

    await service.delete(user, tag.id)
    assert await TagRepository(session).get(user.id, tag.id) is None


# ---------- aliases ----------


async def test_alias_regex_validation(session):
    user = await _make_user(UserRepository(session))
    service = AliasService(AliasRepository(session))
    try:
        await service.create(
            user, AliasCreate(original_name="(unclosed", alias_name="X", is_regex=True)
        )
    except HTTPException as exc:
        assert exc.status_code == 422  # noqa: PLR2004
    else:
        raise AssertionError("ожидался 422 на битую регулярку")


def test_alias_resolve_substring_and_priority():
    from src.models.alias import Alias

    def make(name: str, alias: str, priority: int = 0, is_regex: bool = False) -> Alias:
        return Alias(
            id=None,
            original_name=name,
            alias_name=alias,
            is_regex=is_regex,
            priority=priority,
        )

    raw = 'АКЦИОНЕРНОЕ ОБЩЕСТВО "ТОРГОВЫЙ ДОМ ПЕРЕКРЕСТОК"'
    aliases = [
        make("перекресток", "Перекрёсток"),
        make("торговый дом", "ТД", priority=5),
    ]
    assert AliasService.resolve(aliases, raw) == "ТД"  # приоритет важнее

    assert AliasService.resolve([], raw) == raw  # без алиасов — как есть
    assert AliasService.resolve([make("магнит", "Магнит")], raw) == raw

    regex = [make(r"перекр\.?есток", "Перекрёсток-рег", priority=0, is_regex=True)]
    assert AliasService.resolve(regex, raw) == "Перекрёсток-рег"


async def test_alias_duplicate_pair(session):
    user = await _make_user(UserRepository(session))
    service = AliasService(AliasRepository(session))
    await service.create(
        user, AliasCreate(original_name="перекресток", alias_name="Перекрёсток")
    )
    try:
        await service.create(
            user, AliasCreate(original_name="перекресток", alias_name="Перекрёсток")
        )
    except HTTPException as exc:
        assert exc.status_code == 409  # noqa: PLR2004
    else:
        raise AssertionError("ожидался 409 на дубль пары")


# ---------- update чека (точечный PATCH) ----------


async def test_receipt_update_patches_only_sent_fields(session):
    user = await _make_user(UserRepository(session))
    service = _service(session)
    receipt = await _create_receipt(service, user)

    updated = await service.update(
        user,
        receipt.id,
        ReceiptUpdate(seller_name="ПЯТЁРОЧКА", total_sum=Decimal("10.00")),
    )
    assert updated.seller_name == "ПЯТЁРОЧКА"
    assert updated.total_sum == Decimal("10.00")
    # не присланные поля не тронуты
    assert updated.qr == QR
    assert updated.receipt_number == "48"
    assert updated.cashback is None
    assert updated.balance_after is None

    # пустой PATCH — no-op, чек не меняется
    again = await service.update(user, receipt.id, ReceiptUpdate())
    assert again.seller_name == "ПЯТЁРОЧКА"
    assert again.total_sum == Decimal("10.00")


async def test_receipt_update_foreign_receipt_404(session):
    owner = await _make_user(UserRepository(session))
    other = await _make_user(UserRepository(session), email="other@test.ru")
    service = _service(session)
    receipt = await _create_receipt(service, owner)

    try:
        await service.update(
            other,
            receipt.id,
            ReceiptUpdate(seller_name="ЧУЖОЙ"),
        )
    except HTTPException as exc:
        assert exc.status_code == 404  # noqa: PLR2004
    else:
        raise AssertionError("ожидался 404 на чужой чек")


async def test_receipt_update_unknown_404(session):
    user = await _make_user(UserRepository(session))
    service = _service(session)
    try:
        await service.update(user, uuid4(), ReceiptUpdate(seller_name="X"))
    except HTTPException as exc:
        assert exc.status_code == 404  # noqa: PLR2004
    else:
        raise AssertionError("ожидался 404 на несуществующий чек")


async def test_receipt_update_null_required_422(session):
    user = await _make_user(UserRepository(session))
    service = _service(session)
    receipt = await _create_receipt(service, user)

    # явный null на NOT NULL колонку → 422, а не IntegrityError 500
    for bad in (ReceiptUpdate(seller_name=None), ReceiptUpdate(total_sum=None)):
        try:
            await service.update(user, receipt.id, bad)
        except HTTPException as exc:
            assert exc.status_code == 422  # noqa: PLR2004
        else:
            raise AssertionError("ожидался 422 на null в NOT NULL колонке")

    # nullable поля — явный null разрешён (очистка, не ошибка)
    cleared = await service.update(user, receipt.id, ReceiptUpdate(cashback=None))
    assert cleared.cashback is None


# ---------- ручной ввод чека (без QR/raw_json) ----------


async def test_receipt_manual_create_with_items(session):
    user = await _make_user(UserRepository(session))
    service = _service(session)

    receipt = await service.create_manual(
        user,
        ReceiptManualCreate(
            seller_name="Магазин у дома",
            total_sum=Decimal("150.00"),
            transactions=[
                TransactionManualIn(
                    name="Молоко",
                    price=Decimal("60"),
                    quantity=Decimal("2"),
                ),
                TransactionManualIn(
                    name="Хлеб",
                    price=Decimal("30"),
                    quantity=Decimal("1"),
                    amount=Decimal("35.00"),  # задан явно — не пересчитывается
                ),
            ],
        ),
    )
    assert receipt.qr is None
    assert receipt.raw_json == {}
    assert receipt.seller_name == "Магазин у дома"
    assert receipt.total_sum == Decimal("150.00")
    assert receipt.operation_type == 1  # noqa: PLR2004  (SALE по умолчанию)

    items = await TransactionRepository(session).list_by_receipt(receipt.id)
    assert len(items) == 2  # noqa: PLR2004
    assert items[0].position == 0
    assert items[0].name == "Молоко"
    assert items[0].normalized_name == "молоко"
    assert items[0].amount == Decimal("120.00")  # price * quantity
    assert items[1].amount == Decimal("35.00")  # как задан


async def test_receipt_manual_create_without_items(session):
    user = await _make_user(UserRepository(session))
    service = _service(session)

    receipt = await service.create_manual(
        user,
        ReceiptManualCreate(seller_name="Киоск", total_sum=Decimal("10.00")),
    )
    assert receipt.qr is None
    assert (
        await TransactionRepository(session).list_by_receipt(receipt.id) == []
    )
