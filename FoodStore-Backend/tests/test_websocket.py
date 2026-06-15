"""
TDD tests for WebSocket functionality.

Unit tests: ConnectionManager (no DB needed).
Integration tests: WS endpoint (real test DB via monkeypatch, same pattern as
the rest of the suite).
"""

from datetime import timedelta
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.security import crear_token_acceso
from app.core.websocket_manager import ConnectionManager, EVENTOS_WS, ROLES_POR_ESTADO
from tests.conftest import DATOS_USUARIO, DATOS_ADMIN


# ── Helpers ────────────────────────────────────────────────────────────────────

def _token(user_id: int, roles: list[str]) -> str:
    return crear_token_acceso(user_id, roles, delta=timedelta(minutes=60))


def _crear_producto(client: TestClient) -> int:
    um_id = client.get("/api/v1/unidades-medida/").json()["items"][0]["id"]
    ing_r = client.post("/api/v1/ingredientes/", json={
        "nombre": "HarinaWS",
        "stock_total": "10.000",
        "precio_costo": "50.00",
    })
    assert ing_r.status_code == 201, ing_r.text
    prod_r = client.post("/api/v1/productos/", json={
        "nombre": "ProductoWS",
        "margen_ganancia": "0",
        "disponible": True,
        "categorias": [],
        "ingredientes": [{
            "ingrediente_id": ing_r.json()["id"],
            "cantidad": "1.000",
            "unidad_medida_id": um_id,
            "es_removible": False,
        }],
    })
    assert prod_r.status_code == 201, prod_r.text
    return prod_r.json()["id"]


def _login(client: TestClient, email: str, contrasena: str) -> None:
    r = client.post("/api/v1/auth/login", json={"email": email, "contrasena": contrasena})
    assert r.status_code == 200, r.text


# ── ConnectionManager unit tests ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_manager_connect_une_rooms_por_todos_los_roles():
    mgr = ConnectionManager()
    ws = AsyncMock()

    await mgr.connect(ws, roles=["ADMIN", "PEDIDOS"], user_id=1)

    assert ws in mgr.rooms.get("role:ADMIN", set())
    assert ws in mgr.rooms.get("role:PEDIDOS", set())
    assert {"role:ADMIN", "role:PEDIDOS"}.issubset(mgr.socket_rooms[ws])


@pytest.mark.asyncio
async def test_manager_connect_cliente_no_une_role_room_client():
    """CLIENT también tiene su role room — lo que no ocurre es broadcast por rol."""
    mgr = ConnectionManager()
    ws = AsyncMock()
    await mgr.connect(ws, roles=["CLIENT"], user_id=1)
    assert ws in mgr.rooms.get("role:CLIENT", set())


@pytest.mark.asyncio
async def test_manager_disconnect_limpia_todos_los_rooms():
    mgr = ConnectionManager()
    ws = AsyncMock()
    await mgr.connect(ws, roles=["ADMIN"], user_id=1)
    mgr.join_order_room(ws, 42)

    mgr.disconnect(ws)

    assert ws not in mgr.socket_rooms
    assert ws not in mgr.rooms.get("role:ADMIN", set())
    assert ws not in mgr.rooms.get("order:42", set())


@pytest.mark.asyncio
async def test_manager_broadcast_to_roles_solo_al_rol_correcto():
    mgr = ConnectionManager()
    ws_admin = AsyncMock()
    ws_pedidos = AsyncMock()
    await mgr.connect(ws_admin, roles=["ADMIN"], user_id=1)
    await mgr.connect(ws_pedidos, roles=["PEDIDOS"], user_id=2)

    await mgr.broadcast_to_roles(["ADMIN"], "TEST_EVENT", {"msg": "hola"})

    ws_admin.send_json.assert_called_once_with({"event": "TEST_EVENT", "data": {"msg": "hola"}})
    ws_pedidos.send_json.assert_not_called()


@pytest.mark.asyncio
async def test_manager_broadcast_deduplication_multi_rol():
    """Socket con múltiples roles no recibe el mismo evento dos veces."""
    mgr = ConnectionManager()
    ws = AsyncMock()
    await mgr.connect(ws, roles=["ADMIN", "PEDIDOS"], user_id=1)

    await mgr.broadcast_to_roles(["ADMIN", "PEDIDOS"], "TEST_EVENT", {})

    ws.send_json.assert_called_once()


@pytest.mark.asyncio
async def test_manager_broadcast_to_order_solo_a_subscribers():
    mgr = ConnectionManager()
    ws_sub = AsyncMock()
    ws_no_sub = AsyncMock()
    await mgr.connect(ws_sub, roles=["CLIENT"], user_id=1)
    await mgr.connect(ws_no_sub, roles=["CLIENT"], user_id=2)
    mgr.join_order_room(ws_sub, 5)

    await mgr.broadcast_to_order(5, "PEDIDO_CONFIRMADO", {"estado_codigo": "CONFIRMADO"})

    ws_sub.send_json.assert_called_once_with({
        "event": "PEDIDO_CONFIRMADO",
        "data": {"estado_codigo": "CONFIRMADO"},
    })
    ws_no_sub.send_json.assert_not_called()


@pytest.mark.asyncio
async def test_manager_leave_order_room_deja_de_recibir():
    mgr = ConnectionManager()
    ws = AsyncMock()
    await mgr.connect(ws, roles=["CLIENT"], user_id=1)
    mgr.join_order_room(ws, 5)
    mgr.leave_order_room(ws, 5)

    await mgr.broadcast_to_order(5, "PEDIDO_CONFIRMADO", {})

    ws.send_json.assert_not_called()


# ── Constantes ─────────────────────────────────────────────────────────────────

def test_eventos_ws_cubre_todos_los_estados():
    esperados = {
        "PENDIENTE":      "PEDIDO_NUEVO",
        "CONFIRMADO":     "PEDIDO_CONFIRMADO",
        "EN_PREPARACION": "PEDIDO_EN_PREPARACION",
        "ENTREGADO":      "PEDIDO_ENTREGADO",
        "CANCELADO":      "PEDIDO_CANCELADO",
    }
    for estado, evento in esperados.items():
        assert EVENTOS_WS[estado] == evento, f"{estado!r} → esperaba {evento!r}"
    assert "EN_CAMINO" not in EVENTOS_WS


@pytest.mark.asyncio
async def test_emitir_evento_pedido_estructura_spec():
    """emitir_evento_pedido emite el payload de 7 campos definido en spec § 9.4."""
    import app.core.websocket_manager as ws_mod
    from app.core.websocket_manager import emitir_evento_pedido

    mgr = ConnectionManager()
    ws = AsyncMock()
    await mgr.connect(ws, roles=["ADMIN"], user_id=1)
    mgr.join_order_room(ws, 42)

    original = ws_mod.manager
    ws_mod.manager = mgr
    try:
        await emitir_evento_pedido(
            pedido_id=42,
            event="estado_cambiado",
            estado_anterior="PENDIENTE",
            estado_nuevo="CONFIRMADO",
            usuario_id=7,
            motivo=None,
        )
    finally:
        ws_mod.manager = original

    assert ws.send_json.call_count >= 1
    payload = ws.send_json.call_args[0][0]
    assert payload["event"] == "estado_cambiado"
    assert payload["pedido_id"] == 42
    assert payload["estado_anterior"] == "PENDIENTE"
    assert payload["estado_nuevo"] == "CONFIRMADO"
    assert payload["usuario_id"] == 7
    assert payload["motivo"] is None
    assert "timestamp" in payload


def test_roles_por_estado_nunca_incluye_client():
    """CLIENT no recibe broadcasts de rol — usa order rooms."""
    for estado, roles in ROLES_POR_ESTADO.items():
        assert "CLIENT" not in roles, f"CLIENT no debe estar en ROLES_POR_ESTADO[{estado!r}]"


def test_roles_por_estado_siempre_incluye_staff_completo():
    for estado, roles in ROLES_POR_ESTADO.items():
        assert "ADMIN" in roles, f"ADMIN falta en ROLES_POR_ESTADO[{estado!r}]"
        assert "PEDIDOS" in roles, f"PEDIDOS falta en ROLES_POR_ESTADO[{estado!r}]"


# ── WS endpoint — autenticación ────────────────────────────────────────────────

def test_ws_rechaza_sin_token(client):
    with pytest.raises(Exception):
        with client.websocket_connect("/api/v1/ws") as ws:
            ws.receive_json()


def test_ws_rechaza_token_malformado(client):
    with pytest.raises(Exception):
        with client.websocket_connect("/api/v1/ws?token=esto.no.es.jwt") as ws:
            ws.receive_json()


def test_ws_conecta_via_query_param(client, usuario_creado):
    token = _token(usuario_creado["id"], ["CLIENT"])
    with client.websocket_connect(f"/api/v1/ws?token={token}") as ws:
        msg = ws.receive_json()
        assert msg["event"] == "CONNECTED"
        assert msg["data"]["user_id"] == usuario_creado["id"]


def test_ws_conecta_via_cookie(client_autenticado, usuario_creado):
    with client_autenticado.websocket_connect("/api/v1/ws") as ws:
        msg = ws.receive_json()
        assert msg["event"] == "CONNECTED"
        assert msg["data"]["user_id"] == usuario_creado["id"]


# ── WS endpoint — subscribe / unsubscribe ─────────────────────────────────────

def test_ws_staff_subscribe_sin_verificar_ownership(client, usuario_admin_creado):
    """ADMIN suscribe a cualquier order_id sin verificar ownership en DB."""
    token = _token(usuario_admin_creado["id"], ["ADMIN"])
    with client.websocket_connect(f"/api/v1/ws?token={token}") as ws:
        ws.receive_json()  # CONNECTED
        ws.send_json({"action": "subscribe-order", "order_id": 9999})
        msg = ws.receive_json()
        assert msg["event"] == "SUBSCRIBED"
        assert msg["data"]["order_id"] == 9999


def test_ws_cliente_subscribe_a_pedido_propio(client, usuario_admin_creado, usuario_creado):
    """CLIENT puede suscribirse a su propio pedido."""
    # Admin crea productos
    _login(client, DATOS_ADMIN["email"], DATOS_ADMIN["contrasena"])
    prod_id = _crear_producto(client)

    # CLIENT crea pedido (login actualiza la cookie)
    _login(client, DATOS_USUARIO["email"], DATOS_USUARIO["contrasena"])
    ped_r = client.post("/api/v1/pedidos/", json={
        "forma_pago_codigo": "EFECTIVO",
        "items": [{"producto_id": prod_id, "cantidad": 1}],
    })
    assert ped_r.status_code == 201, ped_r.text
    ped_id = ped_r.json()["id"]

    # WS usa la cookie del CLIENT (último login)
    with client.websocket_connect("/api/v1/ws") as ws:
        ws.receive_json()  # CONNECTED
        ws.send_json({"action": "subscribe-order", "order_id": ped_id})
        msg = ws.receive_json()
        assert msg["event"] == "SUBSCRIBED"
        assert msg["data"]["order_id"] == ped_id


def test_ws_ownership_enforcement(client, usuario_admin_creado, usuario_creado):
    """CLIENT no puede suscribirse al pedido de otro usuario → ERROR."""
    # Admin crea productos y un pedido (propiedad del admin)
    _login(client, DATOS_ADMIN["email"], DATOS_ADMIN["contrasena"])
    prod_id = _crear_producto(client)
    ped_r = client.post("/api/v1/pedidos/", json={
        "forma_pago_codigo": "EFECTIVO",
        "items": [{"producto_id": prod_id, "cantidad": 1}],
    })
    assert ped_r.status_code == 201, ped_r.text
    ped_id = ped_r.json()["id"]

    # CLIENT hace login (reemplaza cookie de admin)
    _login(client, DATOS_USUARIO["email"], DATOS_USUARIO["contrasena"])

    # WS usa cookie del CLIENT → intenta suscribirse al pedido del admin
    with client.websocket_connect("/api/v1/ws") as ws:
        ws.receive_json()  # CONNECTED
        ws.send_json({"action": "subscribe-order", "order_id": ped_id})
        msg = ws.receive_json()
        assert msg["event"] == "ERROR"


def test_ws_unsubscribe(client, usuario_admin_creado):
    """Unsubscribe de un order room envía UNSUBSCRIBED."""
    token = _token(usuario_admin_creado["id"], ["ADMIN"])
    with client.websocket_connect(f"/api/v1/ws?token={token}") as ws:
        ws.receive_json()  # CONNECTED
        ws.send_json({"action": "subscribe-order", "order_id": 1})
        ws.receive_json()  # SUBSCRIBED
        ws.send_json({"action": "unsubscribe-order", "order_id": 1})
        msg = ws.receive_json()
        assert msg["event"] == "UNSUBSCRIBED"
        assert msg["data"]["order_id"] == 1


def test_ws_accion_desconocida(client, usuario_creado):
    """Acción desconocida → ERROR."""
    token = _token(usuario_creado["id"], ["CLIENT"])
    with client.websocket_connect(f"/api/v1/ws?token={token}") as ws:
        ws.receive_json()  # CONNECTED
        ws.send_json({"action": "accion_no_existe"})
        msg = ws.receive_json()
        assert msg["event"] == "ERROR"
