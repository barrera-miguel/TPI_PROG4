import { create } from 'zustand'

interface AdminOrdersState {
  lastUpdate: string | null
  updatedOrderIds: number[]
  setLastUpdate: (timestamp: string) => void
  addUpdatedOrder: (pedidoId: number, timestamp: string) => void
  clear: () => void
}

export const useAdminOrdersStore = create<AdminOrdersState>((set) => ({
  lastUpdate: null,
  updatedOrderIds: [],
  setLastUpdate: (lastUpdate) => set({ lastUpdate }),
  addUpdatedOrder: (pedidoId, timestamp) =>
    set((s) => ({
      lastUpdate: timestamp,
      updatedOrderIds: [pedidoId, ...s.updatedOrderIds.filter((id) => id !== pedidoId)].slice(0, 20),
    })),
  clear: () => set({ lastUpdate: null, updatedOrderIds: [] }),
}))
