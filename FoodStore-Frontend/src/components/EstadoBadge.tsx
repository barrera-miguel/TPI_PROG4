const MAP: Record<string, string> = {
  PENDIENTE: 'badge-yellow',
  CONFIRMADO: 'badge-blue',
  EN_PREPARACION: 'badge-orange',
  ENTREGADO: 'badge-green',
  CANCELADO: 'badge-red',
}
const LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  EN_PREPARACION: 'En preparación',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
}
export function EstadoBadge({ estado }: { estado: string }) {
  return <span className={`badge ${MAP[estado] ?? 'badge-gray'}`}>{LABELS[estado] ?? estado}</span>
}
