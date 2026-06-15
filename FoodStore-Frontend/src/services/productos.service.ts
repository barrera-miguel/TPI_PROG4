import client from '../api/client'
import type { ProductoRead, ProductoCreate, ProductoUpdate, IngredienteResumen, PaginatedResponse } from '../types'

export const productosService = {
  listar: (p?: { page?: number; size?: number; nombre?: string; disponible?: boolean; categoria_id?: number }) =>
    client.get<PaginatedResponse<ProductoRead>>('/productos/', { params: p }).then(r => r.data),
  detalle: (id: number) => client.get<ProductoRead>(`/productos/${id}`).then(r => r.data),
  crear: (d: ProductoCreate) => client.post<ProductoRead>('/productos/', d).then(r => r.data),
  actualizar: (id: number, d: ProductoUpdate) => client.put<ProductoRead>(`/productos/${id}`, d).then(r => r.data),
  actualizarStock: (id: number, d: { stock_directo: number; precio_base?: string }) =>
    client.patch<ProductoRead>(`/productos/${id}/stock`, d).then(r => r.data),
  actualizarImagenes: (id: number, imagenes_url: string[]) =>
    client.patch<ProductoRead>(`/productos/${id}/imagenes`, { imagenes_url }).then(r => r.data),
  actualizarDisponibilidad: (id: number, disponible: boolean) =>
    client.patch<ProductoRead>(`/productos/${id}/disponibilidad`, { disponible }).then(r => r.data),
  eliminar: (id: number) => client.delete(`/productos/${id}`),
  listarIngredientes: (id: number) =>
    client.get<IngredienteResumen[]>(`/productos/${id}/ingredientes`).then(r => r.data),
  agregarCategoria: (id: number, d: { categoria_id: number; es_principal?: boolean }) =>
    client.post<ProductoRead>(`/productos/${id}/categorias`, d).then(r => r.data),
  quitarCategoria: (id: number, cat_id: number) => client.delete(`/productos/${id}/categorias/${cat_id}`),
  agregarIngrediente: (id: number, d: { ingrediente_id: number; cantidad: string; unidad_medida_id: number; es_removible?: boolean }) =>
    client.post<ProductoRead>(`/productos/${id}/ingredientes`, d).then(r => r.data),
  quitarIngrediente: (id: number, ing_id: number) => client.delete(`/productos/${id}/ingredientes/${ing_id}`),
}
