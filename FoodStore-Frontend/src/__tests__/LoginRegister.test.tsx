import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../components/Toast'
import { useAuthStore } from '../stores/authStore'
import { useCartStore } from '../stores/cartStore'
import { LoginPage } from '../pages/LoginPage'
import { RegisterPage } from '../pages/RegisterPage'

const mockLogin = vi.fn()
const mockMe = vi.fn()
const mockRegister = vi.fn()

vi.mock('../services/auth.service', () => ({
  authService: {
    login: (...args: any[]) => mockLogin(...args),
    me: (...args: any[]) => mockMe(...args),
    register: (...args: any[]) => mockRegister(...args),
  },
}))

const user = { id: 1, nombre: 'Admin', apellido: 'Sistema', email: 'admin@test.com', roles: ['ADMIN'] }

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

function renderRegister() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.getState().setUsuario(null)
      useCartStore.getState().vaciar()
    })
    mockLogin.mockReset()
    mockMe.mockReset()
  })

  it('renders login form', () => {
    renderLogin()
    expect(screen.getByPlaceholderText('tu@email.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('shows FoodStore brand', () => {
    renderLogin()
    expect(screen.getByText('FoodStore')).toBeInTheDocument()
  })

  it('has link to register', () => {
    renderLogin()
    expect(screen.getByText('Registrarse')).toBeInTheDocument()
  })

  it('shows loading state on submit', async () => {
    mockLogin.mockReturnValue(new Promise(() => {})) // never resolves
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText('tu@email.com'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: '12345678' } })
    fireEvent.click(screen.getByText('Ingresar'))
    expect(await screen.findByText('Ingresando...')).toBeInTheDocument()
  })

  it('shows error on failed login', async () => {
    mockLogin.mockRejectedValue({ response: { data: { detail: 'Credenciales inválidas' } } })
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText('tu@email.com'), { target: { value: 'bad@b.com' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByText('Ingresar'))
    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument()
  })

  it('shows network error when no response', async () => {
    mockLogin.mockRejectedValue({}) // no response = network error
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText('tu@email.com'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: '12345678' } })
    fireEvent.click(screen.getByText('Ingresar'))
    expect(await screen.findByText(/Error de conexión/)).toBeInTheDocument()
  })

  it('shows too many attempts for 429', async () => {
    mockLogin.mockRejectedValue({ response: { status: 429 } })
    renderLogin()
    fireEvent.change(screen.getByPlaceholderText('tu@email.com'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: '12345678' } })
    fireEvent.click(screen.getByText('Ingresar'))
    expect(await screen.findByText(/Demasiados intentos/)).toBeInTheDocument()
  })
})

describe('RegisterPage', () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.getState().setUsuario(null)
    })
    mockRegister.mockReset()
    mockLogin.mockReset()
    mockMe.mockReset()
  })

  it('renders registration form with all fields', () => {
    renderRegister()
    expect(screen.getByRole('heading', { name: 'Crear cuenta' })).toBeInTheDocument()
    // 5 inputs: nombre, apellido, email, celular, contraseña
    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(4) // nombre, apellido, email, celular (textbox role)
    // Password has role="" so it doesn't show as textbox. Use placeholder instead.
    expect(screen.getByPlaceholderText('Mínimo 8 caracteres')).toBeInTheDocument()
  })

  it('has link to login', () => {
    renderRegister()
    expect(screen.getByRole('link', { name: 'Ingresar' })).toBeInTheDocument()
  })

  it('validates minimum password length on submit', async () => {
    renderRegister()
    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { value: '123' } })
    const form = screen.getByRole('button', { name: 'Crear cuenta' }).closest('form')!
    fireEvent.submit(form)
    expect(await screen.findByText(/contraseña debe tener al menos 8/)).toBeInTheDocument()
  })

  it('has optional celular input field', () => {
    renderRegister()
    const inputs = screen.getAllByRole('textbox')
    // El celular es type="tel", role="textbox"
    const celularInput = inputs.find(i => i.getAttribute('type') === 'tel')
    expect(celularInput).toBeInTheDocument()
  })

  it('shows loading state on submit', async () => {
    mockRegister.mockReturnValue(new Promise(() => {}))
    renderRegister()
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: 'Juan' } })
    fireEvent.change(inputs[1], { target: { value: 'Perez' } })
    fireEvent.change(inputs[2], { target: { value: 'juan@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { value: '12345678' } })
    const form = screen.getByRole('button', { name: 'Crear cuenta' }).closest('form')!
    fireEvent.submit(form)
    expect(await screen.findByText('Creando cuenta...')).toBeInTheDocument()
  })
})
