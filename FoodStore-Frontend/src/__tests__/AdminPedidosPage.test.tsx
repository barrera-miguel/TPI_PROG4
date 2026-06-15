import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminPedidosPage } from '../pages/admin/AdminPedidosPage'
import { useAuthStore } from '../stores/authStore'

vi.mock('../hooks/useAdminOrdersFeed', () => ({
  useAdminOrdersFeed: () => {},
}))

const mockListarAdmin = vi.fn().mockResolvedValue({
  items: [],
  total: 0,
  page: 1,
  size: 20,
  pages: 0,
})

vi.mock('../services/pedidos.service', () => ({
  pedidosService: {
    listarAdmin: (...args: any[]) => mockListarAdmin(...args),
    avanzarEstado: vi.fn(),
  },
}))

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AdminPedidosPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AdminPedidosPage', () => {
  beforeEach(() => {
    mockListarAdmin.mockClear()
    act(() => {
      useAuthStore.getState().setUsuario({
        id: 1, nombre: 'Admin', apellido: 'Sistema', email: 'admin@test.com', roles: ['ADMIN'],
      })
    })
  })

  it('renders page title', async () => {
    renderPage()
    expect(await screen.findByText('🧾 Pedidos')).toBeInTheDocument()
  })

  it('renders filter dropdown without EN_CAMINO', async () => {
    renderPage()
    const select = await screen.findByRole('combobox')
    expect(select).toBeInTheDocument()

    const options = Array.from(select.querySelectorAll('option')).map(o => o.value)
    expect(options).not.toContain('EN_CAMINO')
  })

  it('FSM dropdown shows only 5 valid states and excludes EN_CAMINO', async () => {
    renderPage()
    await screen.findByText('🧾 Pedidos')

    const select = screen.getByRole('combobox')
    const optionTexts = Array.from(select.querySelectorAll('option')).map(o => o.textContent?.trim())
    
    expect(optionTexts).toContain('Todos los estados')
    expect(optionTexts).toContain('Pendiente')
    expect(optionTexts).toContain('Confirmado')
    expect(optionTexts).toContain('En preparación')
    expect(optionTexts).toContain('Entregado')
    expect(optionTexts).toContain('Cancelado')
    expect(optionTexts).not.toContain('En camino')
    // Exactly 6 options: "Todos los estados" + 5 estados
    expect(optionTexts).toHaveLength(6)
  })
})
