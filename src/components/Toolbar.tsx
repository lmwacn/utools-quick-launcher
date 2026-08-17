import type { MouseEvent } from 'react'
import type { CommandPlatform, ResourceType } from '../types/launcher'
import ResourceGlyph from './ResourceGlyph'

export type FilterType = 'all' | ResourceType | 'favorite' | 'recent' | 'missing'

interface ToolbarProps {
  search: string
  filter: FilterType
  counts: Record<FilterType, number>
  onSearch: (value: string) => void
  onFilter: (filter: FilterType) => void
  onAddLocal: (type: 'file' | 'folder') => void
  onAddVirtual: (type: 'url' | 'cmd') => void
  onImport: () => void
  onExport: () => void
  onRestoreImportBackup: () => void
  onToggleSelection: () => void
  selectionMode: boolean
  onTrash: () => void
  onHelp: () => void
  tags: string[]
  selectedTag: string
  onTag: (tag: string) => void
  currentPlatform: CommandPlatform
}

const FILTERS: Array<{ value: FilterType; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'favorite', label: '收藏' },
  { value: 'recent', label: '最近' },
  { value: 'folder', label: '文件夹' },
  { value: 'file', label: '文件' },
  { value: 'url', label: '网页' },
  { value: 'cmd', label: '命令' },
  { value: 'missing', label: '失效' }
]

export default function Toolbar({
  search,
  filter,
  counts,
  onSearch,
  onFilter,
  onAddLocal,
  onAddVirtual,
  onImport,
  onExport,
  onRestoreImportBackup,
  onToggleSelection,
  selectionMode,
  onTrash,
  onHelp,
  tags,
  selectedTag,
  onTag,
  currentPlatform
}: ToolbarProps) {
  const runAndClose = (event: MouseEvent<HTMLButtonElement>, callback: () => void) => {
    callback()
    const details = event.currentTarget.closest('details')
    if (details) details.open = false
  }

  return (
    <>
      <header className="app-header">
        <div className="brand-block">
          <img src="./logo.svg" alt="" />
          <div>
            <h1>快速启动</h1>
            <p>所有资源，一处启动</p>
          </div>
        </div>

        <section className="search-row" aria-label="搜索与筛选">
          <label className="search-box">
            <span className="visually-hidden">搜索启动项</span>
            <input
              type="search"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="搜索名称、别名或路径…"
              autoComplete="off"
            />
            {search && <button type="button" onClick={() => onSearch('')} aria-label="清空搜索">×</button>}
          </label>
          <kbd>{currentPlatform === 'win32' || currentPlatform === 'linux' ? 'Ctrl K' : '⌘ K'}</kbd>
        </section>

        <div className="header-actions">
          <details className="dropdown">
            <summary role="button" className="button button--primary" aria-label="添加资源">+ 添加资源</summary>
            <div className="dropdown-panel dropdown-panel--wide">
              <button type="button" aria-label="添加文件" onClick={(event) => runAndClose(event, () => onAddLocal('file'))}>
                <span className="menu-mark menu-mark--file"><ResourceGlyph type="file" /></span><span><b>文件</b><small>应用、文档、脚本等</small></span>
              </button>
              <button type="button" aria-label="添加文件夹" onClick={(event) => runAndClose(event, () => onAddLocal('folder'))}>
                <span className="menu-mark menu-mark--folder"><ResourceGlyph type="folder" /></span><span><b>文件夹</b><small>常用项目和工作目录</small></span>
              </button>
              <button type="button" aria-label="添加网页" onClick={(event) => runAndClose(event, () => onAddVirtual('url'))}>
                <span className="menu-mark menu-mark--url"><ResourceGlyph type="url" /></span><span><b>网页</b><small>网站、后台和在线工具</small></span>
              </button>
              <button type="button" aria-label="添加命令" onClick={(event) => runAndClose(event, () => onAddVirtual('cmd'))}>
                <span className="menu-mark menu-mark--cmd"><ResourceGlyph type="cmd" /></span><span><b>命令</b><small>macOS、Windows 和 Linux</small></span>
              </button>
            </div>
          </details>

          <details className="dropdown">
            <summary role="button" className="button button--secondary more-button" aria-label="更多操作">
              <span className="more-button-dots" aria-hidden="true">⋯</span>
            </summary>
            <div className="dropdown-panel dropdown-panel--compact">
              <button type="button" onClick={(event) => runAndClose(event, onImport)}>导入数据</button>
              <button type="button" onClick={(event) => runAndClose(event, onExport)}>导出备份</button>
              <button type="button" onClick={(event) => runAndClose(event, onRestoreImportBackup)}>恢复导入前备份</button>
              <button type="button" onClick={(event) => runAndClose(event, onToggleSelection)}>{selectionMode ? '退出批量管理' : '批量管理'}</button>
              <button type="button" onClick={(event) => runAndClose(event, onTrash)}>回收站</button>
              <button type="button" onClick={(event) => runAndClose(event, onHelp)}>使用帮助</button>
            </div>
          </details>
        </div>
      </header>

      <nav className="filter-tabs" aria-label="资源类型">
        {FILTERS.map((entry) => (
          <button
            key={entry.value}
            className={filter === entry.value ? 'is-active' : ''}
            type="button"
            aria-pressed={filter === entry.value}
            onClick={() => onFilter(entry.value)}
          >
            {entry.label}<span>{counts[entry.value]}</span>
          </button>
        ))}
      </nav>
      {tags.length > 0 && (
        <label className="tag-filter">
          <span>标签</span>
          <select value={selectedTag} onChange={(event) => onTag(event.target.value)}>
            <option value="">全部标签</option>
            {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </label>
      )}
    </>
  )
}
