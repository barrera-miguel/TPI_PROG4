import client from '../api/client'
import type { IngredienteRead, IngredienteCreate, IngredienteUpdate, StockIngredienteUpdate, PaginatedResponse } from '../types'

export const ingredientesService = {
  listar: (p?: { page?: number; size?: number; nombre?: string }) =>
    client.get<PaginatedResponse<IngredienteRead>>('/ingredientes/', { params: p }).then(r => r.data),
  detalle: (id: number) => client.get<IngredienteRead>(`/ingredientes/${id}`).then(r => r.data),
  crear: (d: IngredienteCreate) => client.post<IngredienteRead>('/ingredientes/', d).then(r => r.data),
  actualizar: (id: number, d: IngredienteUpdate) => client.patch<IngredienteRead>(`/ingredientes/${id}`, d).then(r => r.data),
  actualizarStock: (id: number, d: StockIngredienteUpdate) =>
    client.patch<IngredienteRead>(`/ingredientes/${id}/stock`, d).then(r => r.data),
  eliminar: (id: number) => client.delete(`/ingredientes/${id}`),
}
