from collections.abc import Sequence

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from src.core.cookies import ACCESS_COOKIE, REFRESH_COOKIE

_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class CookieCSRFMiddleware(BaseHTTPMiddleware):
    """Require a trusted Origin for cookie-authenticated state changes.

    Bearer/API clients remain usable without an Origin because they do not
    rely on ambient browser credentials and therefore are not CSRF targets.
    """

    def __init__(self, app, *, allowed_origins: Sequence[str]) -> None:
        super().__init__(app)
        self._allowed_origins = frozenset(allowed_origins)

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        uses_auth_cookie = bool(
            request.cookies.get(ACCESS_COOKIE) or request.cookies.get(REFRESH_COOKIE)
        )
        if (
            request.method not in _SAFE_METHODS
            and request.url.path.startswith("/api/")
            and uses_auth_cookie
            and request.headers.get("origin") not in self._allowed_origins
        ):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Недоверенный источник запроса"},
            )
        return await call_next(request)
