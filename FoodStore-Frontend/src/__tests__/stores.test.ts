import { act } from 'react'
import { useWSStore } from '../stores/wsStore'
import { useOrderStatusStore } from '../stores/orderStatusStore'
import { useAdminOrdersStore } from '../stores/adminOrdersStore'
import { useAuthStore } from '../stores/authStore'
import type { WSEvent } from '../types'

const sampleEvent: WSEvent = {
  event: 'PEDIDO_CONFIRMADO',
  pedido_id: 42,
  estado_anterior: 'PENDIENTE',
  estado_nuevo: 'CONFIRMADO',
  usuario_id: 1,
  motivo: null,
  timestamp: '2026-06-13T20:00:00Z',
}

describe('wsStore', () => {
  beforeEach(() => {
    act(() => {
      useWSStore.setState({ connectionStatus: 'disconnected', lastEvent: null })
    })
  })

  it('starts disconnected', () => {
    expect(useWSStore.getState().connectionStatus).toBe('disconnected')
  })

  it('setConnecting changes status', () => {
    act(() => useWSStore.getState().setConnecting())
    expect(useWSStore.getState().connectionStatus).toBe('connecting')
  })

  it('setConnected changes status', () => {
    act(() => useWSStore.getState().setConnected())
    expect(useWSStore.getState().connectionStatus).toBe('connected')
  })

  it('setDisconnected changes status', () => {
    act(() => useWSStore.getState().setConnected())
    act(() => useWSStore.getState().setDisconnected())
    expect(useWSStore.getState().connectionStatus).toBe('disconnected')
  })

  it('setLastEvent stores event', () => {
    act(() => useWSStore.getState().setLastEvent(sampleEvent))
    expect(useWSStore.getState().lastEvent).toEqual(sampleEvent)
  })

  it('lastEvent starts as null', () => {
    expect(useWSStore.getState().lastEvent).toBeNull()
  })
})

describe('orderStatusStore', () => {
  beforeEach(() => {
    act(() => {
      // Limpiar orders del estado
      const state = useOrderStatusStore.getState()
      Object.keys(state.orders).forEach(id => state.removeOrder(Number(id)))
    })
  })

  it('starts with empty orders', () => {
    expect(useOrderStatusStore.getState().orders).toEqual({})
  })

  it('updateOrder adds/updates order state', () => {
    act(() => useOrderStatusStore.getState().updateOrder(42, 'ENTREGADO', '2026-06-13T20:00:00Z'))
    expect(useOrderStatusStore.getState().orders[42]).toEqual({
      estado: 'ENTREGADO',
      timestamp: '2026-06-13T20:00:00Z',
    })
  })

  it('updateOrder overwrites existing order', () => {
    act(() => useOrderStatusStore.getState().updateOrder(42, 'CONFIRMADO', 't1'))
    act(() => useOrderStatusStore.getState().updateOrder(42, 'ENTREGADO', 't2'))
    expect(useOrderStatusStore.getState().orders[42]).toEqual({
      estado: 'ENTREGADO',
      timestamp: 't2',
    })
  })

  it('removeOrder deletes order from map', () => {
    act(() => useOrderStatusStore.getState().updateOrder(42, 'CONFIRMADO', 't1'))
    act(() => useOrderStatusStore.getState().updateOrder(99, 'PENDIENTE', 't0'))
    act(() => useOrderStatusStore.getState().removeOrder(42))
    expect(useOrderStatusStore.getState().orders[42]).toBeUndefined()
    expect(useOrderStatusStore.getState().orders[99]).toBeDefined()
  })

  it('tracks multiple orders independently', () => {
    act(() => useOrderStatusStore.getState().updateOrder(1, 'PENDIENTE', 't1'))
    act(() => useOrderStatusStore.getState().updateOrder(2, 'CONFIRMADO', 't2'))
    act(() => useOrderStatusStore.getState().updateOrder(3, 'ENTREGADO', 't3'))
    const { orders } = useOrderStatusStore.getState()
    expect(Object.keys(orders)).toHaveLength(3)
    expect(orders[1].estado).toBe('PENDIENTE')
    expect(orders[2].estado).toBe('CONFIRMADO')
    expect(orders[3].estado).toBe('ENTREGADO')
  })
})

describe('adminOrdersStore', () => {
  beforeEach(() => {
    act(() => useAdminOrdersStore.getState().clear())
  })

  it('starts with empty state', () => {
    expect(useAdminOrdersStore.getState().lastUpdate).toBeNull()
    expect(useAdminOrdersStore.getState().updatedOrderIds).toEqual([])
  })

  it('addUpdatedOrder prepends order id', () => {
    act(() => useAdminOrdersStore.getState().addUpdatedOrder(42, 't1'))
    expect(useAdminOrdersStore.getState().updatedOrderIds).toContain(42)
  })

  it('addUpdatedOrder deduplicates IDs', () => {
    act(() => useAdminOrdersStore.getState().addUpdatedOrder(42, 't1'))
    act(() => useAdminOrdersStore.getState().addUpdatedOrder(99, 't2'))
    act(() => useAdminOrdersStore.getState().addUpdatedOrder(42, 't3'))
    const ids = useAdminOrdersStore.getState().updatedOrderIds
    expect(ids.filter(id => id === 42)).toHaveLength(1)
  })

  it('addUpdatedOrder keeps max 20 items', () => {
    for (let i = 0; i < 25; i++) {
      act(() => useAdminOrdersStore.getState().addUpdatedOrder(i, `t${i}`))
    }
    expect(useAdminOrdersStore.getState().updatedOrderIds).toHaveLength(20)
  })

  it('setLastUpdate updates timestamp', () => {
    act(() => useAdminOrdersStore.getState().setLastUpdate('2026-06-13T20:00:00Z'))
    expect(useAdminOrdersStore.getState().lastUpdate).toBe('2026-06-13T20:00:00Z')
  })

  it('clear resets state', () => {
    act(() => useAdminOrdersStore.getState().addUpdatedOrder(42, 't1'))
    act(() => useAdminOrdersStore.getState().clear())
    expect(useAdminOrdersStore.getState().lastUpdate).toBeNull()
    expect(useAdminOrdersStore.getState().updatedOrderIds).toEqual([])
  })
})

describe('authStore', () => {
  beforeEach(() => {
    act(() => useAuthStore.getState().setUsuario(null))
  })

  it('starts with null usuario', () => {
    expect(useAuthStore.getState().usuario).toBeNull()
  })

  it('setUsuario updates user', () => {
    const user = { id: 1, nombre: 'Admin', apellido: 'Sistema', email: 'admin@test.com', roles: ['ADMIN'] }
    act(() => useAuthStore.getState().setUsuario(user))
    expect(useAuthStore.getState().usuario?.nombre).toBe('Admin')
  })

  it('isAdmin returns true for ADMIN role', () => {
    const user = { id: 1, nombre: 'A', apellido: 'B', email: 'a@b.com', roles: ['ADMIN'] }
    act(() => useAuthStore.getState().setUsuario(user))
    expect(useAuthStore.getState().isAdmin()).toBe(true)
  })

  it('isAdmin returns false for CLIENT role', () => {
    const user = { id: 2, nombre: 'C', apellido: 'D', email: 'c@d.com', roles: ['CLIENT'] }
    act(() => useAuthStore.getState().setUsuario(user))
    expect(useAuthStore.getState().isAdmin()).toBe(false)
  })

  it('isPedidos returns true for PEDIDOS role', () => {
    const user = { id: 3, nombre: 'E', apellido: 'F', email: 'e@f.com', roles: ['PEDIDOS'] }
    act(() => useAuthStore.getState().setUsuario(user))
    expect(useAuthStore.getState().isPedidos()).toBe(true)
  })

  it('isPedidos returns true for ADMIN (inherits PEDIDOS access)', () => {
    const user = { id: 1, nombre: 'A', apellido: 'B', email: 'a@b.com', roles: ['ADMIN'] }
    act(() => useAuthStore.getState().setUsuario(user))
    expect(useAuthStore.getState().isPedidos()).toBe(true)
  })

  it('isStock returns true for STOCK role', () => {
    const user = { id: 4, nombre: 'G', apellido: 'H', email: 'g@h.com', roles: ['STOCK'] }
    act(() => useAuthStore.getState().setUsuario(user))
    expect(useAuthStore.getState().isStock()).toBe(true)
  })

  it('hasRole checks array of roles', () => {
    const user = { id: 5, nombre: 'I', apellido: 'J', email: 'i@j.com', roles: ['CLIENT'] }
    act(() => useAuthStore.getState().setUsuario(user))
    expect(useAuthStore.getState().hasRole(['ADMIN', 'CLIENT'])).toBe(true)
  })

  it('hasRole returns false for roles user does not have', () => {
    const user = { id: 6, nombre: 'K', apellido: 'L', email: 'k@l.com', roles: ['CLIENT'] }
    act(() => useAuthStore.getState().setUsuario(user))
    expect(useAuthStore.getState().hasRole('ADMIN')).toBe(false)
  })

  it('hasRole returns false when no user', () => {
    expect(useAuthStore.getState().hasRole('ADMIN')).toBe(false)
  })
})
