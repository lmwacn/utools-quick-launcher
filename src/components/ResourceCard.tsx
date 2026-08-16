import { useRef } from 'react'
import type { LauncherItem, PathInspection, ResourceType } from '../types/launcher'
import ResourceGlyph from './ResourceGlyph'

interface ResourceCardProps {
  item: LauncherItem
  fileIcon?: string
  inspection?: PathInspection | null
  sortable: boolean
  dragging: boolean
  onLaunch: (item: LauncherItem) => void
  onEdit: (item: LauncherItem) => void
  onDelete: (item: LauncherItem) => void
  onDragStart: (item: LauncherItem) => void
  onDrop: (item: LauncherItem) => void
  onDragEnd: () => void
}

const TYPE_LABELS: Record<ResourceType, string> = {
  folder: '文件夹',
  file: '文件',
  url: '网页',
  cmd: '命令'
}

const PLATFORM_SHORT_LABELS = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux'
} as const

export default function ResourceCard({
  item,
  fileIcon,
  inspection,
  sortable,
  dragging,
  onLaunch,
  onEdit,
  onDelete,
  onDragStart,
  onDrop,
  onDragEnd
}: ResourceCardProps) {
  const menuRef = useRef<HTMLDetailsElement>(null)
  const isMissing = inspection?.exists === false
  const displayName = item.displayName || item.name
  const subtitle = item.displayName
    ? item.name
    : item.type === 'cmd'
      ? item.platform && item.platform !== 'all' ? PLATFORM_SHORT_LABELS[item.platform] : item.path
      : ''
  const image = item.customIcon || fileIcon
  const closeMenu = () => {
    if (menuRef.current) menuRef.current.open = false
  }

  return (
    <article
      className={`resource-card resource-card--${item.type}${dragging ? ' is-dragging' : ''}${isMissing ? ' is-missing' : ''}`}
      draggable={sortable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/quick-launcher-item', item.id)
        onDragStart(item)
      }}
      onDragOver={(event) => {
        if (sortable) event.preventDefault()
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes('text/quick-launcher-item')) return
        event.preventDefault()
        event.stopPropagation()
        onDrop(item)
      }}
      onDragEnd={onDragEnd}
      onContextMenu={(event) => {
        event.preventDefault()
        if (menuRef.current) menuRef.current.open = true
      }}
    >
      <div className="card-topline">
        <span className={`type-label type-label--${item.type}`}>{TYPE_LABELS[item.type]}</span>
        <details className="card-menu" ref={menuRef}>
          <summary role="button" aria-label={`管理${displayName}`} title="编辑或删除">…</summary>
          <div className="card-menu__panel">
            <button type="button" onClick={() => { closeMenu(); onEdit(item) }}>编辑</button>
            <button type="button" className="danger-text" onClick={() => { closeMenu(); onDelete(item) }}>删除</button>
          </div>
        </details>
      </div>

      <button
        className="card-launch"
        type="button"
        onClick={() => onLaunch(item)}
        aria-label={`${isMissing ? '已失效，' : ''}启动${displayName}`}
        title={item.path}
      >
        <span className={`resource-icon${image ? ' has-image' : ''}`} aria-hidden="true">
          <ResourceGlyph type={item.type} />
          {image && <img src={image} alt="" onError={(event) => {
            event.currentTarget.style.display = 'none'
            event.currentTarget.parentElement?.classList.remove('has-image')
          }} />}
        </span>
        <strong>{displayName}</strong>
        {subtitle && <small>{subtitle}</small>}
        {isMissing && <span className="missing-status">路径已失效</span>}
      </button>
    </article>
  )
}
