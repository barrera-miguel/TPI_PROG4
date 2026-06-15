import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProductoRead } from '../types'

export interface CartItem {
  producto: ProductoRead
  cantidad: number
  ingredientesRemovidos: number[]
}

interface CartState {
  items: CartItem[]
  agregar: (producto: ProductoRead, cantidad?: number) => boolean
  quitar: (producto_id: number) => void
  cambiarCantidad: (producto_id: number, cantidad: number) => void
  toggleIngrediente: (producto_id: number, ing_id: number) => void
  vaciar: () => void
  total: () => number
  cantidadTotal: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      agregar: (producto, cantidad = 1) => {
        if (cantidad <= 0) return false
        if (!producto.disponible) return false
        const stock = producto.stock_calculado
        if (stock != null && stock <= 0) return false
        let added = false
        set(s => {
          const ex = s.items.find(i => i.producto.id === producto.id &&
            JSON.stringify(i.ingredientesRemovidos.sort()) === '[]')
          if (ex) {
            const nueva = ex.cantidad + cantidad
            if (stock != null && nueva > stock) return s
            added = true
            return { items: s.items.map(i => i.producto.id === producto.id ? { ...i, cantidad: nueva } : i) }
          }
          if (stock != null && cantidad > stock) return s
          added = true
          return { items: [...s.items, { producto, cantidad, ingredientesRemovidos: [] }] }
        })
        return added
      },
      quitar: (pid) => set(s => ({ items: s.items.filter(i => i.producto.id !== pid) })),
      cambiarCantidad: (pid, cantidad) => set(s => {
        const item = s.items.find(i => i.producto.id === pid)
        if (!item) return s
        if (cantidad <= 0) return { items: s.items.filter(i => i.producto.id !== pid) }
        const stock = item.producto.stock_calculado
        if (stock != null && cantidad > stock) return s
        return { items: s.items.map(i => i.producto.id === pid ? { ...i, cantidad } : i) }
      }),
      toggleIngrediente: (pid, iid) => set(s => ({
        items: s.items.map(i => i.producto.id === pid ? {
          ...i,
          ingredientesRemovidos: i.ingredientesRemovidos.includes(iid)
            ? i.ingredientesRemovidos.filter(x => x !== iid)
            : [...i.ingredientesRemovidos, iid]
        } : i)
      })),
      vaciar: () => set({ items: [] }),
      total: () => get().items.reduce((acc, i) => acc + Number(i.producto.precio_venta) * i.cantidad, 0),
      cantidadTotal: () => get().items.reduce((acc, i) => acc + i.cantidad, 0),
    }),
    { name: 'foodstore-cart' }
  )
)
