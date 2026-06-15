"""
tests/integration/test_middlewares.py
======================================

Pruebas de integración para LoggingMiddleware y TimingMiddleware.

Usan el fixture `client_sqlite` (SQLite in-memory) para no depender de
la BD de Postgres. Los endpoints testeados son:
  - Un path inexistente → 404 (headers presentes en cualquier response)
  - POST /api/v1/auth/register → valida que el request_id llega al body
"""

import uuid

import pytest
from fastapi.testclient import TestClient


class TestLoggingMiddleware:
    """
    LoggingMiddleware agrega X-Request-ID a cada response y guarda
    el ID en request.state para que los exception handlers lo incluyan
    en el cuerpo del error.
    """

    def test_request_id_header_presente(self, client_sqlite: TestClient):
        """Toda response incluye el header X-Request-ID."""
        response = client_sqlite.get("/api/v1/ruta-inexistente")
        assert "x-request-id" in response.headers

    def test_request_id_es_uuid_v4(self, client_sqlite: TestClient):
        """El X-Request-ID es un UUID v4 válido."""
        response = client_sqlite.get("/api/v1/ruta-inexistente")
        request_id = response.headers["x-request-id"]
        parsed = uuid.UUID(request_id)
        assert parsed.version == 4

    def test_request_id_unico_por_request(self, client_sqlite: TestClient):
        """Dos requests distintos producen request_ids distintos."""
        r1 = client_sqlite.get("/api/v1/ruta-inexistente")
        r2 = client_sqlite.get("/api/v1/ruta-inexistente")
        assert r1.headers["x-request-id"] != r2.headers["x-request-id"]

    def test_request_id_incluido_en_error_body(self, client_sqlite: TestClient):
        """
        El middleware guarda el request_id en request.state y los
        exception handlers lo incluyen en el JSON de error.
        El request_id del header debe coincidir con el del body.
        """
        response = client_sqlite.get("/api/v1/ruta-inexistente")
        assert response.status_code == 404
        body = response.json()
        assert "error" in body
        assert body["error"]["request_id"] == response.headers["x-request-id"]


class TestTimingMiddleware:
    """
    TimingMiddleware agrega X-Response-Time-ms y Server-Timing a cada response.
    """

    def test_response_time_header_presente(self, client_sqlite: TestClient):
        """Toda response incluye X-Response-Time-ms."""
        response = client_sqlite.get("/api/v1/ruta-inexistente")
        assert "x-response-time-ms" in response.headers

    def test_response_time_es_numerico(self, client_sqlite: TestClient):
        """El valor de X-Response-Time-ms es parseable como float >= 0."""
        response = client_sqlite.get("/api/v1/ruta-inexistente")
        ms = float(response.headers["x-response-time-ms"])
        assert ms >= 0

    def test_response_time_razonable(self, client_sqlite: TestClient):
        """El tiempo reportado es entre 0 y 5 000 ms."""
        response = client_sqlite.get("/api/v1/ruta-inexistente")
        ms = float(response.headers["x-response-time-ms"])
        assert 0 <= ms < 5000

    def test_server_timing_header_presente(self, client_sqlite: TestClient):
        """El header estándar Server-Timing está presente y contiene 'total'."""
        response = client_sqlite.get("/api/v1/ruta-inexistente")
        assert "server-timing" in response.headers
        assert "total" in response.headers["server-timing"]
