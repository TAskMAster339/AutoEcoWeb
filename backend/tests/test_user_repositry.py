from datetime import datetime, timedelta, timezone
from http import HTTPStatus

import pytest
from fastapi import HTTPException
from src.models.user import User
from src.repositories.user import UserRepository
from src.schemas.user import ProverkachekaTokenUpdate
from src.services.user import AdminUserService, UserService


async def test_list_cursor_paginates(repo, session):
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for i in range(25):
        user = await repo.create(email=f"u{i}@test.ru", password_hash="x" * 60)
        # sqlite хранит created_at строкой без tz/микросекунд — задаём явно,
        # иначе keyset-сравнение строк недетерминировано (форматы разъезжаются)
        user.created_at = base + timedelta(seconds=i)
    await session.commit()
    svc = AdminUserService(repo)
    page1, cursor1 = await svc.list_users(
        limit=10,
        cursor=None,
        role=None,
        status=None,
        q=None,
    )
    assert len(page1) == 10  # noqa: PLR2004
    assert cursor1 is not None
    page2, cursor2 = await svc.list_users(
        limit=10,
        cursor=cursor1,
        role=None,
        status=None,
        q=None,
    )
    page3, cursor3 = await svc.list_users(
        limit=10,
        cursor=cursor2,
        role=None,
        status=None,
        q=None,
    )
    assert len(page3) == 5  # noqa: PLR2004
    assert cursor3 is None
    ids = {u.id for u in page1} | {u.id for u in page2} | {u.id for u in page3}
    assert len(ids) == 25  # noqa: PLR2004


async def test_cursor_tiebreaker_equal_created_at(session, repo):
    ts = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for i in range(5):
        session.add(User(email=f"t{i}@test.ru", password_hash="x" * 60, created_at=ts))
    await session.commit()
    svc = AdminUserService(repo)
    page1, c1 = await svc.list_users(
        limit=2,
        cursor=None,
        role=None,
        status=None,
        q=None,
    )
    page2, c2 = await svc.list_users(limit=2, cursor=c1, role=None, status=None, q=None)
    assert {u.id for u in page1}.isdisjoint({u.id for u in page2})


async def test_list_cursor_filters(repo):
    await repo.create(email="a@test.ru", password_hash="x" * 60)  # status=pending
    await repo.create(email="b@test.ru", password_hash="x" * 60)
    await repo.create(email="c@test.ru", password_hash="x" * 60)
    users = await repo.list_cursor(
        limit=50,
        cursor=None,
        role=None,
        status=None,
        q="b@",
    )
    assert [u.email for u in users] == ["b@test.ru"]


async def test_decode_cursor_invalid():
    from src.core.cursor import decode_cursor

    try:
        decode_cursor("!!!not-base64!!!")
    except HTTPException as exc:
        assert exc.status_code == HTTPStatus.UNPROCESSABLE_ENTITY  # noqa: F821, PT017
    else:
        raise AssertionError("ожидался 422")


async def test_create_and_get_by_email(repo: UserRepository):
    user = await repo.create(email="test@example.com", password_hash="hashed")
    assert user.id is not None
    assert user.role.value == "user"
    assert user.status.value == "pending"

    found = await repo.get_by_email("test@example.com")
    assert found is not None
    assert found.id == user.id

    assert await repo.get_by_email("missing@example.com") is None


async def test_get_missing(repo: UserRepository):
    assert await repo.get_by_email("nobody@example.com") is None


# ---------- персональный токен proverkacheka ----------


async def test_update_proverkacheka_token(repo: UserRepository, session):
    user = await repo.create(email="token@test.ru", password_hash="x" * 60)
    assert user.proverkacheka_token is None

    service = UserService(repo)
    updated = await service.update_proverkacheka_token(user, "  secret-token-1  ")
    assert updated.proverkacheka_token == "secret-token-1"  # trim
    assert updated.id == user.id

    # обновление существующего
    again = await service.update_proverkacheka_token(updated, "secret-token-2")
    assert again.proverkacheka_token == "secret-token-2"

    # переживает перезагрузку из БД
    await session.commit()
    reloaded = await repo.get(user.id)
    assert reloaded is not None
    assert reloaded.proverkacheka_token == "secret-token-2"


async def test_update_proverkacheka_token_blank_rejected(repo):
    user = await repo.create(email="blank@test.ru", password_hash="x" * 60)
    service = UserService(repo)
    with pytest.raises(HTTPException) as exc_info:
        await service.update_proverkacheka_token(user, "   ")
    assert exc_info.value.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert user.proverkacheka_token is None


async def test_proverkacheka_token_update_schema_validation():
    # валидный токен
    assert ProverkachekaTokenUpdate(token="tok").token == "tok"
    # пустой/слишком длинный — 422 на уровне pydantic
    with pytest.raises(Exception):  # noqa: B017, PT011
        ProverkachekaTokenUpdate(token="")
    with pytest.raises(Exception):  # noqa: B017, PT011
        ProverkachekaTokenUpdate(token="x" * 257)
