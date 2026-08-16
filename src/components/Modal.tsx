import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  size?: 'small' | 'medium'
}

export default function Modal({ title, description, children, onClose, size = 'small' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = `dialog-${title.replace(/\s+/g, '-')}`

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const focusable = panel.querySelector<HTMLElement>('input:not([disabled]), button:not([disabled]), [tabindex="0"]')
    focusable?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const elements = Array.from(
        panel.querySelectorAll<HTMLElement>('input:not([disabled]), button:not([disabled]), [tabindex="0"]')
      )
      if (!elements.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className={`modal-panel modal-panel--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭弹窗">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
