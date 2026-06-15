interface Props { page: number; pages: number; onChange: (p: number) => void }
export function Pagination({ page, pages, onChange }: Props) {
  if (pages <= 1) return null
  const nums = Array.from({ length: Math.min(pages, 5) }, (_, i) => {
    if (pages <= 5) return i + 1
    if (page <= 3) return i + 1
    if (page >= pages - 2) return pages - 4 + i
    return page - 2 + i
  })
  return (
    <div className="pagination">
      <button className="pagination-btn" onClick={() => onChange(page - 1)} disabled={page === 1}>‹</button>
      {nums.map(n => (
        <button key={n} className={`pagination-btn${n === page ? ' active' : ''}`} onClick={() => onChange(n)}>{n}</button>
      ))}
      <button className="pagination-btn" onClick={() => onChange(page + 1)} disabled={page === pages}>›</button>
    </div>
  )
}
