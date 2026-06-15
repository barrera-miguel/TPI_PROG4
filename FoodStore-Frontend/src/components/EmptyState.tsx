interface Props { icon?: string; title: string; desc?: string; action?: React.ReactNode }
export function EmptyState({ icon = '📭', title, desc, action }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3>{title}</h3>
      {desc && <p>{desc}</p>}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  )
}
