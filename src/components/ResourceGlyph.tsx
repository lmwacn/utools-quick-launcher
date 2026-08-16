import type { ResourceType } from '../types/launcher'

interface ResourceGlyphProps {
  type: ResourceType
  className?: string
}

export default function ResourceGlyph({ type, className }: ResourceGlyphProps) {
  const commonProps = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  }

  if (type === 'folder') {
    return (
      <svg {...commonProps}>
        <path d="M3.5 7.5h6l1.8 2H20a1.5 1.5 0 0 1 1.5 1.5v7a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2H8l2 2.2" />
        <path d="M3 10h18" />
      </svg>
    )
  }

  if (type === 'file') {
    return (
      <svg {...commonProps}>
        <path d="M6 2.8h7.2L18 7.6V21H6a2 2 0 0 1-2-2V4.8a2 2 0 0 1 2-2Z" />
        <path d="M13 3v5h5M8 12h6M8 16h7" />
      </svg>
    )
  }

  if (type === 'url') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3.5 9h17M3.5 15h17M12 3c2.2 2.4 3.2 5.4 3.2 9s-1 6.6-3.2 9c-2.2-2.4-3.2-5.4-3.2-9S9.8 5.4 12 3Z" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <rect x="2.5" y="4" width="19" height="16" rx="3" />
      <path d="m7 9 3 3-3 3M13 15h4" />
    </svg>
  )
}
