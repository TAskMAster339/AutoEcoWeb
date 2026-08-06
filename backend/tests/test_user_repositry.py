import pytest
from src.repositories.user import UserRepository


@pytest.mark.asyncio
async def test_create_and_get_by_email(repo: UserRepository):
    user = await repo.create(email="test@example.com", password_hash="hashed")
    assert user.id is not None
    assert user.role.value == "user"
    assert user.status.value == "pending"

    found = await repo.get_by_email("test@example.com")
    assert found is not None
    assert found.id == user.id

    assert await repo.get_by_email("missing@example.com") is None


@pytest.mark.asyncio
async def test_get_missing(repo: UserRepository):
    assert await repo.get_by_email("nobody@example.com") is None
