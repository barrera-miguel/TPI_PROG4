import client from '../api/client'
import type { UnidadMedidaPublica, UnidadMedidaCrear, UnidadMedidaActualizar, PaginatedResponse } from '../types'

export const unidadesService = {
  listar: (p?: { page?: number; size?: number; tipo?: string }) =>
    client.get<PaginatedResponse<UnidadMedidaPublica>>('/unidades-medida/', { params: p }).then(r => r.data),
  detalle: (id: number) => client.get<UnidadMedidaPublica>(`/unidades-medida/${id}`).then(r => r.data),
  crear: (d: UnidadMedidaCrear) => client.post<UnidadMedidaPublica>('/unidades-medida/', d).then(r => r.data),
  actualizar: (id: number, d: UnidadMedidaActualizar) => client.patch<UnidadMedidaPublica>(`/unidades-medida/${id}`, d).then(r => r.data),
  eliminar: (id: number) => client.delete(`/unidades-medida/${id}`),
}
