from fastapi import HTTPException, status
from src.core.cursor import decode_cursor, encode_cursor
from src.core.enums.user_role import UserRole
from src.core.enums.user_status import UserStatus
from src.core.security import hash_password
from src.models.user import User
from src.repositories.user import UserRepository
from src.schemas.user import AdminUserUpdate, UserUpdate


class UserService:
    def __init__(self, repo: UserRepository) -> None:
        self._repo = repo

    async def update_profile(self, user: User, data: UserUpdate) -> User:
        changes = data.model_dump(exclude_unset=True)
        if "email" in changes:
            changes["email"] = changes["email"].lower()
            duplicate = await self._repo.get_by_email(changes["email"])
            if duplicate is not None and duplicate.id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email уже занят",
                )

        if "password" in changes:
            changes["password_hash"] = hash_password(changes.pop("password"))

        return await self._repo.update(user, **changes)

    async def update_proverkacheka_token(self, user: User, token: str) -> User:
        token = token.strip()
        if not token:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Токен не может быть пустым",
            )
        return await self._repo.update(user, proverkacheka_token=token)


class AdminUserService:
    def __init__(self, repo: UserRepository) -> None:
        self._repo = repo

    async def list_users(
        self,
        *,
        limit: int,
        cursor: str | None,
        role: UserRole | None,
        status: UserStatus | None,
        q: str | None,
    ) -> tuple[list[User], str | None]:
        cursor_tuple = decode_cursor(cursor) if cursor is not None else None
        items = await self._repo.list_cursor(
            limit=limit + 1,  # +1 строка = детект "есть ещё"
            cursor=cursor_tuple,
            role=role,
            status=status,
            q=q,
        )
        has_more = len(items) > limit
        items = items[:limit]
        next_cursor = (
            encode_cursor(items[-1].created_at, items[-1].id)
            if has_more and items
            else None
        )
        return items, next_cursor

    async def update_user(
        self,
        actor: User,
        target: User,
        data: AdminUserUpdate,
    ) -> User:
        changes = data.model_dump(exclude_unset=True)
        if not changes:
            return target
        if actor.id == target.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Нельзя менять роль/статус самому себе",  # noqa: RUF001
            )
        if (
            "role" in changes
            and target.role == UserRole.ADMIN
            and changes["role"] != UserRole.ADMIN
            and await self._repo.count_admins() <= 1
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Нельзя снять роль администратора с последнего админа",  # noqa: RUF001
            )
        return await self._repo.update(target, **changes)

    async def delete_user(self, actor: User, target: User) -> None:
        if actor.id == target.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Нельзя удалить самого себя",
            )
        if target.role == UserRole.ADMIN and await self._repo.count_admins() <= 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Нельзя удалить последнего администратора",
            )
        await self._repo.delete(target)
