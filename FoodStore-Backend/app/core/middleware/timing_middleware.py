import time

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.logger import get_logger

logger = get_logger("app.middleware.timing")

SLOW_REQUEST_THRESHOLD_MS = 500.0


class TimingMiddleware:
    """
    Middleware ASGI puro que mide el tiempo total de cada request y lo
    expone via headers:
      - X-Response-Time-ms
      - Server-Timing (estándar W3C)

    Se implementa como ASGI puro por la misma razón que LoggingMiddleware:
    los headers se inyectan en "http.response.start", que se ejecuta
    tanto para respuestas normales como para respuestas de error (500).
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start = time.perf_counter()
        path: str = scope.get("path", "")
        method: str = scope.get("method", "")

        async def send_with_timing(message: Message) -> None:
            if message["type"] == "http.response.start":
                duration_ms = (time.perf_counter() - start) * 1000.0
                headers = MutableHeaders(scope=message)
                headers.append("X-Response-Time-ms", f"{duration_ms:.2f}")
                headers.append(
                    "Server-Timing",
                    f'total;dur={duration_ms:.2f};desc="Total request time"',
                )
                if duration_ms > SLOW_REQUEST_THRESHOLD_MS:
                    logger.warning(
                        "SLOW REQUEST: %s %s took %.1fms (threshold: %.0fms)",
                        method, path, duration_ms, SLOW_REQUEST_THRESHOLD_MS,
                    )
            await send(message)

        await self.app(scope, receive, send_with_timing)
