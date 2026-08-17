import { useRef } from 'react'
import type { LauncherItem, PathInspection, ResourceType } from '../types/launcher'
import ResourceGlyph from './ResourceGlyph'

interface ResourceCardProps {
  item: LauncherItem
  fileIcon?: string
  inspection?: PathInspection | null
  sortable: boolean
  dragging: boolean
  selectionMode: boolean
  selected: boolean
  onLaunch: (item: LauncherItem) => void
  onToggleSelect: (item: LauncherItem) => void
  onToggleFavorite: (item: LauncherItem) => void
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
  selectionMode,
  selected,
  onLaunch,
  onToggleSelect,
  onToggleFavorite,
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
      className={`resource-card resource-card--${item.type}${dragging ? ' is-dragging' : ''}${isMissing ? ' is-missing' : ''}${selected ? ' is-selected' : ''}`}
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
        <div className="card-utilities">
          {selectionMode ? (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(item)}
              aria-label={`选择${displayName}`}
            />
          ) : (
            <>
              <button
                type="button"
                className={`favorite-button${item.favorite ? ' is-favorite' : ''}`}
                onClick={() => onToggleFavorite(item)}
                aria-label={item.favorite ? `取消收藏${displayName}` : `收藏${displayName}`}
                title={item.favorite ? '取消收藏' : '收藏'}
              >★</button>
              <details className="card-menu" ref={menuRef}>
                <summary role="button" aria-label={`管理${displayName}`} title="编辑或删除">…</summary>
                <div className="card-menu__panel">
                  <button type="button" onClick={() => { closeMenu(); onEdit(item) }}>编辑</button>
                  <button type="button" className="danger-text" onClick={() => { closeMenu(); onDelete(item) }}>删除</button>
                </div>
              </details>
            </>
          )}
        </div>
      </div>

      <button
        className="card-launch"
        type="button"
        onClick={() => selectionMode ? onToggleSelect(item) : onLaunch(item)}
        aria-label={selectionMode ? `${selected ? '取消选择' : '选择'}${displayName}` : `${isMissing ? '已失效，' : ''}启动${displayName}`}
        data-resource-id={item.id}
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
