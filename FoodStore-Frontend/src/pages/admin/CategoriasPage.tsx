import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { categoriasService } from '../../services/categorias.service'
import { uploadsService } from '../../services/uploads.service'
import { Modal, ConfirmModal } from '../../components/Modal'
import { Pagination } from '../../components/Pagination'
import { SpinnerCenter } from '../../components/Spinner'
import { EmptyState } from '../../components/EmptyState'
import { useToast } from '../../components/Toast'
import type { CategoriaRead, CategoriaCreate, CategoriaUpdate, CategoriaNodo, CloudinaryResponse } from '../../types'

const EMPTY: CategoriaCreate = { nombre: '', descripcion: '', parent_id: undefined, imagen_url: undefined }

function getAllDescendants(nodes: CategoriaNodo[], targetId: number): Set<number> {
  const ids = new Set<number>()
  const visit = (ns: CategoriaNodo[]) => ns.forEach(n => { if (n.id === targetId || ids.has(n.parent_id!)) { ids.add(n.id); visit(n.hijos) } else visit(n.hijos) })
  visit(nodes)
  return ids
}

export function CategoriasPage() {
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<'crear' | 'editar' | 'borrar' | null>(null)
  const [sel, setSel] = useState<CategoriaRead | null>(null)
  const [form, setForm] = useState<CategoriaCreate>(EMPTY)
  const toast = useToast(); const qc = useQueryClient()
  const inv = () => { qc.invalidateQueries({ queryKey: ['categorias'] }); qc.invalidateQueries({ queryKey: ['categorias-arbol'] }) }
  const [uploading, setUploading] = useState(false)
  const [imgError, setImgError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['categorias', page], queryFn: () => categoriasService.listar({ page, size: 20 }) })
  const { data: arbol } = useQuery({ queryKey: ['categorias-arbol'], queryFn: categoriasService.arbol })

  const crearMut = useMutation({ mutationFn: (d: CategoriaCreate) => categoriasService.crear(d), onSuccess: () => { toast.success('Categoría creada'); setModal(null); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo crear la categoría') })
  const editarMut = useMutation({ mutationFn: ({ id, d }: { id: number; d: CategoriaUpdate }) => categoriasService.actualizar(id, d), onSuccess: () => { toast.success('Actualizada'); setModal(null); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo actualizar la categoría') })
  const borrarMut = useMutation({ mutationFn: (id: number) => categoriasService.eliminar(id), onSuccess: () => { toast.success('Eliminada'); setModal(null); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo eliminar la categoría') })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value || undefined }))

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setImgError(null)
    try {
      const res: CloudinaryResponse = await uploadsService.subirImagen(file)
      setForm(f => ({ ...f, imagen_url: res.secure_url }))
      toast.success('Imagen subida')
    } catch (err: any) {
      setImgError(err.response?.data?.detail ?? 'No se pudo subir la imagen')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleEliminarImagen = async () => {
    const url = form.imagen_url
    if (!url) return
    const publicId = url.split('/').slice(-1)[0]?.split('.')[0]
    setForm(f => ({ ...f, imagen_url: undefined }))
    if (publicId) {
      try { await uploadsService.eliminarImagen(publicId) } catch { /* */ }
    }
  }

  const flatCats: { id: number; nombre: string; depth: number }[] = []
  const flatten = (nodes: any[], d = 0) => nodes.forEach(n => { flatCats.push({ id: n.id, nombre: n.nombre, depth: d }); flatten(n.hijos ?? [], d + 1) })
  if (arbol) flatten(arbol)

  const openEditar = (c: CategoriaRead) => {
    setSel(c); setForm({ nombre: c.nombre, descripcion: c.descripcion ?? '', parent_id: c.parent_id, imagen_url: c.imagen_url }); setModal('editar')
  }

  // Filtrar categorías que causarían ciclo
  const excludedIds = (modal === 'editar' && sel && arbol) ? getAllDescendants(arbol, sel.id) : new Set<number>()

  const FormContent = (
    <>
      <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={form.nombre} onChange={set('nombre')} required /></div>
      <div className="form-group"><label className="form-label">Descripción</label><textarea className="form-textarea" value={form.descripcion ?? ''} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value || undefined }))} /></div>
      <div className="form-group">
        <label className="form-label">Categoría padre</label>
        <select className="form-select" value={form.parent_id ?? ''} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value ? Number(e.target.value) : undefined }))}>
          <option value="">Sin padre (raíz)</option>
          {flatCats.filter(c => modal !== 'editar' || (c.id !== sel?.id && !excludedIds.has(c.id))).map(c => (
            <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.nombre}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Imagen</label>
        {form.imagen_url ? (
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
            <img src={form.imagen_url} alt="" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--color-border)' }} />
            <button
              onClick={handleEliminarImagen}
              style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(220,38,38,.85)', color: '#fff', fontSize: 13, cursor: 'pointer', lineHeight: 1 }}
            >×</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} disabled={uploading} style={{ fontSize: 13 }} />
            {uploading && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Subiendo...</span>}
          </div>
        )}
        {!form.imagen_url && <p style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 4 }}>JPEG, PNG o WebP. Máx 5 MB.</p>}
        {imgError && <p style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 4 }}>{imgError}</p>}
      </div>
    </>
  )

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title font-display">🗂️ Categorías</h1>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setModal('crear') }}>+ Nueva categoría</button>
      </div>
      {isLoading ? <SpinnerCenter /> : !data?.items.length ? <EmptyState icon="🗂️" title="Sin categorías" /> : (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Nombre</th><th>Descripción</th><th>Padre</th><th></th></tr></thead>
              <tbody>
                {data.items.map(c => {
                  const padre = flatCats.find(x => x.id === c.parent_id)
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                      <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{c.descripcion ?? '—'}</td>
                      <td style={{ fontSize: 13 }}>{padre?.nombre ?? <span style={{ color: 'var(--color-text-dim)' }}>Raíz</span>}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEditar(c)}>✏️ Editar</button>
                          <button className="btn btn-danger btn-sm" onClick={() => { setSel(c); setModal('borrar') }}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
      {(modal === 'crear' || modal === 'editar') && (
        <Modal title={modal === 'crear' ? 'Nueva categoría' : `Editar: ${sel?.nombre}`} onClose={() => setModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={() => modal === 'crear' ? crearMut.mutate(form) : editarMut.mutate({ id: sel!.id, d: form })} disabled={crearMut.isPending || editarMut.isPending}>{crearMut.isPending || editarMut.isPending ? 'Guardando...' : 'Guardar'}</button></>}>
          {FormContent}
        </Modal>
      )}
      {modal === 'borrar' && sel && <ConfirmModal msg={`¿Eliminar "${sel.nombre}"?`} onConfirm={() => borrarMut.mutate(sel.id)} onCancel={() => setModal(null)} loading={borrarMut.isPending} danger />}
    </div>
  )
}
