from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from src import main


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=main.app),
        base_url="http://test",
    ) as test_client:
        yield test_client


async def test_liveness_does_not_depend_on_database(client, monkeypatch):
    database_check = AsyncMock(return_value=False)
    monkeypatch.setattr(main, "_database_is_ready", database_check)

    response = await client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    database_check.assert_not_awaited()


async def test_readiness_reports_database_failure(client, monkeypatch):
    monkeypatch.setattr(main, "_database_is_ready", AsyncMock(return_value=False))

    response = await client.get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {"detail": "database unavailable"}


async def test_legacy_health_remains_a_readiness_alias(client, monkeypatch):
    database_check = AsyncMock(return_value=True)
    monkeypatch.setattr(main, "_database_is_ready", database_check)

    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    database_check.assert_awaited_once()
