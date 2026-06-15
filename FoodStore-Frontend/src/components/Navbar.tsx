import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useCartStore } from '../stores/cartStore'
import { useWSStore } from '../stores/wsStore'
import { authService } from '../services/auth.service'
import { useToast } from './Toast'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

export function Navbar({ onOpenCart }: { onOpenCart: () => void }) {
  const { usuario, setUsuario, isAdmin, isPedidos, isStock } = useAuthStore()
  const cantidadTotal = useCartStore(s => s.cantidadTotal)
  const vaciar = useCartStore(s => s.vaciar)
  const connectionStatus = useWSStore(s => s.connectionStatus)
  const toast = useToast()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    try { await authService.logout() } catch {}
    setUsuario(null)
    vaciar()
    qc.clear()
    toast.info('Sesión cerrada')
    navigate('/login')
    setMenuOpen(false)
  }

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 'var(--navbar-h)',
      background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', zIndex: 800, padding: '0 24px',
    }}>
      <Link to="/" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--color-accent)', marginRight: 32, letterSpacing: '-0.5px' }}>
        🍔 FoodStore
      </Link>

      <div style={{ display: 'flex', gap: 8, flex: 1, alignItems: 'center' }}>
        <Link to="/" className="btn btn-ghost btn-sm">Catálogo</Link>
        {usuario && <Link to="/orders" className="btn btn-ghost btn-sm">Mis pedidos</Link>}
        {usuario && <Link to="/profile/addresses" className="btn btn-ghost btn-sm">Mis direcciones</Link>}
        {isAdmin() && <Link to="/admin" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-accent)' }}>Admin</Link>}
        {!isAdmin() && isPedidos() && <Link to="/admin/pedidos" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-accent)' }}>Pedidos</Link>}
        {!isAdmin() && !isPedidos() && isStock() && <Link to="/admin/productos" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-accent)' }}>Stock</Link>}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {usuario && (
          <button className="btn btn-ghost btn-sm" onClick={onOpenCart} style={{ position: 'relative' }}>
            🛒
            {cantidadTotal() > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4, background: 'var(--color-accent)',
                color: '#fff', borderRadius: '999px', fontSize: 10, fontWeight: 700,
                width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{cantidadTotal()}</span>
            )}
          </button>
        )}

        {usuario && (
          <span
            title={connectionStatus === 'connected' ? 'Conexión en vivo' : connectionStatus === 'connecting' ? 'Conectando...' : 'Sin conexión en tiempo real'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
              color: connectionStatus === 'connected' ? 'var(--color-success)' : connectionStatus === 'connecting' ? '#f59e0b' : 'var(--color-text-muted)',
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: connectionStatus === 'connected' ? 'var(--color-success)' : connectionStatus === 'connecting' ? '#f59e0b' : '#d1d5db',
              animation: connectionStatus === 'connecting' ? 'pulse 1.5s infinite' : 'none',
            }} />
            {connectionStatus === 'connected' ? 'En vivo' : connectionStatus === 'connecting' ? '...' : 'Offline'}
          </span>
        )}

        {!usuario ? (
          <>
            <Link to="/login" className="btn btn-ghost btn-sm">Ingresar</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Registrarse</Link>
          </>
        ) : (
          <div style={{ position: 'relative' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setMenuOpen(!menuOpen)}>
              {usuario.nombre} {usuario.apellido} ▾
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 42, background: 'var(--color-surface)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 8,
                minWidth: 160, boxShadow: 'var(--shadow)', zIndex: 10,
              }}>
                <div style={{ padding: '6px 12px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {usuario.roles.join(' · ')}
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
                <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={handleLogout}>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
