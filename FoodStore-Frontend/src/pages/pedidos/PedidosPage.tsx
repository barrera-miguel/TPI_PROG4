import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { pedidosService } from '../../services/pedidos.service'
import { useAuthStore } from '../../stores/authStore'
import { EstadoBadge } from '../../components/EstadoBadge'
import { Pagination } from '../../components/Pagination'
import { SpinnerCenter } from '../../components/Spinner'
import { EmptyState } from '../../components/EmptyState'

export function PedidosPage() {
  const [page, setPage] = useState(1)
  const { isPedidos } = useAuthStore()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pedidos', page],
    queryFn: () => pedidosService.listar({ page, size: 15 }),
  })

  return (
    <div className="page-wrapper">
      <div className="container page-content">
        <h1 className="section-title font-display" style={{ marginBottom: 24 }}>
          {isPedidos() ? '🧾 Todos los pedidos' : '🧾 Mis pedidos'}
        </h1>
        {isLoading ? <SpinnerCenter /> : isError ? (
          <EmptyState icon="⚠️" title="Error al cargar pedidos" desc="No se pudo conectar con el servidor"
            action={<button className="btn btn-primary" onClick={() => refetch()}>Reintentar</button>} />
        ) : !data?.items.length ? (
          <EmptyState icon="🛒" title="Sin pedidos" desc="Todavía no realizaste ningún pedido"
            action={<Link to="/" className="btn btn-primary">Ver el menú</Link>} />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr>
                  <th>Pedido</th><th>Fecha</th><th>Estado</th><th>Forma de pago</th><th>Total</th><th></th>
                </tr></thead>
                <tbody>
                  {data.items.map(p => (
                    <tr key={p.id}>
                      <td><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>#{p.id}</span></td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                        {p.created_at ? new Date(p.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td><EstadoBadge estado={p.estado_codigo} /></td>
                      <td style={{ fontSize: 13 }}>{p.forma_pago_codigo}</td>
                      <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-accent)' }}>${Number(p.total).toFixed(2)}</td>
                      <td><Link to={`/orders/${p.id}`} className="btn btn-secondary btn-sm">Ver →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
