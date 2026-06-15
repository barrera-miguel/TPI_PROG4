import client from '../api/client'
import type { VentasPeriodoItem, ProductoTopItem, PedidosEstadoItem, IngresosFormaPagoItem, ResumenResponse } from '../types'

export const estadisticasService = {
  ventas: (desde: string, hasta: string, agrupacion: string = 'day'): Promise<VentasPeriodoItem[]> =>
    client.get('/estadisticas/ventas', { params: { desde, hasta, agrupacion } }).then(r => r.data),

  productosTop: (limit: number = 5): Promise<ProductoTopItem[]> =>
    client.get('/estadisticas/productos-top', { params: { limit } }).then(r => r.data),

  pedidosPorEstado: (): Promise<PedidosEstadoItem[]> =>
    client.get('/estadisticas/pedidos-por-estado').then(r => r.data),

  ingresos: (desde: string, hasta: string): Promise<IngresosFormaPagoItem[]> =>
    client.get('/estadisticas/ingresos', { params: { desde, hasta } }).then(r => r.data),

  resumen: (): Promise<ResumenResponse> =>
    client.get('/estadisticas/resumen').then(r => r.data),
}
