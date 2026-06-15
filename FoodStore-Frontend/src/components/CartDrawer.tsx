import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../stores/cartStore'
import { useAuthStore } from '../stores/authStore'

interface Props { open: boolean; onClose: () => void }

function cloudinaryUrl(url: string, w = 72, h = 72): string {
  if (!url || !url.includes('cloudinary.com') || url.includes('f_auto')) return url
  const [base, rest] = url.split('/upload/')
  return `${base}/upload/f_auto,q_auto,c_fill,w_${w},h_${h}/${rest}`
}

export function CartDrawer({ open, onClose }: Props) {
  const { items, quitar, cambiarCantidad, total } = useCartStore()
  const { usuario } = useAuthStore()
  const navigate = useNavigate()

  if (!open) return null
  return (
    <>
      <div className="cart-drawer-overlay" onClick={onClose} />
      <div className="cart-drawer">
        <div className="cart-drawer-header">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
            🛒 Mi carrito ({items.length})
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="cart-drawer-body">
          {items.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', paddingTop: 40 }}>
              El carrito está vacío
            </p>
          ) : (
            items.map(item => {
              const stock = item.producto.stock_calculado
              const excede = stock != null && item.cantidad > stock
              const alLimite = stock != null && item.cantidad >= stock
              return (
              <div key={item.producto.id} className="cart-item">
                {item.producto.imagenes_url?.[0]
                  ? <img src={cloudinaryUrl(item.producto.imagenes_url[0])} alt={item.producto.nombre} className="cart-item-img" />
                  : <div className="cart-item-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🍔</div>
                }
                <div className="cart-item-info">
                  <div className="cart-item-name">
                    {item.producto.nombre}
                    {excede && <span className="badge badge-red" style={{ marginLeft: 6, fontSize: 10 }}>Stock insuficiente</span>}
                  </div>
                  <div className="cart-item-price">
                    ${Number(item.producto.precio_venta).toFixed(2)} c/u
                    {stock != null && <span style={{ fontSize: 11, color: 'var(--color-text-dim)', marginLeft: 6 }}>(disp: {stock})</span>}
                  </div>
                  {item.ingredientesRemovidos.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2 }}>
                      Sin: {item.producto.ingredientes
                        .filter(i => item.ingredientesRemovidos.includes(i.id))
                        .map(i => i.nombre).join(', ')}
                    </div>
                  )}
                  <div className="cart-qty">
                    <button className="cart-qty-btn" onClick={() => cambiarCantidad(item.producto.id, item.cantidad - 1)}>−</button>
                    <span style={{ fontSize: 14, minWidth: 24, textAlign: 'center' }}>{item.cantidad}</span>
                    <button className="cart-qty-btn" onClick={() => cambiarCantidad(item.producto.id, item.cantidad + 1)} disabled={alLimite}>+</button>
                    <button onClick={() => quitar(item.producto.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: 16 }}>🗑</button>
                  </div>
                </div>
              </div>
            )})
          )}
        </div>
        <div className="cart-drawer-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontWeight: 700, fontSize: 16 }}>
            <span>Total</span>
            <span style={{ color: 'var(--color-accent)' }}>${total().toFixed(2)}</span>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={items.length === 0}
            onClick={() => {
              if (!usuario) { navigate('/login'); onClose(); return }
              navigate('/checkout'); onClose()
            }}
          >
            Ir al checkout →
          </button>
        </div>
      </div>
    </>
  )
}
