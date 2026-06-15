import client from '../api/client'
import type { UsuarioPublico, LoginRequest, UsuarioCrear, Token, PaginatedResponse } from '../types'

export const authService = {
  login: (d: LoginRequest) => client.post<Token>('/auth/login', d).then(r => r.data),
  register: (d: UsuarioCrear) => client.post<UsuarioPublico>('/auth/register', d).then(r => r.data),
  logout: () => client.post('/auth/logout'),
  refresh: () => client.post('/auth/refresh'),
  me: () => client.get<UsuarioPublico>('/auth/me').then(r => r.data),

  // Admin
  listarUsuarios: (params?: { rol?: string; page?: number; size?: number }) =>
    client.get<PaginatedResponse<UsuarioPublico>>('/auth/admin/usuarios', { params }).then(r => r.data),
  detalleUsuario: (id: number) =>
    client.get<UsuarioPublico>(`/auth/admin/usuarios/${id}`).then(r => r.data),
  actualizarUsuario: (id: number, d: { activo?: boolean; roles?: string[] }) =>
    client.put<UsuarioPublico>(`/auth/admin/usuarios/${id}`, d).then(r => r.data),
  habilitarUsuario: (id: number) =>
    client.post<UsuarioPublico>(`/auth/admin/usuarios/${id}/habilitar`).then(r => r.data),
  deshabilitarUsuario: (id: number) =>
    client.post<UsuarioPublico>(`/auth/admin/usuarios/${id}/deshabilitar`).then(r => r.data),
  eliminarUsuario: (id: number) => client.delete(`/auth/admin/usuarios/${id}`),
  asignarRol: (id: number, rol: string) =>
    client.post<UsuarioPublico>(`/auth/admin/usuarios/${id}/roles/${rol}`).then(r => r.data),
  quitarRol: (id: number, rol: string) =>
    client.delete<UsuarioPublico>(`/auth/admin/usuarios/${id}/roles/${rol}`).then(r => r.data),
  listarRoles: () => client.get('/auth/admin/roles').then(r => r.data),
}
