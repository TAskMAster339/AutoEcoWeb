import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from prometheus_client import generate_latest

from src.core.observability import (
    JsonFormatter,
    ObservabilityMiddleware,
    observe_external_call,
)


def _client() -> TestClient:
    app = FastAPI()
    app.add_middleware(ObservabilityMiddleware)

    @app.get("/ok")
    async def ok():
        return {"ok": True}

    @app.get("/failure")
    async def failure():
        raise RuntimeError("private failure details")

    return TestClient(app, raise_server_exceptions=False)


def test_request_id_is_preserved_in_response():
    response = _client().get("/ok", headers={"X-Request-ID": "client-request-42"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "client-request-42"


def test_invalid_request_id_is_replaced():
    response = _client().get("/ok", headers={"X-Request-ID": "invalid id"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] != "invalid id"
    assert len(response.headers["X-Request-ID"]) == 32


def test_unhandled_exception_has_safe_response_and_correlation_id():
    response = _client().get("/failure", headers={"X-Request-ID": "failure-42"})

    assert response.status_code == 500
    assert response.headers["X-Request-ID"] == "failure-42"
    assert response.json() == {
        "detail": "Internal server error",
        "request_id": "failure-42",
    }
    assert "private failure details" not in response.text


def test_json_formatter_emits_structured_safe_fields():
    import logging

    record = logging.LogRecord(
        name="test",
        level=logging.WARNING,
        pathname=__file__,
        lineno=1,
        msg="security event",
        args=(),
        exc_info=None,
    )
    record.event = "auth.denied"
    record.request_id = "request-1"

    payload = json.loads(JsonFormatter().format(record))

    assert payload["event"] == "auth.denied"
    assert payload["request_id"] == "request-1"
    assert payload["level"] == "WARNING"


def test_metrics_cover_http_domains_and_external_errors():
    client = _client()
    client.get("/ok")

    with pytest.raises(RuntimeError):
        with observe_external_call("test-service", "fetch"):
            raise RuntimeError("failed")

    metrics = generate_latest().decode()
    assert "autoeco_http_requests_total" in metrics
    assert 'service="test-service"' in metrics
    assert 'operation="fetch",outcome="error"' in metrics
