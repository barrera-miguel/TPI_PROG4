import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UsuarioPublico } from '../types'

interface AuthState {
  usuario: UsuarioPublico | null
  isLoading: boolean
  setUsuario: (u: UsuarioPublico | null) => void
  setLoading: (v: boolean) => void
  hasRole: (role: string | string[]) => boolean
  isAdmin: () => boolean
  isPedidos: () => boolean
  isStock: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      usuario: null,
      isLoading: true,
      setUsuario: (usuario) => set({ usuario }),
      setLoading: (isLoading) => set({ isLoading }),
      hasRole: (role) => {
        const u = get().usuario
        if (!u) return false
        const roles = Array.isArray(role) ? role : [role]
        return roles.some((r) => u.roles.includes(r))
      },
      isAdmin: () => get().hasRole('ADMIN'),
      isPedidos: () => get().hasRole(['ADMIN', 'PEDIDOS']),
      isStock: () => get().hasRole(['ADMIN', 'STOCK']),
    }),
    {
      name: 'foodstore-auth',
      partialize: (state) => ({ usuario: state.usuario }),
    }
  )
)
