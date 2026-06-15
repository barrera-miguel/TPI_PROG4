import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import WebSocket

_SEND_TIMEOUT = 5.0  # segundos; evita que un socket zombi bloquee el broadcast

logger = logging.getLogger(__name__)

EVENTOS_WS: dict[str, str] = {
    "PENDIENTE":      "PEDIDO_NUEVO",
    "CONFIRMADO":     "PEDIDO_CONFIRMADO",
    "EN_PREPARACION": "PEDIDO_EN_PREPARACION",
    "ENTREGADO":      "PEDIDO_ENTREGADO",
    "CANCELADO":      "PEDIDO_CANCELADO",
}

ROLES_POR_ESTADO: dict[str, list[str]] = {
    "PENDIENTE":      ["PEDIDOS", "ADMIN"],
    "CONFIRMADO":     ["PEDIDOS", "ADMIN"],
    "EN_PREPARACION": ["PEDIDOS", "ADMIN"],
    "ENTREGADO":      ["PEDIDOS", "ADMIN"],
    "CANCELADO":      ["PEDIDOS", "ADMIN"],
}


class ConnectionManager:
    def __init__(self) -> None:
        self.rooms: dict[str, set[WebSocket]] = {}
        self.socket_rooms: dict[WebSocket, set[str]] = {}

    async def connect(self, websocket: WebSocket, roles: list[str], user_id: int) -> None:
        await websocket.accept()
        self.socket_rooms[websocket] = set()
        for role in roles:
            self._join_room(websocket, f"role:{role}")

    def disconnect(self, websocket: WebSocket) -> None:
        rooms = self.socket_rooms.pop(websocket, set())
        for room_key in rooms:
            room = self.rooms.get(room_key)
            if room:
                room.discard(websocket)
                if not room:
                    del self.rooms[room_key]

    def join_order_room(self, websocket: WebSocket, order_id: int) -> None:
        self._join_room(websocket, f"order:{order_id}")

    def leave_order_room(self, websocket: WebSocket, order_id: int) -> None:
        room_key = f"order:{order_id}"
        if websocket in self.socket_rooms:
            self.socket_rooms[websocket].discard(room_key)
        room = self.rooms.get(room_key)
        if room:
            room.discard(websocket)
            if not room:
                del self.rooms[room_key]

    def _join_room(self, websocket: WebSocket, room_key: str) -> None:
        if room_key not in self.rooms:
            self.rooms[room_key] = set()
        self.rooms[room_key].add(websocket)
        if websocket in self.socket_rooms:
            self.socket_rooms[websocket].add(room_key)

    async def _send_safe(self, ws: WebSocket, payload: dict) -> bool:
        """Envía payload con timeout. Retorna False si el socket está muerto."""
        try:
            await asyncio.wait_for(ws.send_json(payload), timeout=_SEND_TIMEOUT)
            return True
        except Exception:
            return False

    async def broadcast_to_roles(self, roles: list[str], event_type: str, data: Any) -> None:
        payload = {"event": event_type, "data": data}
        sent_to: set[WebSocket] = set()
        dead: list[WebSocket] = []

        for role in roles:
            for ws in list(self.rooms.get(f"role:{role}", set())):
                if ws in sent_to:
                    continue
                if await self._send_safe(ws, payload):
                    sent_to.add(ws)
                else:
                    dead.append(ws)

        for ws in dead:
            self.disconnect(ws)

    async def broadcast_to_order(self, order_id: int, event_type: str, data: Any) -> None:
        payload = {"event": event_type, "data": data}
        dead: list[WebSocket] = []

        for ws in list(self.rooms.get(f"order:{order_id}", set())):
            if not await self._send_safe(ws, payload):
                dead.append(ws)

        for ws in dead:
            self.disconnect(ws)

    async def _broadcast_raw_to_roles(self, roles: list[str], payload: dict) -> None:
        sent_to: set[WebSocket] = set()
        dead: list[WebSocket] = []

        for role in roles:
            for ws in list(self.rooms.get(f"role:{role}", set())):
                if ws in sent_to:
                    continue
                if await self._send_safe(ws, payload):
                    sent_to.add(ws)
                else:
                    dead.append(ws)

        for ws in dead:
            self.disconnect(ws)

    async def _broadcast_raw_to_order(self, order_id: int, payload: dict) -> None:
        dead: list[WebSocket] = []

        for ws in list(self.rooms.get(f"order:{order_id}", set())):
            if not await self._send_safe(ws, payload):
                dead.append(ws)

        for ws in dead:
            self.disconnect(ws)

    def get_rooms_info(self) -> dict:
        return {
            "total": len(self.rooms),
            "rooms": {key: len(sockets) for key, sockets in self.rooms.items()},
        }


manager = ConnectionManager()


async def emitir_evento_pedido(
    pedido_id: int,
    event: str,
    estado_anterior: Optional[str],
    estado_nuevo: str,
    usuario_id: Optional[int],
    motivo: Optional[str] = None,
) -> None:
    payload = {
        "event": event,
        "pedido_id": pedido_id,
        "estado_anterior": estado_anterior,
        "estado_nuevo": estado_nuevo,
        "usuario_id": usuario_id,
        "motivo": motivo,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    await manager._broadcast_raw_to_order(pedido_id, payload)
    roles = ROLES_POR_ESTADO.get(estado_nuevo, ["PEDIDOS", "ADMIN"])
    await manager._broadcast_raw_to_roles(roles, payload)
