import asyncio
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import delete, select

from src.core.database import AsyncSessionLocal
from src.models.rate_limit import RateLimitBucket
from src.repositories.rate_limit import RateLimitRepository


async def _consume(key: str) -> int:
    async with AsyncSessionLocal() as session, session.begin():
        return await RateLimitRepository(session).consume(
            key,
            limit=1,
            window_seconds=60,
            now=datetime.now(timezone.utc),
        )


async def test_postgres_serializes_concurrent_rate_limit_consumers():
    key = f"ci-race-{uuid4().hex}"
    try:
        results = await asyncio.gather(_consume(key), _consume(key))
        assert sorted(results)[0] == 0
        assert sorted(results)[1] > 0

        async with AsyncSessionLocal() as session:
            bucket = await session.scalar(
                select(RateLimitBucket).where(RateLimitBucket.key_hash == key)
            )
            assert bucket is not None
            assert bucket.count == 2  # noqa: PLR2004
    finally:
        async with AsyncSessionLocal() as session, session.begin():
            await session.execute(
                delete(RateLimitBucket).where(RateLimitBucket.key_hash == key)
            )


async def test_postgres_user_budget_commits_rejections_and_cleanup(monkeypatch):
    import hashlib
    from datetime import timedelta
    import pytest
    from fastapi import HTTPException
    from src.services.rate_limit import RateLimiter

    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from src.core.database import DATABASE_URL
    from src.services import rate_limit

    # Each pytest test has its own event loop; do not reuse another loop's pool.
    local_engine = create_async_engine(DATABASE_URL, pool_size=2, max_overflow=3)
    sessions = async_sessionmaker(local_engine, expire_on_commit=False)
    monkeypatch.setattr(rate_limit, "RateLimitSessionLocal", sessions)

    user_id = uuid4()
    action = "integration_budget"
    key = hashlib.sha256(f"{action}:user:{user_id}".encode()).hexdigest()
    old_key = uuid4().hex
    try:
        limiter = RateLimiter()
        await limiter.check_user(
            action=action, user_id=user_id, limit=1, window_seconds=60
        )
        with pytest.raises(HTTPException) as error:
            await RateLimiter().check_user(
                action=action, user_id=user_id, limit=1, window_seconds=60
            )
        assert error.value.status_code == 429
        async with sessions() as session, session.begin():
            repo = RateLimitRepository(session)
            await repo.consume(
                old_key,
                limit=1,
                window_seconds=60,
                now=datetime.now(timezone.utc) - timedelta(days=2),
            )
            await repo.delete_expired(
                datetime.now(timezone.utc) - timedelta(days=1), limit=1000
            )
        async with sessions() as session:
            assert (await session.get(RateLimitBucket, key)).count == 2
            assert await session.get(RateLimitBucket, old_key) is None
    finally:
        async with sessions() as session, session.begin():
            await session.execute(
                delete(RateLimitBucket).where(
                    RateLimitBucket.key_hash.in_([key, old_key])
                )
            )

        await local_engine.dispose()
