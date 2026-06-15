import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProductCard } from '../components/ProductCard'
import { ToastProvider } from '../components/Toast'
import { useCartStore } from '../stores/cartStore'
import type { ProductoRead } from '../types'

const baseProduct: ProductoRead = {
  id: 1,
  nombre: 'Hamburguesa Clásica',
  descripcion: 'Con queso cheddar y lechuga fresca',
  margen_ganancia: '30',
  imagenes_url: ['https://res.cloudinary.com/demo/image/upload/v1234567/foodstore/productos/hamburguesa.jpg'],
  stock_calculado: 50,
  precio_costo_calculado: '200.00',
  precio_venta: '260.00',
  disponible: true,
  tiene_ingredientes: true,
  categorias: [
    { id: 1, nombre: 'Hamburguesas', es_principal: true },
    { id: 2, nombre: 'Promos', es_principal: false },
  ],
  ingredientes: [
    { id: 1, nombre: 'Queso cheddar', cantidad: '50', simbolo_unidad: 'g', es_removible: true, es_alergeno: true },
    { id: 2, nombre: 'Lechuga', cantidad: '30', simbolo_unidad: 'g', es_removible: true, es_alergeno: false },
  ],
}

function renderCard(product = baseProduct, props: Record<string, any> = {}) {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <ProductCard producto={product} {...props} />
      </MemoryRouter>
    </ToastProvider>
  )
}

describe('ProductCard', () => {
  beforeEach(() => {
    act(() => useCartStore.getState().vaciar())
  })
  it('renders product name', () => {
    renderCard()
    expect(screen.getByText('Hamburguesa Clásica')).toBeInTheDocument()
  })

  it('renders product price', () => {
    renderCard()
    expect(screen.getByText('$260.00')).toBeInTheDocument()
  })

  it('renders product description', () => {
    renderCard()
    expect(screen.getByText('Con queso cheddar y lechuga fresca')).toBeInTheDocument()
  })

  it('renders category badges', () => {
    renderCard()
    expect(screen.getByText('Hamburguesas')).toBeInTheDocument()
    expect(screen.getByText('Promos')).toBeInTheDocument()
  })

  it('shows allergen badge when product has allergens', () => {
    renderCard()
    expect(screen.getByText('⚠️ Contiene alérgenos')).toBeInTheDocument()
  })

  it('does NOT show allergen badge when no allergens', () => {
    const noAllergen = { ...baseProduct, ingredientes: [{ id: 1, nombre: 'Lechuga', cantidad: '30', simbolo_unidad: 'g', es_removible: false, es_alergeno: false }] }
    renderCard(noAllergen)
    expect(screen.queryByText('⚠️ Contiene alérgenos')).not.toBeInTheDocument()
  })

  it('applies Cloudinary transformations to image URL', () => {
    renderCard()
    const img = screen.getByAltText('Hamburguesa Clásica')
    expect(img).toHaveAttribute('src')
    const src = img.getAttribute('src')
    expect(src).toContain('f_auto,q_auto,c_fill')
    expect(src).toContain('w_400,h_300')
  })

  it('does NOT re-apply transformations if already present', () => {
    const alreadyTransformed = {
      ...baseProduct,
      imagenes_url: ['https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,w_400,h_300/v1234567/foodstore/h.jpg'],
    }
    renderCard(alreadyTransformed)
    const img = screen.getByAltText('Hamburguesa Clásica')
    const src = img.getAttribute('src')
    expect((src?.match(/f_auto/g) || []).length).toBe(1)
  })

  it('renders placeholder when no image', () => {
    renderCard({ ...baseProduct, imagenes_url: undefined })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('🍽️')).toBeInTheDocument()
  })

  it('adds to cart when add button is clicked', () => {
    renderCard()
    fireEvent.click(screen.getByText('+ Agregar al carrito'))
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].cantidad).toBe(1)
  })

  it('hides footer when showFooter is false', () => {
    renderCard(baseProduct, { showFooter: false })
    expect(screen.queryByText('+ Agregar al carrito')).not.toBeInTheDocument()
  })

  it('links to product detail when linkToDetail is true', () => {
    renderCard()
    const link = screen.getByText('Hamburguesa Clásica').closest('a')
    expect(link).toHaveAttribute('href', '/productos/1')
  })

  it('renders name as plain text when linkToDetail is false', () => {
    renderCard(baseProduct, { linkToDetail: false, showFooter: false })
    const name = screen.getByText('Hamburguesa Clásica')
    expect(name.closest('a')).toBeNull()
  })

  it('handles non-Cloudinary URLs without transformations', () => {
    const externalUrl = { ...baseProduct, imagenes_url: ['https://example.com/img.jpg'] }
    renderCard(externalUrl)
    const img = screen.getByAltText('Hamburguesa Clásica')
    expect(img.getAttribute('src')).toBe('https://example.com/img.jpg')
  })

  it('renders with lazy loading on image', () => {
    renderCard()
    const img = screen.getByAltText('Hamburguesa Clásica')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('shows "Sin stock" button when stock_calculado is 0', () => {
    const sinStock = { ...baseProduct, stock_calculado: 0, disponible: true }
    renderCard(sinStock)
    expect(screen.getByText('Sin stock')).toBeInTheDocument()
    expect(screen.queryByText('+ Agregar al carrito')).not.toBeInTheDocument()
  })

  it('shows "No disponible" button when producto is not disponible', () => {
    const noDisp = { ...baseProduct, disponible: false }
    renderCard(noDisp)
    expect(screen.getByText('No disponible')).toBeInTheDocument()
    expect(screen.queryByText('+ Agregar al carrito')).not.toBeInTheDocument()
  })

  it('out-of-stock button is disabled', () => {
    const sinStock = { ...baseProduct, stock_calculado: 0, disponible: true }
    renderCard(sinStock)
    expect(screen.getByText('Sin stock')).toBeDisabled()
  })

  it('shows "Máx. X en carrito" when cart already has max stock', () => {
    const limited = { ...baseProduct, stock_calculado: 3 }
    // Llenar carrito ANTES de renderizar el componente
    useCartStore.getState().agregar(limited, 3)
    renderCard(limited)
    // El componente lee el estado actual del store al montar
    expect(screen.getByText(/Máx\. 3 en carrito/)).toBeInTheDocument()
  })

  it('rejects adding when stock exceeded via store', () => {
    const limited = { ...baseProduct, stock_calculado: 1 }
    act(() => useCartStore.getState().agregar(limited, 1)) // cart has 1
    const result = useCartStore.getState().agregar(limited, 1) // try to add another
    expect(result).toBe(false)
    expect(useCartStore.getState().items[0]?.cantidad).toBe(1)
  })
})
