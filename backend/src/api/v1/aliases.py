from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Query, status
from src.core.dependencies import AliasSvc, CurrentUser
from src.schemas.alias import (
    AliasApplyRequest,
    AliasApplyResult,
    AliasCreate,
    AliasResponse,
    AliasUpdate,
)
from src.schemas.pagination import CursorPage

router = APIRouter(prefix="/api/v1/aliases", tags=["aliases"])


@router.get("", response_model=CursorPage[AliasResponse])
async def list_aliases(
    _current_user: CurrentUser,
    alias_service: AliasSvc,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    scope: Literal["seller", "product"] | None = Query(None),
) -> CursorPage[AliasResponse]:
    """Страница алиасов (offset-пагинация) + total — алиасов может быть много."""
    items, total = await alias_service.list_page(
        _current_user,
        scope=scope,
        limit=limit,
        offset=offset,
    )
    return CursorPage[AliasResponse](
        items=[AliasResponse.model_validate(a) for a in items],
        total=total,
    )


@router.post(
    "/apply",
    response_model=AliasApplyResult,
)
async def apply_aliases(
    current_user: CurrentUser,
    alias_service: AliasSvc,
    data: AliasApplyRequest | None = None,
) -> AliasApplyResult:
    """Применить все алиасы (или одного скоупа) к существующим записям."""
    return await alias_service.apply_all(current_user.id, data.scope if data else None)


@router.post("", response_model=AliasResponse, status_code=status.HTTP_201_CREATED)
async def create_alias(
    data: AliasCreate,
    current_user: CurrentUser,
    alias_service: AliasSvc,
) -> AliasResponse:
    """Создать алиас и сразу применить его к подходящим записям."""  # noqa: RUF002
    alias = await alias_service.create(current_user, data)
    return AliasResponse.model_validate(alias)


@router.patch("/{alias_id}", response_model=AliasResponse)
async def update_alias(
    alias_id: UUID,
    data: AliasUpdate,
    current_user: CurrentUser,
    alias_service: AliasSvc,
) -> AliasResponse:
    """Обновить алиас и переприменить его к подходящим записям."""  # noqa: RUF002
    alias = await alias_service.update(current_user, alias_id, data)
    return AliasResponse.model_validate(alias)


@router.delete("/{alias_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alias(
    alias_id: UUID,
    _current_user: CurrentUser,
    alias_service: AliasSvc,
) -> None:
    """Удалить алиас. Уже применённые переименования не откатываются."""
    await alias_service.delete(_current_user, alias_id)
