"""Tests de integración para el módulo de Estadísticas (§11)."""
from datetime import date
from decimal import Decimal
import uuid

import pytest
from app.models.pago import Pago
from app.uow.uow import get_session


@pytest.fixture
def datos_estadisticas(client_admin):
    """Crea pedidos y pagos como ADMIN para probar estadísticas."""
    # Crear categoría y producto
    r = client_admin.post("/api/v1/categorias/", json={"nombre": "TestCat"})
    assert r.status_code == 201, r.text
    cat_id = r.json()["id"]

    r = client_admin.post("/api/v1/productos/", json={
        "nombre": "Producto Test", "margen_ganancia": "20",
        "categorias": [{"categoria_id": cat_id}],
        "stock_directo": 50, "precio_base": "100.00",
    })
    assert r.status_code == 201, r.text
    prod_id = r.json()["id"]

    # Pedido 1: CONFIRMADO con pago approved
    r = client_admin.post("/api/v1/pedidos/", json={
        "forma_pago_codigo": "MERCADOPAGO",
        "items": [{"producto_id": prod_id, "cantidad": 2}],
    })
    assert r.status_code == 201, r.text
    pedido1 = r.json()

    r = client_admin.patch(f"/api/v1/pedidos/{pedido1['id']}/estado", json={
        "estado_hasta": "CONFIRMADO",
    })
    assert r.status_code == 200, r.text

    # Pedido 2: CANCELADO
    r = client_admin.post("/api/v1/pedidos/", json={
        "forma_pago_codigo": "MERCADOPAGO",
        "items": [{"producto_id": prod_id, "cantidad": 1}],
    })
    assert r.status_code == 201, r.text
    pedido2 = r.json()

    r = client_admin.patch(f"/api/v1/pedidos/{pedido2['id']}/estado", json={
        "estado_hasta": "CANCELADO", "motivo": "Test cancel",
    })
    assert r.status_code == 200, r.text

    # Pedido 3: queda PENDIENTE
    r = client_admin.post("/api/v1/pedidos/", json={
        "forma_pago_codigo": "MERCADOPAGO",
        "items": [{"producto_id": prod_id, "cantidad": 3}],
    })
    assert r.status_code == 201, r.text
    pedido3 = r.json()

    # Registrar pago aprobado para pedido1 via BD
    sesion = get_session()
    try:
        importe = Decimal(pedido1["total"])
        pago = Pago(
            pedido_id=pedido1["id"],
            estado="approved",
            mp_payment_id=123456,
            mp_status="approved",
            mp_status_detail="accredited",
            external_reference=str(uuid.uuid4()),
            idempotency_key=str(uuid.uuid4()),
            transaction_amount=importe,
            payment_method_id="visa",
        )
        sesion.add(pago)
        sesion.commit()
    finally:
        sesion.close()

    return {"producto": prod_id, "pedidos": [pedido1, pedido2, pedido3]}


class TestEstadisticas:
    hoy = date.today().isoformat()

    def test_ventas_periodo(self, client_admin, datos_estadisticas):
        r = client_admin.get(f"/api/v1/estadisticas/ventas?desde={self.hoy}&hasta={self.hoy}&agrupacion=day")
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data) >= 1
        for item in data:
            assert "periodo" in item
            assert float(item["total_ventas"]) >= 0
            assert item["cantidad_pedidos"] >= 0

    def test_ventas_excluye_cancelados(self, client_admin, datos_estadisticas):
        """EST-01: CANCELADO no suma en ventas."""
        r = client_admin.get(f"/api/v1/estadisticas/ventas?desde={self.hoy}&hasta={self.hoy}&agrupacion=day")
        assert r.status_code == 200, r.text
        data = r.json()
        total_pedidos = sum(item["cantidad_pedidos"] for item in data)
        assert total_pedidos == 2  # 1 aprobado + 1 pendiente, excluye cancelado

    def test_productos_top(self, client_admin, datos_estadisticas):
        r = client_admin.get("/api/v1/estadisticas/productos-top?limit=5")
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data) >= 1
        for item in data:
            assert "producto_id" in item
            assert "nombre" in item
            assert float(item["ingresos"]) >= 0
            assert item["cantidad_vendida"] > 0

    def test_pedidos_por_estado(self, client_admin, datos_estadisticas):
        r = client_admin.get("/api/v1/estadisticas/pedidos-por-estado")
        assert r.status_code == 200, r.text
        data = r.json()
        estados = {item["estado_codigo"]: item["cantidad"] for item in data}
        assert estados.get("CONFIRMADO", 0) >= 1
        assert estados.get("CANCELADO", 0) >= 1
        assert estados.get("PENDIENTE", 0) >= 1

    def test_ingresos_solo_approved(self, client_admin, datos_estadisticas):
        """EST-03: solo pagos con mp_status='approved' en ingresos."""
        r = client_admin.get(f"/api/v1/estadisticas/ingresos?desde={self.hoy}&hasta={self.hoy}")
        assert r.status_code == 200, r.text
        data = r.json()
        total_ingresos = sum(float(item["total"]) for item in data)
        assert total_ingresos > 0

    def test_resumen_kpis(self, client_admin, datos_estadisticas):
        r = client_admin.get("/api/v1/estadisticas/resumen")
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ["ventas_hoy", "ticket_promedio", "pedidos_activos", "total_pedidos", "facturacion_total", "mes_actual"]:
            assert key in data, f"Missing key: {key}"
        assert data["total_pedidos"] >= 3

    def test_resumen_excluye_cancelados(self, client_admin, datos_estadisticas):
        """EST-01: facturación no incluye CANCELADO."""
        r = client_admin.get("/api/v1/estadisticas/resumen")
        assert r.status_code == 200, r.text
        assert float(r.json()["facturacion_total"]) > 0

    def test_endpoints_protegidos_admin(self, client):
        """Todos los endpoints requieren ADMIN."""
        endpoints = [
            "/api/v1/estadisticas/resumen",
            f"/api/v1/estadisticas/ventas?desde={self.hoy}&hasta={self.hoy}",
            "/api/v1/estadisticas/productos-top",
            "/api/v1/estadisticas/pedidos-por-estado",
            f"/api/v1/estadisticas/ingresos?desde={self.hoy}&hasta={self.hoy}",
        ]
        for ep in endpoints:
            r = client.get(ep)
            assert r.status_code in (401, 403), f"{ep} debería requerir auth, devolvió {r.status_code}"
