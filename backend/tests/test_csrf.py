from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.core.cookies import ACCESS_COOKIE
from src.core.csrf import CookieCSRFMiddleware


def _client() -> TestClient:
    app = FastAPI()
    app.add_middleware(
        CookieCSRFMiddleware,
        allowed_origins=["https://app.example"],
    )

    @app.post("/api/v1/change")
    async def change():
        return {"ok": True}

    return TestClient(app)


def test_cookie_mutation_accepts_allowlisted_origin():
    client = _client()
    client.cookies.set(ACCESS_COOKIE, "token")

    response = client.post(
        "/api/v1/change",
        headers={"Origin": "https://app.example"},
    )

    assert response.status_code == 200  # noqa: PLR2004


def test_cookie_mutation_rejects_missing_or_foreign_origin():
    client = _client()
    client.cookies.set(ACCESS_COOKIE, "token")

    assert client.post("/api/v1/change").status_code == 403  # noqa: PLR2004
    assert (
        client.post(
            "/api/v1/change",
            headers={"Origin": "https://evil.example"},
        ).status_code
        == 403  # noqa: PLR2004
    )


def test_non_cookie_api_client_does_not_require_origin():
    response = _client().post(
        "/api/v1/change",
        headers={"Authorization": "Bearer token"},
    )

    assert response.status_code == 200  # noqa: PLR2004
