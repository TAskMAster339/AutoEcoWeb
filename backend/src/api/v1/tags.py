from uuid import UUID

from fastapi import APIRouter, status
from src.core.dependencies import CurrentUser, TagRepo
from src.schemas.tag import TagCreate, TagResponse, TagUpdate
from src.services.tags import TagService

router = APIRouter(prefix="/api/v1/tags", tags=["tags"])


@router.get("", response_model=list[TagResponse])
async def list_tags(_current_user: CurrentUser, repo: TagRepo) -> list[TagResponse]:
    tags = await TagService(repo).list_all(_current_user)
    return [TagResponse.model_validate(t) for t in tags]


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    data: TagCreate,
    current_user: CurrentUser,
    repo: TagRepo,
) -> TagResponse:
    tag = await TagService(repo).create(current_user, data)
    return TagResponse.model_validate(tag)


@router.patch("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: UUID,
    data: TagUpdate,
    current_user: CurrentUser,
    repo: TagRepo,
) -> TagResponse:
    tag = await TagService(repo).update(current_user, tag_id, data)
    return TagResponse.model_validate(tag)


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: UUID,
    _current_user: CurrentUser,
    repo: TagRepo,
) -> None:
    await TagService(repo).delete(_current_user, tag_id)
