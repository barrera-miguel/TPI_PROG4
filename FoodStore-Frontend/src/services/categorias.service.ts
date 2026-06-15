import client from '../api/client'
import type { CategoriaRead, CategoriaNodo, CategoriaCreate, CategoriaUpdate, PaginatedResponse } from '../types'

export const categoriasService = {
  arbol: () => client.get<CategoriaNodo[]>('/categorias/arbol').then(r => r.data),
  listar: (p?: { page?: number; size?: number; nombre?: string; parent_id?: number }) =>
    client.get<PaginatedResponse<CategoriaRead>>('/categorias/', { params: p }).then(r => r.data),
  detalle: (id: number) => client.get<CategoriaRead>(`/categorias/${id}`).then(r => r.data),
  crear: (d: CategoriaCreate) => client.post<CategoriaRead>('/categorias/', d).then(r => r.data),
  actualizar: (id: number, d: CategoriaUpdate) => client.put<CategoriaRead>(`/categorias/${id}`, d).then(r => r.data),
  actualizarImagen: (id: number, imagen_url: string | null) =>
    client.patch<CategoriaRead>(`/categorias/${id}/imagen`, { imagen_url }).then(r => r.data),
  eliminar: (id: number) => client.delete(`/categorias/${id}`),
}
