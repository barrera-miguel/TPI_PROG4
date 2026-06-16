import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { pagosService } from '../../services/pagos.service'
import { useToast } from '../../components/Toast'

export function PagoResultPage() {
  const { id, estado } = useParams<{ id: string; estado: string }>()
  const [confirmed, setConfirmed] = useState(false)
  const [pagoLoading, setPagoLoading] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (id && estado === 'success') {
      pagosService.confirmar(Number(id)).then(() => setConfirmed(true)).catch(() => setConfirmed(true))
    }
  }, [id, estado])

  const handleReintentar = async () => {
    if (!id) return
    setPagoLoading(true)
    try {
      const pref = await pagosService.crearPreferencia(Number(id))
      if (pref.init_point) window.location.href = pref.init_point
    } catch {
      toast.error('No se pudo iniciar el pago. Intentá de nuevo.')
    } finally {
      setPagoLoading(false)
    }
  }

  const config = {
    success: { icon: '✅', title: '¡Pago exitoso!', msg: 'Tu pago fue procesado correctamente. Pronto estaremos preparando tu pedido.', color: 'var(--color-success)' },
    failure: { icon: '❌', title: 'Pago rechazado', msg: 'No se pudo procesar tu pago. Podés intentarlo de nuevo.', color: 'var(--color-danger)' },
    pending: { icon: '⏳', title: 'Pago pendiente', msg: 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.', color: 'var(--color-warning)' },
  }[estado ?? 'pending'] ?? { icon: '❓', title: 'Estado desconocido', msg: '', color: 'var(--color-text-muted)' }

  return (
    <div className="page-wrapper">
      <div className="container page-content" style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{config.icon}</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: config.color, marginBottom: 12 }}>{config.title}</h1>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 32 }}>{config.msg}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {estado === 'failure' && (
              <button className="btn btn-primary" onClick={handleReintentar} disabled={pagoLoading}>
                {pagoLoading ? 'Cargando...' : '💳 Reintentar pago'}
              </button>
            )}
            <Link to={`/orders/${id}`} className="btn btn-secondary">Ver mi pedido →</Link>
            <Link to="/" className="btn btn-secondary">Volver al menú</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
