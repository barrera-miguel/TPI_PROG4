import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pedidosService } from '../../services/pedidos.service'
import { useAdminOrdersFeed } from '../../hooks/useAdminOrdersFeed'
import { EstadoBadge } from '../../components/EstadoBadge'
import { Modal } from '../../components/Modal'
import { Pagination } from '../../components/Pagination'
import { SpinnerCenter } from '../../components/Spinner'
import { EmptyState } from '../../components/EmptyState'
import { useToast } from '../../components/Toast'
import type { PedidoPublico } from '../../types'

const FSM: Record<string, string[]> = {
  PENDIENTE: ['CONFIRMADO', 'CANCELADO'],
  CONFIRMADO: ['EN_PREPARACION', 'CANCELADO'],
  EN_PREPARACION: ['ENTREGADO', 'CANCELADO'],
  ENTREGADO: [],
  CANCELADO: [],
}
const ESTADOS = ['', 'PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'ENTREGADO', 'CANCELADO']
const LABELS: Record<string, string> = { PENDIENTE:'Pendiente', CONFIRMADO:'Confirmado', EN_PREPARACION:'En preparación', ENTREGADO:'Entregado', CANCELADO:'Cancelado' }

export function AdminPedidosPage() {
  const [page, setPage] = useState(1)
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [avanzarModal, setAvanzarModal] = useState<PedidoPublico | null>(null)
  const [estadoHasta, setEstadoHasta] = useState('')
  const [motivo, setMotivo] = useState('')
  const toast = useToast()
  const qc = useQueryClient()

  useAdminOrdersFeed()

  const { data, isLoading } = useQuery({
    queryKey: ['pedidos-admin', page, estadoFiltro],
    queryFn: () => pedidosService.listarAdmin({ page, size: 20, estado: estadoFiltro || undefined }),
  })

  const avanzarMut = useMutation({
    mutationFn: () => pedidosService.avanzarEstado(avanzarModal!.id, estadoHasta, motivo || undefined),
    onSuccess: () => {
      toast.success('Estado actualizado')
      setAvanzarModal(null)
      qc.invalidateQueries({ queryKey: ['pedidos-admin'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo actualizar el estado del pedido'),
  })

  const openAvanzar = (p: PedidoPublico) => {
    setAvanzarModal(p)
    const sigs = FSM[p.estado_codigo] ?? []
    setEstadoHasta(sigs[0] ?? '')
    setMotivo('')
  }

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title font-display">🧾 Pedidos</h1>
      </div>
      <div className="filters-bar">
        <select className="form-select" value={estadoFiltro} onChange={e => { setEstadoFiltro(e.target.value); setPage(1) }}>
          {ESTADOS.map(e => <option key={e} value={e}>{e ? LABELS[e] : 'Todos los estados'}</option>)}
        </select>
      </div>

      {isLoading ? <SpinnerCenter /> : !data?.items.length ? <EmptyState title="Sin pedidos" /> : (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>#</th><th>Usuario</th><th>Fecha</th><th>Estado</th><th>Pago</th><th>Total</th><th></th></tr></thead>
              <tbody>
                {data.items.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>#{p.id}</td>
                    <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>ID {p.usuario_id}</td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString('es-AR') : '—'}</td>
                    <td><EstadoBadge estado={p.estado_codigo} /></td>
                    <td style={{ fontSize: 13 }}>{p.forma_pago_codigo}</td>
                    <td style={{ fontWeight: 700, color: 'var(--color-accent)' }}>${Number(p.total).toFixed(2)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link to={`/orders/${p.id}`} className="btn btn-ghost btn-sm">Ver</Link>
                        {(FSM[p.estado_codigo]?.length ?? 0) > 0 && (
                          <button className="btn btn-primary btn-sm" onClick={() => openAvanzar(p)}>Avanzar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}

      {avanzarModal && (
        <Modal title={`Avanzar pedido #${avanzarModal.id}`} onClose={() => setAvanzarModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setAvanzarModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={() => avanzarMut.mutate()} disabled={!estadoHasta || avanzarMut.isPending}>{avanzarMut.isPending ? 'Guardando...' : 'Confirmar'}</button></>}>
          <div className="form-group">
            <label className="form-label">Estado actual</label>
            <div><EstadoBadge estado={avanzarModal.estado_codigo} /></div>
          </div>
          <div className="form-group">
            <label className="form-label">Nuevo estado *</label>
            <select className="form-select" value={estadoHasta} onChange={e => setEstadoHasta(e.target.value)}>
              {(FSM[avanzarModal.estado_codigo] ?? []).map(e => <option key={e} value={e}>{LABELS[e] ?? e}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Motivo (opcional)</label>
            <textarea className="form-textarea" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo del cambio de estado..." style={{ minHeight: 70 }} />
          </div>
        </Modal>
      )}
    </div>
  )
}
