"""
Tests de integración para el módulo de categorías:
  GET    /categorias/arbol
  POST   /categorias/
  GET    /categorias/
  GET    /categorias/{id}
  PUT    /categorias/{id}
  PATCH  /categorias/{id}/imagen
  DELETE /categorias/{id}
"""

import pytest

from tests.conftest import DATOS_USUARIO


# ── Helpers ───────────────────────────────────────────────────────────────────

def _crear_categoria(client, nombre="Hamburguesas", parent_id=None):
    payload = {"nombre": nombre}
    if parent_id is not None:
        payload["parent_id"] = parent_id
    r = client.post("/api/v1/categorias/", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


# ── POST /categorias/ ─────────────────────────────────────────────────────────

def test_crear_categoria(client_admin, usuario_admin_creado):
    r = client_admin.post("/api/v1/categorias/", json={"nombre": "Hamburguesas"})
    assert r.status_code == 201
    data = r.json()
    assert data["nombre"] == "Hamburguesas"
    assert "id" in data


def test_crear_categoria_duplicada(client_admin, usuario_admin_creado):
    _crear_categoria(client_admin, "Pizzas")
    r = client_admin.post("/api/v1/categorias/", json={"nombre": "Pizzas"})
    assert r.status_code == 409


def test_cliente_no_puede_crear_categoria(client, usuario_creado, usuario_admin_creado):
    from tests.conftest import DATOS_USUARIO
    r = client.post("/api/v1/auth/login", json={
        "email": DATOS_USUARIO["email"],
        "contrasena": DATOS_USUARIO["contrasena"],
    })
    assert r.status_code == 200
    r = client.post("/api/v1/categorias/", json={"nombre": "NoPermitida"})
    assert r.status_code == 403


# ── GET /categorias/ ──────────────────────────────────────────────────────────

def test_listar_categorias(client_admin, usuario_admin_creado):
    _crear_categoria(client_admin, "Bebidas")
    r = client_admin.get("/api/v1/categorias/")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert data["total"] >= 1


def test_filtrar_categorias_por_nombre(client_admin, usuario_admin_creado):
    _crear_categoria(client_admin, "Ensaladas")
    _crear_categoria(client_admin, "Postres")
    r = client_admin.get("/api/v1/categorias/?nombre=Ensala")
    assert r.status_code == 200
    items = r.json()["items"]
    assert all("Ensala" in it["nombre"] for it in items)


def test_filtrar_categorias_por_parent_id(client_admin, usuario_admin_creado):
    padre = _crear_categoria(client_admin, "Carnes")
    _crear_categoria(client_admin, "Vacuna", parent_id=padre["id"])
    _crear_categoria(client_admin, "Cerdo", parent_id=padre["id"])
    _crear_categoria(client_admin, "Vegana")

    r = client_admin.get(f"/api/v1/categorias/?parent_id={padre['id']}")
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 2
    assert all(it["parent_id"] == padre["id"] for it in items)


# ── GET /categorias/{id} ──────────────────────────────────────────────────────

def test_obtener_categoria(client_admin, usuario_admin_creado):
    cat = _crear_categoria(client_admin, "Sopas")
    r = client_admin.get(f"/api/v1/categorias/{cat['id']}")
    assert r.status_code == 200
    assert r.json()["id"] == cat["id"]


def test_obtener_categoria_inexistente(client_admin, usuario_admin_creado):
    r = client_admin.get("/api/v1/categorias/99999")
    assert r.status_code == 404


# ── PUT /categorias/{id} ──────────────────────────────────────────────────────

def test_actualizar_categoria(client_admin, usuario_admin_creado):
    cat = _crear_categoria(client_admin, "Tacos")
    r = client_admin.put(f"/api/v1/categorias/{cat['id']}", json={"nombre": "Tacos y Burritos"})
    assert r.status_code == 200
    assert r.json()["nombre"] == "Tacos y Burritos"


def test_detectar_ciclo_en_actualizar(client_admin, usuario_admin_creado):
    """PUT /{id} con parent_id que crea un ciclo → 400."""
    padre = _crear_categoria(client_admin, "Padre")
    hijo = _crear_categoria(client_admin, "Hijo", parent_id=padre["id"])
    # Intentar hacer que el padre sea hijo del hijo crea un ciclo
    r = client_admin.put(f"/api/v1/categorias/{padre['id']}", json={"parent_id": hijo["id"]})
    assert r.status_code == 400


# ── GET /categorias/arbol ─────────────────────────────────────────────────────

def test_arbol_categorias(client_admin, usuario_admin_creado):
    padre = _crear_categoria(client_admin, "Raíz")
    _crear_categoria(client_admin, "Hoja1", parent_id=padre["id"])
    _crear_categoria(client_admin, "Hoja2", parent_id=padre["id"])

    r = client_admin.get("/api/v1/categorias/arbol")
    assert r.status_code == 200
    arbol = r.json()
    assert isinstance(arbol, list)
    raiz = next((n for n in arbol if n["nombre"] == "Raíz"), None)
    assert raiz is not None
    assert len(raiz["hijos"]) == 2


# ── PATCH /categorias/{id}/imagen ─────────────────────────────────────────────

def test_actualizar_imagen(client_admin, usuario_admin_creado):
    cat = _crear_categoria(client_admin, "ConImagen")
    url = "https://res.cloudinary.com/demo/image/upload/cat.jpg"
    r = client_admin.patch(f"/api/v1/categorias/{cat['id']}/imagen", json={"imagen_url": url})
    assert r.status_code == 200
    assert r.json()["imagen_url"] == url


# ── DELETE /categorias/{id} ───────────────────────────────────────────────────

def test_eliminar_categoria(client_admin, usuario_admin_creado):
    cat = _crear_categoria(client_admin, "ParaBorrar")
    r = client_admin.delete(f"/api/v1/categorias/{cat['id']}")
    assert r.status_code == 204

    r = client_admin.get(f"/api/v1/categorias/{cat['id']}")
    assert r.status_code == 404


def test_eliminar_categoria_con_hijos_da_409(client_admin, usuario_admin_creado):
    padre = _crear_categoria(client_admin, "PadreConHijos")
    _crear_categoria(client_admin, "HijoUnico", parent_id=padre["id"])
    r = client_admin.delete(f"/api/v1/categorias/{padre['id']}")
    assert r.status_code == 409


def test_eliminar_categoria_inexistente(client_admin, usuario_admin_creado):
    r = client_admin.delete("/api/v1/categorias/99999")
    assert r.status_code == 404
