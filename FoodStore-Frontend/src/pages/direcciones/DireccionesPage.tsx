import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { direccionesService } from '../../services/direcciones.service'
import { useToast } from '../../components/Toast'
import { Modal, ConfirmModal } from '../../components/Modal'
import { SpinnerCenter } from '../../components/Spinner'
import { EmptyState } from '../../components/EmptyState'
import type { DireccionRead, DireccionCrear } from '../../types'

const EMPTY: DireccionCrear = { alias: '', linea1: '', linea2: '', ciudad: '', provincia: '', codigo_postal: '' }

export function DireccionesPage() {
  const [modal, setModal] = useState<'crear' | 'editar' | 'borrar' | null>(null)
  const [editando, setEditando] = useState<DireccionRead | null>(null)
  const [form, setForm] = useState<DireccionCrear>(EMPTY)
  const toast = useToast()
  const qc = useQueryClient()

  const { data: direcciones, isLoading } = useQuery({ queryKey: ['direcciones'], queryFn: direccionesService.listar })

  const inv = () => qc.invalidateQueries({ queryKey: ['direcciones'] })
  const crearMut = useMutation({ mutationFn: (d: DireccionCrear) => direccionesService.crear(d), onSuccess: () => { toast.success('Dirección creada'); setModal(null); inv() } })
  const editarMut = useMutation({ mutationFn: ({ id, d }: { id: number; d: DireccionCrear }) => direccionesService.actualizar(id, d), onSuccess: () => { toast.success('Dirección actualizada'); setModal(null); inv() } })
  const borrarMut = useMutation({ mutationFn: (id: number) => direccionesService.eliminar(id), onSuccess: () => { toast.success('Dirección eliminada'); setModal(null); inv() } })
  const principalMut = useMutation({ mutationFn: (id: number) => direccionesService.marcarPrincipal(id), onSuccess: () => { toast.success('Dirección principal actualizada'); inv() } })

  const openEditar = (d: DireccionRead) => {
    setEditando(d)
    setForm({ alias: d.alias ?? '', linea1: d.linea1, linea2: d.linea2 ?? '', ciudad: d.ciudad, provincia: d.provincia ?? '', codigo_postal: d.codigo_postal ?? '' })
    setModal('editar')
  }

  const set = (k: keyof DireccionCrear) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = () => {
    const d = { ...form, alias: form.alias || undefined, linea2: form.linea2 || undefined, provincia: form.provincia || undefined, codigo_postal: form.codigo_postal || undefined }
    if (modal === 'crear') crearMut.mutate(d)
    else if (editando) editarMut.mutate({ id: editando.id, d })
  }

  const FormContent = (
    <>
      <div className="form-group"><label className="form-label">Alias (ej: "Casa", "Trabajo")</label><input className="form-input" value={form.alias} onChange={set('alias')} /></div>
      <div className="form-group"><label className="form-label">Dirección *</label><input className="form-input" value={form.linea1} onChange={set('linea1')} required /></div>
      <div className="form-group"><label className="form-label">Piso / Depto</label><input className="form-input" value={form.linea2} onChange={set('linea2')} /></div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Ciudad *</label><input className="form-input" value={form.ciudad} onChange={set('ciudad')} required /></div>
        <div className="form-group"><label className="form-label">Provincia</label><input className="form-input" value={form.provincia} onChange={set('provincia')} /></div>
      </div>
      <div className="form-group"><label className="form-label">Código postal</label><input className="form-input" value={form.codigo_postal} onChange={set('codigo_postal')} /></div>
    </>
  )

  return (
    <div className="page-wrapper">
      <div className="container page-content">
        <div className="section-header">
          <div><h1 className="section-title font-display">📍 Mis direcciones</h1></div>
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setModal('crear') }}>+ Nueva dirección</button>
        </div>

        {isLoading ? <SpinnerCenter /> : !direcciones?.length ? (
          <EmptyState icon="📍" title="Sin direcciones" desc="Agregá una dirección para hacer pedidos más rápido"
            action={<button className="btn btn-primary" onClick={() => { setForm(EMPTY); setModal('crear') }}>+ Nueva dirección</button>} />
        ) : (
          <div className="grid-2">
            {direcciones.map(d => (
              <div key={d.id} className="card" style={{ border: d.es_principal ? '2px solid var(--color-accent)' : '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    {d.alias && <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.alias}</div>}
                    <div style={{ fontSize: 14 }}>{d.linea1}</div>
                    {d.linea2 && <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{d.linea2}</div>}
                    <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{d.ciudad}{d.provincia && `, ${d.provincia}`}{d.codigo_postal && ` (${d.codigo_postal})`}</div>
                    {d.es_principal && <span className="badge badge-orange" style={{ marginTop: 8 }}>★ Principal</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  {!d.es_principal && <button className="btn btn-ghost btn-sm" onClick={() => principalMut.mutate(d.id)} disabled={principalMut.isPending}>Marcar principal</button>}
                  <button className="btn btn-secondary btn-sm" onClick={() => openEditar(d)}>Editar</button>
                  <button className="btn btn-danger btn-sm" onClick={() => { setEditando(d); setModal('borrar') }}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(modal === 'crear' || modal === 'editar') && (
          <Modal title={modal === 'crear' ? 'Nueva dirección' : 'Editar dirección'} onClose={() => setModal(null)}
            footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={handleSubmit} disabled={crearMut.isPending || editarMut.isPending}>{crearMut.isPending || editarMut.isPending ? 'Guardando...' : 'Guardar'}</button></>}>
            {FormContent}
          </Modal>
        )}
        {modal === 'borrar' && editando && (
          <ConfirmModal msg={`¿Eliminar la dirección "${editando.linea1}"?`} onConfirm={() => borrarMut.mutate(editando.id)} onCancel={() => setModal(null)} loading={borrarMut.isPending} danger />
        )}
      </div>
    </div>
  )
}
