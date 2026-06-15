"""
Tests de integración para el módulo de ingredientes:
  POST   /ingredientes/
  GET    /ingredientes/
  GET    /ingredientes/{id}
  PATCH  /ingredientes/{id}
  PATCH  /ingredientes/{id}/stock
  DELETE /ingredientes/{id}
"""

import pytest

from tests.conftest import DATOS_USUARIO, DATOS_ADMIN, DATOS_OTRO_USUARIO


# ── Helpers ───────────────────────────────────────────────────────────────────

def _crear_ingrediente(client, nombre="Harina", stock="10.000", precio="50.00"):
    r = client.post("/api/v1/ingredientes/", json={
        "nombre": nombre,
        "stock_total": stock,
        "precio_costo": precio,
    })
    assert r.status_code == 201, r.text
    return r.json()


def _crear_producto_con_ingrediente(client, ing_id: int):
    um_id = client.get("/api/v1/unidades-medida/").json()["items"][0]["id"]
    r = client.post("/api/v1/productos/", json={
        "nombre": "ProdConIng",
        "margen_ganancia": "0",
        "disponible": True,
        "categorias": [],
        "ingredientes": [
            {"ingrediente_id": ing_id, "cantidad": "1.000",
             "unidad_medida_id": um_id, "es_removible": False},
        ],
    })
    assert r.status_code == 201, r.text
    return r.json()


# ── POST /ingredientes/ ───────────────────────────────────────────────────────

def test_crear_ingrediente(client_admin, usuario_admin_creado):
    r = client_admin.post("/api/v1/ingredientes/", json={
        "nombre": "Queso Cheddar",
        "stock_total": "5.000",
        "precio_costo": "200.00",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["nombre"] == "Queso Cheddar"
    assert "id" in data


def test_crear_ingrediente_duplicado(client_admin, usuario_admin_creado):
    _crear_ingrediente(client_admin, "LechugaDup")
    r = client_admin.post("/api/v1/ingredientes/", json={
        "nombre": "LechugaDup",
        "stock_total": "1.000",
        "precio_costo": "10.00",
    })
    assert r.status_code == 409


def test_cliente_no_puede_crear_ingrediente(client, usuario_creado, usuario_admin_creado):
    r = client.post("/api/v1/auth/login", json={
        "email": DATOS_USUARIO["email"],
        "contrasena": DATOS_USUARIO["contrasena"],
    })
    assert r.status_code == 200
    r = client.post("/api/v1/ingredientes/", json={
        "nombre": "IngNoPermitido",
        "stock_total": "1.000",
        "precio_costo": "1.00",
    })
    assert r.status_code == 403


# ── GET /ingredientes/ ────────────────────────────────────────────────────────

def test_listar_ingredientes(client_admin, usuario_admin_creado):
    _crear_ingrediente(client_admin, "Tomate")
    r = client_admin.get("/api/v1/ingredientes/")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert data["total"] >= 1


def test_filtrar_ingredientes_por_nombre(client_admin, usuario_admin_creado):
    _crear_ingrediente(client_admin, "Cebolla Morada")
    _crear_ingrediente(client_admin, "Cebolla Blanca")
    _crear_ingrediente(client_admin, "Zanahoria")
    r = client_admin.get("/api/v1/ingredientes/?nombre=Cebolla")
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 2
    assert all("Cebolla" in it["nombre"] for it in items)


# ── GET /ingredientes/{id} ────────────────────────────────────────────────────

def test_obtener_ingrediente(client_admin, usuario_admin_creado):
    ing = _crear_ingrediente(client_admin, "Palta")
    r = client_admin.get(f"/api/v1/ingredientes/{ing['id']}")
    assert r.status_code == 200
    assert r.json()["id"] == ing["id"]
    assert r.json()["nombre"] == "Palta"


def test_obtener_ingrediente_inexistente(client_admin, usuario_admin_creado):
    r = client_admin.get("/api/v1/ingredientes/99999")
    assert r.status_code == 404


# ── PATCH /ingredientes/{id} ──────────────────────────────────────────────────

def test_actualizar_ingrediente(client_admin, usuario_admin_creado):
    ing = _crear_ingrediente(client_admin, "Aceite")
    r = client_admin.patch(f"/api/v1/ingredientes/{ing['id']}", json={"nombre": "Aceite de Oliva"})
    assert r.status_code == 200
    assert r.json()["nombre"] == "Aceite de Oliva"


def test_actualizar_ingrediente_inexistente(client_admin, usuario_admin_creado):
    r = client_admin.patch("/api/v1/ingredientes/99999", json={"nombre": "Nada"})
    assert r.status_code == 404


# ── PATCH /ingredientes/{id}/stock ────────────────────────────────────────────

def test_actualizar_stock_como_admin(client_admin, usuario_admin_creado):
    ing = _crear_ingrediente(client_admin, "Sal")
    r = client_admin.patch(f"/api/v1/ingredientes/{ing['id']}/stock", json={"stock_total": "99.000"})
    assert r.status_code == 200
    assert r.json()["stock_total"] == "99.000"


def test_actualizar_stock_como_rol_stock(client, usuario_creado, usuario_admin_creado):
    """Usuario con rol STOCK puede actualizar stock de ingredientes."""
    # Admin crea el ingrediente
    r = client.post("/api/v1/auth/login", json={
        "email": DATOS_ADMIN["email"],
        "contrasena": DATOS_ADMIN["contrasena"],
    })
    assert r.status_code == 200
    ing = _crear_ingrediente(client, "AzucarStock")

    # Admin asigna rol STOCK al usuario normal
    uid = usuario_creado["id"]
    r = client.post(f"/api/v1/auth/admin/usuarios/{uid}/roles/STOCK")
    assert r.status_code == 200

    # Usuario con STOCK hace login y actualiza stock
    r = client.post("/api/v1/auth/login", json={
        "email": DATOS_USUARIO["email"],
        "contrasena": DATOS_USUARIO["contrasena"],
    })
    assert r.status_code == 200
    r = client.patch(f"/api/v1/ingredientes/{ing['id']}/stock", json={"stock_total": "50.000"})
    assert r.status_code == 200
    assert r.json()["stock_total"] == "50.000"


def test_cliente_no_puede_actualizar_stock(client, usuario_creado, usuario_admin_creado):
    # Admin crea el ingrediente
    r = client.post("/api/v1/auth/login", json={
        "email": DATOS_ADMIN["email"],
        "contrasena": DATOS_ADMIN["contrasena"],
    })
    assert r.status_code == 200
    ing = _crear_ingrediente(client, "PimientaNoStock")

    # Usuario sin rol STOCK intenta actualizar stock
    r = client.post("/api/v1/auth/login", json={
        "email": DATOS_USUARIO["email"],
        "contrasena": DATOS_USUARIO["contrasena"],
    })
    assert r.status_code == 200
    r = client.patch(f"/api/v1/ingredientes/{ing['id']}/stock", json={"stock_total": "5.000"})
    assert r.status_code == 403


# ── DELETE /ingredientes/{id} ─────────────────────────────────────────────────

def test_eliminar_ingrediente(client_admin, usuario_admin_creado):
    ing = _crear_ingrediente(client_admin, "IngParaBorrar")
    r = client_admin.delete(f"/api/v1/ingredientes/{ing['id']}")
    assert r.status_code == 204

    r = client_admin.get(f"/api/v1/ingredientes/{ing['id']}")
    assert r.status_code == 404


def test_eliminar_ingrediente_en_uso_da_409(client_admin, usuario_admin_creado):
    ing = _crear_ingrediente(client_admin, "IngEnUso")
    _crear_producto_con_ingrediente(client_admin, ing["id"])
    r = client_admin.delete(f"/api/v1/ingredientes/{ing['id']}")
    assert r.status_code == 409


def test_eliminar_ingrediente_inexistente(client_admin, usuario_admin_creado):
    r = client_admin.delete("/api/v1/ingredientes/99999")
    assert r.status_code == 404
