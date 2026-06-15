import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CartDrawer } from '../components/CartDrawer'
import { useCartStore } from '../stores/cartStore'
import { useAuthStore } from '../stores/authStore'

const sampleProduct = {
  id: 1, nombre: 'Hamburguesa', precio_venta: '250.00', stock_calculado: 10,
  precio_costo_calculado: '150.00', disponible: true, tiene_ingredientes: true,
  margen_ganancia: '30', categorias: [], ingredientes: [],
  imagenes_url: ['https://res.cloudinary.com/demo/image/upload/v1/foodstore/burger.jpg'],
}

function renderCart(isOpen = true, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <CartDrawer open={isOpen} onClose={onClose} />
    </MemoryRouter>
  )
}

describe('CartDrawer', () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.getState().setUsuario({ id: 1, nombre: 'X', apellido: 'Y', email: 'x@y.com', roles: ['CLIENT'] })
      useCartStore.getState().vaciar()
    })
  })

  it('renders nothing when closed', () => {
    renderCart(false)
    expect(screen.queryByText('🛒')).not.toBeInTheDocument()
  })

  it('renders empty cart message', () => {
    renderCart()
    expect(screen.getByText('El carrito está vacío')).toBeInTheDocument()
  })

  it('renders items with name and price', () => {
    act(() => useCartStore.getState().agregar(sampleProduct, 2))
    renderCart()
    expect(screen.getByText('Hamburguesa')).toBeInTheDocument()
    expect(screen.getByText('$250.00 c/u')).toBeInTheDocument()
  })

  it('shows correct quantity per item', () => {
    act(() => useCartStore.getState().agregar(sampleProduct, 3))
    renderCart()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('increases quantity with + button', () => {
    act(() => useCartStore.getState().agregar(sampleProduct, 1))
    renderCart()
    const plusBtn = screen.getByText('+')
    fireEvent.click(plusBtn)
    expect(useCartStore.getState().items[0]?.cantidad).toBe(2)
  })

  it('decreases quantity with − button', () => {
    act(() => useCartStore.getState().agregar(sampleProduct, 3))
    renderCart()
    const minusBtn = screen.getByText('−')
    fireEvent.click(minusBtn)
    expect(useCartStore.getState().items[0]?.cantidad).toBe(2)
  })

  it('removes item with trash button', () => {
    act(() => useCartStore.getState().agregar(sampleProduct, 1))
    renderCart()
    fireEvent.click(screen.getByText('🗑'))
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('shows correct total', () => {
    act(() => {
      useCartStore.getState().agregar(sampleProduct, 2)
      useCartStore.getState().agregar({ ...sampleProduct, id: 2, nombre: 'Papas', precio_venta: '100.00' }, 1)
    })
    renderCart()
    // Total: 250 * 2 + 100 = 600
    expect(screen.getByText('$600.00')).toBeInTheDocument()
  })

  it('checkout button disabled when cart empty', () => {
    renderCart()
    const btn = screen.getByText('Ir al checkout →')
    expect(btn).toBeDisabled()
  })

  it('checkout button enabled when cart has items', () => {
    act(() => useCartStore.getState().agregar(sampleProduct, 1))
    renderCart()
    const btn = screen.getByText('Ir al checkout →')
    expect(btn).not.toBeDisabled()
  })

  it('applies Cloudinary transformations to cart image', () => {
    act(() => useCartStore.getState().agregar(sampleProduct, 1))
    renderCart()
    const img = screen.getByAltText('Hamburguesa')
    expect(img.getAttribute('src')).toContain('f_auto,q_auto,c_fill')
  })

  it('shows removed ingredients when personalized', () => {
    const productWithIngs = {
      ...sampleProduct, id: 3, nombre: 'Personalizada',
      ingredientes: [
        { id: 1, nombre: 'Cebolla', cantidad: '10', simbolo_unidad: 'g', es_removible: true, es_alergeno: false },
        { id: 2, nombre: 'Queso', cantidad: '20', simbolo_unidad: 'g', es_removible: true, es_alergeno: false },
      ],
    }
    act(() => {
      useCartStore.getState().agregar(productWithIngs, 1)
      useCartStore.getState().toggleIngrediente(3, 1)
    })
    renderCart()
    expect(screen.getByText(/Sin: Cebolla/)).toBeInTheDocument()
  })

  it('closes when overlay clicked', () => {
    const onClose = vi.fn()
    renderCart(true, onClose)
    fireEvent.click(screen.getByRole('button', { name: '×' }))
    expect(onClose).toHaveBeenCalled()
  })
})
