from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.sql import func
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .pedido import Pedido


class Pago(SQLModel, table=True):
    __tablename__ = "pago"
    __table_args__ = (
        UniqueConstraint("mp_payment_id", name="uq_pago_mp_payment_id"),
        UniqueConstraint("external_reference", name="uq_pago_external_reference"),
        UniqueConstraint("idempotency_key", name="uq_pago_idempotency_key"),
    )

    id: Optional[int] = Field(
        default=None,
        sa_column=Column(BigInteger(), primary_key=True, autoincrement=True),
    )
    pedido_id: int = Field(
        sa_column=Column(BigInteger(), ForeignKey("pedido.id", ondelete="CASCADE"), nullable=False)
    )

    # Estado local simplificado
    estado: str = Field(
        sa_column=Column(String(20), nullable=False, server_default="pendiente")
    )

    # Datos de la preferencia (etapa ANTES de pagar)
    mp_preference_id: Optional[str] = Field(
        default=None, sa_column=Column(String(255), nullable=True)
    )
    mp_init_point: Optional[str] = Field(
        default=None, sa_column=Column(String(500), nullable=True)
    )

    # Datos del pago real (llegan por webhook DESPUÉS de pagar)
    mp_payment_id: Optional[int] = Field(
        default=None, sa_column=Column(BigInteger(), nullable=True)
    )
    mp_merchant_order_id: Optional[int] = Field(
        default=None, sa_column=Column(BigInteger(), nullable=True)
    )
    mp_status: Optional[str] = Field(
        default=None, sa_column=Column(String(30), nullable=True)
    )
    mp_status_detail: Optional[str] = Field(
        default=None, sa_column=Column(String(100), nullable=True)
    )

    # Campos del UML
    external_reference: str = Field(
        sa_column=Column(String(100), nullable=False)
    )
    idempotency_key: str = Field(
        sa_column=Column(String(100), nullable=False)
    )
    transaction_amount: Decimal = Field(
        sa_column=Column(Numeric(10, 2), nullable=False)
    )
    payment_method_id: Optional[str] = Field(
        default=None, sa_column=Column(String(50), nullable=True)
    )

    # Timestamps
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=False, server_default=func.now()),
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True, onupdate=func.now()),
    )

    pedido: Optional["Pedido"] = Relationship(back_populates="pago")
