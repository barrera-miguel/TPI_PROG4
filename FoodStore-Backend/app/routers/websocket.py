import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.core.deps import requerir_rol
from app.core.security import decodificar_token_acceso
from app.core.websocket_manager import manager
from app.uow.uow import UnidadDeTrabajo

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSockets"])


def _verificar_usuario(user_id: int):
    with UnidadDeTrabajo() as uow:
        usuario = uow.usuarios.obtener_por_id(user_id)
        if usuario is None or usuario.deleted_at is not None:
            return None
        return usuario


def _verificar_ownership(order_id: int, user_id: int) -> bool:
    with UnidadDeTrabajo() as uow:
        pedido = uow.pedidos.obtener_por_id(order_id)
        if pedido is None:
            return False
        return int(pedido.usuario_id) == int(user_id)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.cookies.get("access_token")
    if not token:
        token = websocket.query_params.get("token")

    if not token:
        await websocket.accept()
        await websocket.close(code=1008)
        return

    payload = decodificar_token_acceso(token)
    if payload is None:
        await websocket.accept()
        await websocket.close(code=1008)
        return

    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError):
        await websocket.accept()
        await websocket.close(code=1008)
        return

    roles: list[str] = payload.get("roles", [])

    usuario = await asyncio.to_thread(_verificar_usuario, user_id)
    if usuario is None:
        await websocket.accept()
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, roles=roles, user_id=user_id)

    try:
        await websocket.send_json({"event": "CONNECTED", "data": {"user_id": user_id, "roles": roles}})

        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "subscribe-order":
                order_id = data.get("order_id")
                if not order_id:
                    await websocket.send_json({"event": "ERROR", "data": {"msg": "order_id requerido"}})
                    continue

                is_staff = any(r in roles for r in ["ADMIN", "PEDIDOS"])
                if is_staff:
                    manager.join_order_room(websocket, order_id)
                    await websocket.send_json({"event": "SUBSCRIBED", "data": {"order_id": order_id}})
                else:
                    owns = await asyncio.to_thread(_verificar_ownership, order_id, user_id)
                    if not owns:
                        await websocket.send_json({
                            "event": "ERROR",
                            "data": {"msg": "Pedido no encontrado o sin acceso"},
                        })
                    else:
                        manager.join_order_room(websocket, order_id)
                        await websocket.send_json({"event": "SUBSCRIBED", "data": {"order_id": order_id}})

            elif action == "unsubscribe-order":
                order_id = data.get("order_id")
                if order_id:
                    manager.leave_order_room(websocket, order_id)
                    await websocket.send_json({"event": "UNSUBSCRIBED", "data": {"order_id": order_id}})
                else:
                    await websocket.send_json({"event": "ERROR", "data": {"msg": "order_id requerido"}})

            else:
                await websocket.send_json({
                    "event": "ERROR",
                    "data": {"msg": f"Acción desconocida: {action!r}"},
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        logger.exception("Error en WebSocket (user_id=%s)", user_id)
        manager.disconnect(websocket)


@router.get("/ws/rooms")
async def rooms_info(
    _admin=Depends(requerir_rol(["ADMIN"])),
):
    return manager.get_rooms_info()
