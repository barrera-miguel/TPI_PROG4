import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { pedidosService } from '../../services/pedidos.service'
import { pagosService } from '../../services/pagos.service'
import { useAuthStore } from '../../stores/authStore'
import { useWSStore } from '../../stores/wsStore'
import { useOrderStatusWS } from '../../hooks/useOrderStatusWS'
import { EstadoBadge } from '../../components/EstadoBadge'
import { SpinnerCenter } from '../../components/Spinner'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toast'

export function PedidoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const pedidoId = Number(id)
  const { usuario, isPedidos } = useAuthStore()
  const connectionStatus = useWSStore(s => s.connectionStatus)
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const [cancelModal, setCancelModal] = useState(false)
  const [motivoCancel, setMotivoCancel] = useState('')
  const [pagoLoading, setPagoLoading] = useState(false)

  const { data: pedido, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pedido', pedidoId],
    queryFn: () => (isPedidos() ? pedidosService.detalleAdmin(pedidoId) : pedidosService.detalle(pedidoId)),
    enabled: !!pedidoId,
  })

  useOrderStatusWS(pedidoId || null)

  const cancelarMut = useMutation({
    mutationFn: () => pedidosService.cancelar(pedidoId, motivoCancel),
    onSuccess: () => { toast.success('Pedido cancelado'); setCancelModal(false); qc.invalidateQueries({ queryKey: ['pedido', pedidoId] }) },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo cancelar el pedido'),
  })

  const handlePagar = async () => {
    setPagoLoading(true)
    try {
      const pref = await pagosService.crearPreferencia(pedidoId)
      if (pref.init_point) window.location.href = pref.init_point
    } catch { toast.error('No se pudo iniciar el pago. Verificá tu conexión o intentá de nuevo') }
    finally { setPagoLoading(false) }
  }

  if (isLoading) return <div className="page-wrapper"><SpinnerCenter /></div>
  if (isError) {
    const status = (error as any)?.response?.status
    const msg = status === 403 ? 'No tenés acceso a este pedido' : 'Error al cargar el pedido'
    return (
      <div className="page-wrapper">
        <div className="container page-content" style={{ maxWidth: 900 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>← Volver</button>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ color: 'var(--color-danger)', fontSize: 16, marginBottom: 16 }}>⚠️ {msg}</p>
            <button className="btn btn-primary" onClick={() => refetch()}>Reintentar</button>
          </div>
        </div>
      </div>
    )
  }
  if (!pedido) return <div className="page-wrapper"><div className="container page-content"><p>Pedido no encontrado</p></div></div>

  const esDueño = usuario?.id === pedido.usuario_id
  const puedeCancel = (esDueño || isPedidos()) && pedido.estado_codigo === 'PENDIENTE'
  const necesitaPago = pedido.forma_pago_codigo === 'MERCADOPAGO' && (!pedido.pago || pedido.pago.estado === 'pendiente' || pedido.pago.estado === 'rechazado')

  const formatDireccion = (snapshot: string) => {
    try {
      const d = JSON.parse(snapshot)
      const lineas = [d.linea1, d.linea2].filter(Boolean).join(', ')
      const localidad = [d.ciudad, d.provincia, d.codigo_postal].filter(Boolean).join(', ')
      return { alias: d.alias ?? null, detalle: [lineas, localidad].filter(Boolean).join(' — ') }
    } catch {
      return { alias: null, detalle: snapshot }
    }
  }

  const getTimelineDot = (estado: string) => {
    if (estado === 'CANCELADO') return 'cancelled'
    if (estado === pedido.estado_codigo) return 'active'
    return 'done'
  }

  return (
    <div className="page-wrapper">
      <div className="container page-content" style={{ maxWidth: 900 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>← Volver</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <h1 className="section-title font-display">Pedido #{pedido.id}</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 4 }}>
              {pedido.created_at ? new Date(pedido.created_at).toLocaleString('es-AR') : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <EstadoBadge estado={pedido.estado_codigo} />
            {puedeCancel && <button className="btn btn-danger btn-sm" onClick={() => setCancelModal(true)}>Cancelar pedido</button>}
            {necesitaPago && esDueño && (
              <button className="btn btn-primary" onClick={handlePagar} disabled={pagoLoading}>
                {pagoLoading ? 'Cargando...' : '💳 Pagar ahora'}
              </button>
            )}
          </div>
        </div>

        <div className="grid-2" style={{ alignItems: 'flex-start', gap: 24 }}>
          {/* Info pedido */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: 12 }}>📦 Detalle del pedido</h3>
              {pedido.items.map((item, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--color-border)', fontSize: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>{item.nombre_snapshot} × {item.cantidad}</span>
                    <span>${Number(item.subtotal_snap).toFixed(2)}</span>
                  </div>
                  {item.personalizacion.length > 0 && <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 2 }}>Personalizado</div>}
                </div>
              ))}
              <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span><span>${Number(pedido.subtotal).toFixed(2)}</span>
                </div>
                {Number(pedido.descuento) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)' }}>
                    <span>Descuento</span><span>-${Number(pedido.descuento).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Envío</span><span>${Number(pedido.costo_envio).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, paddingTop: 8, borderTop: '1px solid var(--color-border)', color: 'var(--color-accent)', fontFamily: 'var(--font-display)' }}>
                  <span>Total</span><span>${Number(pedido.total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {pedido.direccion_snapshot && (() => {
              const { alias, detalle } = formatDireccion(pedido.direccion_snapshot!)
              return (
                <div className="card">
                  <h3 style={{ fontWeight: 700, marginBottom: 8 }}>📍 Dirección</h3>
                  {alias && <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{alias}</p>}
                  <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{detalle}</p>
                </div>
              )
            })()}

            {pedido.pago && (
              <div className="card">
                <h3 style={{ fontWeight: 700, marginBottom: 8 }}>💳 Pago</h3>
                <div style={{ fontSize: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Estado</span>
                    <span className={`badge ${pedido.pago.estado === 'approved' ? 'badge-green' : pedido.pago.estado === 'rejected' ? 'badge-red' : 'badge-yellow'}`}>{pedido.pago.estado}</span>
                  </div>
                  {pedido.pago.mp_status_detail && <div style={{ marginTop: 6, color: 'var(--color-text-dim)', fontSize: 12 }}>{pedido.pago.mp_status_detail}</div>}
                </div>
              </div>
            )}

            {pedido.notas && (
              <div className="card">
                <h3 style={{ fontWeight: 700, marginBottom: 8 }}>📝 Notas</h3>
                <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{pedido.notas}</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 20 }}>🕐 Historial de estados
              {connectionStatus !== 'connected' && <span style={{ fontSize: 11, color: 'var(--color-warning)', marginLeft: 8 }}>(sin conexión en vivo)</span>}
            </h3>
            <div className="timeline">
              {pedido.historial.map((h, i) => {
                const dotClass = h.estado_hasta === 'CANCELADO' ? 'cancelled' : i === pedido.historial.length - 1 ? 'active' : 'done'
                const labels: Record<string, string> = { PENDIENTE: 'Pendiente', CONFIRMADO: 'Confirmado', EN_PREPARACION: 'En preparación', ENTREGADO: '✓ Entregado', CANCELADO: '✗ Cancelado' }
                return (
                  <div key={i} className="timeline-item">
                    <div className={`timeline-dot ${dotClass}`} />
                    <div className="timeline-content">
                      <div className="timeline-estado">{labels[h.estado_hasta] ?? h.estado_hasta}</div>
                      {h.created_at && <div className="timeline-meta">{new Date(h.created_at).toLocaleString('es-AR')}</div>}
                      {h.motivo && <div className="timeline-motivo">"{h.motivo}"</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {cancelModal && (
          <Modal title="Cancelar pedido" onClose={() => setCancelModal(false)}
            footer={<>
              <button className="btn btn-secondary" onClick={() => setCancelModal(false)}>Volver</button>
              <button className="btn btn-danger" onClick={() => cancelarMut.mutate()} disabled={!motivoCancel.trim() || cancelarMut.isPending}>
                {cancelarMut.isPending ? 'Cancelando...' : 'Confirmar cancelación'}
              </button>
            </>}>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>Indicá el motivo de la cancelación:</p>
            <textarea className="form-textarea" value={motivoCancel} onChange={e => setMotivoCancel(e.target.value)} placeholder="Ej: Me arrepentí del pedido..." required />
          </Modal>
        )}
      </div>
    </div>
  )
}
