import { Link } from 'react-router-dom'
import { useCartStore } from '../stores/cartStore'
import { useAuthStore } from '../stores/authStore'
import { useToast } from '../components/Toast'
import type { ProductoRead } from '../types'

interface Props {
  producto: ProductoRead
  linkToDetail?: boolean
  showFooter?: boolean
}

function cloudinaryUrl(url: string, width = 400, height = 300): string {
  if (!url) return url
  if (url.includes('cloudinary.com') && !url.includes('f_auto')) {
    const [base, rest] = url.split('/upload/')
    return `${base}/upload/f_auto,q_auto,c_fill,w_${width},h_${height}/${rest}`
  }
  return url
}

export function ProductCard({ producto: p, linkToDetail = true, showFooter = true }: Props) {
  const imgUrl = p.imagenes_url?.[0] ? cloudinaryUrl(p.imagenes_url[0]) : null
  const items = useCartStore(s => s.items)
  const agregar = useCartStore(s => s.agregar)
  const usuario = useAuthStore(s => s.usuario)
  const toast = useToast()

  const enCarrito = items.find(i => i.producto.id === p.id)
  const cantidadEnCarrito = enCarrito?.cantidad ?? 0
  const stock = p.stock_calculado
  const stockMaximo = stock ?? 999
  const sinStock = !p.disponible || (stock != null && stock <= 0)
  const maximoAlcanzado = !sinStock && cantidadEnCarrito >= stockMaximo

  const handleAgregar = () => {
    if (sinStock) return
    const ok = agregar(p)
    if (ok) {
      toast.success(`${p.nombre} agregado al carrito`)
    } else {
      toast.error(`No se puede agregar: stock máximo alcanzado (${stock} disponibles)`)
    }
  }

  const image = imgUrl ? (
    <img src={imgUrl} alt={p.nombre} className="product-card-img" loading="lazy" />
  ) : (
    <div className="product-card-img-placeholder">🍽️</div>
  )

  return (
    <div className="product-card">
      {linkToDetail ? <Link to={`/productos/${p.id}`}>{image}</Link> : image}

      <div className="product-card-body">
        {linkToDetail ? (
          <Link to={`/productos/${p.id}`}>
            <div className="product-card-name">{p.nombre}</div>
          </Link>
        ) : (
          <div className="product-card-name">{p.nombre}</div>
        )}
        {p.descripcion && (
          <div className="text-sm text-muted" style={{ WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.descripcion}</div>
        )}
        {p.categorias.length > 0 && (
          <div className="product-card-cats">
            {p.categorias.slice(0, 2).map(c => <span key={c.id} className="badge badge-gray text-xs">{c.nombre}</span>)}
          </div>
        )}
        {p.ingredientes.some(i => i.es_alergeno) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="badge badge-yellow" style={{ fontSize: 11 }}>⚠️ Contiene alérgenos</span>
          </div>
        )}
        <div className="product-card-price">
          ${Number(p.precio_venta).toFixed(2)}
          {stock != null && <span style={{ fontSize: 11, color: 'var(--color-text-dim)', marginLeft: 6 }}>stock: {stock}</span>}
        </div>
      </div>

      {showFooter && usuario && (
        <div className="product-card-footer">
          {sinStock ? (
            <button className="btn btn-secondary" style={{ width: '100%' }} disabled>
              {!p.disponible ? 'No disponible' : 'Sin stock'}
            </button>
          ) : maximoAlcanzado ? (
            <button className="btn btn-secondary" style={{ width: '100%' }} disabled>
              Máx. {stockMaximo} en carrito
            </button>
          ) : (
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAgregar}>
              + Agregar al carrito
            </button>
          )}
        </div>
      )}
    </div>
  )
}
