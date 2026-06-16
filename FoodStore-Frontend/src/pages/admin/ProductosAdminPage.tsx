import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productosService } from '../../services/productos.service'
import { categoriasService } from '../../services/categorias.service'
import { ingredientesService } from '../../services/ingredientes.service'
import { unidadesService } from '../../services/unidades.service'
import { uploadsService } from '../../services/uploads.service'
import { useAuthStore } from '../../stores/authStore'
import { Modal, ConfirmModal } from '../../components/Modal'
import { ComboSearch } from '../../components/ComboSearch'
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
  const [formCats, setFormCats] = useState<{ categoria_id: number; es_principal: boolean }[]>([])
  const [formIngs, setFormIngs] = useState<{ ingrediente_id: number; cantidad: string; unidad_medida_id: number; es_removible: boolean }[]>([])
  const [stagingCat, setStagingCat] = useState({ categoria_id: 0, es_principal: false })
  const [expandido, setExpandido] = useState<number | null>(null)
  const [stagingIng, setStagingIng] = useState({ ingrediente_id: 0, cantidad: '', unidad_medida_id: 0, es_removible: false })
  const [editExistingCats, setEditExistingCats] = useState<ProductoRead['categorias']>([])
  const [editExistingIngs, setEditExistingIngs] = useState<ProductoRead['ingredientes']>([])
  const [editNewCats, setEditNewCats] = useState<{ categoria_id: number; es_principal: boolean }[]>([])
  const [editNewIngs, setEditNewIngs] = useState<{ ingrediente_id: number; cantidad: string; unidad_medida_id: number; es_removible: boolean }[]>([])
  const [guardandoEditar, setGuardandoEditar] = useState(false)
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
  const remCatMut = useMutation({ mutationFn: ({ id, cid }: { id: number; cid: number }) => productosService.quitarCategoria(id, cid), onSuccess: (_data, { cid }) => { setSeleccionado(s => s ? { ...s, categorias: s.categorias.filter(c => c.id !== cid) } : s); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Error al quitar categoría') })
  const addIngMut = useMutation({ mutationFn: ({ id, d }: { id: number; d: any }) => productosService.agregarIngrediente(id, d), onSuccess: (p) => { setSeleccionado(p); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo agregar el ingrediente') })
  const remIngMut = useMutation({ mutationFn: ({ id, iid }: { id: number; iid: number }) => productosService.quitarIngrediente(id, iid), onSuccess: async (_data, { id }) => { const fresh = await productosService.detalle(id); setSeleccionado(fresh); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Error al quitar ingrediente') })

  const flatCats: { id: number; nombre: string }[] = []
  const flattenCats = (nodes: any[], d = 0) => nodes.forEach(n => { flatCats.push({ id: n.id, nombre: ('  '.repeat(d)) + n.nombre }); if (n.hijos?.length) flattenCats(n.hijos, d+1) })
  if (cats) flattenCats(cats)

  const openEditar = (p: ProductoRead) => {
    setSeleccionado(p)
    setForm({ nombre: p.nombre, descripcion: p.descripcion ?? '', margen_ganancia: p.margen_ganancia, disponible: p.disponible, unidad_venta_id: p.unidad_venta_id, stock_directo: p.stock_directo, precio_base: p.precio_base, imagenes_url: p.imagenes_url ?? [] })
    setEditExistingCats(p.categorias)
    setEditExistingIngs(p.ingredientes)
    setEditNewCats([])
    setEditNewIngs([])
    setNuevaCat({ categoria_id: 0, es_principal: false })
    setNuevoIng({ ingrediente_id: 0, cantidad: '', unidad_medida_id: 0, es_removible: false })
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
      default: filtered.sort((a, b) => b.id - a.id); break
    }
    return filtered
  }, [data?.items, nombre, filtroDisp, filtroCat, orden])

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const paginatedItems = items.slice((page - 1) * pageSize, page * pageSize)

  const precioCrear = useMemo(() => {
    const margen = parseFloat(form.margen_ganancia ?? '0') || 0
    if (formIngs.length > 0) {
      const costo = formIngs.reduce((sum, fi) => {
        const ing = ings?.items.find(i => i.id === fi.ingrediente_id)
        const precioCosto = parseFloat(ing?.precio_costo ?? '0') || 0
        const cantidad = parseFloat(fi.cantidad) || 0
        return sum + precioCosto * cantidad
      }, 0)
      return { costo, venta: costo * (1 + margen / 100) }
    }
    if (form.precio_base) {
      const base = parseFloat(form.precio_base) || 0
      if (base > 0) return { costo: base, venta: base * (1 + margen / 100) }
    }
    return null
  }, [formIngs, form.margen_ganancia, form.precio_base, ings?.items])

  const precioEditar = useMemo(() => {
    if (!seleccionado) return null
    const margen = parseFloat(form.margen_ganancia ?? seleccionado.margen_ganancia ?? '0') || 0
    const allIngs = [
      ...editExistingIngs.map(i => ({ ingrediente_id: i.id, cantidad: String(i.cantidad) })),
      ...editNewIngs,
    ]
    if (allIngs.length > 0) {
      const costo = allIngs.reduce((sum, fi) => {
        const ing = ings?.items.find(x => x.id === fi.ingrediente_id)
        const precioCosto = parseFloat(ing?.precio_costo ?? '0') || 0
        const cantidad = parseFloat(fi.cantidad) || 0
        return sum + precioCosto * cantidad
      }, 0)
      return { costo, venta: costo * (1 + margen / 100) }
    }
    const base = form.precio_base
      ? parseFloat(form.precio_base) || 0
      : Number(seleccionado.precio_costo_calculado)
    return { costo: base, venta: base * (1 + margen / 100) }
  }, [editExistingIngs, editNewIngs, form.margen_ganancia, form.precio_base, ings?.items, seleccionado])

  const handleGuardarEditar = async () => {
    if (!seleccionado) return
    setGuardandoEditar(true)
    try {
      const id = seleccionado.id
      await productosService.actualizar(id, form)
      const catsToRemove = seleccionado.categorias.filter(c => !editExistingCats.find(e => e.id === c.id))
      for (const c of catsToRemove) await productosService.quitarCategoria(id, c.id)
      for (const c of editNewCats) await productosService.agregarCategoria(id, c)
      const ingsToRemove = seleccionado.ingredientes.filter(i => !editExistingIngs.find(e => e.id === i.id))
      for (const i of ingsToRemove) await productosService.quitarIngrediente(id, i.id)
      for (const i of editNewIngs) await productosService.agregarIngrediente(id, i)
      toast.success('Producto actualizado')
      setModal(null)
      inv()
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'No se pudo guardar el producto')
    } finally {
      setGuardandoEditar(false)
    }
  }

  const FormContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Nombre *</label>
        <input className="form-input" value={form.nombre} onChange={set('nombre')} required />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Descripción</label>
        <textarea className="form-textarea" rows={2} value={form.descripcion ?? ''} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} style={{ resize: 'vertical', minHeight: 64 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Margen ganancia (%)</label>
          <input className="form-input" type="number" min="0" step="0.01" value={form.margen_ganancia ?? ''} onChange={set('margen_ganancia')} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Unidad de venta</label>
          <select className="form-select" value={form.unidad_venta_id ?? ''} onChange={e => setForm(f => ({ ...f, unidad_venta_id: e.target.value ? Number(e.target.value) : undefined }))}>
            <option value="">Sin unidad</option>
            {unidades?.items.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.simbolo})</option>)}
          </select>
        </div>
      </div>
      {((modal === 'crear' && formIngs.length === 0) ||
        (modal === 'editar' && editExistingIngs.length === 0 && editNewIngs.length === 0)) && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Costo base ($)</label>
          <input
            className="form-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.precio_base ?? ''}
            onChange={e => setForm(f => ({ ...f, precio_base: e.target.value || undefined }))}
          />
        </div>
      )}
      <label className="checkbox-group" style={{ margin: 0 }}>
        <input type="checkbox" checked={form.disponible ?? true} onChange={e => setForm(f => ({ ...f, disponible: e.target.checked }))} />
        Disponible para la venta
      </label>

      <div style={{ paddingTop: 4 }}>
        <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Imágenes</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {(form.imagenes_url ?? []).map((url, i) => (
            <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)', flexShrink: 0 }}>
              <img src={cloudinaryUrl(url, 72, 72)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={() => handleEliminarImagen(url)} style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.65)', color: '#fff', fontSize: 13, cursor: 'pointer', lineHeight: '20px', padding: 0, textAlign: 'center' }}>×</button>
            </div>
          ))}
          {(form.imagenes_url ?? []).length < 1 && (
            <label style={{ width: 72, height: 72, borderRadius: 8, border: '2px dashed var(--color-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: uploading ? 'not-allowed' : 'pointer', color: 'var(--color-text-muted)', fontSize: 11, gap: 2, flexShrink: 0 }}>
              <span style={{ fontSize: 20 }}>{uploading ? '⏳' : '+'}</span>
              <span>{uploading ? 'Subiendo' : 'Imagen'}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
            </label>
          )}
        </div>
        {imgError && <p style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 6, marginBottom: 0 }}>{imgError}</p>}
        <p style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 6, marginBottom: 0 }}>JPEG, PNG o WebP · Máx 5 MB · 1 imagen por producto</p>
      </div>
    </div>
  )

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title font-display">🍽️ Productos</h1>
        {!esStockNoAdmin && <button className="btn btn-primary" onClick={() => { setForm(EMPTY_CREATE); setFormCats([]); setFormIngs([]); setStagingCat({ categoria_id: 0, es_principal: false }); setStagingIng({ ingrediente_id: 0, cantidad: '', unidad_medida_id: 0, es_removible: false }); setModal('crear') }}>+ Nuevo producto</button>}
      </div>
      <div className="filters-bar">
        <input className="form-input" placeholder="Buscar..." value={nombre} onChange={e => { setNombre(e.target.value); setPage(1); setExpandido(null) }} style={{ flex: 1, maxWidth: 200 }} />
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

      {isLoading ? <SpinnerCenter /> : !data?.items.length ? <EmptyState icon="🍽️" title="Sin productos" action={!esStockNoAdmin ? <button className="btn btn-primary" onClick={() => { setForm(EMPTY_CREATE); setFormCats([]); setFormIngs([]); setStagingCat({ categoria_id: 0, es_principal: false }); setStagingIng({ ingrediente_id: 0, cantidad: '', unidad_medida_id: 0, es_removible: false }); setModal('crear') }}>Crear producto</button> : undefined} /> : (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Producto</th><th>Precio venta</th><th>Stock</th><th>Categorías</th><th>Disponible</th><th></th></tr></thead>
              <tbody>
                {paginatedItems.map(p => (
                  <React.Fragment key={p.id}>
                    <tr>
                      <td style={{ cursor: 'pointer' }} onClick={() => setExpandido(e => e === p.id ? null : p.id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {p.imagenes_url?.[0] ? <img src={cloudinaryUrl(p.imagenes_url[0])} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} alt="" /> : <div style={{ width: 40, height: 40, background: 'var(--color-surface2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🍽️</div>}
                          <div>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {p.nombre}
                              <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{expandido === p.id ? '▾' : '▸'}</span>
                            </div>
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
                    {expandido === p.id && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0, background: 'var(--color-surface2)', borderBottom: '2px solid var(--color-accent)' }}>
                          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Precio</div>
                              <div style={{ fontSize: 13, marginBottom: 4 }}>Costo: <strong>${Number(p.precio_costo_calculado).toFixed(2)}</strong></div>
                              <div style={{ fontSize: 13, marginBottom: 12 }}>Margen: <strong>{p.margen_ganancia}%</strong></div>
                              {(p.imagenes_url?.length ?? 0) > 0 && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {p.imagenes_url!.map((url, i) => (
                                    <img key={i} src={cloudinaryUrl(url, 60, 60)} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--color-border)' }} alt="" />
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Categorías</div>
                              {p.categorias.length === 0
                                ? <span style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>Sin categorías</span>
                                : p.categorias.map(c => (
                                  <div key={c.id} style={{ fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span className={`badge ${c.es_principal ? 'badge-orange' : 'badge-gray'}`}>{c.nombre}</span>
                                    {c.es_principal && <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>principal</span>}
                                  </div>
                                ))
                              }
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Ingredientes</div>
                              {p.ingredientes.length === 0
                                ? <span style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>Sin ingredientes</span>
                                : <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '4px 10px' }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', paddingBottom: 4, borderBottom: '1px solid var(--color-border)' }}>Ingrediente</span>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', paddingBottom: 4, borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>Cantidad</span>
                                    <span style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 4 }} />
                                    <span style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 4 }} />
                                    {p.ingredientes.map(i => (
                                      <React.Fragment key={i.id}>
                                        <span style={{ fontSize: 13, paddingBlock: 3 }}>{i.nombre}</span>
                                        <span style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'right', paddingBlock: 3 }}>{i.cantidad} {i.simbolo_unidad}</span>
                                        <span style={{ paddingBlock: 3 }}>{i.es_alergeno ? <span className="badge badge-yellow" style={{ fontSize: 10 }}>⚠️</span> : null}</span>
                                        <span style={{ fontSize: 10, color: 'var(--color-text-dim)', paddingBlock: 3 }}>{i.es_removible ? 'removible' : ''}</span>
                                      </React.Fragment>
                                    ))}
                                  </div>
                              }
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {items.length === 0 && <EmptyState icon="🔍" title="Sin resultados con estos filtros" />}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <Pagination page={page} pages={totalPages} onChange={setPage} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
              <span>Mostrar</span>
              <select className="form-select" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); setExpandido(null) }} style={{ width: 70 }}>
                {[5, 10, 15, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>de {items.length}</span>
            </div>
          </div>
        </>
      )}

      {modal === 'crear' && (
        <Modal title="Nuevo producto" onClose={() => setModal(null)} size="lg"
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={() => crearMut.mutate({ ...form, categorias: formCats.length ? formCats : undefined, ingredientes: formIngs.length ? formIngs : undefined })} disabled={crearMut.isPending}>{crearMut.isPending ? 'Creando...' : 'Crear'}</button></>}>
          {FormContent}

          {/* Categorías */}
          <div style={{ marginTop: 20, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <div style={{ padding: '10px 14px', background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>🗂️ Categorías</span>
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {formCats.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {formCats.map((fc, i) => {
                    const nombre = flatCats.find(c => c.id === fc.categoria_id)?.nombre ?? String(fc.categoria_id)
                    return (
                      <span key={i} className={`badge ${fc.es_principal ? 'badge-orange' : 'badge-gray'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {nombre}{fc.es_principal ? ' ★' : ''}
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 14 }} onClick={() => setFormCats(f => f.filter((_, j) => j !== i))}>×</button>
                      </span>
                    )
                  })}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}>
                <ComboSearch options={flatCats.map(c => ({ value: c.id, label: c.nombre }))} value={stagingCat.categoria_id} onChange={id => setStagingCat(f => ({ ...f, categoria_id: id }))} placeholder="Buscar categoría..." />
                <label className="checkbox-group" style={{ margin: 0, whiteSpace: 'nowrap' }}><input type="checkbox" checked={stagingCat.es_principal} onChange={e => setStagingCat(f => ({ ...f, es_principal: e.target.checked }))} />Principal</label>
                <button className="btn btn-primary btn-sm" disabled={!stagingCat.categoria_id || formCats.some(f => f.categoria_id === stagingCat.categoria_id)} onClick={() => { setFormCats(f => [...f, stagingCat]); setStagingCat({ categoria_id: 0, es_principal: false }) }}>Agregar</button>
              </div>
            </div>
          </div>

          {/* Ingredientes */}
          <div style={{ marginTop: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <div style={{ padding: '10px 14px', background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>🥬 Ingredientes</span>
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {formIngs.length > 0 && (
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
                  {formIngs.map((fi, i) => {
                    const ing = ings?.items.find(x => x.id === fi.ingrediente_id)
                    const uni = unidades?.items.find(u => u.id === fi.unidad_medida_id)
                    return (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, alignItems: 'center', padding: '7px 10px', borderBottom: i < formIngs.length - 1 ? '1px solid var(--color-border)' : 'none', fontSize: 13 }}>
                        <span style={{ fontWeight: 500 }}>{ing?.nombre ?? fi.ingrediente_id}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>{fi.cantidad} {uni?.simbolo ?? ''}</span>
                        {fi.es_removible && <span style={{ fontSize: 11, color: 'var(--color-text-dim)', background: 'var(--color-surface2)', padding: '2px 6px', borderRadius: 4 }}>removible</span>}
                        {!fi.es_removible && <span />}
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)', padding: '2px 6px' }} onClick={() => setFormIngs(f => f.filter((_, j) => j !== i))}>×</button>
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 88px 52px', gap: 8 }}>
                <ComboSearch options={ings?.items.map(i => ({ value: i.id, label: i.nombre })) ?? []} value={stagingIng.ingrediente_id} onChange={ingId => { const s = ings?.items.find(x => x.id === ingId); setStagingIng(f => ({ ...f, ingrediente_id: ingId, unidad_medida_id: s?.unidad_medida_id ?? 0 })) }} placeholder="Buscar ingrediente..." />
                <input className="form-input" placeholder="Cantidad" type="number" min="0.001" step="0.001" value={stagingIng.cantidad} onChange={e => setStagingIng(f => ({ ...f, cantidad: e.target.value }))} style={{ textAlign: 'right' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  {stagingIng.unidad_medida_id ? (unidades?.items.find(u => u.id === stagingIng.unidad_medida_id)?.simbolo ?? '—') : '—'}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="checkbox-group" style={{ margin: 0 }}><input type="checkbox" checked={stagingIng.es_removible} onChange={e => setStagingIng(f => ({ ...f, es_removible: e.target.checked }))} />Removible</label>
                <button className="btn btn-primary btn-sm" disabled={!stagingIng.ingrediente_id || !stagingIng.cantidad || !stagingIng.unidad_medida_id} onClick={() => { setFormIngs(f => [...f, stagingIng]); setStagingIng({ ingrediente_id: 0, cantidad: '', unidad_medida_id: 0, es_removible: false }) }}>+ Agregar ingrediente</button>
              </div>
            </div>
          </div>

          {precioCrear && (
            <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--color-surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                <div>Costo: <strong>${precioCrear.costo.toFixed(2)}</strong></div>
                <div>Margen: <strong>{form.margen_ganancia ?? '0'}%</strong></div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'right', marginBottom: 2 }}>Precio de venta</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--color-accent)' }}>${precioCrear.venta.toFixed(2)}</div>
              </div>
            </div>
          )}
        </Modal>
      )}
      {modal === 'editar' && seleccionado && (
        <Modal title={`Editar: ${seleccionado.nombre}`} onClose={() => setModal(null)} size="lg"
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={handleGuardarEditar} disabled={guardandoEditar}>{guardandoEditar ? 'Guardando...' : 'Guardar'}</button></>}>
          {FormContent}

          {/* Categorías */}
          <div style={{ marginTop: 20, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <div style={{ padding: '10px 14px', background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>🗂️ Categorías</span>
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(editExistingCats.length > 0 || editNewCats.length > 0) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {editExistingCats.map(c => (
                    <span key={c.id} className={`badge ${c.es_principal ? 'badge-orange' : 'badge-gray'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {c.nombre}{c.es_principal ? ' ★' : ''}
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 14 }} onClick={() => setEditExistingCats(f => f.filter(e => e.id !== c.id))}>×</button>
                    </span>
                  ))}
                  {editNewCats.map((c, i) => {
                    const nombre = flatCats.find(x => x.id === c.categoria_id)?.nombre ?? String(c.categoria_id)
                    return (
                      <span key={`new-${i}`} className={`badge ${c.es_principal ? 'badge-orange' : 'badge-gray'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {nombre}{c.es_principal ? ' ★' : ''}
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 14 }} onClick={() => setEditNewCats(f => f.filter((_, j) => j !== i))}>×</button>
                      </span>
                    )
                  })}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}>
                <ComboSearch options={flatCats.filter(c => !editExistingCats.find(e => e.id === c.id) && !editNewCats.find(n => n.categoria_id === c.id)).map(c => ({ value: c.id, label: c.nombre }))} value={nuevaCat.categoria_id} onChange={id => setNuevaCat(f => ({ ...f, categoria_id: id }))} placeholder="Buscar categoría..." />
                <label className="checkbox-group" style={{ margin: 0, whiteSpace: 'nowrap' }}><input type="checkbox" checked={nuevaCat.es_principal} onChange={e => setNuevaCat(f => ({ ...f, es_principal: e.target.checked }))} />Principal</label>
                <button className="btn btn-primary btn-sm" disabled={!nuevaCat.categoria_id} onClick={() => { setEditNewCats(f => [...f, { categoria_id: nuevaCat.categoria_id, es_principal: nuevaCat.es_principal }]); setNuevaCat({ categoria_id: 0, es_principal: false }) }}>Agregar</button>
              </div>
            </div>
          </div>

          {/* Ingredientes */}
          <div style={{ marginTop: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <div style={{ padding: '10px 14px', background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>🥬 Ingredientes</span>
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(editExistingIngs.length > 0 || editNewIngs.length > 0) && (
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
                  {editExistingIngs.map((i, idx) => {
                    const isLast = idx === editExistingIngs.length - 1 && editNewIngs.length === 0
                    return (
                      <div key={i.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, alignItems: 'center', padding: '7px 10px', borderBottom: isLast ? 'none' : '1px solid var(--color-border)', fontSize: 13 }}>
                        <span style={{ fontWeight: 500 }}>{i.nombre}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>{i.cantidad} {i.simbolo_unidad}</span>
                        {i.es_removible && <span style={{ fontSize: 11, color: 'var(--color-text-dim)', background: 'var(--color-surface2)', padding: '2px 6px', borderRadius: 4 }}>removible</span>}
                        {!i.es_removible && <span />}
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)', padding: '2px 6px' }} onClick={() => setEditExistingIngs(f => f.filter(e => e.id !== i.id))}>×</button>
                      </div>
                    )
                  })}
                  {editNewIngs.map((fi, idx) => {
                    const ing = ings?.items.find(x => x.id === fi.ingrediente_id)
                    const uni = unidades?.items.find(u => u.id === fi.unidad_medida_id)
                    return (
                      <div key={`new-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, alignItems: 'center', padding: '7px 10px', borderBottom: idx < editNewIngs.length - 1 ? '1px solid var(--color-border)' : 'none', fontSize: 13 }}>
                        <span style={{ fontWeight: 500 }}>{ing?.nombre ?? fi.ingrediente_id}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>{fi.cantidad} {uni?.simbolo ?? ''}</span>
                        {fi.es_removible && <span style={{ fontSize: 11, color: 'var(--color-text-dim)', background: 'var(--color-surface2)', padding: '2px 6px', borderRadius: 4 }}>removible</span>}
                        {!fi.es_removible && <span />}
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)', padding: '2px 6px' }} onClick={() => setEditNewIngs(f => f.filter((_, j) => j !== idx))}>×</button>
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 88px 52px', gap: 8 }}>
                <ComboSearch options={ings?.items.filter(x => !editExistingIngs.find(e => e.id === x.id) && !editNewIngs.find(n => n.ingrediente_id === x.id)).map(i => ({ value: i.id, label: i.nombre })) ?? []} value={nuevoIng.ingrediente_id} onChange={ingId => { const ingSel = ings?.items.find(i => i.id === ingId); setNuevoIng(f => ({ ...f, ingrediente_id: ingId, unidad_medida_id: ingSel?.unidad_medida_id ?? 0 })) }} placeholder="Buscar ingrediente..." />
                <input className="form-input" placeholder="Cantidad" type="number" min="0.001" step="0.001" value={nuevoIng.cantidad} onChange={e => setNuevoIng(f => ({ ...f, cantidad: e.target.value }))} style={{ textAlign: 'right' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  {nuevoIng.unidad_medida_id ? (unidades?.items.find(u => u.id === nuevoIng.unidad_medida_id)?.simbolo ?? '—') : '—'}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="checkbox-group" style={{ margin: 0 }}><input type="checkbox" checked={nuevoIng.es_removible} onChange={e => setNuevoIng(f => ({ ...f, es_removible: e.target.checked }))} />Removible</label>
                <button className="btn btn-primary btn-sm" disabled={!nuevoIng.ingrediente_id || !nuevoIng.cantidad || !nuevoIng.unidad_medida_id} onClick={() => { setEditNewIngs(f => [...f, nuevoIng]); setNuevoIng({ ingrediente_id: 0, cantidad: '', unidad_medida_id: 0, es_removible: false }) }}>+ Agregar ingrediente</button>
              </div>
            </div>
          </div>

          {precioEditar && (
            <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--color-surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                <div>Costo: <strong>${precioEditar.costo.toFixed(2)}</strong></div>
                <div>Margen: <strong>{form.margen_ganancia ?? seleccionado.margen_ganancia}%</strong></div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'right', marginBottom: 2 }}>Precio de venta</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--color-accent)' }}>${precioEditar.venta.toFixed(2)}</div>
              </div>
            </div>
          )}
        </Modal>
      )}
      {modal === 'borrar' && seleccionado && (
        <ConfirmModal msg={`¿Eliminar "${seleccionado.nombre}"?`} onConfirm={() => borrarMut.mutate(seleccionado.id)} onCancel={() => setModal(null)} loading={borrarMut.isPending} danger />
      )}
      {modal === 'stock' && seleccionado && (
        <Modal title="Actualizar stock" onClose={() => setModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={() => stockMut.mutate({ id: seleccionado.id, d: { stock_directo: stockForm.stock_directo } })} disabled={stockMut.isPending}>Guardar</button></>}>
          <div className="form-group"><label className="form-label">Stock directo *</label><input className="form-input" type="number" min="0" value={stockForm.stock_directo} onChange={e => setStockForm(f => ({ ...f, stock_directo: Number(e.target.value) }))} /></div>
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ComboSearch
              options={flatCats.map(c => ({ value: c.id, label: c.nombre }))}
              value={nuevaCat.categoria_id}
              onChange={id => setNuevaCat(f => ({ ...f, categoria_id: id }))}
              placeholder="Buscar categoría..."
            />
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
            <ComboSearch
              options={ings?.items.map(i => ({ value: i.id, label: i.nombre })) ?? []}
              value={nuevoIng.ingrediente_id}
              onChange={ingId => {
                const ingSel = ings?.items.find(i => i.id === ingId)
                setNuevoIng(f => ({ ...f, ingrediente_id: ingId, unidad_medida_id: ingSel?.unidad_medida_id ?? 0 }))
              }}
              placeholder="Buscar ingrediente..."
            />
            <input className="form-input" style={{ width: 80 }} placeholder="Cant." type="number" min="0.001" step="0.001" value={nuevoIng.cantidad} onChange={e => setNuevoIng(f => ({ ...f, cantidad: e.target.value }))} />
            <span style={{ padding: '6px 10px', background: 'var(--color-surface)', borderRadius: 4, fontSize: 13, minWidth: 48, textAlign: 'center', border: '1px solid var(--color-border)' }}>
              {nuevoIng.unidad_medida_id ? (unidades?.items.find(u => u.id === nuevoIng.unidad_medida_id)?.simbolo ?? '—') : '—'}
            </span>
            <label className="checkbox-group"><input type="checkbox" checked={nuevoIng.es_removible} onChange={e => setNuevoIng(f => ({ ...f, es_removible: e.target.checked }))} />Removible</label>
            <button
              className="btn btn-primary btn-sm"
              disabled={!nuevoIng.ingrediente_id || !nuevoIng.cantidad || !nuevoIng.unidad_medida_id || addIngMut.isPending}
              onClick={() => addIngMut.mutate({ id: seleccionado.id, d: nuevoIng })}
            >{addIngMut.isPending ? 'Agregando...' : 'Agregar'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
