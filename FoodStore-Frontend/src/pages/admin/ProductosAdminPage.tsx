import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productosService } from '../../services/productos.service'
import { categoriasService } from '../../services/categorias.service'
import { ingredientesService } from '../../services/ingredientes.service'
import { unidadesService } from '../../services/unidades.service'
import { uploadsService } from '../../services/uploads.service'
import { useAuthStore } from '../../stores/authStore'
import { Modal, ConfirmModal } from '../../components/Modal'
import { Pagination } from '../../components/Pagination'
import { SpinnerCenter } from '../../components/Spinner'
import { EmptyState } from '../../components/EmptyState'
import { useToast } from '../../components/Toast'
import type { ProductoRead, ProductoCreate, ProductoUpdate, CloudinaryResponse } from '../../types'

const EMPTY_CREATE: ProductoCreate = { nombre: '', descripcion: '', margen_ganancia: '0', disponible: true, imagenes_url: [] }

function cloudinaryUrl(url: string, w = 120, h = 120): string {
  if (!url || !url.includes('cloudinary.com') || url.includes('f_auto')) return url
  const [base, rest] = url.split('/upload/')
  return `${base}/upload/f_auto,q_auto,c_fill,w_${w},h_${h}/${rest}`
}

const ORDENES: { value: string; label: string }[] = [
  { value: '', label: 'Orden default' },
  { value: 'az', label: 'A-Z' },
  { value: 'za', label: 'Z-A' },
  { value: 'stock+', label: 'Stock ↑' },
  { value: 'stock-', label: 'Stock ↓' },
]

export function ProductosAdminPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [nombre, setNombre] = useState('')
  const [modal, setModal] = useState<'crear' | 'editar' | 'borrar' | 'stock' | 'cats' | 'ings' | null>(null)
  const [seleccionado, setSeleccionado] = useState<ProductoRead | null>(null)
  const [form, setForm] = useState<ProductoCreate>(EMPTY_CREATE)
  const [stockForm, setStockForm] = useState({ stock_directo: 0, precio_base: '' })
  const [nuevaCat, setNuevaCat] = useState({ categoria_id: 0, es_principal: false })
  const [nuevoIng, setNuevoIng] = useState({ ingrediente_id: 0, cantidad: '', unidad_medida_id: 0, es_removible: false })
  const [filtroDisp, setFiltroDisp] = useState('')
  const [filtroCat, setFiltroCat] = useState('')
  const [orden, setOrden] = useState('')
  const { isAdmin, isStock } = useAuthStore()
  const esStockNoAdmin = isStock() && !isAdmin()
  const toast = useToast()
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['productos-admin-all'] })
  const [uploading, setUploading] = useState(false)
  const [imgError, setImgError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['productos-admin-all'], queryFn: () => productosService.listar({ page: 1, size: 100 }) })
  const { data: cats } = useQuery({ queryKey: ['categorias-arbol'], queryFn: categoriasService.arbol })
  const { data: ings } = useQuery({ queryKey: ['ingredientes-all'], queryFn: () => ingredientesService.listar({ size: 100 }) })
  const { data: unidades } = useQuery({ queryKey: ['unidades-all'], queryFn: () => unidadesService.listar({ size: 100 }) })

  const crearMut = useMutation({ mutationFn: (d: ProductoCreate) => productosService.crear(d), onSuccess: () => { toast.success('Producto creado'); setModal(null); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo crear el producto') })
  const editarMut = useMutation({ mutationFn: ({ id, d }: { id: number; d: ProductoUpdate }) => productosService.actualizar(id, d), onSuccess: () => { toast.success('Producto actualizado'); setModal(null); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo actualizar el producto') })
  const borrarMut = useMutation({ mutationFn: (id: number) => productosService.eliminar(id), onSuccess: () => { toast.success('Eliminado'); setModal(null); inv() } })
  const dispMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: boolean }) => productosService.actualizarDisponibilidad(id, d),
    onMutate: async ({ id, d }) => {
      await qc.cancelQueries({ queryKey: ['productos-admin-all'] })
      const prev = qc.getQueryData<{ items: ProductoRead[] }>(['productos-admin-all'])
      if (prev) {
        qc.setQueryData(['productos-admin-all'], {
          ...prev,
          items: prev.items.map((p: ProductoRead) => p.id === id ? { ...p, disponible: d } : p),
        })
      }
      return { prev }
    },
    onError: (_err: any, _vars: any, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['productos-admin-all'], ctx.prev)
    },
  })
  const stockMut = useMutation({ mutationFn: ({ id, d }: { id: number; d: { stock_directo: number; precio_base?: string } }) => productosService.actualizarStock(id, d), onSuccess: () => { toast.success('Stock actualizado'); setModal(null); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo actualizar el stock') })
  const addCatMut = useMutation({ mutationFn: ({ id, d }: { id: number; d: any }) => productosService.agregarCategoria(id, d), onSuccess: (p) => { setSeleccionado(p); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo agregar la categoría') })
  const remCatMut = useMutation({ mutationFn: ({ id, cid }: { id: number; cid: number }) => productosService.quitarCategoria(id, cid), onSuccess: () => { qc.invalidateQueries({ queryKey: ['producto-detail', seleccionado?.id] }); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Error al quitar categoría') })
  const addIngMut = useMutation({ mutationFn: ({ id, d }: { id: number; d: any }) => productosService.agregarIngrediente(id, d), onSuccess: (p) => { setSeleccionado(p); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo agregar el ingrediente') })
  const remIngMut = useMutation({ mutationFn: ({ id, iid }: { id: number; iid: number }) => productosService.quitarIngrediente(id, iid), onSuccess: () => inv(), onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Error al quitar ingrediente') })

  const flatCats: { id: number; nombre: string }[] = []
  const flattenCats = (nodes: any[], d = 0) => nodes.forEach(n => { flatCats.push({ id: n.id, nombre: ('  '.repeat(d)) + n.nombre }); if (n.hijos?.length) flattenCats(n.hijos, d+1) })
  if (cats) flattenCats(cats)

  const openEditar = (p: ProductoRead) => {
    setSeleccionado(p)
    setForm({ nombre: p.nombre, descripcion: p.descripcion ?? '', margen_ganancia: p.margen_ganancia, disponible: p.disponible, unidad_venta_id: p.unidad_venta_id, stock_directo: p.stock_directo, precio_base: p.precio_base, imagenes_url: p.imagenes_url ?? [] })
    setModal('editar')
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setImgError(null)
    try {
      const res: CloudinaryResponse = await uploadsService.subirImagen(file)
      setForm(f => ({ ...f, imagenes_url: [...(f.imagenes_url ?? []), res.secure_url] }))
      toast.success('Imagen subida')
    } catch (err: any) {
      setImgError(err.response?.data?.detail ?? 'No se pudo subir la imagen')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleEliminarImagen = async (url: string) => {
    const publicId = url.split('/').slice(-1)[0]?.split('.')[0]
    const idx = (form.imagenes_url ?? []).indexOf(url)
    setForm(f => ({ ...f, imagenes_url: (f.imagenes_url ?? []).filter((_, i) => i !== idx) }))
    if (publicId) {
      try { await uploadsService.eliminarImagen(publicId) } catch { /* ya fue removida del array */ }
    }
  }

  // Filtrado y ordenamiento frontend
  const items = useMemo(() => {
    if (!data?.items) return []
    let filtered = data.items.filter(p =>
      p.nombre.toLowerCase().includes(nombre.toLowerCase())
    )
    if (filtroDisp === 'si') filtered = filtered.filter(p => p.disponible)
    if (filtroDisp === 'no') filtered = filtered.filter(p => !p.disponible)
    if (filtroCat) {
      const catId = Number(filtroCat)
      filtered = filtered.filter(p => p.categorias.some(c => c.id === catId))
    }
    switch (orden) {
      case 'az': filtered.sort((a, b) => a.nombre.localeCompare(b.nombre)); break
      case 'za': filtered.sort((a, b) => b.nombre.localeCompare(a.nombre)); break
      case 'stock+': filtered.sort((a, b) => a.stock_calculado - b.stock_calculado); break
      case 'stock-': filtered.sort((a, b) => b.stock_calculado - a.stock_calculado); break
    }
    return filtered
  }, [data?.items, nombre, filtroDisp, filtroCat, orden])

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const paginatedItems = items.slice((page - 1) * pageSize, page * pageSize)

  const FormContent = (
    <>
      <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={form.nombre} onChange={set('nombre')} required /></div>
      <div className="form-group"><label className="form-label">Descripción</label><textarea className="form-textarea" value={form.descripcion ?? ''} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} /></div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Margen ganancia (%)</label><input className="form-input" type="number" min="0" step="0.01" value={form.margen_ganancia ?? ''} onChange={set('margen_ganancia')} /></div>
        <div className="form-group"><label className="form-label">Unidad de venta</label>
          <select className="form-select" value={form.unidad_venta_id ?? ''} onChange={e => setForm(f => ({ ...f, unidad_venta_id: e.target.value ? Number(e.target.value) : undefined }))}>
            <option value="">Sin unidad</option>
            {unidades?.items.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.simbolo})</option>)}
          </select>
        </div>
      </div>
      <label className="checkbox-group" style={{ marginBottom: 16 }}>
        <input type="checkbox" checked={form.disponible ?? true} onChange={e => setForm(f => ({ ...f, disponible: e.target.checked }))} />
        Disponible para la venta
      </label>

      <div className="form-group">
        <label className="form-label">Imágenes</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {(form.imagenes_url ?? []).map((url, i) => (
            <div key={i} style={{ position: 'relative', width: 80, height: 80, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
              <img src={cloudinaryUrl(url, 80, 80)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={() => handleEliminarImagen(url)} style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 12, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} disabled={uploading} style={{ fontSize: 13 }} />
          {uploading && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Subiendo...</span>}
        </div>
        {imgError && <p style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 4 }}>{imgError}</p>}
        <p style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 4 }}>JPEG, PNG o WebP. Máx 5 MB.</p>
      </div>
    </>
  )

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title font-display">🍽️ Productos</h1>
        {!esStockNoAdmin && <button className="btn btn-primary" onClick={() => { setForm(EMPTY_CREATE); setModal('crear') }}>+ Nuevo producto</button>}
      </div>
      <div className="filters-bar">
        <input className="form-input" placeholder="Buscar..." value={nombre} onChange={e => { setNombre(e.target.value); setPage(1) }} style={{ flex: 1, maxWidth: 200 }} />
        <select className="form-select" value={filtroDisp} onChange={e => setFiltroDisp(e.target.value)}>
          <option value="">Disponibilidad</option>
          <option value="si">Disponible</option>
          <option value="no">No disponible</option>
        </select>
        <select className="form-select" value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
          <option value="">Categoría</option>
          {flatCats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select className="form-select" value={orden} onChange={e => setOrden(e.target.value)}>
          {ORDENES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {isLoading ? <SpinnerCenter /> : !data?.items.length ? <EmptyState icon="🍽️" title="Sin productos" action={!esStockNoAdmin ? <button className="btn btn-primary" onClick={() => { setForm(EMPTY_CREATE); setModal('crear') }}>Crear producto</button> : undefined} /> : (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Producto</th><th>Precio venta</th><th>Stock</th><th>Categorías</th><th>Disponible</th><th></th></tr></thead>
              <tbody>
                {paginatedItems.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {p.imagenes_url?.[0] ? <img src={cloudinaryUrl(p.imagenes_url[0])} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} alt="" /> : <div style={{ width: 40, height: 40, background: 'var(--color-surface2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🍽️</div>}
                        <div>
                          <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                          {p.descripcion && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descripcion}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--color-accent)' }}>${Number(p.precio_venta).toFixed(2)}</td>
                    <td>
                      <span style={{ color: p.stock_calculado > 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>{p.stock_calculado}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{p.categorias.map(c => <span key={c.id} className={`badge ${c.es_principal ? 'badge-orange' : 'badge-gray'}`} style={{ marginRight: 4 }}>{c.nombre}</span>)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label className="toggle">
                          <input type="checkbox" checked={p.disponible} onChange={e => dispMut.mutate({ id: p.id, d: e.target.checked })} />
                          <span className="toggle-slider"></span>
                        </label>
                        <span style={{ fontSize: 12, fontWeight: 600, color: p.disponible ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {p.disponible ? 'Sí' : 'No'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {!esStockNoAdmin && <button className="btn btn-ghost btn-sm" onClick={() => openEditar(p)}>✏️</button>}
                        {!p.tiene_ingredientes && <button className="btn btn-ghost btn-sm" onClick={() => { setSeleccionado(p); setStockForm({ stock_directo: p.stock_directo ?? 0, precio_base: p.precio_base ?? '' }); setModal('stock') }}>📦 Stock</button>}
                        {!esStockNoAdmin && <button className="btn btn-ghost btn-sm" onClick={() => { setSeleccionado(p); setNuevaCat({ categoria_id: 0, es_principal: false }); setModal('cats') }}>🗂️</button>}
                        {!esStockNoAdmin && <button className="btn btn-ghost btn-sm" onClick={() => { setSeleccionado(p); setNuevoIng({ ingrediente_id: 0, cantidad: '', unidad_medida_id: 0, es_removible: false }); setModal('ings') }}>🥬</button>}
                        {!esStockNoAdmin && <button className="btn btn-danger btn-sm" onClick={() => { setSeleccionado(p); setModal('borrar') }}>🗑</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length === 0 && <EmptyState icon="🔍" title="Sin resultados con estos filtros" />}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <Pagination page={page} pages={totalPages} onChange={setPage} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
              <span>Mostrar</span>
              <select className="form-select" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} style={{ width: 70 }}>
                {[5, 10, 15, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>de {items.length}</span>
            </div>
          </div>
        </>
      )}

      {modal === 'crear' && (
        <Modal title="Nuevo producto" onClose={() => setModal(null)} size="lg"
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={() => crearMut.mutate(form)} disabled={crearMut.isPending}>{crearMut.isPending ? 'Creando...' : 'Crear'}</button></>}>
          {FormContent}
        </Modal>
      )}
      {modal === 'editar' && seleccionado && (
        <Modal title={`Editar: ${seleccionado.nombre}`} onClose={() => setModal(null)} size="lg"
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={() => editarMut.mutate({ id: seleccionado.id, d: form })} disabled={editarMut.isPending}>{editarMut.isPending ? 'Guardando...' : 'Guardar'}</button></>}>
          {FormContent}
        </Modal>
      )}
      {modal === 'borrar' && seleccionado && (
        <ConfirmModal msg={`¿Eliminar "${seleccionado.nombre}"?`} onConfirm={() => borrarMut.mutate(seleccionado.id)} onCancel={() => setModal(null)} loading={borrarMut.isPending} danger />
      )}
      {modal === 'stock' && seleccionado && (
        <Modal title="Actualizar stock" onClose={() => setModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={() => stockMut.mutate({ id: seleccionado.id, d: { stock_directo: stockForm.stock_directo, precio_base: esStockNoAdmin ? undefined : (stockForm.precio_base || undefined) } })} disabled={stockMut.isPending}>Guardar</button></>}>
          <div className="form-group"><label className="form-label">Stock directo *</label><input className="form-input" type="number" min="0" value={stockForm.stock_directo} onChange={e => setStockForm(f => ({ ...f, stock_directo: Number(e.target.value) }))} /></div>
          {!esStockNoAdmin && <div className="form-group"><label className="form-label">Precio base ($)</label><input className="form-input" type="number" min="0" step="0.01" value={stockForm.precio_base} onChange={e => setStockForm(f => ({ ...f, precio_base: e.target.value }))} /></div>}
        </Modal>
      )}
      {modal === 'cats' && seleccionado && (
        <Modal title={`Categorías: ${seleccionado.nombre}`} onClose={() => setModal(null)} size="lg">
          <div style={{ marginBottom: 16 }}>
            <strong style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Asignadas:</strong>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {seleccionado.categorias.map(c => (
                <span key={c.id} className={`badge ${c.es_principal ? 'badge-orange' : 'badge-gray'}`}>
                  {c.nombre}
                  <button style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }} onClick={() => remCatMut.mutate({ id: seleccionado.id, cid: c.id })}>×</button>
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="form-select" value={nuevaCat.categoria_id} onChange={e => setNuevaCat(f => ({ ...f, categoria_id: Number(e.target.value) }))}>
              <option value={0}>Seleccionar categoría...</option>
              {flatCats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <label className="checkbox-group"><input type="checkbox" checked={nuevaCat.es_principal} onChange={e => setNuevaCat(f => ({ ...f, es_principal: e.target.checked }))} />Principal</label>
            <button className="btn btn-primary btn-sm" onClick={() => nuevaCat.categoria_id && addCatMut.mutate({ id: seleccionado.id, d: { categoria_id: nuevaCat.categoria_id, es_principal: nuevaCat.es_principal } })}>Agregar</button>
          </div>
        </Modal>
      )}
      {modal === 'ings' && seleccionado && (
        <Modal title={`Ingredientes: ${seleccionado.nombre}`} onClose={() => setModal(null)} size="lg">
          <div style={{ marginBottom: 16 }}>
            {seleccionado.ingredientes.map(i => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: 14 }}>
                <span>{i.nombre} — {i.cantidad} {i.simbolo_unidad} {i.es_removible ? '(removible)' : ''}</span>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => remIngMut.mutate({ id: seleccionado.id, iid: i.id })}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="form-select" style={{ flex: 1 }} value={nuevoIng.ingrediente_id} onChange={e => setNuevoIng(f => ({ ...f, ingrediente_id: Number(e.target.value) }))}>
              <option value={0}>Ingrediente...</option>
              {ings?.items.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
            <input className="form-input" style={{ width: 80 }} placeholder="Cant." type="number" min="0.001" step="0.001" value={nuevoIng.cantidad} onChange={e => setNuevoIng(f => ({ ...f, cantidad: e.target.value }))} />
            <select className="form-select" style={{ width: 100 }} value={nuevoIng.unidad_medida_id} onChange={e => setNuevoIng(f => ({ ...f, unidad_medida_id: Number(e.target.value) }))}>
              <option value={0}>Unidad...</option>
              {unidades?.items.map(u => <option key={u.id} value={u.id}>{u.simbolo}</option>)}
            </select>
            <label className="checkbox-group"><input type="checkbox" checked={nuevoIng.es_removible} onChange={e => setNuevoIng(f => ({ ...f, es_removible: e.target.checked }))} />Removible</label>
            <button className="btn btn-primary btn-sm" onClick={() => nuevoIng.ingrediente_id && nuevoIng.cantidad && nuevoIng.unidad_medida_id && addIngMut.mutate({ id: seleccionado.id, d: nuevoIng })}>Agregar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
