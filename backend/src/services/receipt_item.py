from uuid import UUID

from fastapi import HTTPException, status
from src.models.receipt_item import ReceiptItem
from src.models.user import User
from src.repositories.receipt import ReceiptRepository
from src.repositories.receipt_item import ReceiptItemRepository
from src.repositories.tag import TagRepository
from src.schemas.receipt import ReceiptItemManualIn, ReceiptItemUpdate
from src.services.receipt_parser import ReceiptItemData, normalize_product_name


class ReceiptItemService:
    def __init__(
        self,
        item_repo: ReceiptItemRepository,
        receipt_repo: ReceiptRepository,
        tag_repo: TagRepository | None = None,
    ) -> None:
        self._item_repo = item_repo
        self._receipt_repo = receipt_repo
        self._tag_repo = tag_repo

    def _build_models(
        self,
        items: list[ReceiptItemData],
        *,
        start: int,
    ) -> list[ReceiptItem]:
        return [
            ReceiptItem(
                position=start + index,
                product_name=item.name,
                normalized_name=normalize_product_name(item.name),
                quantity=item.quantity,
                unit=item.unit,
                price=item.price,
                total_price=item.sum,
            )
            for index, item in enumerate(items)
        ]

    async def create_for_receipt(
        self,
        receipt_id: UUID,
        items: list[ReceiptItemData],
    ) -> list[ReceiptItem]:
        models = self._build_models(items, start=0)
        return await self._item_repo.create_many(receipt_id, models)

    async def add_items(
        self,
        user: User,
        receipt_id: UUID,
        items: list[ReceiptItemData],
    ) -> list[ReceiptItem]:
        """Добавляет позиции в существующий чек (нумерация продолжается)."""
        receipt = await self._receipt_repo.get(user.id, receipt_id)
        if receipt is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Чек не найден",
            )
        existing = await self._item_repo.list_by_receipt(receipt_id)
        start = max((i.position for i in existing), default=-1) + 1
        models = self._build_models(items, start=start)
        return await self._item_repo.create_many(receipt_id, models)

    def _manual_to_data(
        self,
        items: list[ReceiptItemManualIn],
    ) -> list[ReceiptItemData]:
        """Ручные позиции (схема) → данные парсера (DTO)."""
        return [
            ReceiptItemData(
                name=item.product_name,
                price=item.price,
                quantity=item.quantity,
                sum=item.total_price
                if item.total_price is not None
                else item.price * item.quantity,
                nds=None,
                unit=item.unit,
            )
            for item in items
        ]

    async def create_manual_for_receipt(
        self,
        receipt_id: UUID,
        items: list[ReceiptItemManualIn],
    ) -> list[ReceiptItem]:
        """Позиции ручного чека (схема) — создаются при создании чека."""
        return await self.create_for_receipt(receipt_id, self._manual_to_data(items))

    async def add_manual_items(
        self,
        user: User,
        receipt_id: UUID,
        items: list[ReceiptItemManualIn],
    ) -> list[ReceiptItem]:
        """Ручные позиции — добавляются в существующий чек (владелец)."""
        return await self.add_items(user, receipt_id, self._manual_to_data(items))

    async def list_by_receipt(self, user: User, receipt_id: UUID) -> list[ReceiptItem]:
        receipt = await self._receipt_repo.get(user.id, receipt_id)
        if receipt is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Чек не найден",
            )
        return await self._item_repo.list_by_receipt(receipt_id)

    async def set_tag(
        self,
        user: User,
        item_id: UUID,
        tag_id: UUID | None,
    ) -> ReceiptItem:
        item = await self._item_repo.get_by_id(item_id)
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Позиция чека не найдена",
            )
        receipt = await self._receipt_repo.get(user.id, item.receipt_id)
        if receipt is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Чек не найден",
            )
        if tag_id is not None and self._tag_repo is not None:
            tag = await self._tag_repo.get(user.id, tag_id)
            if tag is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Тег не найден",  # noqa: RUF001
                )
        return await self._item_repo.update(item, tag_id=tag_id)

    async def _load_owned(
        self,
        user: User,
        receipt_id: UUID,
        item_id: UUID,
    ) -> ReceiptItem:
        """Позиция из чека пользователя; иначе 404 (владение через чек)."""
        item = await self._item_repo.get_by_id(item_id)
        if item is None or item.receipt_id != receipt_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Позиция чека не найдена",
            )
        receipt = await self._receipt_repo.get(user.id, item.receipt_id)
        if receipt is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Чек не найден",
            )
        return item

    async def update(
        self,
        user: User,
        receipt_id: UUID,
        item_id: UUID,
        data: ReceiptItemUpdate,
    ) -> ReceiptItem:
        item = await self._load_owned(user, receipt_id, item_id)
        fields = data.model_dump(exclude_unset=True)
        if not fields:
            return item
        if "product_name" in fields:
            # normalized_name пересчитывается при смене названия
            fields["normalized_name"] = normalize_product_name(fields["product_name"])
        tag_id = fields.get("tag_id")
        if tag_id is not None and self._tag_repo is not None:
            tag = await self._tag_repo.get(user.id, tag_id)
            if tag is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Тег не найден",  # noqa: RUF001
                )
        return await self._item_repo.update(item, **fields)

    async def delete(self, user: User, receipt_id: UUID, item_id: UUID) -> None:
        item = await self._load_owned(user, receipt_id, item_id)
        await self._item_repo.delete(item)
