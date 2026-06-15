import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { unidadesService } from '../../services/unidades.service'
import { Modal, ConfirmModal } from '../../components/Modal'
import { Pagination } from '../../components/Pagination'
import { SpinnerCenter } from '../../components/Spinner'
import { EmptyState } from '../../components/EmptyState'
import { useToast } from '../../components/Toast'
import type { UnidadMedidaPublica, UnidadMedidaCrear } from '../../types'

const TIPOS = ['masa', 'volumen', 'unidad', 'área']
const EMPTY: UnidadMedidaCrear = { nombre: '', simbolo: '', tipo: 'unidad' }

export function UnidadesMedidaPage() {
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<'crear' | 'editar' | 'borrar' | null>(null)
  const [sel, setSel] = useState<UnidadMedidaPublica | null>(null)
  const [form, setForm] = useState<UnidadMedidaCrear>(EMPTY)
  const toast = useToast(); const qc = useQueryClient()
  const inv = () => { qc.invalidateQueries({ queryKey: ['unidades'] }); qc.invalidateQueries({ queryKey: ['unidades-all'] }) }

  const { data, isLoading } = useQuery({ queryKey: ['unidades', page], queryFn: () => unidadesService.listar({ page, size: 20 }) })
  const crearMut = useMutation({ mutationFn: (d: UnidadMedidaCrear) => unidadesService.crear(d), onSuccess: () => { toast.success('Creada'); setModal(null); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo crear la unidad') })
  const editarMut = useMutation({ mutationFn: ({ id, d }: { id: number; d: UnidadMedidaCrear }) => unidadesService.actualizar(id, d), onSuccess: () => { toast.success('Actualizada'); setModal(null); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo actualizar la unidad') })
  const borrarMut = useMutation({ mutationFn: (id: number) => unidadesService.eliminar(id), onSuccess: () => { toast.success('Eliminada'); setModal(null); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo eliminar la unidad') })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
  const openEditar = (u: UnidadMedidaPublica) => { setSel(u); setForm({ nombre: u.nombre, simbolo: u.simbolo, tipo: u.tipo }); setModal('editar') }

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title font-display">📏 Unidades de Medida</h1>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setModal('crear') }}>+ Nueva unidad</button>
      </div>
      {isLoading ? <SpinnerCenter /> : !data?.items.length ? <EmptyState icon="📏" title="Sin unidades" /> : (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Nombre</th><th>Símbolo</th><th>Tipo</th><th></th></tr></thead>
              <tbody>
                {data.items.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                    <td><span className="badge badge-gray">{u.simbolo}</span></td>
                    <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{u.tipo}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditar(u)}>✏️ Editar</button>
                        <button className="btn btn-danger btn-sm" onClick={() => { setSel(u); setModal('borrar') }}>🗑</button>
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
      {(modal === 'crear' || modal === 'editar') && (
        <Modal title={modal === 'crear' ? 'Nueva unidad' : `Editar: ${sel?.nombre}`} onClose={() => setModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={() => modal === 'crear' ? crearMut.mutate(form) : editarMut.mutate({ id: sel!.id, d: form })} disabled={crearMut.isPending || editarMut.isPending}>Guardar</button></>}>
          <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={form.nombre} onChange={set('nombre')} required /></div>
          <div className="form-group"><label className="form-label">Símbolo *</label><input className="form-input" value={form.simbolo} onChange={set('simbolo')} required /></div>
          <div className="form-group"><label className="form-label">Tipo *</label><select className="form-select" value={form.tipo} onChange={set('tipo')}>{TIPOS.map(t => <option key={t}>{t}</option>)}</select></div>
        </Modal>
      )}
      {modal === 'borrar' && sel && <ConfirmModal msg={`¿Eliminar "${sel.nombre}"?`} onConfirm={() => borrarMut.mutate(sel.id)} onCancel={() => setModal(null)} loading={borrarMut.isPending} danger />}
    </div>
  )
}
