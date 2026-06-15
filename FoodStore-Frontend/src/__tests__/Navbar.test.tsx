import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navbar } from '../components/Navbar'
import { useAuthStore } from '../stores/authStore'
import { useCartStore } from '../stores/cartStore'
import { useWSStore } from '../stores/wsStore'

function renderNavbar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Navbar onOpenCart={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Navbar', () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.getState().setUsuario(null)
      useCartStore.getState().vaciar()
      useWSStore.getState().setDisconnected()
    })
  })

  it('renders FoodStore brand link', () => {
    renderNavbar()
    expect(screen.getByText('🍔 FoodStore')).toBeInTheDocument()
  })

  it('renders login and register when no user', () => {
    renderNavbar()
    expect(screen.getByText('Ingresar')).toBeInTheDocument()
    expect(screen.getByText('Registrarse')).toBeInTheDocument()
  })

  it('does NOT show cart when no user', () => {
    renderNavbar()
    expect(screen.queryByText('🛒')).not.toBeInTheDocument()
  })

  it('renders user name and logout when logged in', () => {
    act(() => {
      useAuthStore.getState().setUsuario({
        id: 1, nombre: 'Admin', apellido: 'Sistema', email: 'admin@test.com', roles: ['ADMIN'],
      })
    })
    renderNavbar()
    expect(screen.getByText('Admin Sistema ▾')).toBeInTheDocument()
  })

  it('shows Admin link for ADMIN role', () => {
    act(() => {
      useAuthStore.getState().setUsuario({
        id: 1, nombre: 'A', apellido: 'B', email: 'a@b.com', roles: ['ADMIN'],
      })
    })
    renderNavbar()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('does NOT show Admin link for CLIENT', () => {
    act(() => {
      useAuthStore.getState().setUsuario({
        id: 2, nombre: 'C', apellido: 'D', email: 'c@d.com', roles: ['CLIENT'],
      })
    })
    renderNavbar()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('shows Pedidos link for PEDIDOS role (not admin)', () => {
    act(() => {
      useAuthStore.getState().setUsuario({
        id: 3, nombre: 'E', apellido: 'F', email: 'e@f.com', roles: ['PEDIDOS'],
      })
    })
    renderNavbar()
    expect(screen.getByText('Pedidos')).toBeInTheDocument()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('shows Mis pedidos and Mis direcciones when logged in', () => {
    act(() => {
      useAuthStore.getState().setUsuario({
        id: 1, nombre: 'X', apellido: 'Y', email: 'x@y.com', roles: ['CLIENT'],
      })
    })
    renderNavbar()
    expect(screen.getByText('Mis pedidos')).toBeInTheDocument()
    expect(screen.getByText('Mis direcciones')).toBeInTheDocument()
  })

  it('shows cart button when logged in', () => {
    act(() => {
      useAuthStore.getState().setUsuario({
        id: 1, nombre: 'X', apellido: 'Y', email: 'x@y.com', roles: ['CLIENT'],
      })
    })
    renderNavbar()
    expect(screen.getByText('🛒')).toBeInTheDocument()
  })

  describe('WS connection badge', () => {
    const user = { id: 1, nombre: 'X', apellido: 'Y', email: 'x@y.com', roles: ['CLIENT'] }

    it('shows Offline when disconnected', () => {
      act(() => {
        useAuthStore.getState().setUsuario(user)
        useWSStore.getState().setDisconnected()
      })
      renderNavbar()
      expect(screen.getByText('Offline')).toBeInTheDocument()
    })

    it('shows En vivo when connected', () => {
      act(() => {
        useAuthStore.getState().setUsuario(user)
        useWSStore.getState().setConnected()
      })
      renderNavbar()
      expect(screen.getByText('En vivo')).toBeInTheDocument()
    })

    it('shows ... when connecting', () => {
      act(() => {
        useAuthStore.getState().setUsuario(user)
        useWSStore.getState().setConnecting()
      })
      renderNavbar()
      expect(screen.getByText('...')).toBeInTheDocument()
    })

    it('does NOT show badge when no user', () => {
      act(() => useWSStore.getState().setConnected())
      renderNavbar()
      expect(screen.queryByText('En vivo')).not.toBeInTheDocument()
      expect(screen.queryByText('Offline')).not.toBeInTheDocument()
    })
  })

  it('shows cart badge with item count', () => {
    act(() => {
      useAuthStore.getState().setUsuario({
        id: 1, nombre: 'X', apellido: 'Y', email: 'x@y.com', roles: ['CLIENT'],
      })
      useCartStore.getState().agregar({
        id: 1, nombre: 'P1', precio_venta: '100', stock_calculado: 10,
        precio_costo_calculado: '50', disponible: true, tiene_ingredientes: false,
        margen_ganancia: '50', categorias: [], ingredientes: [],
      }, 3)
    })
    renderNavbar()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
