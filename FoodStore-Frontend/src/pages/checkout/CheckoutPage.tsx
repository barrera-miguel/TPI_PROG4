import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { pedidosService } from '../../services/pedidos.service'
import { pagosService } from '../../services/pagos.service'
import { direccionesService } from '../../services/direcciones.service'
import { useCartStore } from '../../stores/cartStore'
import { useToast } from '../../components/Toast'
import { SpinnerCenter } from '../../components/Spinner'
import type { PedidoCrear } from '../../types'

const FORMAS_PAGO = [
  { codigo: 'EFECTIVO', label: '💵 Efectivo' },
  { codigo: 'TRANSFERENCIA', label: '🏦 Transferencia' },
  { codigo: 'MERCADOPAGO', label: '💳 MercadoPago' },
]

export function CheckoutPage() {
  const { items, total, vaciar } = useCartStore()
  const [direccionId, setDireccionId] = useState<number | ''>('')
  const [formaPago, setFormaPago] = useState('EFECTIVO')
  const [notas, setNotas] = useState('')
  const toast = useToast()
  const navigate = useNavigate()
  const redirectingToMP = useRef(false)

  const { data: direcciones, isLoading } = useQuery({ queryKey: ['direcciones'], queryFn: direccionesService.listar })

  const crearPedidoMut = useMutation({
    mutationFn: (d: PedidoCrear) => pedidosService.crear(d),
    onSuccess: async (pedido) => {
      if (formaPago === 'MERCADOPAGO') {
        try {
          const pref = await pagosService.crearPreferencia(pedido.id)
          if (pref.init_point) { redirectingToMP.current = true; vaciar(); window.location.href = pref.init_point; return }
        } catch {
          vaciar()
          toast.success('Pedido creado. El pago falló — podés pagar desde Mis Pedidos')
          navigate(`/orders/${pedido.id}`)
          return
        }
      }
      vaciar()
      toast.success('¡Pedido creado exitosamente!')
      navigate(`/orders/${pedido.id}`)
    },
    onError: (err: any) => toast.error(err.response?.data?.detail ?? 'No se pudo crear el pedido. Verificá tu conexión'),
  })

  // Redirigir si el carrito está vacío (no durante render, no si vamos a MP)
  useEffect(() => {
    if (redirectingToMP.current) return
    if (!isLoading && !items.length) navigate('/')
  }, [items.length, isLoading, navigate])

  if (isLoading) return <div className="page-wrapper"><SpinnerCenter /></div>
  if (!items.length) return null

  const handleConfirmar = () => {
    // Validar stock antes de enviar
    const sinStock = items.find(i => {
      const stock = i.producto.stock_calculado
      return stock != null && i.cantidad > stock
    })
    if (sinStock) {
      toast.error(`"${sinStock.producto.nombre}" solo tiene ${sinStock.producto.stock_calculado} disponibles`)
      return
    }

    const pedido: PedidoCrear = {
      direccion_id: direccionId ? Number(direccionId) : undefined,
      forma_pago_codigo: formaPago,
      notas: notas || undefined,
      items: items.map(i => ({ producto_id: i.producto.id, cantidad: i.cantidad, personalizacion: i.ingredientesRemovidos })),
    }
    crearPedidoMut.mutate(pedido)
  }

  return (
    <div className="page-wrapper">
      <div className="container page-content" style={{ maxWidth: 800 }}>
        <h1 className="section-title font-display" style={{ marginBottom: 32 }}>🛒 Confirmar pedido</h1>
        <div className="grid-2" style={{ alignItems: 'flex-start', gap: 28 }}>
          {/* Resumen */}
          <div className="card">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Resumen del pedido</h2>
            {items.map(item => (
              <div key={item.producto.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border)', fontSize: 14 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.producto.nombre} × {item.cantidad}</div>
                  {item.ingredientesRemovidos.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
                      Sin: {item.producto.ingredientes.filter(i => item.ingredientesRemovidos.includes(i.id)).map(i => i.nombre).join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ fontWeight: 600 }}>${(Number(item.producto.precio_venta) * item.cantidad).toFixed(2)}</div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>
              <span>Total</span>
              <span style={{ color: 'var(--color-accent)' }}>${total().toFixed(2)}</span>
            </div>
          </div>

          {/* Opciones */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📍 Dirección de entrega</h2>
              <select className="form-select" value={direccionId} onChange={e => setDireccionId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Sin dirección (retiro en local)</option>
                {direcciones?.map(d => (
                  <option key={d.id} value={d.id}>{d.alias ? `${d.alias} — ` : ''}{d.linea1}, {d.ciudad}</option>
                ))}
              </select>
            </div>

            <div className="card">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>💳 Forma de pago</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {FORMAS_PAGO.map(fp => (
                  <label key={fp.codigo} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: `1px solid ${formaPago === fp.codigo ? 'var(--color-accent)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: formaPago === fp.codigo ? 'var(--color-accent-light)' : 'transparent' }}>
                    <input type="radio" name="forma_pago" value={fp.codigo} checked={formaPago === fp.codigo} onChange={() => setFormaPago(fp.codigo)} style={{ accentColor: 'var(--color-accent)' }} />
                    <span style={{ fontSize: 14, fontWeight: formaPago === fp.codigo ? 600 : 400 }}>{fp.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📝 Notas (opcional)</h2>
              <textarea className="form-textarea" placeholder="Instrucciones especiales..." value={notas} onChange={e => setNotas(e.target.value)} style={{ minHeight: 70 }} />
            </div>

            <button className="btn btn-primary btn-lg" onClick={handleConfirmar} disabled={crearPedidoMut.isPending}>
              {crearPedidoMut.isPending ? 'Creando pedido...' : formaPago === 'MERCADOPAGO' ? '💳 Ir a pagar con MercadoPago' : '✓ Confirmar pedido'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
