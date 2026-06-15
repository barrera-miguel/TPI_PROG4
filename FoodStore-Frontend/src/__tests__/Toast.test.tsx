import { render, screen, act } from '@testing-library/react'
import { ToastProvider, useToast } from '../components/Toast'

function ToastTrigger({ msg, type }: { msg: string; type: 'success' | 'error' | 'info' }) {
  const toast = useToast()
  return <button onClick={() => toast[type](msg)}>Show</button>
}

function renderToast(msg: string, type: 'success' | 'error' | 'info' = 'success') {
  return render(
    <ToastProvider>
      <ToastTrigger msg={msg} type={type} />
    </ToastProvider>
  )
}

describe('Toast', () => {
  it('renders toast message on trigger', () => {
    renderToast('Operación exitosa')
    act(() => screen.getByText('Show').click())
    expect(screen.getByText('Operación exitosa')).toBeInTheDocument()
  })

  it('shows success icon', () => {
    renderToast('OK', 'success')
    act(() => screen.getByText('Show').click())
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('shows error icon', () => {
    renderToast('Error', 'error')
    act(() => screen.getByText('Show').click())
    expect(screen.getByText('✗')).toBeInTheDocument()
  })

  it('shows info icon', () => {
    renderToast('Info', 'info')
    act(() => screen.getByText('Show').click())
    expect(screen.getByText('ℹ')).toBeInTheDocument()
  })

  it('applies correct toast class per type', () => {
    const { container } = renderToast('Success', 'success')
    act(() => screen.getByText('Show').click())
    expect(container.querySelector('.toast-success')).toBeInTheDocument()
  })

  it('applies error class for error type', () => {
    const { container } = renderToast('Fail', 'error')
    act(() => screen.getByText('Show').click())
    expect(container.querySelector('.toast-error')).toBeInTheDocument()
  })

  it('renders toast container', () => {
    const { container } = renderToast('Test', 'info')
    expect(container.querySelector('.toast-container')).toBeInTheDocument()
  })
})
