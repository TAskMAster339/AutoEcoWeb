from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.rate_limit import RateLimitBucket


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class RateLimitRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def consume(
        self,
        key_hash: str,
        *,
        limit: int,
        window_seconds: int,
        now: datetime | None = None,
    ) -> int:
        """Consume one attempt and return Retry-After seconds, or zero."""
        now = now or datetime.now(timezone.utc)
        bucket = await self._get_for_update(key_hash)
        created = False
        if bucket is None:
            try:
                async with self._session.begin_nested():
                    bucket = RateLimitBucket(
                        key_hash=key_hash,
                        window_started_at=now,
                        count=1,
                    )
                    self._session.add(bucket)
                    await self._session.flush()
                    created = True
            except IntegrityError:
                bucket = await self._get_for_update(key_hash)
                if bucket is None:
                    raise

        # A concurrent transaction may have inserted the missing bucket while
        # this transaction waited on the unique key. That attempt still needs
        # to be consumed after the savepoint rollback.
        if not created:
            elapsed = (now - _as_utc(bucket.window_started_at)).total_seconds()
            if elapsed >= window_seconds:
                bucket.window_started_at = now
                bucket.count = 1
            else:
                bucket.count += 1
            await self._session.flush()

        if bucket.count <= limit:
            return 0
        elapsed = (now - _as_utc(bucket.window_started_at)).total_seconds()
        return max(1, int(window_seconds - elapsed))

    async def _get_for_update(self, key_hash: str) -> RateLimitBucket | None:
        return await self._session.scalar(
            select(RateLimitBucket)
            .where(RateLimitBucket.key_hash == key_hash)
            .with_for_update()
        )
