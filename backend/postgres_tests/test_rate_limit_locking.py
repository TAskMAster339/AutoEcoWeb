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
