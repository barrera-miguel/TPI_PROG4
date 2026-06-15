import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../services/auth.service'
import { useAuthStore } from '../stores/authStore'
import { useToast } from '../components/Toast'

const DEMO_USERS = [
  { label: '👤 Admin', email: 'admin@foodstore.com', password: 'Admin1234!', color: '#a855f7' },
  { label: '📦 Stock', email: 'stock@foodstore.com', password: 'Stock1234!', color: '#f59e0b' },
  { label: '🧾 Pedidos', email: 'pedidos@foodstore.com', password: 'Pedidos1234!', color: '#3b82f6' },
  { label: '🛒 Cliente', email: 'cliente@foodstore.com', password: 'Cliente1234!', color: '#22c55e' },
]

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setUsuario } = useAuthStore()
  const toast = useToast()
  const navigate = useNavigate()

  const doLogin = async (e: string, p: string) => {
    setError('')
    setLoading(true)
    try {
      await authService.login({ email: e, contrasena: p })
      const me = await authService.me()
      setUsuario(me)
      toast.success(`¡Bienvenido, ${me.nombre}!`)
      navigate('/')
    } catch (err: any) {
      const status = err.response?.status
      if (!err.response) setError('Error de conexión. Verificá tu internet')
      else if (status === 429) setError('Demasiados intentos. Esperá unos minutos')
      else setError(err.response?.data?.detail ?? 'Credenciales inválidas')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    doLogin(email, contrasena)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🍔</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--color-accent)' }}>FoodStore</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>Ingresá a tu cuenta</p>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input className="form-input" type="password" value={contrasena} onChange={e => setContrasena(e.target.value)} required placeholder="••••••••" />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} type="submit" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--color-text-muted)' }}>
            ¿No tenés cuenta? <Link to="/register" style={{ color: 'var(--color-accent)' }}>Registrarse</Link>
          </p>
        </div>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--color-text-dim)', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>🧪 Demo rápido</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {DEMO_USERS.map(u => (
              <button
                key={u.email}
                className="btn btn-sm"
                onClick={() => doLogin(u.email, u.password)}
                disabled={loading}
                style={{
                  fontSize: 12,
                  border: `1px solid ${u.color}`,
                  color: u.color,
                  background: 'transparent',
                }}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
