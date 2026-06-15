import { render, screen, fireEvent } from '@testing-library/react'
import { Pagination } from '../components/Pagination'
import { Modal, ConfirmModal } from '../components/Modal'
import { Spinner, SpinnerCenter } from '../components/Spinner'
import { EmptyState } from '../components/EmptyState'

describe('Pagination', () => {
  it('returns null when pages <= 1', () => {
    const { container } = render(<Pagination page={1} pages={1} onChange={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders page numbers for multiple pages', () => {
    render(<Pagination page={1} pages={3} onChange={vi.fn()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('calls onChange with page number', () => {
    const onChange = vi.fn()
    render(<Pagination page={1} pages={3} onChange={onChange} />)
    fireEvent.click(screen.getByText('3'))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('highlights active page', () => {
    render(<Pagination page={2} pages={3} onChange={vi.fn()} />)
    const active = screen.getByText('2')
    expect(active.className).toContain('active')
    const inactive = screen.getByText('1')
    expect(inactive.className).not.toContain('active')
  })

  it('disabled prev button on first page', () => {
    render(<Pagination page={1} pages={3} onChange={vi.fn()} />)
    expect(screen.getByText('‹')).toBeDisabled()
  })

  it('disabled next button on last page', () => {
    render(<Pagination page={3} pages={3} onChange={vi.fn()} />)
    expect(screen.getByText('›')).toBeDisabled()
  })

  it('shows prev/next arrows as text', () => {
    render(<Pagination page={1} pages={5} onChange={vi.fn()} />)
    expect(screen.getByText('‹')).toBeInTheDocument()
    expect(screen.getByText('›')).toBeInTheDocument()
  })
})

describe('Spinner', () => {
  it('renders with default class', () => {
    const { container } = render(<Spinner />)
    expect(container.firstChild).toHaveClass('spinner')
    expect(container.firstChild).not.toHaveClass('spinner-sm')
  })

  it('renders small variant', () => {
    const { container } = render(<Spinner small />)
    expect(container.firstChild).toHaveClass('spinner-sm')
  })

  it('SpinnerCenter wraps spinner in container', () => {
    const { container } = render(<SpinnerCenter />)
    expect(container.firstChild).toHaveClass('spinner-center')
    expect(container.querySelector('.spinner')).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="Sin resultados" />)
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
  })

  it('renders default icon', () => {
    render(<EmptyState title="Vacío" />)
    expect(screen.getByText('📭')).toBeInTheDocument()
  })

  it('renders custom icon', () => {
    render(<EmptyState icon="🔍" title="Búsqueda" />)
    expect(screen.getByText('🔍')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<EmptyState title="Vacío" desc="Probá con otros filtros" />)
    expect(screen.getByText('Probá con otros filtros')).toBeInTheDocument()
  })

  it('renders action element', () => {
    render(<EmptyState title="Vacío" action={<button>Crear</button>} />)
    expect(screen.getByText('Crear')).toBeInTheDocument()
  })
})

describe('Modal', () => {
  it('renders title and children', () => {
    render(<Modal title="Test Modal" onClose={vi.fn()}><p>Contenido</p></Modal>)
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Contenido')).toBeInTheDocument()
  })

  it('calls onClose when X clicked', () => {
    const onClose = vi.fn()
    render(<Modal title="X" onClose={onClose}><p>x</p></Modal>)
    fireEvent.click(screen.getByText('×'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders footer when provided', () => {
    render(<Modal title="Footer" onClose={vi.fn()} footer={<button>Guardar</button>}><p>body</p></Modal>)
    expect(screen.getByText('Guardar')).toBeInTheDocument()
  })

  it('does not render footer when not provided', () => {
    const { container } = render(<Modal title="No footer" onClose={vi.fn()}><p>body</p></Modal>)
    expect(container.querySelector('.modal-footer')).not.toBeInTheDocument()
  })

  it('renders sm size', () => {
    const { container } = render(<Modal title="Small" onClose={vi.fn()} size="sm"><p>s</p></Modal>)
    const modalEl = container.querySelector('.modal') as HTMLElement
    expect(modalEl.style.maxWidth).toBe('400px')
  })

  it('renders lg size', () => {
    const { container } = render(<Modal title="Large" onClose={vi.fn()} size="lg"><p>l</p></Modal>)
    const modalEl = container.querySelector('.modal') as HTMLElement
    expect(modalEl.style.maxWidth).toBe('760px')
  })

  it('renders default md size', () => {
    const { container } = render(<Modal title="Medium" onClose={vi.fn()} size="md"><p>m</p></Modal>)
    const modalEl = container.querySelector('.modal') as HTMLElement
    expect(modalEl.style.maxWidth).toBe('520px')
  })
})

describe('ConfirmModal', () => {
  it('renders message', () => {
    render(<ConfirmModal msg="¿Estás seguro?" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('¿Estás seguro?')).toBeInTheDocument()
  })

  it('calls onConfirm', () => {
    const onConfirm = vi.fn()
    render(<ConfirmModal msg="¿Seguro?" onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onCancel', () => {
    const onCancel = vi.fn()
    render(<ConfirmModal msg="¿Seguro?" onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('disables buttons when loading', () => {
    render(<ConfirmModal msg="Cargando..." onConfirm={vi.fn()} onCancel={vi.fn()} loading />)
    expect(screen.getByRole('button', { name: 'Procesando...' })).toBeInTheDocument()
  })

  it('uses danger class when danger prop true', () => {
    render(<ConfirmModal msg="Peligro" onConfirm={vi.fn()} onCancel={vi.fn()} danger />)
    const btn = screen.getByRole('button', { name: 'Confirmar' })
    expect(btn.className).toContain('btn-danger')
  })

  it('uses primary class by default', () => {
    render(<ConfirmModal msg="Normal" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const btn = screen.getByRole('button', { name: 'Confirmar' })
    expect(btn.className).toContain('btn-primary')
  })
})
