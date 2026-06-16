import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { categoriasService } from '../../services/categorias.service'
import { uploadsService } from '../../services/uploads.service'
import { Modal, ConfirmModal } from '../../components/Modal'
import { CategoriaTree } from '../../components/CategoriaTree'
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

function filterTree(nodes: CategoriaNodo[], query: string): CategoriaNodo[] {
  if (!query) return nodes
  const q = query.toLowerCase()
  const filter = (ns: CategoriaNodo[]): CategoriaNodo[] => {
    return ns.reduce<CategoriaNodo[]>((acc, n) => {
      const hijos = filter(n.hijos)
      const matches = n.nombre.toLowerCase().includes(q) || (n.descripcion && n.descripcion.toLowerCase().includes(q))
      if (matches || hijos.length > 0) acc.push({ ...n, hijos })
      return acc
    }, [])
  }
  return filter(nodes)
}

export function CategoriasPage() {
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'crear' | 'editar' | 'borrar' | null>(null)
  const [sel, setSel] = useState<CategoriaRead | null>(null)
  const [form, setForm] = useState<CategoriaCreate>(EMPTY)
  const toast = useToast(); const qc = useQueryClient()
  const inv = () => { qc.invalidateQueries({ queryKey: ['categorias-arbol'] }) }
  const [uploading, setUploading] = useState(false)
  const [imgError, setImgError] = useState<string | null>(null)

  const { data: arbol, isLoading } = useQuery({ queryKey: ['categorias-arbol'], queryFn: categoriasService.arbol })

  const filteredArbol = useMemo(() => arbol ? filterTree(arbol, search) : [], [arbol, search])

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

  const handleSelectParent = (id: number | null) => {
    setForm(f => ({ ...f, parent_id: id ?? undefined }))
  }

  const openEditar = (c: CategoriaRead) => {
    setSel(c); setForm({ nombre: c.nombre, descripcion: c.descripcion ?? '', parent_id: c.parent_id, imagen_url: c.imagen_url }); setModal('editar')
  }

  const openCrearHijo = (parentId: number) => {
    setForm({ ...EMPTY, parent_id: parentId }); setModal('crear')
  }

  const excludedIds = (modal === 'editar' && sel && arbol) ? getAllDescendants(arbol, sel.id) : new Set<number>()

  const FormContent = (
    <>
      <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={form.nombre} onChange={set('nombre')} required /></div>
      <div className="form-group"><label className="form-label">Descripción</label><textarea className="form-textarea" value={form.descripcion ?? ''} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value || undefined }))} /></div>
      <div className="form-group">
        <label className="form-label">Categoría padre</label>
        {arbol && arbol.length > 0 ? (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 8, maxHeight: 260, overflowY: 'auto', background: 'var(--color-surface2)' }}>
            <CategoriaTree
              nodes={arbol}
              mode="select-parent"
              selectedParentId={form.parent_id ?? null}
              onSelectParent={handleSelectParent}
              excludeIds={excludedIds}
            />
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>No hay categorías disponibles.</p>
        )}
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

      {isLoading ? <SpinnerCenter /> : !arbol?.length ? <EmptyState icon="🗂️" title="Sin categorías" /> : (
        <>
          <div className="filters-bar">
            <input
              className="form-input"
              placeholder="Buscar categoría..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </div>

          {filteredArbol.length === 0 ? (
            <EmptyState icon="🔍" title="Sin resultados" />
          ) : (
            <div className="card" style={{ padding: 16 }}>
              <CategoriaTree
                nodes={filteredArbol}
                mode="display"
                onEdit={openEditar}
                onDelete={(c) => { setSel(c); setModal('borrar') }}
                onAddChild={openCrearHijo}
              />
            </div>
          )}
        </>
      )}

      {(modal === 'crear' || modal === 'editar') && (
        <Modal
          title={modal === 'crear' ? 'Nueva categoría' : `Editar: ${sel?.nombre}`}
          onClose={() => setModal(null)}
          size="lg"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={() => modal === 'crear' ? crearMut.mutate(form) : editarMut.mutate({ id: sel!.id, d: form })}
                disabled={crearMut.isPending || editarMut.isPending}
              >
                {crearMut.isPending || editarMut.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          }
        >
          {FormContent}
        </Modal>
      )}

      {modal === 'borrar' && sel && (
        <ConfirmModal
          msg={`¿Eliminar "${sel.nombre}"?`}
          onConfirm={() => borrarMut.mutate(sel.id)}
          onCancel={() => setModal(null)}
          loading={borrarMut.isPending}
          danger
        />
      )}
    </div>
  )
}
