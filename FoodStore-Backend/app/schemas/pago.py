from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class CrearPagoRequest(BaseModel):
    pedido_id: int


class PagoPreferenciaResponse(BaseModel):
    pago_id: int
    preference_id: str
    init_point: Optional[str]
    public_key: Optional[str]


class ConfirmarPagoRequest(BaseModel):
    pedido_id: int
    payment_id: Optional[int] = None


class PagoEstadoResponse(BaseModel):
    estado: Optional[str]
    pedido_id: int


class PagoPublico(BaseModel):
    id: int
    pedido_id: int
    estado: str
    mp_payment_id: Optional[int]
    mp_status: Optional[str]
    mp_status_detail: Optional[str]
    transaction_amount: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}
