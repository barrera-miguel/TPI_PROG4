"""
Tests de integración para el módulo de unidades de medida:
  POST   /unidades-medida/
  GET    /unidades-medida/
  GET    /unidades-medida/{id}
  PATCH  /unidades-medida/{id}
  DELETE /unidades-medida/{id}
"""

import pytest

from tests.conftest import DATOS_USUARIO


# ── POST /unidades-medida/ ────────────────────────────────────────────────────

def test_crear_unidad_medida(client_admin, usuario_admin_creado):
    r = client_admin.post("/api/v1/unidades-medida/", json={
        "nombre": "tonelada",
        "simbolo": "t",
        "tipo": "masa",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["nombre"] == "tonelada"
    assert data["simbolo"] == "t"
    assert data["tipo"] == "masa"
    assert "id" in data


def test_crear_unidad_duplicada_da_409(client_admin, usuario_admin_creado):
    """Símbolo duplicado → 409."""
    client_admin.post("/api/v1/unidades-medida/", json={
        "nombre": "gallon",
        "simbolo": "gal",
        "tipo": "volumen",
    })
    r = client_admin.post("/api/v1/unidades-medida/", json={
        "nombre": "gallon us",
        "simbolo": "gal",
        "tipo": "volumen",
    })
    assert r.status_code == 409


def test_cliente_no_puede_crear_unidad(client, usuario_creado, usuario_admin_creado):
    r = client.post("/api/v1/auth/login", json={
        "email": DATOS_USUARIO["email"],
        "contrasena": DATOS_USUARIO["contrasena"],
    })
    assert r.status_code == 200
    r = client.post("/api/v1/unidades-medida/", json={
        "nombre": "pie",
        "simbolo": "ft",
        "tipo": "longitud",
    })
    assert r.status_code == 403


# ── GET /unidades-medida/ ─────────────────────────────────────────────────────

def test_listar_unidades_medida(client_admin, usuario_admin_creado):
    r = client_admin.get("/api/v1/unidades-medida/")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    # La BD de test tiene 8 unidades seeded
    assert data["total"] >= 8


def test_filtrar_unidades_por_tipo(client_admin, usuario_admin_creado):
    r = client_admin.get("/api/v1/unidades-medida/?tipo=masa")
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) >= 1
    assert all(it["tipo"] == "masa" for it in items)


# ── GET /unidades-medida/{id} ─────────────────────────────────────────────────

def test_obtener_unidad_medida(client_admin, usuario_admin_creado):
    r = client_admin.get("/api/v1/unidades-medida/")
    first_id = r.json()["items"][0]["id"]
    r = client_admin.get(f"/api/v1/unidades-medida/{first_id}")
    assert r.status_code == 200
    assert r.json()["id"] == first_id


def test_obtener_unidad_inexistente(client_admin, usuario_admin_creado):
    r = client_admin.get("/api/v1/unidades-medida/99999")
    assert r.status_code == 404


# ── PATCH /unidades-medida/{id} ───────────────────────────────────────────────

def test_actualizar_unidad_medida(client_admin, usuario_admin_creado):
    r = client_admin.post("/api/v1/unidades-medida/", json={
        "nombre": "onza",
        "simbolo": "oz",
        "tipo": "masa",
    })
    uid = r.json()["id"]
    r = client_admin.patch(f"/api/v1/unidades-medida/{uid}", json={"nombre": "onza troy"})
    assert r.status_code == 200
    assert r.json()["nombre"] == "onza troy"


def test_actualizar_unidad_inexistente(client_admin, usuario_admin_creado):
    r = client_admin.patch("/api/v1/unidades-medida/99999", json={"nombre": "nada"})
    assert r.status_code == 404


# ── DELETE /unidades-medida/{id} ──────────────────────────────────────────────

def test_eliminar_unidad_medida(client_admin, usuario_admin_creado):
    r = client_admin.post("/api/v1/unidades-medida/", json={
        "nombre": "vara",
        "simbolo": "vr",
        "tipo": "longitud",
    })
    uid = r.json()["id"]
    r = client_admin.delete(f"/api/v1/unidades-medida/{uid}")
    assert r.status_code == 204

    r = client_admin.get(f"/api/v1/unidades-medida/{uid}")
    assert r.status_code == 404


def test_eliminar_unidad_inexistente(client_admin, usuario_admin_creado):
    r = client_admin.delete("/api/v1/unidades-medida/99999")
    assert r.status_code == 404
