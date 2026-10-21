import asyncio
import hashlib
import logging
import socket
import time
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from ipaddress import ip_address
from typing import Any

from fastapi import HTTPException, Request, status
from sqlalchemy.exc import SQLAlchemyError

from src.core.config import settings
from src.core.database import RateLimitSessionLocal
from src.repositories.rate_limit import RateLimitRepository

logger = logging.getLogger(__name__)


@lru_cache(maxsize=4)
def _proxy_addresses(hosts: str, minute: int) -> frozenset[str]:
    addresses: set[str] = set()
    for host in hosts.split(","):
        if not host.strip():
            continue
        try:
            addresses.update(
                str(item[4][0]) for item in socket.getaddrinfo(host.strip(), None)
            )
        except OSError:
            logger.warning("trusted_proxy_resolution_failed")
    return frozenset(addresses)


def client_ip(request: Request) -> str:
    # Uvicorn proxy rewriting is disabled: request.client is the actual peer.
    peer = request.client.host if request.client is not None else "unknown"
    if peer in _proxy_addresses(
        settings.trusted_proxy_hosts, int(time.monotonic() // 60)
    ):
        try:
            return str(ip_address(request.headers.get("x-real-ip", "")))
        except ValueError:
            pass
    return peer


RATE_LIMIT_RESPONSES: dict[int | str, dict[str, Any]] = {
    429: {
        "description": "Слишком много запросов",
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "required": ["detail"],
                    "properties": {"detail": {"type": "string"}},
                }
            }
        },
        "headers": {
            "Retry-After": {
                "schema": {"type": "integer"},
                "description": "Время ожидания в секундах",
            }
        },
    },
    503: {
        "description": "Защита временно недоступна",
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "required": ["detail"],
                    "properties": {"detail": {"type": "string"}},
                }
            }
        },
    },
}


class RateLimiter:
    """Database-backed budgets shared by workers and containers."""

    _next_cleanup = 0.0

    async def _consume(
        self, action: str, identities: list[tuple[str, str, int]], window_seconds: int
    ) -> None:
        retry_after = 0
        cleanup = time.monotonic() >= RateLimiter._next_cleanup
        if cleanup:
            RateLimiter._next_cleanup = time.monotonic() + 3600
        try:
            async with asyncio.timeout(5):
                async with RateLimitSessionLocal() as session, session.begin():
                    repo = RateLimitRepository(session)
                    for kind, value, limit in identities:
                        key = hashlib.sha256(
                            f"{action}:{kind}:{value}".encode()
                        ).hexdigest()
                        retry_after = max(
                            retry_after,
                            await repo.consume(
                                key, limit=limit, window_seconds=window_seconds
                            ),
                        )
                    if cleanup:
                        await repo.delete_expired(
                            datetime.now(timezone.utc) - timedelta(days=1), limit=1000
                        )
        except (SQLAlchemyError, TimeoutError, OSError) as exc:
            logger.warning("rate_limit_unavailable action=%s", action)
            raise HTTPException(
                status_code=503,
                detail="Сервис временно недоступен. Повторите позже.",
                headers={"Retry-After": "5"},
            ) from exc
        if retry_after:
            logger.info(
                "rate_limit_exceeded action=%s retry_after=%s", action, retry_after
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Слишком много запросов. Повторите позже.",
                headers={"Retry-After": str(retry_after)},
            )

    async def check_user(
        self, *, action: str, user_id: object, limit: int, window_seconds: int
    ) -> None:
        await self._consume(action, [("user", str(user_id), limit)], window_seconds)

    async def check(
        self,
        *,
        action: str,
        ip: str,
        email: str | None,
        ip_limit: int,
        email_limit: int,
        window_seconds: int,
    ) -> None:
        identities = [("ip", ip, ip_limit)]
        if email:
            identities.append(("email", email.strip().lower(), email_limit))
        await self._consume(action, identities, window_seconds)


# Preserve the existing dependency and imports used by authentication.
AuthRateLimiter = RateLimiter
