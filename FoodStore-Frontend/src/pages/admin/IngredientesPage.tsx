import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ingredientesService } from '../../services/ingredientes.service'
import { unidadesService } from '../../services/unidades.service'
import { useAuthStore } from '../../stores/authStore'
import { Modal, ConfirmModal } from '../../components/Modal'
import { Pagination } from '../../components/Pagination'
import { SpinnerCenter } from '../../components/Spinner'
import { EmptyState } from '../../components/EmptyState'
import { useToast } from '../../components/Toast'
import type { IngredienteRead, IngredienteCreate } from '../../types'

const EMPTY: IngredienteCreate = { nombre: '', es_alergeno: false, stock_total: '0', precio_costo: '0' }

const ORDENES: { value: string; label: string }[] = [
  { value: '', label: 'Orden default' },
  { value: 'az', label: 'A-Z' },
  { value: 'za', label: 'Z-A' },
  { value: 'stock+', label: 'Stock ↑' },
  { value: 'stock-', label: 'Stock ↓' },
]

export function IngredientesPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [nombre, setNombre] = useState('')
  const [modal, setModal] = useState<'crear' | 'editar' | 'stock' | 'borrar' | null>(null)
  const [sel, setSel] = useState<IngredienteRead | null>(null)
  const [form, setForm] = useState<IngredienteCreate>(EMPTY)
  const [stockVal, setStockVal] = useState('')
  const [filtroAlerg, setFiltroAlerg] = useState('')
  const [orden, setOrden] = useState('')
  const toast = useToast(); const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['ingredientes-admin-all'] })
  const { isStock: isStockRole, isAdmin } = useAuthStore()
  const soloStock = isStockRole() && !isAdmin()

  const { data, isLoading } = useQuery({ queryKey: ['ingredientes-admin-all'], queryFn: () => ingredientesService.listar({ page: 1, size: 100 }) })
  const { data: unidades } = useQuery({ queryKey: ['unidades-all'], queryFn: () => unidadesService.listar({ size: 100 }) })

  const crearMut = useMutation({ mutationFn: (d: IngredienteCreate) => ingredientesService.crear(d), onSuccess: () => { toast.success('Ingrediente creado'); setModal(null); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo crear el ingrediente') })
  const editarMut = useMutation({ mutationFn: ({ id, d }: { id: number; d: IngredienteCreate }) => ingredientesService.actualizar(id, d), onSuccess: () => { toast.success('Actualizado'); setModal(null); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Error al actualizar') })
  const stockMut = useMutation({ mutationFn: ({ id, s }: { id: number; s: string }) => ingredientesService.actualizarStock(id, { stock_total: s }), onSuccess: () => { toast.success('Stock actualizado'); setModal(null); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Error al actualizar stock') })
  const borrarMut = useMutation({ mutationFn: (id: number) => ingredientesService.eliminar(id), onSuccess: () => { toast.success('Eliminado'); setModal(null); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo eliminar el ingrediente') })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))
  const openEditar = (i: IngredienteRead) => { setSel(i); setForm({ nombre: i.nombre, descripcion: i.descripcion, es_alergeno: i.es_alergeno, unidad_medida_id: i.unidad_medida_id, stock_total: i.stock_total, precio_costo: i.precio_costo }); setModal('editar') }

  const StockBar = ({ stock }: { stock: string }) => {
    const v = Number(stock); const max = 50
    const pct = Math.min((v / max) * 100, 100)
    const color = v > 10 ? 'var(--color-success)' : v > 3 ? 'var(--color-warning)' : 'var(--color-danger)'
    return <div className="stock-bar" style={{ width: 80 }}><div className="stock-bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
  }

  const items = useMemo(() => {
    if (!data?.items) return []
    let filtered = data.items.filter(i =>
      i.nombre.toLowerCase().includes(nombre.toLowerCase())
    )
    if (filtroAlerg === 'si') filtered = filtered.filter(i => i.es_alergeno)
    if (filtroAlerg === 'no') filtered = filtered.filter(i => !i.es_alergeno)
    switch (orden) {
      case 'az': filtered.sort((a, b) => a.nombre.localeCompare(b.nombre)); break
      case 'za': filtered.sort((a, b) => b.nombre.localeCompare(a.nombre)); break
      case 'stock+': filtered.sort((a, b) => Number(a.stock_total) - Number(b.stock_total)); break
      case 'stock-': filtered.sort((a, b) => Number(b.stock_total) - Number(a.stock_total)); break
    }
    return filtered
  }, [data?.items, nombre, filtroAlerg, orden])

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const paginatedItems = items.slice((page - 1) * pageSize, page * pageSize)

  const FormContent = (
    <>
      <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={form.nombre} onChange={set('nombre')} required /></div>
      <div className="form-group"><label className="form-label">Descripción</label><input className="form-input" value={form.descripcion ?? ''} onChange={set('descripcion')} /></div>
      <div className="form-group">
        <label className="form-label">Unidad de medida</label>
        <select className="form-select" value={form.unidad_medida_id ?? ''} onChange={e => setForm(f => ({ ...f, unidad_medida_id: e.target.value ? Number(e.target.value) : undefined }))}>
          <option value="">Sin unidad</option>
          {unidades?.items.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.simbolo})</option>)}
        </select>
      </div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Stock total</label><input className="form-input" type="number" min="0" step="0.001" value={form.stock_total ?? ''} onChange={set('stock_total')} /></div>
        <div className="form-group"><label className="form-label">Precio costo ($)</label><input className="form-input" type="number" min="0" step="0.01" value={form.precio_costo ?? ''} onChange={set('precio_costo')} /></div>
      </div>
      <label className="checkbox-group"><input type="checkbox" checked={form.es_alergeno ?? false} onChange={set('es_alergeno')} />Contiene alérgeno</label>
    </>
  )

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title font-display">🥬 Ingredientes</h1>
        {!soloStock && <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setModal('crear') }}>+ Nuevo ingrediente</button>}
      </div>
      <div className="filters-bar">
        <input className="form-input" placeholder="Buscar..." value={nombre} onChange={e => { setNombre(e.target.value); setPage(1) }} style={{ flex: 1, maxWidth: 200 }} />
        <select className="form-select" value={filtroAlerg} onChange={e => setFiltroAlerg(e.target.value)}>
          <option value="">Alérgenos: Todos</option>
          <option value="si">Con alérgenos</option>
          <option value="no">Sin alérgenos</option>
        </select>
        <select className="form-select" value={orden} onChange={e => setOrden(e.target.value)}>
          {ORDENES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {isLoading ? <SpinnerCenter /> : !data?.items.length ? <EmptyState icon="🥬" title="Sin ingredientes" /> : (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Nombre</th><th>Stock</th><th>Precio costo</th><th>Alérgeno</th><th></th></tr></thead>
              <tbody>
                {paginatedItems.map(i => {
                  const unidad = unidades?.items.find(u => u.id === i.unidad_medida_id)
                  return (
                    <tr key={i.id}>
                      <td style={{ fontWeight: 600 }}>{i.nombre}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600 }}>{Number(i.stock_total).toFixed(2)} {unidad?.simbolo ?? ''}</span>
                          <StockBar stock={i.stock_total} />
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>${Number(i.precio_costo).toFixed(2)}</td>
                      <td>{i.es_alergeno ? <span className="badge badge-yellow">⚠️ Sí</span> : <span style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>No</span>}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setSel(i); setStockVal(i.stock_total); setModal('stock') }}>📦 Stock</button>
                          {!soloStock && <button className="btn btn-ghost btn-sm" onClick={() => openEditar(i)}>✏️</button>}
                          {!soloStock && <button className="btn btn-danger btn-sm" onClick={() => { setSel(i); setModal('borrar') }}>🗑</button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
      {(modal === 'crear' || modal === 'editar') && (
        <Modal title={modal === 'crear' ? 'Nuevo ingrediente' : `Editar: ${sel?.nombre}`} onClose={() => setModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={() => modal === 'crear' ? crearMut.mutate(form) : editarMut.mutate({ id: sel!.id, d: form })} disabled={crearMut.isPending || editarMut.isPending}>Guardar</button></>}>
          {FormContent}
        </Modal>
      )}
      {modal === 'stock' && sel && (
        <Modal title={`Stock: ${sel.nombre}`} onClose={() => setModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={() => stockMut.mutate({ id: sel.id, s: stockVal })} disabled={stockMut.isPending}>Guardar</button></>}>
          <div className="form-group"><label className="form-label">Stock total *</label><input className="form-input" type="number" min="0" step="0.001" value={stockVal} onChange={e => setStockVal(e.target.value)} /></div>
        </Modal>
      )}
      {modal === 'borrar' && sel && <ConfirmModal msg={`¿Eliminar "${sel.nombre}"? Puede fallar si está en uso.`} onConfirm={() => borrarMut.mutate(sel.id)} onCancel={() => setModal(null)} loading={borrarMut.isPending} danger />}
    </div>
  )
}
