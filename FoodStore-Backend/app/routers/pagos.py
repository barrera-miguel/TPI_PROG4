from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse

from app.core.config import configuracion
from app.core.deps import obtener_usuario_activo, requerir_rol
from app.schemas.pago import (
    ConfirmarPagoRequest,
    CrearPagoRequest,
    PagoEstadoResponse,
    PagoPreferenciaResponse,
    PagoPublico,
)
from app.services import pago_service

router = APIRouter(tags=["Pagos"])


@router.get(
    "/pagos/{pedido_id}",
    response_model=PagoPublico,
    summary="Consultar pago de un pedido",
)
def obtener_pago(
    pedido_id: int,
    usuario_actual=Depends(obtener_usuario_activo),
):
    es_admin = "ADMIN" in usuario_actual.roles
    return pago_service.obtener_pago(pedido_id, usuario_actual.id, es_admin)


@router.post(
    "/pagos/create-preference",
    response_model=PagoPreferenciaResponse,
)
def crear_preferencia(
    datos: CrearPagoRequest,
    usuario_actual=Depends(requerir_rol(["CLIENT", "ADMIN"])),
):
    return pago_service.crear_pago(datos.pedido_id, usuario_actual.id)


@router.post("/pagos/webhook")
async def webhook(request: Request):
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("application/json"):
        data = await request.json()
    else:
        form = await request.form()
        data = dict(form)

    query_params = dict(request.query_params)
    return await pago_service.procesar_webhook(request, data, query_params)


@router.post(
    "/pagos/confirm",
    response_model=PagoEstadoResponse,
)
async def confirmar_pago(
    datos: ConfirmarPagoRequest,
    usuario_actual=Depends(obtener_usuario_activo),
):
    return await pago_service.confirmar_pago_y_notificar(datos, usuario_actual.id)


@router.get("/pagos/redirect/{pedido_id}/{estado}")
def redirect_post_pago(pedido_id: int, estado: str):
    frontend_url = configuracion.FRONTEND_URL or "http://localhost:5173"
    return RedirectResponse(url=f"{frontend_url}/orders/{pedido_id}/{estado}")
