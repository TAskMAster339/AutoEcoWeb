from datetime import datetime, timedelta, timezone

from src.repositories.rate_limit import RateLimitRepository


async def test_database_rate_limit_bucket_is_shared_and_resets(session):
    repo = RateLimitRepository(session)
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)

    assert await repo.consume("shared-key", limit=2, window_seconds=60, now=start) == 0
    assert await repo.consume("shared-key", limit=2, window_seconds=60, now=start) == 0
    retry_after = await repo.consume(
        "shared-key",
        limit=2,
        window_seconds=60,
        now=start,
    )
    assert retry_after == 60  # noqa: PLR2004

    assert (
        await repo.consume(
            "shared-key",
            limit=2,
            window_seconds=60,
            now=start + timedelta(seconds=61),
        )
        == 0
    )
