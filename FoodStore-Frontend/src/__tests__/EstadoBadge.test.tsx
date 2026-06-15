import { render, screen } from '@testing-library/react'
import { EstadoBadge } from '../components/EstadoBadge'

describe('EstadoBadge', () => {
  it('renders Pendiente', () => {
    render(<EstadoBadge estado="PENDIENTE" />)
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
  })

  it('renders Confirmado', () => {
    render(<EstadoBadge estado="CONFIRMADO" />)
    expect(screen.getByText('Confirmado')).toBeInTheDocument()
  })

  it('renders En preparación', () => {
    render(<EstadoBadge estado="EN_PREPARACION" />)
    expect(screen.getByText('En preparación')).toBeInTheDocument()
  })

  it('renders Entregado', () => {
    render(<EstadoBadge estado="ENTREGADO" />)
    expect(screen.getByText('Entregado')).toBeInTheDocument()
  })

  it('renders Cancelado', () => {
    render(<EstadoBadge estado="CANCELADO" />)
    expect(screen.getByText('Cancelado')).toBeInTheDocument()
  })

  it('does NOT render EN_CAMINO (removed in v7 spec)', () => {
    render(<EstadoBadge estado="EN_CAMINO" />)
    // EN_CAMINO no está en los labels, así que se muestra el código crudo
    const badge = screen.getByText('EN_CAMINO')
    expect(badge).toBeInTheDocument()
    // Verifica que no se use el label amigable
    expect(screen.queryByText('En camino')).not.toBeInTheDocument()
  })

  it('renders all 5 FSM v7 states with correct labels', () => {
    const estados = ['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'ENTREGADO', 'CANCELADO']
    const labels = ['Pendiente', 'Confirmado', 'En preparación', 'Entregado', 'Cancelado']
    estados.forEach(estado => {
      const { unmount } = render(<EstadoBadge estado={estado} />)
      expect(screen.getByText(labels[estados.indexOf(estado)])).toBeInTheDocument()
      unmount()
    })
  })

  it('applies correct CSS classes for each state', () => {
    const cases: [string, string][] = [
      ['PENDIENTE', 'badge-yellow'],
      ['CONFIRMADO', 'badge-blue'],
      ['EN_PREPARACION', 'badge-orange'],
      ['ENTREGADO', 'badge-green'],
      ['CANCELADO', 'badge-red'],
    ]
    cases.forEach(([estado, cls]) => {
      const { container, unmount } = render(<EstadoBadge estado={estado} />)
      expect(container.firstChild).toHaveClass(cls)
      unmount()
    })
  })
})
