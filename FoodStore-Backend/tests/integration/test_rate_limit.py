"""
tests/integration/test_rate_limit.py
======================================

Pruebas de integración del rate limiting en /api/v1/auth/login.

El limiter está configurado en `configuracion.RATE_LIMIT_LOGIN` (5/15minutes).
Después de 5 intentos fallidos desde la misma IP, el 6° debe devolver 429.

El fixture `reset_rate_limits` del conftest limpia el estado antes de cada test.
"""

import pytest
from fastapi.testclient import TestClient


# Payload de login inválido (no interesa que falle por credenciales,
# solo que el rate limiter cuente la request).
_LOGIN_INVALID = {"email": "noexiste@test.com", "contrasena": "wrong"}

# slowapi usa request.client.host como clave del rate limiter.
# TestClient no envía una IP real, por lo que slowapi no puede identificar
# al cliente y nunca incrementa el contador. Inyectamos X-Forwarded-For
# para forzar una IP conocida y hacer el rate limiting predecible en tests.
_HEADERS = {"X-Forwarded-For": "1.2.3.4"}


class TestRateLimitLogin:
    """
    Rate limit aplicado al endpoint de login (slowapi).
    """

    def test_primer_intento_permitido(self, client: TestClient):
        """El primer login siempre pasa (no es bloqueado por rate limit)."""
        response = client.post("/api/v1/auth/login", json=_LOGIN_INVALID, headers=_HEADERS)
        # Puede ser 401 (credenciales incorrectas) pero NO 429.
        assert response.status_code != 429

    def test_superar_limite_devuelve_429(self, client: TestClient):
        """Después del límite configurado, la siguiente request recibe 429."""
        # Agotamos el límite (5 intentos por defecto).
        for _ in range(5):
            client.post("/api/v1/auth/login", json=_LOGIN_INVALID, headers=_HEADERS)

        # El intento siguiente debe ser bloqueado.
        response = client.post("/api/v1/auth/login", json=_LOGIN_INVALID, headers=_HEADERS)
        assert response.status_code == 429

    def test_respuesta_429_tiene_formato_unificado(self, client: TestClient):
        """
        El 429 generado por slowapi usa nuestro formato unificado
        (gracias al rate_limit_exceeded_handler registrado en main.py).
        """
        for _ in range(5):
            client.post("/api/v1/auth/login", json=_LOGIN_INVALID, headers=_HEADERS)

        response = client.post("/api/v1/auth/login", json=_LOGIN_INVALID, headers=_HEADERS)
        assert response.status_code == 429
        body = response.json()
        assert "error" in body
        err = body["error"]
        assert "code" in err
        assert "message" in err
        assert err["code"] == "rate_limit_exceeded"

    def test_respuesta_429_tiene_retry_after(self, client: TestClient):
        """El 429 incluye el header Retry-After para que el cliente sepa cuándo reintentar."""
        for _ in range(5):
            client.post("/api/v1/auth/login", json=_LOGIN_INVALID, headers=_HEADERS)

        response = client.post("/api/v1/auth/login", json=_LOGIN_INVALID, headers=_HEADERS)
        assert response.status_code == 429
        assert "retry-after" in response.headers
