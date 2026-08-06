from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.repositories.user import UserRepository

DBSession = Annotated[AsyncSession, Depends(get_db)]


async def get_user_repo(session: DBSession) -> UserRepository:
    return UserRepository(session)


UserRepo = Annotated[UserRepository, Depends(get_user_repo)]
