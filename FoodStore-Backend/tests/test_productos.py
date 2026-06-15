"""
Tests de integración para el módulo de productos:
  POST   /productos/
  GET    /productos/
  GET    /productos/{id}
  PUT    /productos/{id}
  PATCH  /productos/{id}/stock
  PATCH  /productos/{id}/imagenes
  PATCH  /productos/{id}/disponibilidad
  DELETE /productos/{id}
  GET    /productos/{id}/ingredientes
  POST   /productos/{id}/categorias
  DELETE /productos/{id}/categorias/{cat_id}
  POST   /productos/{id}/ingredientes
  DELETE /productos/{id}/ingredientes/{ing_id}
"""

import pytest

from tests.conftest import DATOS_USUARIO, DATOS_ADMIN


# ── Helpers ───────────────────────────────────────────────────────────────────

def _um_id(client) -> int:
    return client.get("/api/v1/unidades-medida/").json()["items"][0]["id"]


def _crear_ingrediente(client, nombre="Ing", stock="20.000", precio="10.00"):
    r = client.post("/api/v1/ingredientes/", json={
        "nombre": nombre,
        "stock_total": stock,
        "precio_costo": precio,
    })
    assert r.status_code == 201, r.text
    return r.json()


def _crear_categoria(client, nombre="CatTest"):
    r = client.post("/api/v1/categorias/", json={"nombre": nombre})
    assert r.status_code == 201, r.text
    return r.json()


def _crear_producto_con_ingredientes(client, nombre="Hamburguesa"):
    um = _um_id(client)
    ing = _crear_ingrediente(client, f"Ing{nombre}")
    r = client.post("/api/v1/productos/", json={
        "nombre": nombre,
        "margen_ganancia": "0",
        "disponible": True,
        "categorias": [],
        "ingredientes": [
            {"ingrediente_id": ing["id"], "cantidad": "1.000",
             "unidad_medida_id": um, "es_removible": False},
        ],
    })
    assert r.status_code == 201, r.text
    return r.json(), ing


def _crear_producto_directo(client, nombre="ProductoDirecto"):
    r = client.post("/api/v1/productos/", json={
        "nombre": nombre,
        "margen_ganancia": "0",
        "disponible": True,
        "categorias": [],
        "ingredientes": [],
        "stock_directo": 10,
        "precio_base": "100.00",
    })
    assert r.status_code == 201, r.text
    return r.json()


# ── POST /productos/ ──────────────────────────────────────────────────────────

def test_crear_producto_con_ingredientes(client_admin, usuario_admin_creado):
    prod, _ = _crear_producto_con_ingredientes(client_admin)
    assert prod["nombre"] == "Hamburguesa"
    assert prod["tiene_ingredientes"] is True


def test_crear_producto_directo(client_admin, usuario_admin_creado):
    prod = _crear_producto_directo(client_admin)
    assert prod["tiene_ingredientes"] is False
    assert prod["stock_directo"] == 10


def test_cliente_no_puede_crear_producto(client, usuario_creado, usuario_admin_creado):
    r = client.post("/api/v1/auth/login", json={
        "email": DATOS_USUARIO["email"],
        "contrasena": DATOS_USUARIO["contrasena"],
    })
    assert r.status_code == 200
    r = client.post("/api/v1/productos/", json={
        "nombre": "NoPermitido",
        "margen_ganancia": "0",
        "disponible": True,
        "categorias": [],
        "ingredientes": [],
        "precio_base": "50.00",
    })
    assert r.status_code == 403


# ── GET /productos/ ───────────────────────────────────────────────────────────

def test_listar_productos(client_admin, usuario_admin_creado):
    _crear_producto_con_ingredientes(client_admin, "Pizza")
    r = client_admin.get("/api/v1/productos/")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert data["total"] >= 1


def test_filtrar_productos_por_nombre(client_admin, usuario_admin_creado):
    _crear_producto_con_ingredientes(client_admin, "Milanesa")
    _crear_producto_directo(client_admin, "Torta")
    r = client_admin.get("/api/v1/productos/?nombre=Milanesa")
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["nombre"] == "Milanesa"


def test_filtrar_productos_por_disponible(client_admin, usuario_admin_creado):
    prod, _ = _crear_producto_con_ingredientes(client_admin, "ProdDisp")
    client_admin.patch(f"/api/v1/productos/{prod['id']}/disponibilidad", json={"disponible": False})

    r = client_admin.get("/api/v1/productos/?disponible=true")
    assert r.status_code == 200
    ids = [it["id"] for it in r.json()["items"]]
    assert prod["id"] not in ids


def test_filtrar_productos_por_categoria(client_admin, usuario_admin_creado):
    cat = _crear_categoria(client_admin, "CatFiltro")
    prod, _ = _crear_producto_con_ingredientes(client_admin, "ProdCat")
    client_admin.post(f"/api/v1/productos/{prod['id']}/categorias",
                      json={"categoria_id": cat["id"], "es_principal": True})
    _crear_producto_con_ingredientes(client_admin, "ProdSinCat")

    r = client_admin.get(f"/api/v1/productos/?categoria_id={cat['id']}")
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == prod["id"]


# ── GET /productos/{id} ───────────────────────────────────────────────────────

def test_obtener_producto(client_admin, usuario_admin_creado):
    prod, _ = _crear_producto_con_ingredientes(client_admin, "Wrap")
    r = client_admin.get(f"/api/v1/productos/{prod['id']}")
    assert r.status_code == 200
    assert r.json()["id"] == prod["id"]


def test_obtener_producto_inexistente(client_admin, usuario_admin_creado):
    r = client_admin.get("/api/v1/productos/99999")
    assert r.status_code == 404


# ── PUT /productos/{id} ───────────────────────────────────────────────────────

def test_actualizar_producto(client_admin, usuario_admin_creado):
    prod, _ = _crear_producto_con_ingredientes(client_admin, "BurgerOrig")
    r = client_admin.put(f"/api/v1/productos/{prod['id']}", json={"nombre": "BurgerNueva"})
    assert r.status_code == 200
    assert r.json()["nombre"] == "BurgerNueva"


# ── PATCH /productos/{id}/disponibilidad ──────────────────────────────────────

def test_actualizar_disponibilidad(client_admin, usuario_admin_creado):
    prod, _ = _crear_producto_con_ingredientes(client_admin, "ProdDispChange")
    assert prod["disponible"] is True
    r = client_admin.patch(f"/api/v1/productos/{prod['id']}/disponibilidad", json={"disponible": False})
    assert r.status_code == 200
    assert r.json()["disponible"] is False


def test_actualizar_disponibilidad_con_rol_stock(client, usuario_creado, usuario_admin_creado):
    """Usuario con rol STOCK puede cambiar disponibilidad."""
    r = client.post("/api/v1/auth/login", json={
        "email": DATOS_ADMIN["email"],
        "contrasena": DATOS_ADMIN["contrasena"],
    })
    assert r.status_code == 200
    prod, _ = _crear_producto_con_ingredientes(client, "ProdStock")

    uid = usuario_creado["id"]
    client.post(f"/api/v1/auth/admin/usuarios/{uid}/roles/STOCK")

    r = client.post("/api/v1/auth/login", json={
        "email": DATOS_USUARIO["email"],
        "contrasena": DATOS_USUARIO["contrasena"],
    })
    assert r.status_code == 200
    r = client.patch(f"/api/v1/productos/{prod['id']}/disponibilidad", json={"disponible": False})
    assert r.status_code == 200


# ── PATCH /productos/{id}/stock ───────────────────────────────────────────────

def test_actualizar_stock_directo(client_admin, usuario_admin_creado):
    prod = _crear_producto_directo(client_admin, "ProdStockDir")
    r = client_admin.patch(f"/api/v1/productos/{prod['id']}/stock",
                           json={"stock_directo": 25, "precio_base": "150.00"})
    assert r.status_code == 200
    assert r.json()["stock_directo"] == 25


def test_stock_directo_en_producto_con_ingredientes_da_422(client_admin, usuario_admin_creado):
    prod, _ = _crear_producto_con_ingredientes(client_admin, "ProdIngStock")
    r = client_admin.patch(f"/api/v1/productos/{prod['id']}/stock", json={"stock_directo": 5})
    assert r.status_code == 422


# ── PATCH /productos/{id}/imagenes ────────────────────────────────────────────

def test_actualizar_imagenes(client_admin, usuario_admin_creado):
    prod, _ = _crear_producto_con_ingredientes(client_admin, "ProdImg")
    urls = ["https://res.cloudinary.com/demo/image/upload/prod1.jpg"]
    r = client_admin.patch(f"/api/v1/productos/{prod['id']}/imagenes", json={"imagenes_url": urls})
    assert r.status_code == 200
    assert r.json()["imagenes_url"] == urls


# ── DELETE /productos/{id} ────────────────────────────────────────────────────

def test_eliminar_producto(client_admin, usuario_admin_creado):
    prod, _ = _crear_producto_con_ingredientes(client_admin, "ProdBorrar")
    r = client_admin.delete(f"/api/v1/productos/{prod['id']}")
    assert r.status_code == 204

    r = client_admin.get(f"/api/v1/productos/{prod['id']}")
    assert r.status_code == 404


def test_eliminar_producto_inexistente(client_admin, usuario_admin_creado):
    r = client_admin.delete("/api/v1/productos/99999")
    assert r.status_code == 404


# ── GET /productos/{id}/ingredientes ─────────────────────────────────────────

def test_listar_ingredientes_producto(client_admin, usuario_admin_creado):
    prod, ing = _crear_producto_con_ingredientes(client_admin, "ProdListIng")
    r = client_admin.get(f"/api/v1/productos/{prod['id']}/ingredientes")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) == 1
    assert r.json()[0]["id"] == ing["id"]


def test_listar_ingredientes_producto_inexistente(client_admin, usuario_admin_creado):
    r = client_admin.get("/api/v1/productos/99999/ingredientes")
    assert r.status_code == 404


# ── POST /productos/{id}/categorias ──────────────────────────────────────────

def test_agregar_categoria_a_producto(client_admin, usuario_admin_creado):
    prod, _ = _crear_producto_con_ingredientes(client_admin, "ProdAddCat")
    cat = _crear_categoria(client_admin, "CatAdd")
    r = client_admin.post(f"/api/v1/productos/{prod['id']}/categorias",
                          json={"categoria_id": cat["id"], "es_principal": True})
    assert r.status_code == 201
    cats = [c["id"] for c in r.json()["categorias"]]
    assert cat["id"] in cats


def test_agregar_categoria_duplicada_a_producto_da_409(client_admin, usuario_admin_creado):
    prod, _ = _crear_producto_con_ingredientes(client_admin, "ProdDupCat")
    cat = _crear_categoria(client_admin, "CatDup")
    client_admin.post(f"/api/v1/productos/{prod['id']}/categorias",
                      json={"categoria_id": cat["id"], "es_principal": False})
    r = client_admin.post(f"/api/v1/productos/{prod['id']}/categorias",
                          json={"categoria_id": cat["id"], "es_principal": False})
    assert r.status_code == 409


# ── DELETE /productos/{id}/categorias/{cat_id} ───────────────────────────────

def test_quitar_categoria_de_producto(client_admin, usuario_admin_creado):
    prod, _ = _crear_producto_con_ingredientes(client_admin, "ProdRmCat")
    cat = _crear_categoria(client_admin, "CatRm")
    client_admin.post(f"/api/v1/productos/{prod['id']}/categorias",
                      json={"categoria_id": cat["id"], "es_principal": False})
    r = client_admin.delete(f"/api/v1/productos/{prod['id']}/categorias/{cat['id']}")
    assert r.status_code == 204


# ── POST /productos/{id}/ingredientes ────────────────────────────────────────

def test_agregar_ingrediente_a_producto(client_admin, usuario_admin_creado):
    prod, _ = _crear_producto_con_ingredientes(client_admin, "ProdAddIng")
    ing2 = _crear_ingrediente(client_admin, "IngExtra")
    um = _um_id(client_admin)
    r = client_admin.post(f"/api/v1/productos/{prod['id']}/ingredientes", json={
        "ingrediente_id": ing2["id"],
        "cantidad": "2.000",
        "unidad_medida_id": um,
        "es_removible": True,
    })
    assert r.status_code == 201
    ing_ids = [i["id"] for i in r.json()["ingredientes"]]
    assert ing2["id"] in ing_ids


def test_agregar_ingrediente_duplicado_da_409(client_admin, usuario_admin_creado):
    prod, ing = _crear_producto_con_ingredientes(client_admin, "ProdDupIng")
    um = _um_id(client_admin)
    r = client_admin.post(f"/api/v1/productos/{prod['id']}/ingredientes", json={
        "ingrediente_id": ing["id"],
        "cantidad": "1.000",
        "unidad_medida_id": um,
        "es_removible": False,
    })
    assert r.status_code == 409


# ── DELETE /productos/{id}/ingredientes/{ing_id} ─────────────────────────────

def test_quitar_ingrediente_de_producto(client_admin, usuario_admin_creado):
    prod, ing = _crear_producto_con_ingredientes(client_admin, "ProdRmIng")
    r = client_admin.delete(f"/api/v1/productos/{prod['id']}/ingredientes/{ing['id']}")
    assert r.status_code == 204
