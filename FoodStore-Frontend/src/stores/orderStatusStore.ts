import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OrderInfo {
  estado: string
  timestamp: string
}

interface OrderStatusState {
  orders: Record<number, OrderInfo>
  updateOrder: (pedidoId: number, estado: string, timestamp: string) => void
  removeOrder: (pedidoId: number) => void
}

export const useOrderStatusStore = create<OrderStatusState>()(
  persist(
    (set) => ({
      orders: {},
      updateOrder: (pedidoId, estado, timestamp) =>
        set((s) => ({ orders: { ...s.orders, [pedidoId]: { estado, timestamp } } })),
      removeOrder: (pedidoId) =>
        set((s) => {
          const { [pedidoId]: _, ...rest } = s.orders
          return { orders: rest }
        }),
    }),
    { name: 'foodstore-order-status' }
  )
)
