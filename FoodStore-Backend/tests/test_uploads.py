"""
Tests de integración para el módulo de uploads (Cloudinary):
  POST   /uploads/imagen
  DELETE /uploads/imagen/{public_id}
"""

import pytest

from tests.conftest import DATOS_USUARIO


# ── POST /uploads/imagen ──────────────────────────────────────────────────────

def test_subir_imagen_exitoso(client_admin, usuario_admin_creado, monkeypatch):
    """POST /uploads/imagen con Cloudinary mockeado → 201 con secure_url y public_id."""
    monkeypatch.setattr(
        "app.services.uploads_service.subir_imagen",
        lambda file_bytes, content_type: {
            "secure_url": "https://res.cloudinary.com/demo/image/upload/test.jpg",
            "public_id": "foodstore/test",
            "width": 800,
            "height": 600,
            "format": "jpg",
            "resource_type": "image",
        },
    )
    r = client_admin.post(
        "/api/v1/uploads/imagen",
        files={"file": ("test.jpg", b"fake-image-bytes", "image/jpeg")},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["secure_url"] == "https://res.cloudinary.com/demo/image/upload/test.jpg"
    assert data["public_id"] == "foodstore/test"


def test_subir_imagen_tipo_invalido_da_400(client_admin, usuario_admin_creado, monkeypatch):
    """MIME type no permitido → service lanza ValueError → 400."""
    monkeypatch.setattr(
        "app.services.uploads_service.subir_imagen",
        lambda file_bytes, content_type: (_ for _ in ()).throw(
            ValueError("Tipo de archivo no permitido")
        ),
    )
    r = client_admin.post(
        "/api/v1/uploads/imagen",
        files={"file": ("doc.txt", b"not an image", "text/plain")},
    )
    assert r.status_code == 400


def test_subir_imagen_error_cloudinary_da_502(client_admin, usuario_admin_creado, monkeypatch):
    """Error de Cloudinary → 502."""
    def _subir_falla(file_bytes, content_type):
        raise Exception("Cloudinary connection timeout")

    monkeypatch.setattr("app.services.uploads_service.subir_imagen", _subir_falla)
    r = client_admin.post(
        "/api/v1/uploads/imagen",
        files={"file": ("img.png", b"fake-png", "image/png")},
    )
    assert r.status_code == 502


def test_cliente_no_puede_subir_imagen(client, usuario_creado, usuario_admin_creado):
    """Sin rol ADMIN → 403."""
    r = client.post("/api/v1/auth/login", json={
        "email": DATOS_USUARIO["email"],
        "contrasena": DATOS_USUARIO["contrasena"],
    })
    assert r.status_code == 200
    r = client.post(
        "/api/v1/uploads/imagen",
        files={"file": ("img.jpg", b"fake", "image/jpeg")},
    )
    assert r.status_code == 403


# ── DELETE /uploads/imagen/{public_id} ────────────────────────────────────────

def test_eliminar_imagen_exitoso(client_admin, usuario_admin_creado, monkeypatch):
    """DELETE /uploads/imagen/{public_id} con Cloudinary mockeado → 204."""
    monkeypatch.setattr(
        "app.services.uploads_service.eliminar_imagen",
        lambda public_id: None,
    )
    r = client_admin.delete("/api/v1/uploads/imagen/foodstore/test-image")
    assert r.status_code == 204


def test_eliminar_imagen_error_cloudinary_da_502(client_admin, usuario_admin_creado, monkeypatch):
    """Error de Cloudinary al eliminar → 502."""
    def _eliminar_falla(public_id):
        raise Exception("Not found in Cloudinary")

    monkeypatch.setattr("app.services.uploads_service.eliminar_imagen", _eliminar_falla)
    r = client_admin.delete("/api/v1/uploads/imagen/foodstore/inexistente")
    assert r.status_code == 502


def test_cliente_no_puede_eliminar_imagen(client, usuario_creado, usuario_admin_creado, monkeypatch):
    """Sin rol ADMIN → 403 antes de llegar al service."""
    monkeypatch.setattr(
        "app.services.uploads_service.eliminar_imagen",
        lambda public_id: None,
    )
    r = client.post("/api/v1/auth/login", json={
        "email": DATOS_USUARIO["email"],
        "contrasena": DATOS_USUARIO["contrasena"],
    })
    assert r.status_code == 200
    r = client.delete("/api/v1/uploads/imagen/foodstore/algo")
    assert r.status_code == 403
