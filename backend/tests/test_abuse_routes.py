from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from src.main import app
from src.core.dependencies import get_current_user, get_auth_rate_limiter
from src.models.user import User


@pytest.mark.parametrize(
    "method,path,body,action",
    [
        ("POST", "/api/v1/receipts/parse", {}, "receipt_fetch"),
        ("POST", "/api/v1/receipts", {}, "receipt_fetch"),
        ("POST", "/api/v1/import-export/import", {}, "import_export"),
        ("GET", "/api/v1/import-export/export", None, "import_export"),
        ("POST", "/api/v1/feedback", {}, "feedback_create"),
        ("POST", "/api/v1/import-export/preview", None, "import_export"),
    ],
)
async def test_rejected_requests_stop_before_business_logic(method, path, body, action):
    user = User(id=uuid4(), email="user@example.com", password_hash="unused")
    limiter = AsyncMock()
    limiter.check_user.side_effect = HTTPException(
        status_code=429, detail="Слишком много запросов", headers={"Retry-After": "60"}
    )
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_auth_rate_limiter] = lambda: limiter
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.request(method, path, json=body)
        assert response.status_code == 429
        assert response.headers["Retry-After"] == "60"
        assert limiter.check_user.await_args.kwargs["action"] == action
        assert limiter.check_user.await_args.kwargs["user_id"] == user.id
    finally:
        app.dependency_overrides.clear()


async def test_unauthenticated_request_does_not_consume_user_budget():
    limiter = AsyncMock()
    app.dependency_overrides[get_auth_rate_limiter] = lambda: limiter
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/v1/import-export/export")
        assert response.status_code == 401
        limiter.check_user.assert_not_awaited()
    finally:
        app.dependency_overrides.clear()
