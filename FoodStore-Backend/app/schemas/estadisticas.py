from datetime import date
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class VentasPeriodoItem(BaseModel):
    periodo: str
    total_ventas: Decimal
    cantidad_pedidos: int


class ProductoTopItem(BaseModel):
    producto_id: int
    nombre: str
    ingresos: Decimal
    cantidad_vendida: int


class PedidosEstadoItem(BaseModel):
    estado_codigo: str
    cantidad: int


class IngresosFormaPagoItem(BaseModel):
    forma_pago_codigo: str
    total: Decimal
    cantidad: int


class ResumenResponse(BaseModel):
    ventas_hoy: Decimal
    ticket_promedio: Decimal
    pedidos_activos: int
    total_pedidos: int
    facturacion_total: Decimal
    mes_actual: Decimal
