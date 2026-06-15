import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productosService } from '../services/productos.service'
import { categoriasService } from '../services/categorias.service'
import { ProductCard } from '../components/ProductCard'
import { Pagination } from '../components/Pagination'
import { EmptyState } from '../components/EmptyState'

function SkeletonCard() {
  return (
    <div className="product-card" style={{ animation: 'pulse 1.5s ease infinite alternate' }}>
      <div style={{ height: 180, background: 'var(--color-surface2)' }} />
      <div className="product-card-body">
        <div style={{ height: 16, background: 'var(--color-surface2)', borderRadius: 4, width: '70%' }} />
        <div style={{ height: 22, background: 'var(--color-surface2)', borderRadius: 4, width: '40%' }} />
      </div>
    </div>
  )
}

export function ProductosPage() {
  const [page, setPage] = useState(1)
  const [nombre, setNombre] = useState('')
  const [debouncedNombre, setDebouncedNombre] = useState('')
  const [categoriaId, setCategoriaId] = useState<number | undefined>()

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedNombre(nombre); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [nombre])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['productos', page, debouncedNombre, categoriaId],
    queryFn: () => productosService.listar({ page, size: 12, nombre: debouncedNombre || undefined, disponible: true, categoria_id: categoriaId }),
  })
  const { data: cats } = useQuery({ queryKey: ['categorias-arbol'], queryFn: categoriasService.arbol })

  // Aplanar árbol para el select
  const flattened: { id: number; nombre: string; depth: number }[] = []
  const flatten = (nodes: any[], depth = 0) => nodes.forEach(n => {
    flattened.push({ id: n.id, nombre: n.nombre, depth })
    if (n.hijos?.length) flatten(n.hijos, depth + 1)
  })
  if (cats) flatten(cats)

  return (
    <div className="page-wrapper">
      <div className="container page-content">
        <div className="section-header">
          <div>
            <h1 className="section-title font-display">Nuestro menú 🍽️</h1>
            <p className="section-subtitle">{data?.total ?? 0} productos disponibles</p>
          </div>
        </div>

        <div className="filters-bar">
          <input
            className="form-input"
            placeholder="Buscar producto..."
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            style={{ flex: 1, maxWidth: 280 }}
          />
          <select className="form-select" value={categoriaId ?? ''} onChange={e => { setCategoriaId(e.target.value ? Number(e.target.value) : undefined); setPage(1) }}>
            <option value="">Todas las categorías</option>
            {flattened.map(c => (
              <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.nombre}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="grid-4">{Array(8).fill(0).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : isError ? (
          <EmptyState icon="⚠️" title="Error al cargar productos" desc="No se pudo conectar con el servidor"
            action={<button className="btn btn-primary" onClick={() => refetch()}>Reintentar</button>} />
        ) : !data?.items.length ? (
          <EmptyState icon="🔍" title="Sin resultados" desc="Probá con otro nombre o categoría" />
        ) : (
          <div className="grid-4">
            {data.items.map(p => (
              <ProductCard key={p.id} producto={p} />
            ))}
          </div>
        )}
        {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
      </div>
    </div>
  )
}
