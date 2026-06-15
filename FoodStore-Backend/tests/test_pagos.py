"""
Tests de integración para el módulo de pagos:
  GET   /pagos/{pedido_id}
  POST  /pagos/create-preference
  POST  /pagos/webhook
"""

import uuid
from decimal import Decimal

import pytest
from sqlmodel import Session

from tests.conftest import DATOS_ADMIN, DATOS_USUARIO, test_engine


# ── Helpers ───────────────────────────────────────────────────────────────────

def _login(client, email: str, contrasena: str) -> None:
    r = client.post("/api/v1/auth/login", json={"email": email, "contrasena": contrasena})
    assert r.status_code == 200, r.text


def _crear_ingrediente(client, nombre="HarinaPago", stock="10.000", precio="50.00"):
    r = client.post("/api/v1/ingredientes/", json={
        "nombre": nombre,
        "stock_total": stock,
        "precio_costo": precio,
    })
    assert r.status_code == 201, r.text
    return r.json()


def _crear_producto(client, nombre="ProductoPago"):
    um_id = client.get("/api/v1/unidades-medida/").json()["items"][0]["id"]
    ing = _crear_ingrediente(client, nombre=f"Ing{nombre}")
    r = client.post("/api/v1/productos/", json={
        "nombre": nombre,
        "margen_ganancia": "0",
        "disponible": True,
        "categorias": [],
        "ingredientes": [{"ingrediente_id": ing["id"], "cantidad": "1.000",
                          "unidad_medida_id": um_id, "es_removible": False}],
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _crear_pedido(client, prod_id: int, forma_pago: str = "EFECTIVO") -> int:
    r = client.post("/api/v1/pedidos/", json={
        "forma_pago_codigo": forma_pago,
        "items": [{"producto_id": prod_id, "cantidad": 1}],
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _insertar_pago_en_bd(pedido_id: int, estado: str = "pendiente",
                          mp_payment_id: int = None) -> dict:
    from app.models.pago import Pago
    with Session(test_engine) as s:
        pago = Pago(
            pedido_id=pedido_id,
            estado=estado,
            external_reference=str(uuid.uuid4()),
            idempotency_key=str(uuid.uuid4()),
            transaction_amount=Decimal("100.00"),
            mp_payment_id=mp_payment_id,
        )
        s.add(pago)
        s.commit()
        s.refresh(pago)
        return {"id": pago.id, "pedido_id": pago.pedido_id, "estado": pago.estado}


# ── GET /pagos/{pedido_id} ─────────────────────────────────────────────────────

def test_obtener_pago_de_pedido_sin_pago_da_404(client_admin, usuario_admin_creado):
    """Si el pedido no tiene pago asociado, GET /pagos/{id} devuelve 404."""
    _login(client_admin, DATOS_ADMIN["email"], DATOS_ADMIN["contrasena"])
    prod_id = _crear_producto(client_admin)
    pedido_id = _crear_pedido(client_admin, prod_id)

    r = client_admin.get(f"/api/v1/pagos/{pedido_id}")
    assert r.status_code == 404


def test_obtener_pago_de_pedido_propio(client, usuario_creado, usuario_admin_creado):
    """CLIENT puede ver el pago de su propio pedido."""
    _login(client, DATOS_ADMIN["email"], DATOS_ADMIN["contrasena"])
    prod_id = _crear_producto(client)
    _login(client, DATOS_USUARIO["email"], DATOS_USUARIO["contrasena"])
    pedido_id = _crear_pedido(client, prod_id)
    _insertar_pago_en_bd(pedido_id)

    r = client.get(f"/api/v1/pagos/{pedido_id}")
    assert r.status_code == 200
    data = r.json()
    assert data["pedido_id"] == pedido_id
    assert "estado" in data
    assert "transaction_amount" in data


def test_obtener_pago_de_pedido_ajeno_da_403(client, usuario_creado, usuario_admin_creado):
    """CLIENT no puede ver el pago de un pedido de otro usuario → 403."""
    # Admin crea pedido (le pertenece al admin)
    _login(client, DATOS_ADMIN["email"], DATOS_ADMIN["contrasena"])
    prod_id = _crear_producto(client)
    admin_pedido_id = _crear_pedido(client, prod_id)
    _insertar_pago_en_bd(admin_pedido_id)

    # CLIENT intenta ver el pago del admin
    _login(client, DATOS_USUARIO["email"], DATOS_USUARIO["contrasena"])
    r = client.get(f"/api/v1/pagos/{admin_pedido_id}")
    assert r.status_code == 403


def test_admin_puede_ver_cualquier_pago(client, usuario_creado, usuario_admin_creado):
    """ADMIN puede ver el pago de cualquier pedido."""
    _login(client, DATOS_ADMIN["email"], DATOS_ADMIN["contrasena"])
    prod_id = _crear_producto(client)
    _login(client, DATOS_USUARIO["email"], DATOS_USUARIO["contrasena"])
    pedido_id = _crear_pedido(client, prod_id)
    _insertar_pago_en_bd(pedido_id)

    _login(client, DATOS_ADMIN["email"], DATOS_ADMIN["contrasena"])
    r = client.get(f"/api/v1/pagos/{pedido_id}")
    assert r.status_code == 200
    assert r.json()["pedido_id"] == pedido_id


# ── POST /pagos/create-preference ─────────────────────────────────────────────

def test_crear_preferencia_sin_mp_token_da_400(client, usuario_creado, usuario_admin_creado, monkeypatch):
    """Sin MP_ACCESS_TOKEN configurado, create-preference devuelve 400."""
    from app.core.config import configuracion
    monkeypatch.setattr(configuracion, "MP_ACCESS_TOKEN", None)

    _login(client, DATOS_ADMIN["email"], DATOS_ADMIN["contrasena"])
    prod_id = _crear_producto(client)
    pedido_id = _crear_pedido(client, prod_id, forma_pago="MERCADOPAGO")

    r = client.post("/api/v1/pagos/create-preference", json={"pedido_id": pedido_id})
    assert r.status_code == 400


def test_crear_preferencia_exitoso(client, usuario_creado, usuario_admin_creado, monkeypatch):
    """POST /pagos/create-preference con MP mockeado devuelve 200 con preference_id."""
    from app.core.config import configuracion
    monkeypatch.setattr(configuracion, "MP_ACCESS_TOKEN", "test-token-fake")
    monkeypatch.setattr(
        "app.services.pago_service._crear_preferencia_mp",
        lambda monto, titulo, pedido_id, back_urls: {
            "preference_id": "TEST-PREF-123",
            "init_point": "https://mercadopago.test/init",
        },
    )

    _login(client, DATOS_ADMIN["email"], DATOS_ADMIN["contrasena"])
    prod_id = _crear_producto(client)
    pedido_id = _crear_pedido(client, prod_id, forma_pago="MERCADOPAGO")

    r = client.post("/api/v1/pagos/create-preference", json={"pedido_id": pedido_id})
    assert r.status_code == 200
    data = r.json()
    assert data["preference_id"] == "TEST-PREF-123"
    assert data["init_point"] == "https://mercadopago.test/init"
    assert "pago_id" in data


def test_crear_preferencia_pedido_no_mercadopago_da_422(client, usuario_admin_creado, monkeypatch):
    """Si forma_pago_codigo != MERCADOPAGO, create-preference devuelve 422."""
    from app.core.config import configuracion
    monkeypatch.setattr(configuracion, "MP_ACCESS_TOKEN", "test-token-fake")

    _login(client, DATOS_ADMIN["email"], DATOS_ADMIN["contrasena"])
    prod_id = _crear_producto(client)
    pedido_id = _crear_pedido(client, prod_id, forma_pago="EFECTIVO")

    r = client.post("/api/v1/pagos/create-preference", json={"pedido_id": pedido_id})
    assert r.status_code == 422


# ── POST /pagos/webhook ────────────────────────────────────────────────────────

def test_webhook_aprobado_confirma_pedido(client, usuario_admin_creado, monkeypatch):
    """Webhook con mp_status=approved actualiza pago a aprobado y pedido a CONFIRMADO."""
    mp_payment_id = 99001

    from app.core.config import configuracion
    monkeypatch.setattr(configuracion, "MP_WEBHOOK_SECRET", None)

    monkeypatch.setattr(
        "app.services.pago_service._consultar_pago_mp",
        lambda pid: {
            "mp_payment_id": mp_payment_id,
            "mp_status": "approved",
            "mp_status_detail": "accredited",
            "mp_merchant_order_id": None,
            "external_reference": None,
        },
    )

    _login(client, DATOS_ADMIN["email"], DATOS_ADMIN["contrasena"])
    prod_id = _crear_producto(client)
    pedido_id = _crear_pedido(client, prod_id, forma_pago="MERCADOPAGO")
    _insertar_pago_en_bd(pedido_id, mp_payment_id=mp_payment_id)

    r = client.post(
        "/api/v1/pagos/webhook",
        json={"type": "payment", "data": {"id": str(mp_payment_id)}},
    )
    assert r.status_code == 200
    assert r.json().get("status") == "ok"

    pedido = client.get(f"/api/v1/admin/pedidos/{pedido_id}")
    assert pedido.json()["estado_codigo"] == "CONFIRMADO"


def test_webhook_rechazado_no_cambia_estado(client, usuario_admin_creado, monkeypatch):
    """Webhook con mp_status=rejected no cambia estado del pedido."""
    mp_payment_id = 99002

    from app.core.config import configuracion
    monkeypatch.setattr(configuracion, "MP_WEBHOOK_SECRET", None)

    monkeypatch.setattr(
        "app.services.pago_service._consultar_pago_mp",
        lambda pid: {
            "mp_payment_id": mp_payment_id,
            "mp_status": "rejected",
            "mp_status_detail": "cc_rejected_insufficient_amount",
            "mp_merchant_order_id": None,
            "external_reference": None,
        },
    )

    _login(client, DATOS_ADMIN["email"], DATOS_ADMIN["contrasena"])
    prod_id = _crear_producto(client)
    pedido_id = _crear_pedido(client, prod_id, forma_pago="MERCADOPAGO")
    _insertar_pago_en_bd(pedido_id, mp_payment_id=mp_payment_id)

    r = client.post(
        "/api/v1/pagos/webhook",
        json={"type": "payment", "data": {"id": str(mp_payment_id)}},
    )
    assert r.status_code == 200

    pedido = client.get(f"/api/v1/admin/pedidos/{pedido_id}")
    assert pedido.json()["estado_codigo"] == "PENDIENTE"


def test_webhook_sin_pago_en_bd_es_ignorado(client, usuario_admin_creado, monkeypatch):
    """Webhook para payment_id inexistente en BD → status 'ignored'."""
    from app.core.config import configuracion
    monkeypatch.setattr(configuracion, "MP_WEBHOOK_SECRET", None)

    monkeypatch.setattr(
        "app.services.pago_service._consultar_pago_mp",
        lambda pid: {
            "mp_payment_id": 77777,
            "mp_status": "approved",
            "mp_status_detail": "accredited",
            "mp_merchant_order_id": None,
            "external_reference": None,
        },
    )

    r = client.post(
        "/api/v1/pagos/webhook",
        json={"type": "payment", "data": {"id": "77777"}},
    )
    assert r.status_code == 200
    assert r.json().get("status") == "ignored"


def test_webhook_aprobado_via_external_reference(client, usuario_admin_creado, monkeypatch):
    """Webhook puede encontrar el pago usando external_reference cuando mp_payment_id no matchea."""
    mp_payment_id = 99003

    from app.core.config import configuracion
    monkeypatch.setattr(configuracion, "MP_WEBHOOK_SECRET", None)

    _login(client, DATOS_ADMIN["email"], DATOS_ADMIN["contrasena"])
    prod_id = _crear_producto(client)
    pedido_id = _crear_pedido(client, prod_id, forma_pago="MERCADOPAGO")
    _insertar_pago_en_bd(pedido_id)  # sin mp_payment_id

    monkeypatch.setattr(
        "app.services.pago_service._consultar_pago_mp",
        lambda pid: {
            "mp_payment_id": mp_payment_id,
            "mp_status": "approved",
            "mp_status_detail": "accredited",
            "mp_merchant_order_id": None,
            "external_reference": str(pedido_id),
        },
    )

    r = client.post(
        "/api/v1/pagos/webhook",
        json={"type": "payment", "data": {"id": str(mp_payment_id)}},
    )
    assert r.status_code == 200
    assert r.json().get("status") == "ok"

    pedido = client.get(f"/api/v1/admin/pedidos/{pedido_id}")
    assert pedido.json()["estado_codigo"] == "CONFIRMADO"


# ── PedidoDetail incluye pago ──────────────────────────────────────────────────

def test_pedido_detail_incluye_campo_pago(client_admin, usuario_admin_creado):
    """GET /admin/pedidos/{id} incluye campo 'pago' (null si no hay pago asociado)."""
    _login(client_admin, DATOS_ADMIN["email"], DATOS_ADMIN["contrasena"])
    prod_id = _crear_producto(client_admin)
    pedido_id = _crear_pedido(client_admin, prod_id)

    r = client_admin.get(f"/api/v1/admin/pedidos/{pedido_id}")
    assert r.status_code == 200
    data = r.json()
    assert "pago" in data
    assert data["pago"] is None


def test_pedido_detail_incluye_pago_cuando_existe(client_admin, usuario_admin_creado):
    """GET /admin/pedidos/{id} incluye datos del pago cuando hay uno asociado."""
    _login(client_admin, DATOS_ADMIN["email"], DATOS_ADMIN["contrasena"])
    prod_id = _crear_producto(client_admin)
    pedido_id = _crear_pedido(client_admin, prod_id)
    _insertar_pago_en_bd(pedido_id)

    r = client_admin.get(f"/api/v1/admin/pedidos/{pedido_id}")
    assert r.status_code == 200
    pago = r.json()["pago"]
    assert pago is not None
    assert pago["pedido_id"] == pedido_id
    assert pago["estado"] == "pendiente"
    assert "transaction_amount" in pago
