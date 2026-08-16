export interface ToastMessage {
  id: number
  text: string
  tone?: 'default' | 'error' | 'success'
  actionLabel?: string
  onAction?: () => void
}

interface ToastProps {
  toast: ToastMessage
  onClose: () => void
}

export default function Toast({ toast, onClose }: ToastProps) {
  return (
    <div className={`toast toast--${toast.tone ?? 'default'}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <span>{toast.text}</span>
      {toast.actionLabel && toast.onAction && (
        <button type="button" onClick={toast.onAction}>{toast.actionLabel}</button>
      )}
      <button className="toast-close" type="button" onClick={onClose} aria-label="关闭提示">×</button>
    </div>
  )
}
