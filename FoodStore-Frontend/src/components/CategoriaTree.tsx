import { useState } from 'react'
import type { CategoriaNodo, CategoriaRead } from '../types'

interface CategoriaTreeProps {
  nodes: CategoriaNodo[]
  mode: 'display' | 'select-parent'
  selectedParentId?: number | null
  onSelectParent?: (id: number | null) => void
  excludeIds?: Set<number>
  onEdit?: (cat: CategoriaRead) => void
  onDelete?: (cat: CategoriaRead) => void
  onAddChild?: (parentId: number) => void
}

function collectAllIds(nodes: CategoriaNodo[]): Set<number> {
  const ids = new Set<number>()
  const walk = (ns: CategoriaNodo[]) => ns.forEach(n => { ids.add(n.id); walk(n.hijos) })
  walk(nodes)
  return ids
}

export function CategoriaTree({
  nodes, mode, selectedParentId, onSelectParent,
  excludeIds, onEdit, onDelete, onAddChild,
}: CategoriaTreeProps) {
  const allIds = collectAllIds(nodes)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(mode === 'display' ? allIds : new Set())

  const toggle = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const expandAll = () => setExpandedIds(new Set(allIds))
  const collapseAll = () => setExpandedIds(new Set())

  return (
    <div className="cat-tree">
      <div className="cat-tree-toolbar">
        <button type="button" className="btn btn-ghost btn-sm" onClick={expandAll}>Expandir todo</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={collapseAll}>Colapsar todo</button>
      </div>

      {mode === 'select-parent' && (
        <div
          className={`cat-tree-row selectable ${(selectedParentId === null || selectedParentId === undefined) ? 'selected' : ''}`}
          onClick={() => onSelectParent?.(null)}
        >
          <input type="radio" className="cat-tree-radio" checked={selectedParentId === null || selectedParentId === undefined} onChange={() => onSelectParent?.(null)} />
          <div className="cat-tree-content">
            <div className="cat-tree-name cat-tree-name--muted">Sin padre (raíz)</div>
          </div>
        </div>
      )}

      {nodes.map(node => (
        <TreeNode
          key={node.id}
          node={node}
          mode={mode}
          depth={0}
          expandedIds={expandedIds}
          onToggle={toggle}
          selectedParentId={selectedParentId}
          onSelectParent={onSelectParent}
          excludeIds={excludeIds}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
        />
      ))}
    </div>
  )
}

interface TreeNodeProps {
  node: CategoriaNodo
  mode: 'display' | 'select-parent'
  depth: number
  expandedIds: Set<number>
  onToggle: (id: number) => void
  selectedParentId?: number | null
  onSelectParent?: (id: number | null) => void
  excludeIds?: Set<number>
  onEdit?: (cat: CategoriaRead) => void
  onDelete?: (cat: CategoriaRead) => void
  onAddChild?: (parentId: number) => void
}

function TreeNode({
  node, mode, depth, expandedIds, onToggle,
  selectedParentId, onSelectParent, excludeIds,
  onEdit, onDelete, onAddChild,
}: TreeNodeProps) {
  const hasChildren = node.hijos && node.hijos.length > 0
  const expanded = expandedIds.has(node.id)
  const isExcluded = excludeIds?.has(node.id)
  const isSelected = selectedParentId === node.id
  const selectable = mode === 'select-parent' && !isExcluded

  return (
    <div>
      <div
        className={`cat-tree-row ${selectable ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${14 + depth * 28}px` }}
        onClick={() => { if (selectable && onSelectParent) onSelectParent(node.id) }}
      >
        <button
          type="button"
          className={`cat-tree-toggle ${!hasChildren ? 'placeholder' : ''} ${expanded ? 'expanded' : 'collapsed'}`}
          onClick={e => { e.stopPropagation(); if (hasChildren) onToggle(node.id) }}
          tabIndex={hasChildren ? 0 : -1}
        >
          ▶
        </button>

        {mode === 'select-parent' && (
          <input
            type="radio"
            className="cat-tree-radio"
            checked={isSelected}
            disabled={isExcluded}
            onChange={() => onSelectParent?.(node.id)}
          />
        )}

        <div className="cat-tree-content">
          <div className="cat-tree-name">{node.nombre}</div>
          {node.descripcion && mode === 'display' && (
            <div className="cat-tree-desc">{node.descripcion}</div>
          )}
        </div>

        {mode === 'display' && (
          <div className="cat-tree-actions">
            {onAddChild && (
              <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onAddChild(node.id) }} title="Agregar subcategoría">
                ＋
              </button>
            )}
            {onEdit && (
              <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onEdit(node) }}>
                ✏️
              </button>
            )}
            {onDelete && (
              <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); onDelete(node) }}>
                🗑
              </button>
            )}
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {node.hijos.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              mode={mode}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              selectedParentId={selectedParentId}
              onSelectParent={onSelectParent}
              excludeIds={excludeIds}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  )
}
