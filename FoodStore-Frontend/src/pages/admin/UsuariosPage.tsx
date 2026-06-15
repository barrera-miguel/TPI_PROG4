import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authService } from '../../services/auth.service'
import { useAuthStore } from '../../stores/authStore'
import { Modal, ConfirmModal } from '../../components/Modal'
import { Pagination } from '../../components/Pagination'
import { SpinnerCenter } from '../../components/Spinner'
import { EmptyState } from '../../components/EmptyState'
import { useToast } from '../../components/Toast'
import type { UsuarioPublico } from '../../types'

const ROLES_SISTEMA = ['ADMIN', 'CLIENT', 'PEDIDOS', 'STOCK']

export function UsuariosPage() {
  const [page, setPage] = useState(1)
  const [rolFiltro, setRolFiltro] = useState('')
  const [modal, setModal] = useState<'roles' | 'borrar' | null>(null)
  const [sel, setSel] = useState<UsuarioPublico | null>(null)
  const { usuario: yo } = useAuthStore()
  const toast = useToast(); const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['usuarios-admin'] })

  const { data, isLoading } = useQuery({ queryKey: ['usuarios-admin', page, rolFiltro], queryFn: () => authService.listarUsuarios({ page, size: 20, rol: rolFiltro || undefined }) })
  const habMut = useMutation({ mutationFn: (id: number) => authService.habilitarUsuario(id), onSuccess: () => { toast.success('Usuario habilitado'); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo habilitar el usuario') })
  const desMut = useMutation({ mutationFn: (id: number) => authService.deshabilitarUsuario(id), onSuccess: () => { toast.success('Usuario deshabilitado'); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo deshabilitar el usuario') })
  const borrarMut = useMutation({ mutationFn: (id: number) => authService.eliminarUsuario(id), onSuccess: () => { toast.success('Eliminado'); setModal(null); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'No se pudo eliminar el usuario') })
  const addRolMut = useMutation({ mutationFn: ({ id, r }: { id: number; r: string }) => authService.asignarRol(id, r), onSuccess: (u) => { setSel(u); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Error al asignar rol') })
  const remRolMut = useMutation({ mutationFn: ({ id, r }: { id: number; r: string }) => authService.quitarRol(id, r), onSuccess: (u) => { setSel(u); inv() }, onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Error al quitar rol') })

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title font-display">👤 Usuarios</h1>
      </div>
      <div className="filters-bar">
        <select className="form-select" value={rolFiltro} onChange={e => { setRolFiltro(e.target.value); setPage(1) }}>
          <option value="">Todos los roles</option>
          {ROLES_SISTEMA.map(r => <option key={r}>{r}</option>)}
        </select>
      </div>
      {isLoading ? <SpinnerCenter /> : !data?.items.length ? <EmptyState icon="👤" title="Sin usuarios" /> : (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Nombre</th><th>Email</th><th>Roles</th><th>Activo</th><th></th></tr></thead>
              <tbody>
                {data.items.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.nombre} {u.apellido}</div>
                      {u.celular && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{u.celular}</div>}
                    </td>
                    <td style={{ fontSize: 13 }}>{u.email}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {u.roles.map(r => <span key={r} className={`badge ${r === 'ADMIN' ? 'badge-red' : r === 'CLIENT' ? 'badge-green' : r === 'PEDIDOS' ? 'badge-blue' : 'badge-orange'}`}>{r}</span>)}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.deleted_at ? 'badge-red' : 'badge-green'}`}>
                        {u.deleted_at ? 'Inactivo' : 'Activo'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setSel(u); setModal('roles') }}>🔑 Roles</button>
                        {u.id !== yo?.id && (
                          <button className="btn btn-danger btn-sm" onClick={() => { setSel(u); setModal('borrar') }}>🗑</button>
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

      {modal === 'roles' && sel && (
        <Modal title={`Roles: ${sel.nombre} ${sel.apellido}`} onClose={() => setModal(null)}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>Roles actuales:</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {sel.roles.map(r => (
              <span key={r} className={`badge ${r === 'ADMIN' ? 'badge-red' : 'badge-blue'}`} style={{ cursor: 'pointer' }}>
                {r}
                {sel.id !== yo?.id && (
                  <button style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                    onClick={() => remRolMut.mutate({ id: sel.id, r })}>×</button>
                )}
              </span>
            ))}
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 8 }}>Asignar rol:</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ROLES_SISTEMA.filter(r => !sel.roles.includes(r)).map(r => (
              <button key={r} className="btn btn-secondary btn-sm" onClick={() => addRolMut.mutate({ id: sel.id, r })}>+ {r}</button>
            ))}
          </div>
          {sel.id !== yo?.id && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => habMut.mutate(sel.id)}>✓ Habilitar</button>
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8, color: 'var(--color-warning)' }} onClick={() => desMut.mutate(sel.id)}>⊘ Deshabilitar</button>
            </div>
          )}
        </Modal>
      )}
      {modal === 'borrar' && sel && <ConfirmModal msg={`¿Eliminar a "${sel.nombre} ${sel.apellido}" (${sel.email})?`} onConfirm={() => borrarMut.mutate(sel.id)} onCancel={() => setModal(null)} loading={borrarMut.isPending} danger />}
    </div>
  )
}
