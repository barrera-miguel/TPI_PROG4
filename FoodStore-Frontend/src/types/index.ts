// ── Paginación ──────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export interface UsuarioPublico {
  id: number
  nombre: string
  apellido: string
  email: string
  celular?: string
  roles: string[]
  deleted_at?: string | null
  created_at?: string
}
export interface LoginRequest { email: string; contrasena: string }
export interface UsuarioCrear {
  nombre: string; apellido: string; email: string
  celular?: string; contrasena: string
}
export interface Token {
  access_token: string; refresh_token: string
  token_type: string; expires_in: number
}

// ── Categoría ─────────────────────────────────────────────────────────────────
export interface CategoriaRead {
  id: number; nombre: string; descripcion?: string
  imagen_url?: string; parent_id?: number
  created_at?: string; updated_at?: string
}
export interface CategoriaNodo extends CategoriaRead { hijos: CategoriaNodo[] }
export interface CategoriaCreate {
  nombre: string; descripcion?: string; imagen_url?: string; parent_id?: number
}
export interface CategoriaUpdate {
  nombre?: string; descripcion?: string; imagen_url?: string | null; parent_id?: number
}

// ── Ingrediente ───────────────────────────────────────────────────────────────
export interface IngredienteRead {
  id: number; nombre: string; descripcion?: string
  es_alergeno: boolean; unidad_medida_id?: number
  stock_total: string; precio_costo: string
  created_at?: string; updated_at?: string
}
export interface IngredienteCreate {
  nombre: string; descripcion?: string; es_alergeno?: boolean
  unidad_medida_id?: number; stock_total?: string; precio_costo?: string
}
export type IngredienteUpdate = Partial<IngredienteCreate>
export interface StockIngredienteUpdate { stock_total: string }

// ── Unidad de medida ──────────────────────────────────────────────────────────
export interface UnidadMedidaPublica {
  id: number; nombre: string; simbolo: string; tipo: string; created_at?: string
}
export interface UnidadMedidaCrear { nombre: string; simbolo: string; tipo: string }
export type UnidadMedidaActualizar = Partial<UnidadMedidaCrear>

// ── Producto ──────────────────────────────────────────────────────────────────
export interface CategoriaResumen { id: number; nombre: string; es_principal: boolean }
export interface IngredienteResumen {
  id: number; nombre: string; cantidad: string
  simbolo_unidad: string; es_removible: boolean; es_alergeno: boolean
}
export interface ProductoRead {
  id: number; nombre: string; descripcion?: string
  margen_ganancia: string; imagenes_url?: string[]
  stock_calculado: number; precio_costo_calculado: string
  precio_venta: string; disponible: boolean
  unidad_venta_id?: number; tiene_ingredientes: boolean
  stock_directo?: number; precio_base?: string
  created_at?: string; updated_at?: string
  categorias: CategoriaResumen[]; ingredientes: IngredienteResumen[]
}
export interface ProductoCreate {
  nombre: string; descripcion?: string; margen_ganancia?: string
  imagenes_url?: string[]; disponible?: boolean; unidad_venta_id?: number
  stock_directo?: number; precio_base?: string
  categorias?: { categoria_id: number; es_principal?: boolean }[]
  ingredientes?: { ingrediente_id: number; cantidad: string; unidad_medida_id: number; es_removible?: boolean }[]
}
export interface ProductoUpdate {
  nombre?: string; descripcion?: string; margen_ganancia?: string
  imagenes_url?: string[]; disponible?: boolean; unidad_venta_id?: number
  stock_directo?: number; precio_base?: string
}

// ── Dirección ─────────────────────────────────────────────────────────────────
export interface DireccionRead {
  id: number; usuario_id: number; alias?: string
  linea1: string; linea2?: string; ciudad: string
  provincia?: string; codigo_postal?: string
  es_principal: boolean; created_at?: string; updated_at?: string
}
export interface DireccionCrear {
  alias?: string; linea1: string; linea2?: string
  ciudad: string; provincia?: string; codigo_postal?: string
}
export type DireccionActualizar = Partial<DireccionCrear>

// ── Pedido ────────────────────────────────────────────────────────────────────
export interface ItemPedidoCrear {
  producto_id: number; cantidad: number; personalizacion?: number[]
}
export interface PedidoCrear {
  direccion_id?: number; forma_pago_codigo: string
  descuento?: string; notas?: string; items: ItemPedidoCrear[]
}
export interface DetallePedidoPublico {
  producto_id: number; nombre_snapshot: string
  precio_snapshot: string; cantidad: number
  subtotal_snap: string; personalizacion: number[]
}
export interface HistorialEstadoPublico {
  estado_desde?: string; estado_hasta: string
  usuario_id?: number; motivo?: string; created_at?: string
}
export interface PagoPublico {
  id: number; pedido_id: number; estado: string
  mp_payment_id?: number; mp_status?: string; mp_status_detail?: string
  transaction_amount: string; created_at: string
}
export interface PedidoPublico {
  id: number; usuario_id: number; direccion_id?: number
  direccion_snapshot?: string; estado_codigo: string
  forma_pago_codigo: string; subtotal: string
  descuento: string; costo_envio: string; total: string
  notas?: string; created_at?: string
  items: DetallePedidoPublico[]
  historial: HistorialEstadoPublico[]
  pago?: PagoPublico
}
export interface MetricasResumen {
  total_pedidos: number; facturacion_total: string
  pedidos_por_estado: Record<string, number>
}
export interface PagoPreferenciaResponse {
  pago_id: number; preference_id: string; init_point?: string; public_key?: string
}
export interface CloudinaryResponse {
  secure_url: string; public_id: string; width: number; height: number; format: string; resource_type: string
}

export interface WSEvent {
  event: string
  pedido_id: number
  estado_anterior: string | null
  estado_nuevo: string
  usuario_id: number | null
  motivo: string | null
  timestamp: string
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export interface VentasPeriodoItem {
  periodo: string
  total_ventas: string
  cantidad_pedidos: number
}

export interface ProductoTopItem {
  producto_id: number
  nombre: string
  ingresos: string
  cantidad_vendida: number
}

export interface PedidosEstadoItem {
  estado_codigo: string
  cantidad: number
}

export interface IngresosFormaPagoItem {
  forma_pago_codigo: string
  total: string
  cantidad: number
}

export interface ResumenResponse {
  ventas_hoy: string
  ticket_promedio: string
  pedidos_activos: number
  total_pedidos: number
  facturacion_total: string
  mes_actual: string
}
