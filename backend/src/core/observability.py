import json
import logging
import logging.config
import re
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = b"x-request-id"
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._:-]{1,64}$")
_request_id: ContextVar[str] = ContextVar("request_id", default="-")

HTTP_REQUESTS = Counter(
    "autoeco_http_requests_total",
    "HTTP requests grouped by route, method and status.",
    ("route", "method", "status"),
)
HTTP_DURATION = Histogram(
    "autoeco_http_request_duration_seconds",
    "HTTP request latency grouped by route and method.",
    ("route", "method"),
)
DOMAIN_REQUESTS = Counter(
    "autoeco_domain_requests_total",
    "Auth and import request outcomes.",
    ("domain", "operation", "outcome"),
)
DOMAIN_DURATION = Histogram(
    "autoeco_domain_request_duration_seconds",
    "Auth and import request latency.",
    ("domain", "operation"),
)
EXTERNAL_REQUESTS = Counter(
    "autoeco_external_requests_total",
    "External API request outcomes.",
    ("service", "operation", "outcome"),
)
EXTERNAL_DURATION = Histogram(
    "autoeco_external_request_duration_seconds",
    "External API request latency.",
    ("service", "operation"),
)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", _request_id.get()),
        }
        for field in (
            "event",
            "method",
            "route",
            "status",
            "duration_ms",
            "outcome",
            "service",
            "operation",
            "error_type",
        ):
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging() -> None:
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {"json": {"()": JsonFormatter}},
            "handlers": {
                "default": {
                    "class": "logging.StreamHandler",
                    "formatter": "json",
                    "stream": "ext://sys.stdout",
                },
            },
            "root": {"handlers": ["default"], "level": "INFO"},
        },
    )


def _request_id_from_scope(scope: Scope) -> str:
    for name, value in scope.get("headers", []):
        if name == REQUEST_ID_HEADER:
            candidate = value.decode("ascii", errors="ignore")
            if _SAFE_REQUEST_ID.fullmatch(candidate):
                return candidate
    return uuid.uuid4().hex


def _domain_for_route(route: str) -> tuple[str, str] | None:
    for domain, prefix in (
        ("auth", "/api/v1/auth"),
        ("import", "/api/v1/import-export"),
    ):
        if route == prefix or route.startswith(f"{prefix}/"):
            operation = route.removeprefix(prefix).strip("/") or "root"
            return domain, operation
    return None


class ObservabilityMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self._logger = logging.getLogger("autoeco.http")

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _request_id_from_scope(scope)
        context_token = _request_id.set(request_id)
        started_at = time.perf_counter()
        status_code = 500
        response_started = False

        async def send_with_request_id(message: Message) -> None:
            nonlocal response_started, status_code
            if message["type"] == "http.response.start":
                response_started = True
                status_code = message["status"]
                headers = list(message.get("headers", []))
                headers.append((REQUEST_ID_HEADER, request_id.encode("ascii")))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception as exc:
            self._logger.exception(
                "Unhandled request exception",
                extra={
                    "event": "request.unhandled_exception",
                    "error_type": type(exc).__name__,
                },
            )
            if response_started:
                raise
            response = JSONResponse(
                status_code=500,
                content={"detail": "Internal server error", "request_id": request_id},
            )
            await response(scope, receive, send_with_request_id)
        finally:
            duration = time.perf_counter() - started_at
            route_object = scope.get("route")
            route_value = getattr(route_object, "path", scope.get("path", "unknown"))
            route = route_value if isinstance(route_value, str) else "unknown"
            method = scope.get("method", "unknown")
            status_label = str(status_code)
            outcome = "success" if status_code < 400 else "error"
            HTTP_REQUESTS.labels(route, method, status_label).inc()
            HTTP_DURATION.labels(route, method).observe(duration)

            domain = _domain_for_route(route)
            if domain is not None:
                domain_name, operation = domain
                DOMAIN_REQUESTS.labels(domain_name, operation, outcome).inc()
                DOMAIN_DURATION.labels(domain_name, operation).observe(duration)
                self._logger.info(
                    "Domain request completed",
                    extra={
                        "event": f"{domain_name}.request",
                        "route": route,
                        "method": method,
                        "status": status_code,
                        "duration_ms": round(duration * 1000, 2),
                        "outcome": outcome,
                        "operation": operation,
                    },
                )
            else:
                self._logger.info(
                    "HTTP request completed",
                    extra={
                        "event": "request.completed",
                        "route": route,
                        "method": method,
                        "status": status_code,
                        "duration_ms": round(duration * 1000, 2),
                        "outcome": outcome,
                    },
                )
            _request_id.reset(context_token)


@contextmanager
def observe_external_call(service: str, operation: str) -> Iterator[None]:
    started_at = time.perf_counter()
    outcome = "success"
    try:
        yield
    except Exception:
        outcome = "error"
        raise
    finally:
        duration = time.perf_counter() - started_at
        EXTERNAL_REQUESTS.labels(service, operation, outcome).inc()
        EXTERNAL_DURATION.labels(service, operation).observe(duration)
        logging.getLogger("autoeco.external").info(
            "External API call completed",
            extra={
                "event": "external.request",
                "service": service,
                "operation": operation,
                "outcome": outcome,
                "duration_ms": round(duration * 1000, 2),
            },
        )


async def metrics_response() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
