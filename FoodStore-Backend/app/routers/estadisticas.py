from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.core.deps import requerir_rol
from app.schemas.estadisticas import (
    IngresosFormaPagoItem,
    PedidosEstadoItem,
    ProductoTopItem,
    ResumenResponse,
    VentasPeriodoItem,
)
from app.services import estadisticas_service

router = APIRouter(prefix="/estadisticas", tags=["Estadísticas"])


@router.get("/ventas", response_model=List[VentasPeriodoItem])
def ventas(
    desde: date = Query(..., description="Fecha inicio (YYYY-MM-DD)"),
    hasta: date = Query(..., description="Fecha fin (YYYY-MM-DD)"),
    agrupacion: str = Query("day", description="Agrupación: day, week, month"),
    _admin=Depends(requerir_rol(["ADMIN"])),
):
    return estadisticas_service.get_ventas_periodo(desde, hasta, agrupacion)


@router.get("/productos-top", response_model=List[ProductoTopItem])
def productos_top(
    limit: int = Query(5, ge=1, le=20, description="Cantidad de productos"),
    _admin=Depends(requerir_rol(["ADMIN"])),
):
    return estadisticas_service.get_productos_top(limit)


@router.get("/pedidos-por-estado", response_model=List[PedidosEstadoItem])
def pedidos_por_estado(
    _admin=Depends(requerir_rol(["ADMIN"])),
):
    return estadisticas_service.get_pedidos_por_estado()


@router.get("/ingresos", response_model=List[IngresosFormaPagoItem])
def ingresos(
    desde: date = Query(..., description="Fecha inicio (YYYY-MM-DD)"),
    hasta: date = Query(..., description="Fecha fin (YYYY-MM-DD)"),
    _admin=Depends(requerir_rol(["ADMIN"])),
):
    return estadisticas_service.get_ingresos_por_forma_pago(desde, hasta)


@router.get("/resumen", response_model=ResumenResponse)
def resumen(
    _admin=Depends(requerir_rol(["ADMIN"])),
):
    return estadisticas_service.get_resumen()
