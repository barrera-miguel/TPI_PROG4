import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { useAuthStore } from '../stores/authStore'

function renderProtected(roles?: string[], children = <p>Acceso</p>) {
  return render(
    <MemoryRouter>
      <ProtectedRoute roles={roles}>{children}</ProtectedRoute>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  afterEach(() => {
    act(() => useAuthStore.getState().setUsuario(null))
    act(() => useAuthStore.getState().setLoading(true))
  })

  it('shows spinner when loading', () => {
    act(() => useAuthStore.getState().setLoading(true))
    const { container } = renderProtected()
    expect(container.querySelector('.spinner-center')).toBeInTheDocument()
  })

  it('redirects to /login when no user', () => {
    act(() => useAuthStore.getState().setLoading(false))
    act(() => useAuthStore.getState().setUsuario(null))
    renderProtected()
    expect(screen.queryByText('Acceso')).not.toBeInTheDocument()
  })

  it('renders children when user is authenticated', () => {
    act(() => {
      useAuthStore.getState().setLoading(false)
      useAuthStore.getState().setUsuario({ id: 1, nombre: 'A', apellido: 'B', email: 'a@b.com', roles: ['CLIENT'] })
    })
    renderProtected()
    expect(screen.getByText('Acceso')).toBeInTheDocument()
  })

  it('redirects when user lacks required role', () => {
    act(() => {
      useAuthStore.getState().setLoading(false)
      useAuthStore.getState().setUsuario({ id: 1, nombre: 'A', apellido: 'B', email: 'a@b.com', roles: ['CLIENT'] })
    })
    renderProtected(['ADMIN'])
    expect(screen.queryByText('Acceso')).not.toBeInTheDocument()
  })

  it('allows access when user has required role', () => {
    act(() => {
      useAuthStore.getState().setLoading(false)
      useAuthStore.getState().setUsuario({ id: 1, nombre: 'A', apellido: 'B', email: 'a@b.com', roles: ['ADMIN'] })
    })
    renderProtected(['ADMIN'])
    expect(screen.getByText('Acceso')).toBeInTheDocument()
  })

  it('allows access without role restriction', () => {
    act(() => {
      useAuthStore.getState().setLoading(false)
      useAuthStore.getState().setUsuario({ id: 1, nombre: 'A', apellido: 'B', email: 'a@b.com', roles: ['CLIENT'] })
    })
    renderProtected()
    expect(screen.getByText('Acceso')).toBeInTheDocument()
  })

  it('allows access if user has any of multiple required roles', () => {
    act(() => {
      useAuthStore.getState().setLoading(false)
      useAuthStore.getState().setUsuario({ id: 1, nombre: 'A', apellido: 'B', email: 'a@b.com', roles: ['PEDIDOS'] })
    })
    renderProtected(['ADMIN', 'PEDIDOS'])
    expect(screen.getByText('Acceso')).toBeInTheDocument()
  })
})
