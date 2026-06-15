import client from '../api/client'
import type { PedidoPublico, PedidoCrear, HistorialEstadoPublico, MetricasResumen, PaginatedResponse } from '../types'

export const pedidosService = {
  crear: (d: PedidoCrear) => client.post<PedidoPublico>('/pedidos/', d).then(r => r.data),
  listar: (p?: { page?: number; size?: number }) =>
    client.get<PaginatedResponse<PedidoPublico>>('/pedidos/', { params: p }).then(r => r.data),
  detalle: (id: number) => client.get<PedidoPublico>(`/pedidos/${id}`).then(r => r.data),
  historial: (id: number) => client.get<HistorialEstadoPublico[]>(`/pedidos/${id}/historial`).then(r => r.data),
  cancelar: (id: number, motivo: string) =>
    client.delete<PedidoPublico>(`/pedidos/${id}`, { data: { motivo } }).then(r => r.data),
  // Admin / PEDIDOS
  listarAdmin: (p?: { page?: number; size?: number; estado?: string }) =>
    client.get<PaginatedResponse<PedidoPublico>>('/admin/pedidos/', { params: p }).then(r => r.data),
  detalleAdmin: (id: number) => client.get<PedidoPublico>(`/admin/pedidos/${id}`).then(r => r.data),
  avanzarEstado: (id: number, estado_hasta: string, motivo?: string) =>
    client.patch<PedidoPublico>(`/pedidos/${id}/estado`, { estado_hasta, motivo }).then(r => r.data),
  metricas: () => client.get<MetricasResumen>('/admin/metricas/resumen').then(r => r.data),
}
