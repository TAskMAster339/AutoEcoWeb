from src.core.config import settings

ACCESS_COOKIE = "autoeco_access"
REFRESH_COOKIE = "autoeco_refresh"


def set_auth_cookies(response, access, refresh, secure):
    response.set_cookie(
        ACCESS_COOKIE,
        access,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        samesite="lax",
        secure=secure,
        path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh,
        max_age=settings.refresh_token_expire_days * 86400,
        httponly=True,
        samesite="lax",
        secure=secure,
        path="/",
    )


def clear_auth_cookies(response):
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/")
