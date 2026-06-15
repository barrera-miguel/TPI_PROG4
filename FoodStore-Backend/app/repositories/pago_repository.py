from typing import List, Optional

from sqlmodel import Session, select

from app.models.pago import Pago
from app.repositories.base import BaseRepository


class PagoRepositorio(BaseRepository[Pago]):
    def __init__(self, sesion: Session):
        super().__init__(Pago, sesion)

    def obtener_por_pedido(self, pedido_id: int) -> List[Pago]:
        consulta = (
            select(Pago)
            .where(Pago.pedido_id == pedido_id)
            .order_by(Pago.created_at.desc())
        )
        return list(self.sesion.exec(consulta).all())

    def obtener_ultimo_por_pedido(self, pedido_id: int) -> Optional[Pago]:
        consulta = (
            select(Pago)
            .where(Pago.pedido_id == pedido_id)
            .order_by(Pago.created_at.desc())
            .limit(1)
        )
        return self.sesion.exec(consulta).first()

    def obtener_por_idempotency_key(self, key: str) -> Optional[Pago]:
        return self.sesion.exec(
            select(Pago).where(Pago.idempotency_key == key)
        ).first()

    def obtener_por_mp_payment_id(self, mp_id: int) -> Optional[Pago]:
        return self.sesion.exec(
            select(Pago).where(Pago.mp_payment_id == mp_id)
        ).first()

    def obtener_por_mp_merchant_order_id(self, order_id: int) -> Optional[Pago]:
        return self.sesion.exec(
            select(Pago).where(Pago.mp_merchant_order_id == order_id)
        ).first()

    def obtener_por_external_reference(self, ref: str) -> Optional[Pago]:
        return self.sesion.exec(
            select(Pago).where(Pago.external_reference == ref)
        ).first()

    def actualizar(self, pago: Pago) -> Pago:
        self.sesion.add(pago)
        self.sesion.flush()
        self.sesion.refresh(pago)
        return pago
