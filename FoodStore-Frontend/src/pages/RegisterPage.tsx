import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../services/auth.service'
import { useAuthStore } from '../stores/authStore'
import { useToast } from '../components/Toast'

export function RegisterPage() {
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', celular: '', contrasena: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setUsuario } = useAuthStore()
  const toast = useToast()
  const navigate = useNavigate()

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.contrasena.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    setError(''); setLoading(true)
    try {
      await authService.register({ ...form, celular: form.celular || undefined })
      await authService.login({ email: form.email, contrasena: form.contrasena })
      const me = await authService.me()
      setUsuario(me)
      toast.success('¡Cuenta creada exitosamente!')
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'No se pudo completar el registro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🍔</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>Crear cuenta</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>Registrate en FoodStore</p>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input className="form-input" value={form.nombre} onChange={set('nombre')} required minLength={2} />
              </div>
              <div className="form-group">
                <label className="form-label">Apellido</label>
                <input className="form-input" value={form.apellido} onChange={set('apellido')} required minLength={2} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={set('email')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Celular (opcional)</label>
              <input className="form-input" type="tel" value={form.celular} onChange={set('celular')} />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input className="form-input" type="password" value={form.contrasena} onChange={set('contrasena')} required minLength={8} placeholder="Mínimo 8 caracteres" />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} type="submit" disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--color-text-muted)' }}>
            ¿Ya tenés cuenta? <Link to="/login" style={{ color: 'var(--color-accent)' }}>Ingresar</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
