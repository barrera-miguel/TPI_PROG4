import client from '../api/client'
import type { DireccionRead, DireccionCrear, DireccionActualizar } from '../types'

export const direccionesService = {
  listar: () => client.get<DireccionRead[]>('/direcciones/').then(r => r.data),
  detalle: (id: number) => client.get<DireccionRead>(`/direcciones/${id}`).then(r => r.data),
  crear: (d: DireccionCrear) => client.post<DireccionRead>('/direcciones/', d).then(r => r.data),
  actualizar: (id: number, d: DireccionActualizar) => client.patch<DireccionRead>(`/direcciones/${id}`, d).then(r => r.data),
  eliminar: (id: number) => client.delete(`/direcciones/${id}`),
  marcarPrincipal: (id: number) => client.patch<DireccionRead>(`/direcciones/${id}/principal`).then(r => r.data),
}
