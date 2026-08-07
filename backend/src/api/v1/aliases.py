from uuid import UUID

from fastapi import APIRouter, status
from src.core.dependencies import AliasRepo, CurrentUser
from src.schemas.alias import AliasCreate, AliasResponse, AliasUpdate
from src.services.aliases import AliasService

router = APIRouter(prefix="/api/v1/aliases", tags=["aliases"])


@router.get("", response_model=list[AliasResponse])
async def list_aliases(
    _current_user: CurrentUser,
    repo: AliasRepo,
) -> list[AliasResponse]:
    aliases = await AliasService(repo).list_all(_current_user)
    return [AliasResponse.model_validate(a) for a in aliases]


@router.post("", response_model=AliasResponse, status_code=status.HTTP_201_CREATED)
async def create_alias(
    data: AliasCreate,
    current_user: CurrentUser,
    repo: AliasRepo,
) -> AliasResponse:
    alias = await AliasService(repo).create(current_user, data)
    return AliasResponse.model_validate(alias)


@router.patch("/{alias_id}", response_model=AliasResponse)
async def update_alias(
    alias_id: UUID,
    data: AliasUpdate,
    current_user: CurrentUser,
    repo: AliasRepo,
) -> AliasResponse:
    alias = await AliasService(repo).update(current_user, alias_id, data)
    return AliasResponse.model_validate(alias)


@router.delete("/{alias_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alias(
    alias_id: UUID,
    _current_user: CurrentUser,
    repo: AliasRepo,
) -> None:
    await AliasService(repo).delete(_current_user, alias_id)
