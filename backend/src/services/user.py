from fastapi import HTTPException, status
from src.core.security import hash_password
from src.models.user import User
from src.repositories.user import UserRepository
from src.schemas.user import UserCreate, UserUpdate


class UserService:
    def __init__(self, repo: UserRepository) -> None:
        self._repo = repo

    async def register(self, data: UserCreate) -> User:
        email = data.email.lower()
        existing = await self._repo.get_by_email(email)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Пользователь с таким email уже существует",  # noqa: RUF001
            )
        password_hash = hash_password(data.password)
        return await self._repo.create(email=email, password_hash=password_hash)

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
