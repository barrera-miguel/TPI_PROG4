from datetime import date
from decimal import Decimal

from app.repositories.pedido_repository import PedidoRepositorio
from app.uow.uow import UnidadDeTrabajo


def get_ventas_periodo(desde: date, hasta: date, agrupacion: str = "day") -> list:
    with UnidadDeTrabajo() as uow:
        repo: PedidoRepositorio = uow.pedidos
        return repo.get_ventas_periodo(desde, hasta, agrupacion)


def get_productos_top(limit: int = 5) -> list:
    with UnidadDeTrabajo() as uow:
        repo: PedidoRepositorio = uow.pedidos
        return repo.get_productos_top(limit)


def get_pedidos_por_estado() -> list:
    with UnidadDeTrabajo() as uow:
        repo: PedidoRepositorio = uow.pedidos
        return repo.get_pedidos_por_estado()


def get_ingresos_por_forma_pago(desde: date, hasta: date) -> list:
    with UnidadDeTrabajo() as uow:
        repo: PedidoRepositorio = uow.pedidos
        return repo.get_ingresos_por_forma_pago(desde, hasta)


def get_resumen() -> dict:
    with UnidadDeTrabajo() as uow:
        repo: PedidoRepositorio = uow.pedidos
        return repo.get_resumen_kpis()
