from decimal import Decimal
from datetime import date, datetime, timezone
from typing import List, Optional

from sqlalchemy import func
from sqlmodel import Session, select

from app.models.detalle_pedido import DetallePedido
from app.models.pago import Pago
from app.models.pedido import Pedido


class PedidoRepositorio:
    def __init__(self, sesion: Session):
        self.sesion = sesion

    def crear(
        self,
        usuario_id: int,
        direccion_id: Optional[int],
        direccion_snapshot: Optional[str],
        estado_codigo: str,
        forma_pago_codigo: str,
        subtotal: Decimal,
        descuento: Decimal,
        costo_envio: Decimal,
        total: Decimal,
        notas: Optional[str],
        items_snapshot: list,
    ) -> Pedido:
        pedido = Pedido(
            usuario_id=usuario_id,
            direccion_id=direccion_id,
            direccion_snapshot=direccion_snapshot,
            estado_codigo=estado_codigo,
            forma_pago_codigo=forma_pago_codigo,
            subtotal=subtotal,
            descuento=descuento,
            costo_envio=costo_envio,
            total=total,
            notas=notas,
        )
        self.sesion.add(pedido)
        self.sesion.flush()

        for item in items_snapshot:
            self.sesion.add(DetallePedido(
                pedido_id=pedido.id,
                producto_id=item["producto_id"],
                cantidad=item["cantidad"],
                nombre_snapshot=item["nombre_snapshot"],
                precio_snapshot=item["precio_snapshot"],
                subtotal_snap=item["subtotal_snap"],
                personalizacion=item.get("personalizacion") or None,
            ))

        self.sesion.flush()
        self.sesion.refresh(pedido)
        return pedido

    def obtener_por_id(self, id: int) -> Optional[Pedido]:
        pedido = self.sesion.get(Pedido, id)
        if pedido and pedido.deleted_at is not None:
            return None
        return pedido

    def obtener_por_usuario(
        self, usuario_id: int, skip: int = 0, limit: int = 10
    ) -> List[Pedido]:
        consulta = (
            select(Pedido)
            .where(Pedido.usuario_id == usuario_id)
            .where(Pedido.deleted_at == None)  # noqa: E711
            .offset(skip)
            .limit(limit)
        )
        return list(self.sesion.exec(consulta).all())

    def obtener_todos(
        self, skip: int = 0, limit: int = 10, estado: Optional[str] = None
    ) -> List[Pedido]:
        consulta = select(Pedido).where(Pedido.deleted_at == None)  # noqa: E711
        if estado:
            consulta = consulta.where(Pedido.estado_codigo == estado)
        consulta = consulta.offset(skip).limit(limit)
        return list(self.sesion.exec(consulta).all())

    def contar(self, estado: Optional[str] = None) -> int:
        consulta = select(func.count(Pedido.id)).where(Pedido.deleted_at == None)  # noqa: E711
        if estado:
            consulta = consulta.where(Pedido.estado_codigo == estado)
        return self.sesion.execute(consulta).scalar() or 0

    def contar_por_usuario(self, usuario_id: int) -> int:
        consulta = (
            select(func.count(Pedido.id))
            .where(Pedido.usuario_id == usuario_id)
            .where(Pedido.deleted_at == None)  # noqa: E711
        )
        return self.sesion.execute(consulta).scalar() or 0

    def actualizar_estado(self, pedido: Pedido, estado_codigo: str) -> Pedido:
        pedido.estado_codigo = estado_codigo
        self.sesion.add(pedido)
        self.sesion.flush()
        self.sesion.refresh(pedido)
        return pedido

    def obtener_metricas(self):
        from app.schemas.pedido import MetricasResumen

        total_pedidos = self.sesion.execute(
            select(func.count(Pedido.id)).where(Pedido.deleted_at == None)  # noqa: E711
        ).scalar() or 0

        facturacion = self.sesion.execute(
            select(func.sum(Pedido.total)).where(Pedido.deleted_at == None)  # noqa: E711
        ).scalar()
        facturacion_total = Decimal(str(facturacion)) if facturacion is not None else Decimal("0.00")

        estados_rows = self.sesion.execute(
            select(Pedido.estado_codigo, func.count(Pedido.id))
            .where(Pedido.deleted_at == None)  # noqa: E711
            .group_by(Pedido.estado_codigo)
        ).all()
        pedidos_por_estado = {estado: count for estado, count in estados_rows}

        return MetricasResumen(
            total_pedidos=total_pedidos,
            facturacion_total=facturacion_total,
            pedidos_por_estado=pedidos_por_estado,
        )

    # ── Estadísticas (§11) ─────────────────────────────────────────────────────

    def get_ventas_periodo(self, desde: date, hasta: date, agrupacion: str) -> list:
        trunc = {"day": "day", "week": "week", "month": "month"}.get(agrupacion, "day")
        date_trunc = func.date_trunc(trunc, Pedido.created_at)
        rows = (
            self.sesion.execute(
                select(
                    date_trunc.label("periodo"),
                    func.sum(Pedido.total).label("total_ventas"),
                    func.count(Pedido.id).label("cantidad_pedidos"),
                )
                .where(Pedido.deleted_at == None)  # noqa: E711
                .where(Pedido.estado_codigo != "CANCELADO")
                .where(func.date(Pedido.created_at).between(desde, hasta))
                .group_by(date_trunc)
                .order_by(date_trunc)
            )
            .all()
        )
        return [{"periodo": str(r.periodo), "total_ventas": Decimal(str(r.total_ventas or 0)), "cantidad_pedidos": r.cantidad_pedidos} for r in rows]

    def get_productos_top(self, limit: int = 5) -> list:
        rows = (
            self.sesion.execute(
                select(
                    DetallePedido.producto_id,
                    DetallePedido.nombre_snapshot.label("nombre"),
                    func.sum(DetallePedido.subtotal_snap).label("ingresos"),
                    func.sum(DetallePedido.cantidad).label("cantidad_vendida"),
                )
                .select_from(DetallePedido)
                .join(Pedido, DetallePedido.pedido_id == Pedido.id)
                .where(Pedido.deleted_at == None)  # noqa: E711
                .where(Pedido.estado_codigo != "CANCELADO")
                .group_by(DetallePedido.producto_id, DetallePedido.nombre_snapshot)
                .order_by(func.sum(DetallePedido.subtotal_snap).desc())
                .limit(limit)
            )
            .all()
        )
        return [{"producto_id": r.producto_id, "nombre": r.nombre, "ingresos": Decimal(str(r.ingresos)), "cantidad_vendida": r.cantidad_vendida} for r in rows]

    def get_pedidos_por_estado(self) -> list:
        rows = (
            self.sesion.execute(
                select(Pedido.estado_codigo, func.count(Pedido.id))
                .where(Pedido.deleted_at == None)  # noqa: E711
                .group_by(Pedido.estado_codigo)
            )
            .all()
        )
        return [{"estado_codigo": r.estado_codigo, "cantidad": r.count} for r in rows]

    def get_ingresos_por_forma_pago(self, desde: date, hasta: date) -> list:
        rows = (
            self.sesion.execute(
                select(
                    Pedido.forma_pago_codigo,
                    func.sum(Pedido.total).label("total"),
                    func.count(Pedido.id).label("cantidad"),
                )
                .join(Pago, Pago.pedido_id == Pedido.id)
                .where(Pedido.deleted_at == None)  # noqa: E711
                .where(Pedido.estado_codigo != "CANCELADO")
                .where(Pago.mp_status == "approved")
                .where(func.date(Pedido.created_at).between(desde, hasta))
                .group_by(Pedido.forma_pago_codigo)
            )
            .all()
        )
        return [{"forma_pago_codigo": r.forma_pago_codigo, "total": Decimal(str(r.total or 0)), "cantidad": r.cantidad} for r in rows]

    def get_resumen_kpis(self) -> dict:
        hoy = date.today()
        inicio_mes = hoy.replace(day=1)

        ventas_hoy = self.sesion.execute(
            select(func.sum(Pedido.total))
            .where(Pedido.deleted_at == None)  # noqa: E711
            .where(Pedido.estado_codigo != "CANCELADO")
            .where(func.date(Pedido.created_at) == hoy)
        ).scalar()
        ventas_hoy = Decimal(str(ventas_hoy)) if ventas_hoy else Decimal("0.00")

        total_pedidos = self.sesion.execute(
            select(func.count(Pedido.id))
            .where(Pedido.deleted_at == None)  # noqa: E711
        ).scalar() or 0

        facturacion = self.sesion.execute(
            select(func.sum(Pedido.total))
            .where(Pedido.deleted_at == None)  # noqa: E711
            .where(Pedido.estado_codigo != "CANCELADO")
        ).scalar()
        facturacion_total = Decimal(str(facturacion)) if facturacion else Decimal("0.00")

        pedidos_activos = self.sesion.execute(
            select(func.count(Pedido.id))
            .where(Pedido.deleted_at == None)  # noqa: E711
            .where(Pedido.estado_codigo.in_(["PENDIENTE", "CONFIRMADO", "EN_PREPARACION"]))
        ).scalar() or 0

        mes_actual = self.sesion.execute(
            select(func.sum(Pedido.total))
            .where(Pedido.deleted_at == None)  # noqa: E711
            .where(Pedido.estado_codigo != "CANCELADO")
            .where(func.date(Pedido.created_at) >= inicio_mes)
        ).scalar()
        mes_actual = Decimal(str(mes_actual)) if mes_actual else Decimal("0.00")

        ticket_promedio = Decimal(str(round(facturacion_total / total_pedidos, 2))) if total_pedidos > 0 else Decimal("0.00")

        return {
            "ventas_hoy": ventas_hoy,
            "ticket_promedio": ticket_promedio,
            "pedidos_activos": pedidos_activos,
            "total_pedidos": total_pedidos,
            "facturacion_total": facturacion_total,
            "mes_actual": mes_actual,
        }
