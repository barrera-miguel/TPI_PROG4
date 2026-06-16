import { useState, useRef, useEffect } from 'react'

interface Option { value: number; label: string }

interface Props {
  options: Option[]
  value: number
  onChange: (value: number) => void
  placeholder?: string
  style?: React.CSSProperties
}

export function ComboSearch({ options, value, onChange, placeholder = 'Buscar...', style }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)
  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (opt: Option) => {
    onChange(opt.value)
    setQuery('')
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(0)
    setQuery('')
  }

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, ...style }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
        background: 'var(--color-surface)', overflow: 'hidden',
      }}>
        <input
          style={{ border: 'none', flex: 1, padding: '8px 12px', fontSize: 14, background: 'transparent', color: 'var(--color-text)', outline: 'none' }}
          placeholder={selected ? selected.label : placeholder}
          value={open ? query : (selected ? selected.label : '')}
          onFocus={() => { setQuery(''); setOpen(true) }}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
        />
        {value !== 0 && (
          <button onClick={handleClear} style={{ padding: '0 10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 18, lineHeight: 1 }}>×</button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 200,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.map(opt => (
            <div
              key={opt.value}
              onMouseDown={() => handleSelect(opt)}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                background: opt.value === value ? 'var(--color-surface2)' : 'transparent',
                color: 'var(--color-text)',
                borderLeft: opt.value === value ? '3px solid var(--color-accent)' : '3px solid transparent',
              }}
              onMouseEnter={e => { if (opt.value !== value) (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface2)' }}
              onMouseLeave={e => { if (opt.value !== value) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}

      {open && filtered.length === 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 200,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)', padding: '10px 12px',
          fontSize: 13, color: 'var(--color-text-muted)',
        }}>
          Sin resultados
        </div>
      )}
    </div>
  )
}
