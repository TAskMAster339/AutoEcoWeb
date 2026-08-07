"""Клиент API proverkacheka.com — получение чека по QR-строке ФНС.
Ответы proverkacheka отдают HTTP 200 даже при ошибках — успех кодируется
в теле: `{"code": 1, "data": {"json": {...}}}`.
"""

from __future__ import annotations

from http import HTTPStatus

import httpx
from src.core.config import settings

__all__ = ["ProverkachekaClient", "ProverkachekaError"]


class ProverkachekaError(RuntimeError):
    """Сервис чеков недоступен, вернул ошибку или токен не задан."""


class ProverkachekaClient:
    """POST {qrraw, token} → proverkacheka.com/api/v1/check/get."""

    def __init__(
        self,
        *,
        url: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
        timeout: float = 15.0,
    ) -> None:
        self._url = url or settings.proverkacheka_url
        self._transport = transport
        self._timeout = timeout

    async def fetch(self, qrraw: str, *, token: str) -> dict:
        """Запрашивает чек по QR-строке ФНС, возвращает сырой payload.

        `token` — персональный токен пользователя из БД; обязателен.
        """
        token = token.strip()
        if not token:
            raise ProverkachekaError("Токен proverkacheka не задан")

        async with httpx.AsyncClient(
            transport=self._transport,
            timeout=self._timeout,
        ) as client:
            try:
                response = await client.post(
                    self._url,
                    json={"qrraw": qrraw, "token": token},
                )
            except httpx.HTTPError as exc:
                raise ProverkachekaError(f"Сервис чеков недоступен: {exc}") from exc

        if response.status_code != HTTPStatus.OK:
            raise ProverkachekaError(
                f"Сервис чеков вернул HTTP {response.status_code}",
            )

        try:
            payload = response.json()
        except ValueError as exc:
            raise ProverkachekaError("Сервис чеков вернул не-JSON ответ") from exc

        if not isinstance(payload, dict):
            raise ProverkachekaError("Некорректный ответ сервиса чеков")

        data = payload.get("data")
        check = data.get("json") if isinstance(data, dict) else None
        if payload.get("code") != 1 or not isinstance(check, dict):
            message = payload.get("message") or payload.get("error")
            detail = f": {message}" if message else ""
            raise ProverkachekaError(f"Сервис чеков не нашёл чек{detail}")

        return payload
