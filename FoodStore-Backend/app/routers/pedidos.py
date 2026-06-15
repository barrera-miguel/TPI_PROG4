from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.core.deps import obtener_usuario_activo, requerir_rol
from app.schemas.common import PaginatedResponse
from app.schemas.pedido import (
    AvanzarEstadoBody,
    CancelarPedidoBody,
    HistorialEstadoPublico,
    MetricasResumen,
    PedidoCrear,
    PedidoPublico,
)
from app.services import pedido_service

router = APIRouter(tags=["Pedidos"])

IdPedido = Annotated[int, Path(gt=0, description="ID del pedido")]


# ── Cliente ────────────────────────────────────────────────────────────────────

@router.post(
    "/pedidos/",
    response_model=PedidoPublico,
    status_code=status.HTTP_201_CREATED,
)
async def crear_pedido(
    datos: PedidoCrear,
    usuario_actual=Depends(requerir_rol(["CLIENT", "ADMIN"])),
):
    try:
        return await pedido_service.crear_pedido_y_notificar(datos, usuario_actual.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get(
    "/pedidos/",
    response_model=PaginatedResponse,
)
def listar_pedidos(
    page: Annotated[int, Query(ge=1, description="Número de página")] = 1,
    size: Annotated[int, Query(ge=1, le=100, description="Registros por página")] = 20,
    usuario_actual=Depends(obtener_usuario_activo),
):
    if any(r in usuario_actual.roles for r in ["ADMIN", "PEDIDOS"]):
        return pedido_service.obtener_pedidos_admin(page, size)
    return pedido_service.obtener_pedidos_usuario(usuario_actual.id, page, size)


@router.get(
    "/pedidos/{id}",
    response_model=PedidoPublico,
)
def detalle_pedido(
    id: IdPedido,
    usuario_actual=Depends(obtener_usuario_activo),
):
    if any(r in usuario_actual.roles for r in ["ADMIN", "PEDIDOS"]):
        pedido = pedido_service.obtener_pedido_admin(id)
    else:
        pedido = pedido_service.obtener_pedido_usuario(id, usuario_actual.id)
    if not pedido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
    return pedido


@router.get(
    "/pedidos/{id}/historial",
    response_model=List[HistorialEstadoPublico],
)
def historial_pedido(
    id: IdPedido,
    usuario_actual=Depends(obtener_usuario_activo),
):
    historial = pedido_service.obtener_historial_pedido(id, usuario_actual.id, usuario_actual.roles)
    if historial is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
    return historial


@router.delete(
    "/pedidos/{id}",
    response_model=PedidoPublico,
)
async def cancelar_pedido(
    id: IdPedido,
    body: CancelarPedidoBody,
    usuario_actual=Depends(requerir_rol(["CLIENT", "ADMIN"])),
):
    try:
        pedido = await pedido_service.cancelar_pedido_cliente_y_notificar(id, body.motivo, usuario_actual.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    if not pedido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
    return pedido


@router.patch(
    "/pedidos/{id}/estado",
    response_model=PedidoPublico,
)
async def avanzar_estado_pedido(
    id: IdPedido,
    body: AvanzarEstadoBody,
    usuario_actual=Depends(requerir_rol(["ADMIN", "PEDIDOS"])),
):
    try:
        pedido = await pedido_service.avanzar_estado_y_notificar(id, body, usuario_actual.roles, usuario_actual.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    if not pedido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
    return pedido


# ── Admin / PEDIDOS ────────────────────────────────────────────────────────────

@router.get(
    "/admin/pedidos/",
    response_model=PaginatedResponse,
)
def listar_pedidos_admin(
    page: Annotated[int, Query(ge=1, description="Número de página")] = 1,
    size: Annotated[int, Query(ge=1, le=100, description="Registros por página")] = 20,
    estado: Annotated[Optional[str], Query(description="Filtrar por estado")] = None,
    usuario_actual=Depends(requerir_rol(["ADMIN", "PEDIDOS"])),
):
    return pedido_service.obtener_pedidos_admin(page, size, estado)


@router.get(
    "/admin/pedidos/{id}",
    response_model=PedidoPublico,
)
def detalle_pedido_admin(
    id: IdPedido,
    usuario_actual=Depends(requerir_rol(["ADMIN", "PEDIDOS"])),
):
    pedido = pedido_service.obtener_pedido_admin(id)
    if not pedido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
    return pedido


@router.get(
    "/admin/metricas/resumen",
    response_model=MetricasResumen,
)
def metricas_resumen(
    _admin=Depends(requerir_rol(["ADMIN"])),
):
    return pedido_service.obtener_metricas()
