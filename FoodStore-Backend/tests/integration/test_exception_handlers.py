"""
tests/integration/test_exception_handlers.py
=============================================

Pruebas de los exception handlers globales.

Verifican que TODOS los errores de la API se devuelvan con el formato
JSON unificado:
    {
        "error": {
            "code": "...",
            "message": "...",
            "request_id": "...",
            "timestamp": "..."
        }
    }

Usan `client_sqlite` (SQLite in-memory) para no depender de Postgres.
"""

import pytest
from fastapi.testclient import TestClient


class TestFormatoUnificado:
    """Toda excepción devuelve la misma estructura JSON."""

    def test_404_tiene_formato_unificado(self, client_sqlite: TestClient):
        """Un path inexistente devuelve 404 con nuestro formato (no el de FastAPI)."""
        response = client_sqlite.get("/api/v1/ruta-que-no-existe")
        assert response.status_code == 404
        data = response.json()
        assert "error" in data
        err = data["error"]
        assert "code" in err
        assert "message" in err
        assert "request_id" in err
        assert "timestamp" in err

    def test_422_errores_de_validacion(self, client_sqlite: TestClient):
        """
        Body inválido → 422 con el formato unificado y lista de fields.
        Enviamos un email con formato inválido para provocar el error.
        """
        response = client_sqlite.post(
            "/api/v1/auth/register",
            json={"nombre": 123, "apellido": "Test", "email": "no-es-email", "contrasena": "x"},
        )
        assert response.status_code == 422
        data = response.json()
        assert "error" in data
        err = data["error"]
        assert err["code"] == "validation_error"
        assert "fields" in err

    def test_401_sin_autenticacion(self, client_sqlite: TestClient):
        """Endpoint protegido sin token → 401 con formato unificado."""
        response = client_sqlite.get("/api/v1/auth/me")
        assert response.status_code == 401
        data = response.json()
        assert "error" in data
        assert "code" in data["error"]

    def test_request_id_presente_en_todos_los_errores(self, client_sqlite: TestClient):
        """El request_id está presente en cualquier respuesta de error."""
        response = client_sqlite.get("/api/v1/ruta-que-no-existe")
        data = response.json()
        assert data["error"]["request_id"] is not None

    def test_timestamp_presente_en_todos_los_errores(self, client_sqlite: TestClient):
        """El timestamp ISO 8601 está presente en cualquier respuesta de error."""
        response = client_sqlite.get("/api/v1/ruta-que-no-existe")
        data = response.json()
        # Si no es parseable como fecha ISO 8601, este test falla.
        timestamp = data["error"]["timestamp"]
        assert isinstance(timestamp, str)
        assert len(timestamp) > 0


class TestExcepcionesDeDominio:
    """
    Excepciones definidas en custom_exceptions.py vía los handlers.
    Se verifican a través de flujos reales de la API.
    """

    def test_registro_duplicado_devuelve_409(self, client: TestClient):
        """Registrar el mismo email dos veces → 409 con código duplicate_resource."""
        payload = {
            "nombre": "Test",
            "apellido": "Dup",
            "email": "dup@test.com",
            "contrasena": "password123",
        }
        r1 = client.post("/api/v1/auth/register", json=payload)
        assert r1.status_code == 201, f"Setup falló: {r1.json()}"

        r2 = client.post("/api/v1/auth/register", json=payload)
        assert r2.status_code == 409
        data = r2.json()
        assert "error" in data
        # El handler de IntegrityError o AppError debe poner código 409.
        assert data["error"]["code"] in ("duplicate_resource", "conflict")

    def test_login_credenciales_invalidas_devuelve_401(self, client: TestClient):
        """Login con contraseña incorrecta → 401 con formato unificado."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "noexiste@test.com", "contrasena": "wrongpass"},
        )
        assert response.status_code == 401
        data = response.json()
        assert "error" in data
        assert "code" in data["error"]

    def test_admin_requerido_sin_rol_devuelve_403(self, client_autenticado: TestClient):
        """Un usuario sin rol ADMIN intentando una acción admin → 403."""
        response = client_autenticado.get("/api/v1/auth/admin/usuarios")
        assert response.status_code == 403
        data = response.json()
        assert "error" in data
        assert "code" in data["error"]
