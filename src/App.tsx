import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadLauncherItems, saveLauncherItems } from './adapters/database'
import {
  parseFeatureItemId,
  removeItemFeature,
  setItemFeature,
  syncItemFeatures
} from './adapters/features'
import { getFileIcon, inspectItem, launchItem, notify } from './adapters/platform'
import HelpDialog from './components/HelpDialog'
import ResourceCard from './components/ResourceCard'
import ResourceFormDialog from './components/ResourceFormDialog'
import Toast, { type ToastMessage } from './components/Toast'
import Toolbar, { type FilterType } from './components/Toolbar'
import {
  itemFromDraft,
  matchesSearch,
  mergeImportedItems,
  nameFromPath,
  reorderItems
} from './domain/launcherItems'
import type { LauncherDraft, LauncherItem, PathInspection, ResourceType } from './types/launcher'

interface FormState {
  type: ResourceType
  item?: LauncherItem
}

const initialMigration = loadLauncherItems()

function App() {
  const [items, setItems] = useState<LauncherItem[]>(initialMigration.items)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [form, setForm] = useState<FormState | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(() => initialMigration.discarded > 0 ? {
    id: Date.now(),
    text: `已忽略 ${initialMigration.discarded} 条无法识别的历史数据`,
    tone: 'error'
  } : null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const itemsRef = useRef(items)
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const showToast = useCallback((message: Omit<ToastMessage, 'id'>, duration = 4200) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    setToast({ ...message, id: Date.now() })
    toastTimerRef.current = window.setTimeout(() => setToast(null), duration)
  }, [])

  const commitItems = useCallback((nextItems: LauncherItem[]): boolean => {
    try {
      saveLauncherItems(nextItems)
      setItems(nextItems)
      return true
    } catch (error) {
      showToast({
        text: error instanceof Error ? error.message : '保存失败',
        tone: 'error'
      }, 6500)
      return false
    }
  }, [showToast])

  const handleLaunch = useCallback(async (item: LauncherItem, fromFeature = false) => {
    const result = await launchItem(item)
    if (!result.ok) {
      const message = result.error || '启动失败'
      showToast({ text: message, tone: 'error' }, 6000)
      if (fromFeature) notify(message)
      return
    }

    if (window.utools) {
      window.utools.hideMainWindow()
      if (fromFeature) window.utools.outPlugin()
    } else {
      showToast({ text: `已启动 ${item.displayName || item.name}`, tone: 'success' })
    }
  }, [showToast])

  useEffect(() => {
    syncItemFeatures(items)
  }, [items])

  const { fileIcons, inspections } = useMemo(() => {
    const icons: Record<string, string> = {}
    const nextInspections: Record<string, PathInspection> = {}
    for (const item of items) {
      if (item.type !== 'file' && item.type !== 'folder') continue
      const icon = getFileIcon(item.path)
      const inspection = inspectItem(item)
      if (icon) icons[item.id] = icon
      if (inspection) nextInspections[item.id] = inspection
    }
    return { fileIcons: icons, inspections: nextInspections }
  }, [items])

  useEffect(() => {
    if (!window.utools) return
    window.utools.onPluginEnter((action) => {
      if (action.code === 'launcher') {
        const latest = loadLauncherItems()
        setItems(latest.items)
        return
      }
      const itemId = parseFeatureItemId(action.code)
      if (!itemId) return
      const item = itemsRef.current.find((entry) => entry.id === itemId)
      if (item) void handleLaunch(item, true)
      else notify('该启动项已不存在')
    })
    window.utools.onPluginOut(() => {
      setSearch('')
      setFilter('all')
      setForm(null)
      setShowHelp(false)
    })
  }, [handleLaunch])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('.search-box input')?.focus()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  const counts = useMemo<Record<FilterType, number>>(() => ({
    all: items.length,
    folder: items.filter((item) => item.type === 'folder').length,
    file: items.filter((item) => item.type === 'file').length,
    url: items.filter((item) => item.type === 'url').length,
    cmd: items.filter((item) => item.type === 'cmd').length
  }), [items])

  const visibleItems = useMemo(() => items.filter((item) => {
    const typeMatches = filter === 'all' || item.type === filter
    return typeMatches && matchesSearch(item, search)
  }), [filter, items, search])

  const sortable = filter === 'all' && search.trim() === ''

  const addPaths = useCallback((paths: string[], type?: 'file' | 'folder') => {
    const knownPaths = new Set(itemsRef.current.map((item) => `${item.type}:${item.path}`.toLocaleLowerCase()))
    const added: LauncherItem[] = []
    let duplicates = 0

    for (const targetPath of paths) {
      const detectedType: 'file' | 'folder' = type
        ?? (window.services?.inspectPath(targetPath).isDirectory ? 'folder' : 'file')
      const key = `${detectedType}:${targetPath}`.toLocaleLowerCase()
      if (knownPaths.has(key)) {
        duplicates += 1
        continue
      }
      knownPaths.add(key)
      added.push(itemFromDraft({
        type: detectedType,
        path: targetPath,
        name: nameFromPath(targetPath),
        displayName: '',
        customIcon: ''
      }))
    }

    if (!added.length) {
      if (duplicates) showToast({ text: '所选资源已经存在' })
      return
    }

    if (commitItems([...added, ...itemsRef.current])) {
      const suffix = duplicates ? `，已跳过 ${duplicates} 个重复项` : ''
      showToast({ text: `已添加 ${added.length} 个资源${suffix}`, tone: 'success' })
      if (type) setFilter(type)
    }
  }, [commitItems, showToast])

  const handleAddLocal = async (type: 'file' | 'folder') => {
    if (!window.services) {
      showToast({ text: '请在 uTools 开发环境中选择本地资源', tone: 'error' })
      return
    }
    const paths = await window.services.selectFile(type)
    if (paths?.length) addPaths(paths, type)
  }

  const handleSubmitForm = (draft: LauncherDraft) => {
    if (!form) return
    const nextItem = itemFromDraft(draft, form.item)
    const duplicate = items.find((item) => item.id !== nextItem.id && item.type === nextItem.type && item.path === nextItem.path)
    if (duplicate) {
      showToast({ text: '该资源已经存在', tone: 'error' })
      return
    }

    const nextItems = form.item
      ? items.map((item) => item.id === form.item?.id ? nextItem : item)
      : [nextItem, ...items]
    if (commitItems(nextItems)) {
      setItemFeature(nextItem)
      setForm(null)
      setFilter(nextItem.type)
      showToast({ text: form.item ? '已保存修改' : '已添加资源', tone: 'success' })
    }
  }

  const handleDelete = (item: LauncherItem) => {
    const index = items.findIndex((entry) => entry.id === item.id)
    const nextItems = items.filter((entry) => entry.id !== item.id)
    if (!commitItems(nextItems)) return
    removeItemFeature(item.id)

    showToast({
      text: `已删除 ${item.displayName || item.name}`,
      actionLabel: '撤销',
      onAction: () => {
        const restored = [...itemsRef.current]
        restored.splice(Math.min(index, restored.length), 0, item)
        if (commitItems(restored)) {
          setItemFeature(item)
          setToast(null)
        }
      }
    }, 6500)
  }

  const handleImport = () => {
    if (!window.utools || !window.services) {
      showToast({ text: '导入功能需要在 uTools 中使用', tone: 'error' })
      return
    }
    const paths = window.utools.showOpenDialog({
      title: '导入快速启动数据',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (!paths?.[0]) return

    const file = window.services.readTextFile(paths[0])
    if (!file.ok || !file.data) {
      showToast({ text: file.error || '读取导入文件失败', tone: 'error' })
      return
    }

    try {
      const result = mergeImportedItems(items, JSON.parse(file.data) as unknown)
      if (!result.added.length) {
        showToast({ text: result.discarded ? '没有可导入的有效数据' : '数据已存在，无需重复导入' })
        return
      }
      if (commitItems(result.items)) {
        result.added.forEach(setItemFeature)
        showToast({
          text: `已导入 ${result.added.length} 条，跳过 ${result.duplicates} 条重复数据`,
          tone: 'success'
        }, 6000)
      }
    } catch {
      showToast({ text: '导入文件不是有效的 JSON', tone: 'error' })
    }
  }

  const handleExport = () => {
    if (!window.utools || !window.services) {
      showToast({ text: '导出功能需要在 uTools 中使用', tone: 'error' })
      return
    }
    const targetPath = window.utools.showSaveDialog({
      title: '导出快速启动数据',
      defaultPath: 'launcher-data.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (!targetPath) return
    const result = window.services.writeTextFile(targetPath, JSON.stringify(items, null, 2))
    showToast(result.ok
      ? { text: '导出成功', tone: 'success' }
      : { text: result.error || '导出失败', tone: 'error' })
  }

  const handleSelectImage = async (): Promise<string | null> => {
    if (!window.services) return null
    const paths = await window.services.selectImage()
    if (!paths?.[0]) return null
    const result = window.services.readFileAsBase64(paths[0])
    if (!result.ok || !result.data) {
      showToast({ text: result.error || '读取图标失败', tone: 'error' })
      return null
    }
    return result.data
  }

  const handleDropFiles = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    if (event.dataTransfer.types.includes('text/quick-launcher-item')) return
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => (file as File & { path?: string }).path)
      .filter((path): path is string => Boolean(path))
    if (paths.length) addPaths(paths)
  }

  return (
    <main className="app-shell" onDragOver={(event) => event.preventDefault()} onDrop={handleDropFiles}>
      <Toolbar
        search={search}
        filter={filter}
        counts={counts}
        onSearch={setSearch}
        onFilter={setFilter}
        onAddLocal={(type) => void handleAddLocal(type)}
        onAddVirtual={(type) => setForm({ type })}
        onImport={handleImport}
        onExport={handleExport}
        onHelp={() => setShowHelp(true)}
      />

      <section className="content-section" aria-live="polite">
        <div className="content-summary">
          <span>{visibleItems.length ? `显示 ${visibleItems.length} 个资源` : '未找到资源'}</span>
          {!sortable && items.length > 1 && <small>清空搜索并切换到“全部”后可拖拽排序</small>}
        </div>

        {visibleItems.length > 0 ? (
          <div className="resource-grid">
            {visibleItems.map((item) => (
              <ResourceCard
                key={item.id}
                item={item}
                fileIcon={fileIcons[item.id]}
                inspection={inspections[item.id]}
                sortable={sortable}
                dragging={draggingId === item.id}
                onLaunch={(target) => void handleLaunch(target)}
                onEdit={(target) => setForm({ type: target.type, item: target })}
                onDelete={handleDelete}
                onDragStart={(target) => setDraggingId(target.id)}
                onDrop={(target) => {
                  if (!draggingId) return
                  commitItems(reorderItems(items, draggingId, target.id))
                  setDraggingId(null)
                }}
                onDragEnd={() => setDraggingId(null)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-mark" aria-hidden="true">+</div>
            <h2>{items.length ? '没有匹配的资源' : '建立你的快速启动库'}</h2>
            <p>{items.length ? '试试其他关键词或资源类型' : '可以添加文件、文件夹、网页和命令，也可直接拖入本地资源。'}</p>
            {items.length > 0 && <button className="button button--secondary" type="button" onClick={() => { setSearch(''); setFilter('all') }}>清除筛选</button>}
          </div>
        )}
      </section>

      {form && (
        <ResourceFormDialog
          type={form.type}
          item={form.item}
          onClose={() => setForm(null)}
          onSubmit={handleSubmitForm}
          onSelectImage={handleSelectImage}
        />
      )}
      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </main>
  )
}

export default App
