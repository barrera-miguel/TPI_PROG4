interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}
export function Modal({ title, onClose, children, footer, size = 'md' }: Props) {
  const maxW = size === 'sm' ? 400 : size === 'lg' ? 760 : 520
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: maxW }}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

interface ConfirmProps {
  msg: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  danger?: boolean
}
export function ConfirmModal({ msg, onConfirm, onCancel, loading, danger }: ConfirmProps) {
  return (
    <Modal title="Confirmar" onClose={onCancel}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={loading}>
            {loading ? 'Procesando...' : 'Confirmar'}
          </button>
        </>
      }>
      <p style={{ color: 'var(--color-text)' }}>{msg}</p>
    </Modal>
  )
}
