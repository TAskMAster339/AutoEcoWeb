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


async def test_cleanup_is_bounded_and_preserves_active_buckets(session):
    from sqlalchemy import select
    from src.models.rate_limit import RateLimitBucket

    repo = RateLimitRepository(session)
    now = datetime.now(timezone.utc)
    for key in ("old-a", "old-b"):
        await repo.consume(key, limit=1, window_seconds=60, now=now - timedelta(days=2))
    await repo.consume("active", limit=1, window_seconds=60, now=now)
    await repo.delete_expired(now - timedelta(days=1), limit=1)
    keys = set(await session.scalars(select(RateLimitBucket.key_hash)))
    assert "active" in keys
    assert len(keys) == 2
    await repo.delete_expired(now - timedelta(days=1), limit=1000)
    assert list(await session.scalars(select(RateLimitBucket.key_hash))) == ["active"]


def test_client_ip_ignores_forged_headers_and_only_trusts_gateway(monkeypatch):
    from starlette.requests import Request
    from src.services import rate_limit

    monkeypatch.setattr(rate_limit, "_proxy_addresses", lambda *_: {"172.20.0.2"})

    def request(peer, real_ip):
        return Request(
            {
                "type": "http",
                "client": (peer, 1234),
                "headers": [
                    (b"x-real-ip", real_ip.encode()),
                    (b"x-forwarded-for", b"1.2.3.4"),
                ],
            }
        )

    assert rate_limit.client_ip(request("8.8.8.8", "1.1.1.1")) == "8.8.8.8"
    assert rate_limit.client_ip(request("172.20.0.2", "1.1.1.1")) == "1.1.1.1"
    assert rate_limit.client_ip(request("172.20.0.2", "invalid")) == "172.20.0.2"


async def test_user_budgets_are_shared_and_isolated_by_user_and_action(
    session, monkeypatch
):
    from contextlib import asynccontextmanager
    from fastapi import HTTPException
    import pytest
    from src.services import rate_limit

    @asynccontextmanager
    async def factory():
        yield session

    monkeypatch.setattr(rate_limit, "RateLimitSessionLocal", factory)
    monkeypatch.setattr(rate_limit.RateLimiter, "_next_cleanup", float("inf"))
    first, second = rate_limit.RateLimiter(), rate_limit.RateLimiter()
    await first.check_user(
        action="receipt_fetch", user_id="alice", limit=1, window_seconds=60
    )
    with pytest.raises(HTTPException) as error:
        await second.check_user(
            action="receipt_fetch", user_id="alice", limit=1, window_seconds=60
        )
    assert error.value.status_code == 429
    assert int(error.value.headers["Retry-After"]) > 0
    await first.check_user(
        action="receipt_fetch", user_id="bob", limit=1, window_seconds=60
    )
    await first.check_user(
        action="import_export", user_id="alice", limit=1, window_seconds=60
    )


async def test_database_failure_returns_503(monkeypatch):
    from fastapi import HTTPException
    from sqlalchemy.exc import SQLAlchemyError
    import pytest
    from src.services import rate_limit

    def unavailable():
        raise SQLAlchemyError("private connection details")

    monkeypatch.setattr(rate_limit, "RateLimitSessionLocal", unavailable)
    with pytest.raises(HTTPException) as error:
        await rate_limit.RateLimiter().check_user(
            action="receipt_fetch", user_id="alice", limit=10, window_seconds=60
        )
    assert error.value.status_code == 503
    assert "private" not in error.value.detail
