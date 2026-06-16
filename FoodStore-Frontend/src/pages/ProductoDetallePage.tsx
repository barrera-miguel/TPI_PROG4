import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productosService } from '../services/productos.service'
import { useCartStore } from '../stores/cartStore'
import { useAuthStore } from '../stores/authStore'
import { useToast } from '../components/Toast'
import { SpinnerCenter } from '../components/Spinner'
import { EmptyState } from '../components/EmptyState'

export function ProductoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const [cantidad, setCantidad] = useState(1)
  const [removidos, setRemovidos] = useState<number[]>([])
  const { usuario } = useAuthStore()
  const { agregar, toggleIngrediente, items } = useCartStore()
  const toast = useToast()
  const navigate = useNavigate()

  const { data: producto, isLoading, isError } = useQuery({
    queryKey: ['producto', id],
    queryFn: () => productosService.detalle(Number(id)),
    enabled: !!id,
  })

  if (isLoading) return <div className="page-wrapper"><SpinnerCenter /></div>
  if (isError || !producto) return <div className="page-wrapper"><EmptyState title="Producto no encontrado" icon="❌" /></div>

  const stock = producto.stock_calculado ?? 999
  const enCarrito = items.find(i => i.producto.id === producto.id)
  const cantidadEnCarrito = enCarrito?.cantidad ?? 0
  const stockDisponible = stock - cantidadEnCarrito
  const puedeAgregar = producto.disponible && stockDisponible > 0

  const handleAgregar = () => {
    if (!usuario) { toast.info('Iniciá sesión para agregar al carrito'); navigate('/login'); return }
    if (!producto.disponible) { toast.error('Este producto no está disponible'); return }
    if (stockDisponible <= 0) { toast.error(`Stock máximo alcanzado (${stock} disponibles)`); return }

    const ok = agregar(producto, cantidad)
    if (!ok) { toast.error(`Stock insuficiente (máx ${stockDisponible} disponibles)`); return }

    removidos.forEach(iid => {
      const cartItem = items.find(i => i.producto.id === producto.id)
      if (!cartItem?.ingredientesRemovidos.includes(iid)) toggleIngrediente(producto.id, iid)
    })
    toast.success(`${producto.nombre} agregado al carrito`)
  }

  const toggleRemovido = (iid: number) => {
    setRemovidos(r => r.includes(iid) ? r.filter(x => x !== iid) : [...r, iid])
  }

  const img = producto.imagenes_url?.[0]

  return (
    <div className="page-wrapper">
      <div className="container page-content">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>← Volver</button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
          <div>
            {img
              ? <img src={img} alt={producto.nombre} style={{ width: '100%', borderRadius: 'var(--radius-lg)', maxHeight: 420, objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: 320, background: 'var(--color-surface2)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80 }}>🍽️</div>
            }
            {(producto.imagenes_url?.length ?? 0) > 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {producto.imagenes_url!.slice(1, 4).map((u, i) => (
                  <img key={i} src={u} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }} alt="" />
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {producto.categorias.map(c => <span key={c.id} className={`badge ${c.es_principal ? 'badge-orange' : 'badge-gray'}`}>{c.nombre}</span>)}
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{producto.nombre}</h1>
            {producto.descripcion && <p style={{ color: 'var(--color-text-muted)', marginBottom: 16, lineHeight: 1.7 }}>{producto.descripcion}</p>}

            <div style={{ fontSize: 36, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-accent)', marginBottom: 8 }}>
              ${Number(producto.precio_venta).toFixed(2)}
            </div>

            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
              Stock: <strong style={{ color: producto.stock_calculado > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{producto.stock_calculado > 0 ? `${producto.stock_calculado} disponibles` : 'Sin stock'}</strong>
            </div>

            {producto.tiene_ingredientes && producto.ingredientes.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  Ingredientes
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {producto.ingredientes.map(ing => (
                    <div key={ing.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--color-surface2)', borderRadius: 'var(--radius-sm)', border: `1px solid ${removidos.includes(ing.id) ? 'var(--color-danger)' : 'var(--color-border)'}` }}>
                      {ing.es_removible && (
                        <input type="checkbox" checked={!removidos.includes(ing.id)} onChange={() => toggleRemovido(ing.id)} style={{ width: 16, height: 16, accentColor: 'var(--color-accent)' }} />
                      )}
                      <span style={{ flex: 1, fontSize: 14, textDecoration: removidos.includes(ing.id) ? 'line-through' : 'none', color: removidos.includes(ing.id) ? 'var(--color-text-dim)' : 'var(--color-text)' }}>
                        {ing.nombre}
                        <span style={{ color: 'var(--color-text-dim)', marginLeft: 4 }}>{ing.cantidad} {ing.simbolo_unidad}</span>
                      </span>
                      {ing.es_alergeno && <span className="badge badge-yellow" style={{ fontSize: 10 }}>⚠️ Alérgeno</span>}
                      {!ing.es_removible && <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>Fijo</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {usuario ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                  <label style={{ fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 600 }}>Cantidad:</label>
                  <div className="cart-qty">
                    <button className="cart-qty-btn" onClick={() => setCantidad(c => Math.max(1, c - 1))}>−</button>
                    <span style={{ minWidth: 32, textAlign: 'center', fontWeight: 700 }}>{cantidad}</span>
                    <button className="cart-qty-btn" onClick={() => setCantidad(c => c + 1)} disabled={cantidad >= stockDisponible}>+</button>
                  </div>
                  {cantidadEnCarrito > 0 && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{cantidadEnCarrito} en carrito</span>}
                </div>

                <button
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  disabled={!puedeAgregar}
                  onClick={handleAgregar}
                >
                  {!producto.disponible ? 'No disponible'
                    : stock <= 0 ? 'Sin stock'
                    : !puedeAgregar ? `Máx. ${stock} en carrito`
                    : `+ Agregar al carrito · $${(Number(producto.precio_venta) * cantidad).toFixed(2)}`}
                </button>
              </>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 8 }}>
                <a href="/login" style={{ color: 'var(--color-accent)', fontWeight: 600 }}>Iniciá sesión</a> para agregar al carrito.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
