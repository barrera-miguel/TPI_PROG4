import client from '../api/client'
import type { PagoPublico, PagoPreferenciaResponse } from '../types'

export const pagosService = {
  obtener: (pedido_id: number) => client.get<PagoPublico>(`/pagos/${pedido_id}`).then(r => r.data),
  crearPreferencia: (pedido_id: number) =>
    client.post<PagoPreferenciaResponse>('/pagos/create-preference', { pedido_id }).then(r => r.data),
  confirmar: (pedido_id: number, payment_id?: number) =>
    client.post('/pagos/confirm', { pedido_id, payment_id }).then(r => r.data),
}
