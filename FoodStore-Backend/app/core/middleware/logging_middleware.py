import json
import logging
import sys
import time
import uuid
from datetime import datetime, timezone

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.logger import get_logger

logger = get_logger("app.middleware.logging")
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(logging.Formatter(
    fmt="%(asctime)s | %(levelname)-8s | %(name)-30s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
))
logger.addHandler(_handler)
logger.setLevel(logging.INFO)
logger.propagate = False

EXCLUDED_PATHS: frozenset[str] = frozenset({
    "/health",
    "/favicon.ico",
    "/openapi.json",
    "/docs",
    "/redoc",
})


class LoggingMiddleware:
    """
    Middleware ASGI puro que registra cada request/response con un UUID
    de correlación (X-Request-ID).

    Se implementa como ASGI puro (no BaseHTTPMiddleware) para que el
    header X-Request-ID se inyecte incluso en respuestas 500 producidas
    por exception handlers — con BaseHTTPMiddleware el post-processing
    no ejecuta cuando una excepción escapa call_next.

    El header se inyecta interceptando el mensaje "http.response.start"
    dentro del wrapper `send`, que se invoca tanto para respuestas
    normales como para las que generan los exception handlers.

    Para excepciones no manejadas (RuntimeError, etc.) que escapan todo el
    stack interno, Starlette las envía a ServerErrorMiddleware, que es
    EXTERIOR a este middleware y por tanto no pasa por send_with_request_id.
    Para cubrir ese caso, las capturamos aquí, construimos la respuesta 500
    directamente y la enviamos con el header ya incluido.
    """

    def __init__(self, app: ASGIApp, log_body: bool = False) -> None:
        self.app = app
        self.log_body = log_body

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = str(uuid.uuid4())
        start_time = time.perf_counter()
        path: str = scope.get("path", "")
        method: str = scope.get("method", "")

        # Guardamos el request_id como clave custom en el scope.
        # No usamos scope["state"] porque algunos entornos (TestClient)
        # lo inicializan como dict plano, lo que rompe el acceso por atributo.
        # Los exception handlers lo leen vía request.scope["_request_id"].
        scope["_request_id"] = request_id

        if path in EXCLUDED_PATHS:
            await self.app(scope, receive, send)
            return

        logger.info(
            "-> %s %s [id=%s] from=%s ua=%s",
            method,
            path,
            request_id,
            self._get_client_ip(scope),
            self._get_header(scope, b"user-agent"),
        )

        # Capturamos el status code desde el mensaje response.start.
        status_code: list[int] = [500]

        async def send_with_request_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                # MutableHeaders permite mutar los headers del mensaje ASGI
                # antes de enviarlo al cliente.
                headers = MutableHeaders(scope=message)
                headers.append("X-Request-ID", request_id)
                status_code[0] = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.critical(
                "x %s %s [id=%s] UNHANDLED EXCEPTION after %.1fms: %s",
                method, path, request_id, duration_ms, repr(exc), exc_info=True,
            )
            # Build the 500 response here rather than re-raising to
            # ServerErrorMiddleware, because ServerErrorMiddleware is outermost
            # and would send the response via its own `send`, bypassing our
            # send_with_request_id wrapper entirely.
            body = json.dumps({
                "error": {
                    "code": "internal_error",
                    "message": "Error interno del servidor. El equipo ha sido notificado.",
                    "request_id": request_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            }).encode()
            await send({
                "type": "http.response.start",
                "status": 500,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                    (b"x-request-id", request_id.encode()),
                ],
            })
            await send({"type": "http.response.body", "body": body})
            status_code[0] = 500

        duration_ms = (time.perf_counter() - start_time) * 1000
        code = status_code[0]

        if code >= 500:
            log_fn = logger.error
        elif code >= 400:
            log_fn = logger.warning
        else:
            log_fn = logger.info

        log_fn(
            "<- %s %s [id=%s] %d in %.1fms",
            method, path, request_id, code, duration_ms,
        )

    @staticmethod
    def _get_client_ip(scope: Scope) -> str:
        for name, value in scope.get("headers", []):
            if name == b"x-forwarded-for":
                return value.decode().split(",")[0].strip()
        client = scope.get("client")
        return client[0] if client else "unknown"

    @staticmethod
    def _get_header(scope: Scope, header_name: bytes) -> str:
        for name, value in scope.get("headers", []):
            if name == header_name:
                return value.decode(errors="replace")
        return "unknown"
