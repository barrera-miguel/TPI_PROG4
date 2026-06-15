import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { estadisticasService } from '../../services/estadisticas.service'
import { SpinnerCenter } from '../../components/Spinner'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LineChart, Line, Legend, CartesianGrid,
} from 'recharts'

const COLORES = ['#f97316', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444']
const LABELS: Record<string, string> = { PENDIENTE: 'Pendiente', CONFIRMADO: 'Confirmado', EN_PREPARACION: 'En preparación', ENTREGADO: 'Entregado', CANCELADO: 'Cancelado' }

function todayISO() { return new Date().toISOString().slice(0, 10) }
function daysAgo(d: number) { const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString().slice(0, 10) }

function ErrorCard({ title, onRefetch }: { title: string; onRefetch: () => void }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 250 }}>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 12, fontSize: 13 }}>⚠️ {title}</p>
      <button className="btn btn-primary btn-sm" onClick={onRefetch}>Reintentar</button>
    </div>
  )
}

export function DashboardPage() {
  const [desde, setDesde] = useState(daysAgo(30))
  const [hasta, setHasta] = useState(todayISO())

  const { data: resumen, isLoading: loadingResumen, isError: errResumen, refetch: refResumen } = useQuery({
    queryKey: ['estadisticas-resumen'],
    queryFn: estadisticasService.resumen,
  })

  const { data: ventas, isLoading: loadingVentas, isError: errVentas, refetch: refVentas } = useQuery({
    queryKey: ['estadisticas-ventas', desde, hasta],
    queryFn: () => estadisticasService.ventas(desde, hasta, 'day'),
  })

  const { data: productosTop, isLoading: loadingTop, isError: errTop, refetch: refTop } = useQuery({
    queryKey: ['estadisticas-top'],
    queryFn: () => estadisticasService.productosTop(5),
  })

  const { data: pedidosEstado, isLoading: loadingEstado, isError: errEstado, refetch: refEstado } = useQuery({
    queryKey: ['estadisticas-estado'],
    queryFn: estadisticasService.pedidosPorEstado,
  })

  const { data: ingresos, isLoading: loadingIngresos, isError: errIngresos, refetch: refIngresos } = useQuery({
    queryKey: ['estadisticas-ingresos', desde, hasta],
    queryFn: () => estadisticasService.ingresos(desde, hasta),
  })

  if (loadingResumen) return <SpinnerCenter />

  const ventasData = (ventas ?? []).map(v => ({
    periodo: v.periodo?.slice(0, 10) ?? v.periodo,
    ventas: Number(v.total_ventas),
    pedidos: v.cantidad_pedidos,
  }))

  const topData = (productosTop ?? []).map(p => ({
    name: p.nombre.length > 15 ? p.nombre.slice(0, 15) + '…' : p.nombre,
    ingresos: Number(p.ingresos),
    cantidad: p.cantidad_vendida,
  }))

  const estadoData = (pedidosEstado ?? []).map(e => ({
    name: LABELS[e.estado_codigo] ?? e.estado_codigo,
    value: e.cantidad,
  }))

  const ingresosData = (ingresos ?? []).map(i => ({
    name: i.forma_pago_codigo,
    total: Number(i.total),
    cantidad: i.cantidad,
  }))

  return (
    <div>
      <h1 className="section-title font-display" style={{ marginBottom: 24 }}>📊 Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid-3" style={{ marginBottom: 32 }}>
        {errResumen && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => refResumen()}>⚠️ Error al cargar métricas — Reintentar</button>
          </div>
        )}
        <div className="kpi-card">
          <div className="kpi-label">Ventas hoy</div>
          <div className="kpi-value" style={{ color: 'var(--color-accent)' }}>${Number(resumen?.ventas_hoy ?? 0).toFixed(0)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Ticket promedio</div>
          <div className="kpi-value" style={{ color: 'var(--color-success)' }}>${Number(resumen?.ticket_promedio ?? 0).toFixed(0)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pedidos activos</div>
          <div className="kpi-value" style={{ color: 'var(--color-info)' }}>{resumen?.pedidos_activos ?? 0}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Facturación total</div>
          <div className="kpi-value" style={{ color: 'var(--color-success)' }}>${Number(resumen?.facturacion_total ?? 0).toFixed(0)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total pedidos</div>
          <div className="kpi-value" style={{ color: 'var(--color-accent)' }}>{resumen?.total_pedidos ?? 0}</div>
        </div>
      </div>

      {/* Date range */}
      <div className="filters-bar" style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Desde</label>
        <input type="date" className="form-input" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: 150 }} />
        <label style={{ fontSize: 13, color: 'var(--color-text-muted)', marginLeft: 12 }}>Hasta</label>
        <input type="date" className="form-input" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: 150 }} />
      </div>

      {/* Charts row 1 */}
      <div className="grid-2" style={{ gap: 24, marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Ventas por período</h3>
          {errVentas ? <ErrorCard title="Error al cargar ventas" onRefetch={() => refVentas()} /> : loadingVentas ? <SpinnerCenter /> : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={ventasData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="ventas" stroke="#f97316" name="Ventas ($)" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="pedidos" stroke="#3b82f6" name="Pedidos" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Top productos</h3>
          {errTop ? <ErrorCard title="Error al cargar top productos" onRefetch={() => refTop()} /> : loadingTop ? <SpinnerCenter /> : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}
                  formatter={(value: any, _name: string, props: any) => [`$${Number(value).toFixed(0)}`, `${props.payload.cantidad} vendidos`]} />
                <Bar dataKey="ingresos" radius={[0, 4, 4, 0]}>
                  {topData.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid-2" style={{ gap: 24 }}>
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Distribución por estado</h3>
          {errEstado ? <ErrorCard title="Error al cargar estados" onRefetch={() => refEstado()} /> : loadingEstado ? <SpinnerCenter /> : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={estadoData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {estadoData.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Ingresos por forma de pago</h3>
          {errIngresos ? <ErrorCard title="Error al cargar ingresos" onRefetch={() => refIngresos()} /> : loadingIngresos ? <SpinnerCenter /> : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ingresosData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}
                  formatter={(value: any, _name: string, props: any) => [`$${Number(value).toFixed(0)}`, `${props.payload.cantidad} pedidos`]} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {ingresosData.map((_, i) => <Cell key={i} fill={COLORES[(i + 2) % COLORES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
