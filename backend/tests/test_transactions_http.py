from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.api.v1.transactions import _encode_cursor, router
from src.core.dependencies import get_current_user, get_transaction_service


class TransactionServiceStub:
    def __init__(self) -> None:
        self.kwargs: dict[str, object] | None = None

    async def list_page(self, _user, **kwargs):
        self.kwargs = kwargs
        return [], None


async def _client(service: TransactionServiceStub) -> AsyncClient:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=uuid4())
    app.dependency_overrides[get_transaction_service] = lambda: service
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_transaction_cursor_reaches_service_through_openapi_contract():
    service = TransactionServiceStub()
    cursor = _encode_cursor(datetime(2026, 1, 2, tzinfo=timezone.utc), uuid4())
    async with await _client(service) as client:
        response = await client.get(
            "/api/v1/transactions",
            params={
                "cursor": cursor,
                "include_total": "false",
                "sort_by": "date",
                "sort_dir": "asc",
            },
        )

    assert response.status_code == 200
    assert response.json() == {"items": [], "next_cursor": None, "total": None}
    assert service.kwargs is not None
    assert service.kwargs["include_total"] is False
    assert service.kwargs["after_datetime"] == datetime(2026, 1, 2, tzinfo=timezone.utc)


async def test_transaction_cursor_validation_is_an_http_422():
    service = TransactionServiceStub()
    async with await _client(service) as client:
        malformed = await client.get("/api/v1/transactions", params={"cursor": "not-a-cursor"})
        incompatible = await client.get(
            "/api/v1/transactions",
            params={"cursor": _encode_cursor(datetime.now(timezone.utc), uuid4()), "sort_dir": "desc"},
        )

    assert malformed.status_code == 422  # noqa: PLR2004
    assert incompatible.status_code == 422  # noqa: PLR2004
    assert service.kwargs is None
