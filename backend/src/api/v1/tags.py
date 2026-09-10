from uuid import UUID

from fastapi import APIRouter, Query, status
from src.core.dependencies import CurrentUser, TagRepo, UserLimitsSvc
from src.models.tag import Tag
from src.schemas.pagination import CursorPage
from src.schemas.tag import TagCreate, TagResponse, TagUpdate
from src.services.tags import TagService

router = APIRouter(prefix="/api/v1/tags", tags=["tags"])


def _response(tag: Tag, count: int = 0) -> TagResponse:
    return TagResponse(
        id=tag.id,
        name=tag.name,
        color=tag.color,
        icon=tag.icon,
        count=count,
        created_at=tag.created_at,
    )


@router.get("", response_model=list[TagResponse])
async def list_tags(_current_user: CurrentUser, repo: TagRepo) -> list[TagResponse]:
    tags = await TagService(repo).list_all(_current_user)
    return [_response(tag, count) for tag, count in tags]


@router.get("/page", response_model=CursorPage[TagResponse])
async def list_tags_page(
    _current_user: CurrentUser,
    repo: TagRepo,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> CursorPage[TagResponse]:
    tags, total = await TagService(repo).list_page(
        _current_user,
        limit=limit,
        offset=offset,
    )
    return CursorPage[TagResponse](
        items=[_response(tag, count) for tag, count in tags],
        total=total,
    )


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    data: TagCreate,
    current_user: CurrentUser,
    repo: TagRepo,
    limits_service: UserLimitsSvc,
) -> TagResponse:
    tag = await TagService(repo, limits_service).create(current_user, data)
    return _response(tag)


@router.patch("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: UUID,
    data: TagUpdate,
    current_user: CurrentUser,
    repo: TagRepo,
) -> TagResponse:
    tag = await TagService(repo).update(current_user, tag_id, data)
    return _response(tag)


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: UUID,
    _current_user: CurrentUser,
    repo: TagRepo,
) -> None:
    await TagService(repo).delete(_current_user, tag_id)
