import hashlib
import hmac as hmac_lib
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, Request, status

from app.core.config import configuracion
from app.models.pago import Pago
from app.schemas.pago import ConfirmarPagoRequest, PagoEstadoResponse, PagoPreferenciaResponse, PagoPublico
from app.uow.uow import UnidadDeTrabajo

logger = logging.getLogger(__name__)

# ── Mapeo de estados MP → estado local ───────────────────────────────────────
_ESTADO_APROBADO = "aprobado"
_ESTADO_RECHAZADO = "rechazado"
_ESTADO_PENDIENTE = "pendiente"

_MP_APROBADOS = {"approved"}
_MP_RECHAZADOS = {"rejected", "cancelled", "refunded", "charged_back"}
_MP_PENDIENTES = {"pending", "in_process", "authorized"}


def _mapear_estado_mp(mp_status: Optional[str]) -> Optional[str]:
    if mp_status in _MP_APROBADOS:
        return _ESTADO_APROBADO
    if mp_status in _MP_RECHAZADOS:
        return _ESTADO_RECHAZADO
    if mp_status in _MP_PENDIENTES:
        return _ESTADO_PENDIENTE
    return None


# ── Comunicación con el SDK de MercadoPago ────────────────────────────────────

def _crear_preferencia_mp(monto: Decimal, titulo: str, pedido_id: int, back_urls: dict) -> dict:
    access_token = configuracion.MP_ACCESS_TOKEN
    if not access_token:
        raise RuntimeError("MercadoPago no configurado. Configure MP_ACCESS_TOKEN en .env")

    try:
        import mercadopago
        sdk = mercadopago.SDK(access_token)

        base_url = configuracion.NGROK_URL or "http://localhost:8000"
        preference_data = {
            "items": [{
                "title": titulo,
                "quantity": 1,
                "unit_price": float(monto),
                "currency_id": "ARS",
            }],
            "external_reference": str(pedido_id),
            "back_urls": back_urls,
            "notification_url": (
                configuracion.MP_WEBHOOK_URL
                or f"{base_url}/api/v1/pagos/webhook"
            ),
            "auto_return": "approved",
        }

        result = sdk.preference().create(preference_data)
        if result.get("status") not in (200, 201):
            logger.error("Error creando preferencia MP: %s", result)
            raise RuntimeError(
                f"Error al crear preferencia: "
                f"{result.get('response', {}).get('message', 'desconocido')}"
            )

        response = result.get("response", {})
        return {
            "preference_id": response.get("id"),
            "init_point": response.get("init_point"),
        }

    except ImportError:
        raise RuntimeError("Instalar dependencia: pip install mercadopago")
    except RuntimeError:
        raise
    except Exception as e:
        logger.exception("Error inesperado al crear preferencia MP")
        raise RuntimeError(f"Error de conexión con MP: {e}")


def _consultar_pago_mp(payment_id: int) -> dict:
    access_token = configuracion.MP_ACCESS_TOKEN
    if not access_token:
        raise RuntimeError("MercadoPago no configurado. Configure MP_ACCESS_TOKEN en .env")

    try:
        import mercadopago
        sdk = mercadopago.SDK(access_token)
        result = sdk.payment().get(payment_id)

        if result.get("status") != 200:
            logger.error("Error consultando pago MP %s: %s", payment_id, result)
            raise RuntimeError(f"Error al consultar pago {payment_id} en MercadoPago")

        response = result.get("response", {})
        return {
            "mp_payment_id": response.get("id"),
            "mp_status": response.get("status"),
            "mp_status_detail": response.get("status_detail"),
            "mp_merchant_order_id": response.get("merchant_order_id"),
            "external_reference": response.get("external_reference"),
        }

    except ImportError:
        raise RuntimeError("Instalar dependencia: pip install mercadopago")
    except RuntimeError:
        raise
    except Exception as e:
        logger.exception("Error consultando pago MP %s", payment_id)
        raise RuntimeError(f"Error de conexión con MP: {e}")


# ── Validación de firma X-Signature ──────────────────────────────────────────

def _validar_firma(x_signature: Optional[str], x_request_id: Optional[str], data_id: Optional[str]) -> None:
    secret = configuracion.MP_WEBHOOK_SECRET
    if not secret:
        logger.warning("MP_WEBHOOK_SECRET no configurado — saltando validación de firma")
        return

    if not x_signature:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Falta header X-Signature")

    # Parsear "ts=...,v1=..."
    ts = None
    v1 = None
    for part in x_signature.split(","):
        part = part.strip()
        if part.startswith("ts="):
            ts = part[3:]
        elif part.startswith("v1="):
            v1 = part[3:]

    if not ts or not v1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Header X-Signature inválido")

    manifest = f"id:{data_id or ''};request-id:{x_request_id or ''};ts:{ts}"
    expected = hmac_lib.new(
        secret.encode(),
        manifest.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac_lib.compare_digest(expected, v1):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Firma de webhook inválida")


# ── Avanzar estado del pedido (uso interno del webhook) ──────────────────────

def _confirmar_pedido_en_uow(uow, pedido_id: int) -> None:
    pedido = uow.pedidos.obtener_por_id(pedido_id)
    if not pedido or pedido.estado_codigo != "PENDIENTE":
        return
    uow.pedidos.actualizar_estado(pedido, "CONFIRMADO")
    uow.historial_pedidos.registrar(
        pedido_id=pedido_id,
        estado_desde="PENDIENTE",
        estado_hasta="CONFIRMADO",
        usuario_id=None,
        motivo="Pago aprobado via MercadoPago",
    )


# ── Operaciones de negocio ────────────────────────────────────────────────────

def obtener_pago(pedido_id: int, usuario_id: int, es_admin: bool = False) -> PagoPublico:
    with UnidadDeTrabajo() as uow:
        pedido = uow.pedidos.obtener_por_id(pedido_id)
        if not pedido:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
        if not es_admin and pedido.usuario_id != usuario_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a este pedido")

        pago = uow.pagos.obtener_ultimo_por_pedido(pedido_id)
        if not pago:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pago no encontrado para este pedido")

        return PagoPublico(
            id=pago.id,
            pedido_id=pago.pedido_id,
            estado=pago.estado,
            mp_payment_id=pago.mp_payment_id,
            mp_status=pago.mp_status,
            mp_status_detail=pago.mp_status_detail,
            transaction_amount=pago.transaction_amount,
            created_at=pago.created_at,
        )


def crear_pago(pedido_id: int, usuario_id: int) -> PagoPreferenciaResponse:
    with UnidadDeTrabajo() as uow:
        pedido = uow.pedidos.obtener_por_id(pedido_id)
        if not pedido:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
        if pedido.usuario_id != usuario_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a este pedido")
        if pedido.estado_codigo != "PENDIENTE":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"El pedido no está en estado PENDIENTE (estado actual: {pedido.estado_codigo})",
            )
        if pedido.forma_pago_codigo != "MERCADOPAGO":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El pedido no usa MercadoPago como forma de pago",
            )
        if not configuracion.MP_ACCESS_TOKEN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MercadoPago no configurado. Configure MP_ACCESS_TOKEN en .env",
            )

        # Idempotencia: reusar preferencia existente si el pago está pendiente
        pago_existente = uow.pagos.obtener_ultimo_por_pedido(pedido_id)
        if pago_existente and pago_existente.estado == _ESTADO_PENDIENTE and pago_existente.mp_preference_id:
            return PagoPreferenciaResponse(
                pago_id=pago_existente.id,
                preference_id=pago_existente.mp_preference_id,
                init_point=pago_existente.mp_init_point,
                public_key=configuracion.MP_PUBLIC_KEY,
            )

        base_url = configuracion.NGROK_URL or "http://localhost:8000"
        back_urls = {
            "success": f"{base_url}/api/v1/pagos/redirect/{pedido_id}/success",
            "failure": f"{base_url}/api/v1/pagos/redirect/{pedido_id}/failure",
            "pending": f"{base_url}/api/v1/pagos/redirect/{pedido_id}/pending",
        }

        try:
            mp_data = _crear_preferencia_mp(
                monto=pedido.total,
                titulo=f"Pedido #{pedido_id}",
                pedido_id=pedido_id,
                back_urls=back_urls,
            )
        except RuntimeError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

        pago = Pago(
            pedido_id=pedido_id,
            estado=_ESTADO_PENDIENTE,
            mp_preference_id=mp_data["preference_id"],
            mp_init_point=mp_data.get("init_point"),
            external_reference=str(uuid.uuid4()),
            idempotency_key=str(uuid.uuid4()),
            transaction_amount=pedido.total,
        )
        uow.pagos.crear(pago)

        return PagoPreferenciaResponse(
            pago_id=pago.id,
            preference_id=mp_data["preference_id"],
            init_point=mp_data.get("init_point"),
            public_key=configuracion.MP_PUBLIC_KEY,
        )


async def procesar_webhook(request: Request, data: dict, query_params: Optional[dict] = None) -> dict:
    # Extraer data_id antes de validar firma (se necesita para el manifest)
    if not data and query_params:
        data = query_params

    data_id = (
        data.get("data_id")
        or (data.get("data") or {}).get("id")
        or data.get("id")
    )
    if not data_id and query_params:
        data_id = query_params.get("data.id") or query_params.get("id")

    x_signature = request.headers.get("x-signature")
    x_request_id = request.headers.get("x-request-id")

    _validar_firma(x_signature, x_request_id, str(data_id) if data_id else None)

    topic = data.get("type") or data.get("topic")
    if not query_params:
        query_params = {}
    if not topic:
        topic = query_params.get("topic") or query_params.get("type")

    pago_mp_id = data_id or data.get("id")
    if not pago_mp_id and query_params:
        pago_mp_id = query_params.get("data.id") or query_params.get("id")

    if not pago_mp_id:
        return {"status": "ignored", "reason": "No payment ID"}

    if topic not in (None, "payment", "merchant_order"):
        return {"status": "ignored", "reason": f"Topic no relevante: {topic}"}

    try:
        mp_info = _consultar_pago_mp(int(pago_mp_id))
        estado_mp = mp_info.get("mp_status")
        nuevo_estado = _mapear_estado_mp(estado_mp)

        if nuevo_estado is None:
            return {"status": "ignored", "reason": f"Estado desconocido: {estado_mp}"}

        with UnidadDeTrabajo() as uow:
            pago = uow.pagos.obtener_por_mp_payment_id(int(pago_mp_id))
            if not pago and mp_info.get("mp_merchant_order_id"):
                pago = uow.pagos.obtener_por_mp_merchant_order_id(mp_info["mp_merchant_order_id"])
            if not pago and mp_info.get("external_reference"):
                try:
                    pedido_id = int(mp_info["external_reference"])
                    pago = uow.pagos.obtener_ultimo_por_pedido(pedido_id)
                except (ValueError, TypeError):
                    pass

            if not pago:
                return {"status": "ignored", "reason": "Pago no encontrado en BD local"}

            if pago.estado != _ESTADO_PENDIENTE:
                return {"status": "already_processed", "estado": pago.estado}

            pago.mp_payment_id = int(pago_mp_id)
            pago.mp_status = estado_mp
            pago.mp_status_detail = mp_info.get("mp_status_detail")
            pago.mp_merchant_order_id = mp_info.get("mp_merchant_order_id")
            pago.estado = nuevo_estado
            pago.updated_at = datetime.now(timezone.utc)
            uow.pagos.actualizar(pago)

            if nuevo_estado == _ESTADO_APROBADO:
                _confirmar_pedido_en_uow(uow, pago.pedido_id)

        # Emitir WS en try/except propio: un fallo aquí nunca debe cambiar la
        # respuesta a MP (evita reintentos del webhook y doble procesamiento).
        if nuevo_estado == _ESTADO_APROBADO:
            try:
                from app.core.websocket_manager import emitir_evento_pedido
                await emitir_evento_pedido(
                    pedido_id=pago.pedido_id,
                    event="pago_confirmado",
                    estado_anterior="PENDIENTE",
                    estado_nuevo="CONFIRMADO",
                    usuario_id=None,
                )
            except Exception:
                logger.warning("Error emitiendo WS en webhook MP — ignorado")

        return {"status": "ok"}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error procesando webhook MP")
        return {"status": "error", "reason": str(e)}


def confirmar_pago(datos: ConfirmarPagoRequest, usuario_id: int) -> PagoEstadoResponse:
    with UnidadDeTrabajo() as uow:
        pedido = uow.pedidos.obtener_por_id(datos.pedido_id)
        if not pedido:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
        if pedido.usuario_id != usuario_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a este pedido")

        pago_local = uow.pagos.obtener_ultimo_por_pedido(datos.pedido_id)
        resolved_id = datos.payment_id or (pago_local.mp_payment_id if pago_local else None)

        if not resolved_id:
            return PagoEstadoResponse(
                estado=pago_local.estado if pago_local else None,
                pedido_id=datos.pedido_id,
            )

        try:
            mp_info = _consultar_pago_mp(resolved_id)
        except RuntimeError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

        nuevo_estado = _mapear_estado_mp(mp_info.get("mp_status")) or _ESTADO_PENDIENTE

        pago = uow.pagos.obtener_por_mp_payment_id(resolved_id)
        if not pago:
            pago = uow.pagos.obtener_ultimo_por_pedido(datos.pedido_id)

        if pago:
            pago.mp_payment_id = resolved_id
            pago.mp_status = mp_info.get("mp_status")
            pago.mp_status_detail = mp_info.get("mp_status_detail")
            pago.mp_merchant_order_id = mp_info.get("mp_merchant_order_id")
            pago.estado = nuevo_estado
            pago.updated_at = datetime.now(timezone.utc)
            uow.pagos.actualizar(pago)

            if nuevo_estado == _ESTADO_APROBADO:
                _confirmar_pedido_en_uow(uow, datos.pedido_id)

        return PagoEstadoResponse(estado=nuevo_estado, pedido_id=datos.pedido_id)


async def confirmar_pago_y_notificar(datos: ConfirmarPagoRequest, usuario_id: int) -> PagoEstadoResponse:
    resultado = confirmar_pago(datos, usuario_id)
    if resultado.estado == _ESTADO_APROBADO:
        from app.core.websocket_manager import emitir_evento_pedido
        await emitir_evento_pedido(
            pedido_id=datos.pedido_id,
            event="pago_confirmado",
            estado_anterior="PENDIENTE",
            estado_nuevo="CONFIRMADO",
            usuario_id=usuario_id,
        )
    return resultado
