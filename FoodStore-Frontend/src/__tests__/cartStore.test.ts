import { act } from 'react'
import { useCartStore } from '../stores/cartStore'

const p1 = { id: 1, nombre: 'P1', precio_venta: '100', stock_calculado: 5, precio_costo_calculado: '50', disponible: true, tiene_ingredientes: false, margen_ganancia: '50', categorias: [], ingredientes: [] }
const p2 = { id: 2, nombre: 'P2', precio_venta: '200', stock_calculado: 3, precio_costo_calculado: '100', disponible: true, tiene_ingredientes: false, margen_ganancia: '50', categorias: [], ingredientes: [] }

describe('cartStore', () => {
  beforeEach(() => {
    act(() => useCartStore.getState().vaciar())
  })

  it('starts empty', () => {
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('agregar adds item with default cantidad 1', () => {
    act(() => useCartStore.getState().agregar(p1))
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].cantidad).toBe(1)
  })

  it('agregar with cantidad parameter', () => {
    act(() => useCartStore.getState().agregar(p1, 3))
    expect(useCartStore.getState().items[0].cantidad).toBe(3)
  })

  it('agregar merges quantity for same product', () => {
    act(() => useCartStore.getState().agregar(p1, 2))
    act(() => useCartStore.getState().agregar(p1, 3))
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].cantidad).toBe(5)
  })

  it('quitar removes item', () => {
    act(() => useCartStore.getState().agregar(p1))
    act(() => useCartStore.getState().quitar(1))
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('cambiarCantidad updates quantity', () => {
    act(() => useCartStore.getState().agregar(p1, 3))
    act(() => useCartStore.getState().cambiarCantidad(1, 5))
    expect(useCartStore.getState().items[0].cantidad).toBe(5)
  })

  it('cambiarCantidad removes item when 0 or less', () => {
    act(() => useCartStore.getState().agregar(p1, 2))
    act(() => useCartStore.getState().cambiarCantidad(1, 0))
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('toggleIngrediente adds and removes ingredient', () => {
    const pConIngs = { ...p1, id: 3, ingredientes: [{ id: 1, nombre: 'Cebolla', cantidad: '10', simbolo_unidad: 'g', es_removible: true, es_alergeno: false }] }
    act(() => useCartStore.getState().agregar(pConIngs, 1))
    // Toggle: remover
    act(() => useCartStore.getState().toggleIngrediente(3, 1))
    expect(useCartStore.getState().items[0].ingredientesRemovidos).toContain(1)
    // Toggle: restaurar
    act(() => useCartStore.getState().toggleIngrediente(3, 1))
    expect(useCartStore.getState().items[0].ingredientesRemovidos).not.toContain(1)
  })

  it('vaciar clears all items', () => {
    act(() => {
      useCartStore.getState().agregar(p1, 2)
      useCartStore.getState().agregar(p2, 3)
    })
    act(() => useCartStore.getState().vaciar())
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('total calculates sum of price * cantidad', () => {
    act(() => {
      useCartStore.getState().agregar(p1, 2)
      useCartStore.getState().agregar(p2, 3)
    })
    // 100*2 + 200*3 = 800
    expect(useCartStore.getState().total()).toBe(800)
  })

  it('cantidadTotal sums all quantities', () => {
    act(() => {
      useCartStore.getState().agregar(p1, 2)
      useCartStore.getState().agregar(p2, 3)
    })
    expect(useCartStore.getState().cantidadTotal()).toBe(5)
  })

  it('persists to localStorage under foodstore-cart', () => {
    const key = 'foodstore-cart'
    act(() => useCartStore.getState().agregar(p1, 2))
    const stored = localStorage.getItem(key)
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.items).toHaveLength(1)
  })

  it('rejects agregar with cantidad <= 0', () => {
    act(() => useCartStore.getState().agregar(p1, 0))
    expect(useCartStore.getState().items).toHaveLength(0)
    act(() => useCartStore.getState().agregar(p1, -1))
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('rejects agregar if cantidad exceeds stock_calculado', () => {
    const limited = { ...p1, stock_calculado: 3 }
    act(() => useCartStore.getState().agregar(limited, 5))
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('rejects cambiarCantidad if exceeds stock', () => {
    const limited = { ...p1, stock_calculado: 3 }
    act(() => useCartStore.getState().agregar(limited, 2))
    act(() => useCartStore.getState().cambiarCantidad(1, 5))
    expect(useCartStore.getState().items[0]?.cantidad).toBe(2)
  })

  it('allows agregar when stock is null/undefined', () => {
    const noStock = { ...p1, stock_calculado: undefined as any }
    act(() => useCartStore.getState().agregar(noStock, 10))
    expect(useCartStore.getState().items).toHaveLength(1)
  })
})
