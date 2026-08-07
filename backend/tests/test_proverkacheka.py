"""Клиент proverkacheka.com: fetch по QR, ошибки, валидация ответа."""

import json

import httpx
import pytest
from src.services.proverkacheka import ProverkachekaClient, ProverkachekaError
from test_receipt_parser import QR, sample_payload

TOKEN = "user-personal-token"


def _client(handler) -> ProverkachekaClient:
    return ProverkachekaClient(
        url="https://proverkacheka.test/api/v1/check/get",
        transport=httpx.MockTransport(handler),
    )


async def test_fetch_returns_payload():
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/check/get"
        body = json.loads(request.read())
        assert body == {"qrraw": QR, "token": TOKEN}
        return httpx.Response(200, json=sample_payload())

    client = _client(handler)
    payload = await client.fetch(QR, token=TOKEN)
    assert payload["code"] == 1
    assert "ПЕРЕКРЕСТОК" in payload["data"]["json"]["user"]


async def test_fetch_http_error():
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="boom")

    with pytest.raises(ProverkachekaError, match="HTTP 500"):
        await _client(handler).fetch(QR, token=TOKEN)


async def test_fetch_service_error_code_in_body():
    """proverkacheka отдаёт HTTP 200 с кодом ошибки в теле."""

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"code": 2, "message": "Неверный qrraw"})

    with pytest.raises(ProverkachekaError, match="Неверный qrraw"):
        await _client(handler).fetch(QR, token=TOKEN)


async def test_fetch_success_code_without_json():
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"code": 1, "data": None})

    with pytest.raises(ProverkachekaError):
        await _client(handler).fetch(QR, token=TOKEN)


async def test_fetch_non_json_response():
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html>captcha</html>")

    with pytest.raises(ProverkachekaError, match="не-JSON"):
        await _client(handler).fetch(QR, token=TOKEN)


async def test_fetch_network_error():
    async def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    with pytest.raises(ProverkachekaError, match="недоступен"):
        await _client(handler).fetch(QR, token=TOKEN)


async def test_fetch_empty_token_rejected():
    client = _client(lambda request: httpx.Response(200, json={}))
    with pytest.raises(ProverkachekaError, match="не задан"):
        await client.fetch(QR, token="   ")


async def test_fetch_strips_token():
    async def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.read())
        assert body["token"] == "trimmed-token"
        return httpx.Response(200, json=sample_payload())

    await _client(handler).fetch(QR, token="  trimmed-token  ")
