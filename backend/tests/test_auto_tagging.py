from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from src.repositories.auto_tagging import AutoTagTrainingRow, AutoTaggingRepository
from src.repositories.alias import AliasRepository
from src.repositories.receipt import ReceiptRepository
from src.repositories.seller import SellerRepository
from src.repositories.tag import TagRepository
from src.repositories.transaction import TransactionRepository
from src.repositories.user import UserRepository
from src.schemas.tag import TagCreate
from src.schemas.transaction import TransactionCreate, TransactionUpdate
from src.services.auto_tagging import (
    AutoTagInput,
    AutoTagPrediction,
    AutoTaggingService,
    _train,
)
from src.services.tags import TagService
from src.services.sellers import SellerService
from src.services.transaction import TransactionService


def _row(
    index: int,
    *,
    tag_id: UUID,
    tag_name: str,
    product: str,
    normalized: str | None = None,
    seller: str = "Пятёрочка №123",
    normalized_seller: str = "Пятёрочка",
) -> AutoTagTrainingRow:
    return AutoTagTrainingRow(
        tag_id=tag_id,
        tag_name=tag_name,
        raw_name=product,
        normalized_name=normalized or product.casefold(),
        raw_seller=seller,
        normalized_seller=normalized_seller,
        operation_type=1,
        amount=Decimal("150.00"),
        check_datetime=datetime(2025, 1, 1, tzinfo=timezone.utc)
        + timedelta(days=index),
    )


def test_hybrid_model_uses_product_before_shared_store() -> None:
    food_id = uuid4()
    fastfood_id = uuid4()
    rows: list[AutoTagTrainingRow] = []
    for index in range(80):
        fastfood = index % 4 == 0
        rows.append(
            _row(
                index,
                tag_id=fastfood_id if fastfood else food_id,
                tag_name="Фастфуд" if fastfood else "Еда",
                product="Чипсы Lay's" if fastfood else "Молоко Простоквашино",
            ),
        )

    result = _train(rows)

    assert result.status == "ready"
    assert result.model is not None
    prediction = result.model.predict(
        AutoTagInput(
            raw_name="Чипсы Lay's",
            normalized_name="чипсы lay's",
            raw_seller="Пятёрочка №999",
            normalized_seller="Пятёрочка",
            operation_type=1,
            amount=Decimal("170.00"),
        ),
    )
    assert prediction is not None
    assert prediction.tag_id == fastfood_id


def test_product_alias_groups_raw_variants_without_losing_original_text() -> None:
    food_id = uuid4()
    other_id = uuid4()
    rows = [
        _row(
            index,
            tag_id=food_id if index % 2 == 0 else other_id,
            tag_name="Еда" if index % 2 == 0 else "Дом",
            product=("Молоко 3,2%" if index % 2 == 0 else "Губки для посуды"),
            normalized=("молоко" if index % 2 == 0 else "губки"),
            seller="Магазин",
            normalized_seller="Магазин",
        )
        for index in range(60)
    ]
    result = _train(rows)
    assert result.model is not None

    prediction = result.model.predict(
        AutoTagInput(
            raw_name="Молоко ультрапастеризованное",
            normalized_name="молоко",
            raw_seller="Другой магазин",
            normalized_seller="Другой магазин",
            operation_type=1,
            amount=Decimal("99.00"),
        ),
    )
    assert prediction is not None
    assert prediction.tag_id == food_id


async def test_status_counts_only_manual_training_examples(session) -> None:
    user = await UserRepository(session).create(
        email="autotag@example.com",
        password_hash="x" * 60,
    )
    tag = await TagService(TagRepository(session)).create(
        user,
        TagCreate(name="Еда", color="#16A34A"),
    )
    from src.models.transaction import Transaction

    session.add_all(
        [
            Transaction(
                user_id=user.id,
                name="Молоко",
                normalized_name="молоко",
                amount=Decimal("100.00"),
                operation_type=1,
                check_datetime=datetime.now(timezone.utc),
                tag_id=tag.id,
                tag_source=source,
                tag_confidence=0.99 if source == "auto" else None,
            )
            for source in ("manual", "auto")
        ],
    )
    await session.commit()
    service = AutoTaggingService(AutoTaggingRepository(session))

    status = await service.status(user)

    assert status.training_examples == 1
    assert status.status == "disabled"


async def test_training_revision_is_persistent(session) -> None:
    user = await UserRepository(session).create(
        email="revision@example.com",
        password_hash="x" * 60,
    )
    repo = AutoTaggingRepository(session)

    await repo.bump_revision(user.id)
    refreshed = await UserRepository(session).get(user.id)

    assert refreshed is not None
    assert refreshed.auto_tagging_training_revision == 1


async def test_transaction_auto_tag_can_be_corrected_into_manual_example(session) -> None:
    user = await UserRepository(session).create(
        email="correction@example.com",
        password_hash="x" * 60,
    )
    user.auto_tagging_enabled = True
    await session.commit()
    tag_service = TagService(TagRepository(session))
    predicted_tag = await tag_service.create(
        user,
        TagCreate(name="Еда", color="#16A34A"),
    )
    corrected_tag = await tag_service.create(
        user,
        TagCreate(name="Фастфуд", color="#F59E0B"),
    )

    class StubAutoTaggingService:
        revisions = 0

        async def predict_many(self, _user, items):
            return [AutoTagPrediction(predicted_tag.id, 0.96) for _ in items]

        async def bump_revision(self, _user_id):
            self.revisions += 1

    auto = StubAutoTaggingService()
    service = TransactionService(
        TransactionRepository(session),
        ReceiptRepository(session),
        TagRepository(session),
        AliasRepository(session),
        SellerService(SellerRepository(session), AliasRepository(session)),
        auto_tagging_service=auto,  # type: ignore[arg-type]
    )

    transaction = await service.create_standalone(
        user,
        TransactionCreate(name="Чипсы", amount=Decimal("150.00")),
    )
    assert transaction.tag_id == predicted_tag.id
    assert transaction.tag_source == "auto"
    assert transaction.tag_confidence == 0.96  # noqa: PLR2004

    corrected = await service.update(
        user,
        transaction.id,
        TransactionUpdate(tag_id=corrected_tag.id),
    )
    assert corrected.tag_id == corrected_tag.id
    assert corrected.tag_source == "manual"
    assert corrected.tag_confidence is None
    assert auto.revisions == 1
