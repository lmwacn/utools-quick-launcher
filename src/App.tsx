import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadLauncherItems, saveLauncherItems } from './adapters/database'
import {
  parseFeatureItemId,
  removeItemFeature,
  setItemFeature,
  syncItemFeatures
} from './adapters/features'
import { getCurrentPlatform, getFileIcon, inspectItem, launchItem, notify } from './adapters/platform'
import { loadImportBackup, loadTrash, loadUsage, recordLaunch, saveImportBackup, saveTrash, trashItems, type TrashedItem } from './adapters/localState'
import CommandTrustDialog from './components/CommandTrustDialog'
import HelpDialog from './components/HelpDialog'
import ImportPreviewDialog from './components/ImportPreviewDialog'
import ResourceCard from './components/ResourceCard'
import ResourceFormDialog from './components/ResourceFormDialog'
import Toast, { type ToastMessage } from './components/Toast'
import Toolbar, { type FilterType } from './components/Toolbar'
import TrashDialog from './components/TrashDialog'
import {
  applyImport,
  itemFromDraft,
  matchesSearch,
  nameFromPath,
  prepareImport,
  reorderItems
} from './domain/launcherItems'
import type { ImportPreview, ImportStrategy, LauncherDraft, LauncherItem, PathInspection, ResourceType, UsageMap } from './types/launcher'

interface FormState {
  type: ResourceType
  item?: LauncherItem
}

type SortMode = 'manual' | 'name' | 'recent' | 'frequent'

interface PendingCommand {
  item: LauncherItem
  fromFeature: boolean
}

const initialMigration = loadLauncherItems()

function App() {
  const [items, setItems] = useState<LauncherItem[]>(initialMigration.items)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedTag, setSelectedTag] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('manual')
  const [form, setForm] = useState<FormState | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [pendingCommand, setPendingCommand] = useState<PendingCommand | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [usage, setUsage] = useState<UsageMap>(() => loadUsage())
  const [trash, setTrash] = useState<TrashedItem[]>(() => loadTrash())
  const [toast, setToast] = useState<ToastMessage | null>(() => initialMigration.discarded > 0 ? {
    id: Date.now(),
    text: `已忽略 ${initialMigration.discarded} 条无法识别的历史数据`,
    tone: 'error'
  } : null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const currentPlatform = getCurrentPlatform()
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

  const performLaunch = useCallback(async (item: LauncherItem, fromFeature = false) => {
    const result = await launchItem(item)
    if (!result.ok) {
      const message = result.error || '启动失败'
      showToast({ text: message, tone: 'error' }, 6000)
      if (fromFeature) notify(message)
      return
    }

    setUsage((current) => recordLaunch(current, item.id))

    if (window.utools) {
      window.utools.hideMainWindow()
      if (fromFeature) window.utools.outPlugin()
    } else {
      showToast({ text: `已启动 ${item.displayName || item.name}`, tone: 'success' })
    }
  }, [showToast])

  const handleLaunch = useCallback(async (item: LauncherItem, fromFeature = false) => {
    if (item.type === 'cmd' && item.trusted === false) {
      setPendingCommand({ item, fromFeature })
      return
    }
    await performLaunch(item, fromFeature)
  }, [performLaunch])

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
      setSelectedTag('')
      setForm(null)
      setShowHelp(false)
      setShowTrash(false)
      setImportPreview(null)
      setPendingCommand(null)
      setSelectionMode(false)
      setSelectedIds(new Set())
    })
  }, [handleLaunch])

  const counts = useMemo<Record<FilterType, number>>(() => ({
    all: items.length,
    favorite: items.filter((item) => item.favorite).length,
    recent: items.filter((item) => usage[item.id]).length,
    folder: items.filter((item) => item.type === 'folder').length,
    file: items.filter((item) => item.type === 'file').length,
    url: items.filter((item) => item.type === 'url').length,
    cmd: items.filter((item) => item.type === 'cmd').length,
    missing: items.filter((item) => inspections[item.id]?.exists === false).length
  }), [inspections, items, usage])

  const tags = useMemo(() => [...new Set(items.flatMap((item) => item.tags ?? []))]
    .sort((left, right) => left.localeCompare(right, 'zh-CN')), [items])

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => {
      const typeMatches = filter === 'all'
        || (filter === 'favorite' && item.favorite)
        || (filter === 'recent' && Boolean(usage[item.id]))
        || (filter === 'missing' && inspections[item.id]?.exists === false)
        || item.type === filter
      const tagMatches = !selectedTag || item.tags?.includes(selectedTag)
      return typeMatches && tagMatches && matchesSearch(item, search)
    })

    const effectiveSort = filter === 'recent' && sortMode === 'manual' ? 'recent' : sortMode
    if (effectiveSort === 'manual') return filtered
    return [...filtered].sort((left, right) => {
      if (effectiveSort === 'name') return (left.displayName || left.name).localeCompare(right.displayName || right.name, 'zh-CN')
      if (effectiveSort === 'frequent') return (usage[right.id]?.count ?? 0) - (usage[left.id]?.count ?? 0)
      return (usage[right.id]?.lastLaunchedAt ?? 0) - (usage[left.id]?.lastLaunchedAt ?? 0)
    })
  }, [filter, inspections, items, search, selectedTag, sortMode, usage])

  const sortable = filter === 'all' && !selectedTag && sortMode === 'manual' && search.trim() === '' && !selectionMode

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
      if (type) {
        setFilter(type)
        setSelectedTag('')
      }
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
    if (draft.type === 'file' || draft.type === 'folder') {
      const inspection = window.services?.inspectPath(draft.path.trim())
      if (inspection && !inspection.exists) {
        showToast({ text: '该路径不存在，请检查后重试', tone: 'error' })
        return
      }
      if (inspection && (draft.type === 'folder') !== inspection.isDirectory) {
        showToast({ text: draft.type === 'folder' ? '所选路径不是文件夹' : '所选路径不是文件', tone: 'error' })
        return
      }
    }
    if (draft.type === 'cmd' && draft.workingDirectory?.trim()) {
      const inspection = window.services?.inspectPath(draft.workingDirectory.trim())
      if (inspection && (!inspection.exists || !inspection.isDirectory)) {
        showToast({ text: '命令工作目录不存在或不是文件夹', tone: 'error' })
        return
      }
    }
    const nextItem = itemFromDraft(draft, form.item)
    if (nextItem.type === 'cmd') nextItem.trusted = true
    const duplicate = items.find((item) => item.id !== nextItem.id && item.type === nextItem.type && item.path === nextItem.path)
    if (duplicate) {
      showToast({ text: '该资源已经存在', tone: 'error' })
      return
    }
    const duplicateName = items.find((item) => item.id !== nextItem.id && item.name.toLocaleLowerCase() === nextItem.name.toLocaleLowerCase())
    if (duplicateName) {
      showToast({ text: '该启动名称已被使用，请换一个名称以避免动态指令冲突', tone: 'error' })
      return
    }

    const nextItems = form.item
      ? items.map((item) => item.id === form.item?.id ? nextItem : item)
      : [nextItem, ...items]
    if (commitItems(nextItems)) {
      setItemFeature(nextItem)
      setForm(null)
      setFilter(nextItem.type)
      setSelectedTag('')
      showToast({ text: form.item ? '已保存修改' : '已添加资源', tone: 'success' })
    }
  }

  const handleDelete = useCallback((item: LauncherItem) => {
    const index = items.findIndex((entry) => entry.id === item.id)
    const nextItems = items.filter((entry) => entry.id !== item.id)
    if (!commitItems(nextItems)) return
    removeItemFeature(item.id)
    setTrash((current) => trashItems(current, [item]))

    showToast({
      text: `已删除 ${item.displayName || item.name}`,
      actionLabel: '撤销',
      onAction: () => {
        const restored = [...itemsRef.current]
        restored.splice(Math.min(index, restored.length), 0, item)
        if (commitItems(restored)) {
          setItemFeature(item)
          setTrash((current) => saveTrash(current.filter((entry) => entry.item.id !== item.id)))
          setToast(null)
        }
      }
    }, 6500)
  }, [commitItems, items, showToast])

  const handleDeleteSelected = () => {
    const targets = items.filter((item) => selectedIds.has(item.id))
    if (!targets.length) return
    if (!commitItems(items.filter((item) => !selectedIds.has(item.id)))) return
    targets.forEach((item) => removeItemFeature(item.id))
    setTrash((current) => trashItems(current, targets))
    setSelectedIds(new Set())
    setSelectionMode(false)
    showToast({ text: `已将 ${targets.length} 个资源移入回收站`, tone: 'success' })
  }

  const handleToggleFavorite = (item: LauncherItem) => {
    const nextItems = items.map((entry) => entry.id === item.id ? { ...entry, favorite: !entry.favorite } : entry)
    if (commitItems(nextItems)) showToast({ text: item.favorite ? '已取消收藏' : '已加入收藏', tone: 'success' })
  }

  const handleFavoriteSelected = () => {
    if (!selectedIds.size) return
    if (commitItems(items.map((item) => selectedIds.has(item.id) ? { ...item, favorite: true } : item))) {
      showToast({ text: `已收藏 ${selectedIds.size} 个资源`, tone: 'success' })
    }
  }

  const handleTagSelected = () => {
    if (!selectedIds.size) return
    const value = window.prompt('输入要添加的标签，多个标签用逗号分隔')
    if (!value) return
    const newTags = value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean)
    if (!newTags.length) return
    const nextItems = items.map((item) => selectedIds.has(item.id)
      ? { ...item, tags: [...new Set([...(item.tags ?? []), ...newTags])].slice(0, 20) }
      : item)
    if (commitItems(nextItems)) showToast({ text: `已为 ${selectedIds.size} 个资源添加标签`, tone: 'success' })
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
      const preview = prepareImport(items, JSON.parse(file.data) as unknown)
      setImportPreview(preview)
    } catch {
      showToast({ text: '导入文件不是有效的 JSON', tone: 'error' })
    }
  }

  const handleConfirmImport = (strategy: ImportStrategy) => {
    if (!importPreview) return
    const nextItems = applyImport(items, importPreview, strategy)
    if (!saveImportBackup(items)) {
      showToast({ text: '无法保存导入前备份，请释放本机存储空间后重试', tone: 'error' }, 6500)
      return
    }
    if (commitItems(nextItems)) {
      setImportPreview(null)
      showToast({
        text: `导入完成：新增 ${importPreview.newItems.length} 条，处理 ${importPreview.conflicts.length} 条冲突`,
        tone: 'success'
      }, 6000)
    }
  }

  const exportResources = (resources: LauncherItem[], defaultPath: string) => {
    if (!window.utools || !window.services) {
      showToast({ text: '导出功能需要在 uTools 中使用', tone: 'error' })
      return
    }
    const targetPath = window.utools.showSaveDialog({
      title: '导出快速启动数据',
      defaultPath,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (!targetPath) return
    const result = window.services.writeTextFile(targetPath, JSON.stringify(resources, null, 2))
    showToast(result.ok
      ? { text: '导出成功', tone: 'success' }
      : { text: result.error || '导出失败', tone: 'error' })
  }


  const handleExport = () => exportResources(items, 'launcher-data.json')

  const handleRestoreImportBackup = () => {
    const backup = loadImportBackup()
    if (!backup.length) {
      showToast({ text: '没有可恢复的导入前备份' })
      return
    }
    if (!window.confirm(`确定恢复导入前的 ${backup.length} 个资源吗？当前列表将被替换。`)) return
    if (commitItems(backup)) showToast({ text: '已恢复导入前备份', tone: 'success' })
  }

  const handleExportSelected = () => {
    const resources = items.filter((item) => selectedIds.has(item.id))
    if (resources.length) exportResources(resources, 'launcher-selected.json')
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

  const handleSelectPath = async (type: 'file' | 'folder'): Promise<string | null> => {
    if (!window.services) {
      showToast({ text: '请在 uTools 开发环境中选择本地资源', tone: 'error' })
      return null
    }
    const paths = await window.services.selectFile(type)
    return paths?.[0] ?? null
  }

  const handleFetchWebsiteIcon = async (url: string): Promise<string | null> => {
    if (!window.services) return null
    const result = await window.services.fetchFavicon(url)
    return result.ok ? result.data ?? null : null
  }

  const handleDropFiles = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    if (event.dataTransfer.types.includes('text/quick-launcher-item')) return
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => (file as File & { path?: string }).path)
      .filter((path): path is string => Boolean(path))
    if (paths.length) addPaths(paths)
  }

  const handleToggleSelection = (item: LauncherItem) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      return next
    })
  }

  const handleRestoreTrash = (entry: TrashedItem) => {
    const duplicate = items.some((item) => item.id === entry.item.id || (item.type === entry.item.type && item.path === entry.item.path))
    if (duplicate) {
      showToast({ text: '该资源已经存在，无法重复恢复', tone: 'error' })
      return
    }
    if (commitItems([entry.item, ...items])) {
      setTrash((current) => saveTrash(current.filter((candidate) => candidate !== entry)))
      setItemFeature(entry.item)
      showToast({ text: '资源已恢复', tone: 'success' })
    }
  }

  const handleEmptyTrash = () => {
    if (!window.confirm('确定永久清空回收站吗？此操作无法撤销。')) return
    setTrash(saveTrash([]))
    showToast({ text: '回收站已清空' })
  }

  const handleTrustCommand = () => {
    if (!pendingCommand) return
    const trustedItem = { ...pendingCommand.item, trusted: true }
    const nextItems = items.map((item) => item.id === trustedItem.id ? trustedItem : item)
    if (!commitItems(nextItems)) return
    const fromFeature = pendingCommand.fromFeature
    setPendingCommand(null)
    void performLaunch(trustedItem, fromFeature)
  }

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey
      const key = event.key.toLocaleLowerCase()
      if (modifier && key === 'k') {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('.search-box input')?.focus()
        return
      }
      if (modifier && key === 'n') {
        event.preventDefault()
        document.querySelector<HTMLElement>('summary[aria-label="添加资源"]')?.click()
        return
      }
      if (modifier && selectionMode && key === 'a') {
        event.preventDefault()
        setSelectedIds(new Set(visibleItems.map((item) => item.id)))
        return
      }
      if (modifier && /^[1-9]$/.test(event.key)) {
        const item = visibleItems[Number(event.key) - 1]
        if (item) {
          event.preventDefault()
          void handleLaunch(item)
        }
        return
      }
      if (document.querySelector('[role="dialog"]')) return
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select')) return

      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.card-launch'))
      const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement)
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key) && buttons.length) {
        event.preventDefault()
        const columns = buttons.filter((button) => button.offsetTop === buttons[0].offsetTop).length || 1
        const start = currentIndex < 0 ? 0 : currentIndex
        const delta = key === 'arrowleft' ? -1 : key === 'arrowright' ? 1 : key === 'arrowup' ? -columns : columns
        buttons[Math.max(0, Math.min(buttons.length - 1, start + delta))]?.focus()
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && currentIndex >= 0) {
        event.preventDefault()
        const item = visibleItems[currentIndex]
        if (item) handleDelete(item)
      } else if (event.key === 'Escape' && selectionMode) {
        setSelectionMode(false)
        setSelectedIds(new Set())
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [handleDelete, handleLaunch, selectionMode, visibleItems])

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
        onRestoreImportBackup={handleRestoreImportBackup}
        selectionMode={selectionMode}
        onToggleSelection={() => {
          setSelectionMode((current) => !current)
          setSelectedIds(new Set())
        }}
        onTrash={() => setShowTrash(true)}
        onHelp={() => setShowHelp(true)}
        tags={tags}
        selectedTag={selectedTag}
        onTag={setSelectedTag}
      />

      <section className="content-section" aria-live="polite">
        <div className="content-summary">
          <span>{visibleItems.length ? `显示 ${visibleItems.length} 个资源` : '未找到资源'}</span>
          <label className="sort-control">
            <span>排序</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="manual">手动排序</option>
              <option value="name">按名称</option>
              <option value="recent">最近使用</option>
              <option value="frequent">最常使用</option>
            </select>
          </label>
        </div>

        {selectionMode && (
          <div className="batch-bar">
            <span>已选择 {selectedIds.size} 项</span>
            <button type="button" onClick={() => setSelectedIds(new Set(visibleItems.map((item) => item.id)))}>全选当前结果</button>
            <button type="button" onClick={handleFavoriteSelected} disabled={!selectedIds.size}>收藏</button>
            <button type="button" onClick={handleTagSelected} disabled={!selectedIds.size}>添加标签</button>
            <button type="button" onClick={handleExportSelected} disabled={!selectedIds.size}>导出</button>
            <button type="button" className="danger-text" onClick={handleDeleteSelected} disabled={!selectedIds.size}>移入回收站</button>
          </div>
        )}

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
                selectionMode={selectionMode}
                selected={selectedIds.has(item.id)}
                onLaunch={(target) => void handleLaunch(target)}
                onToggleSelect={handleToggleSelection}
                onToggleFavorite={handleToggleFavorite}
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
          currentPlatform={currentPlatform}
          onClose={() => setForm(null)}
          onSubmit={handleSubmitForm}
          onSelectImage={handleSelectImage}
          onSelectPath={handleSelectPath}
          onFetchWebsiteIcon={handleFetchWebsiteIcon}
        />
      )}
      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
      {showTrash && (
        <TrashDialog
          items={trash}
          onClose={() => setShowTrash(false)}
          onRestore={handleRestoreTrash}
          onEmpty={handleEmptyTrash}
        />
      )}
      {importPreview && (
        <ImportPreviewDialog
          preview={importPreview}
          onClose={() => setImportPreview(null)}
          onConfirm={handleConfirmImport}
        />
      )}
      {pendingCommand && (
        <CommandTrustDialog
          item={pendingCommand.item}
          onClose={() => setPendingCommand(null)}
          onConfirm={handleTrustCommand}
        />
      )}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </main>
  )
}

export default App
