import hashlib

from fastapi import HTTPException, Request, status

from src.core.database import AsyncSessionLocal
from src.repositories.rate_limit import RateLimitRepository


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client is not None else "unknown"


class AuthRateLimiter:
    """Database-backed limiter shared by all workers and containers."""

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

        retry_after = 0
        async with AsyncSessionLocal() as session, session.begin():
            repo = RateLimitRepository(session)
            for kind, value, limit in identities:
                key_hash = hashlib.sha256(
                    f"{action}:{kind}:{value}".encode()
                ).hexdigest()
                retry_after = max(
                    retry_after,
                    await repo.consume(
                        key_hash,
                        limit=limit,
                        window_seconds=window_seconds,
                    ),
                )

        if retry_after:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Слишком много попыток. Повторите позже.",
                headers={"Retry-After": str(retry_after)},
            )
