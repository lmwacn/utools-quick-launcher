import {
  COMMAND_PLATFORMS,
  RESOURCE_TYPES,
  type ImportResult,
  type LauncherDraft,
  type LauncherItem,
  type MigrationResult,
  type ResourceType
} from '../types/launcher'

const RESOURCE_TYPE_SET = new Set<string>(RESOURCE_TYPES)
const COMMAND_PLATFORM_SET = new Set<string>(COMMAND_PLATFORMS)

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function inferType(record: Record<string, unknown>): ResourceType {
  const type = asText(record.type)
  if (RESOURCE_TYPE_SET.has(type)) return type as ResourceType
  if (asText(record.url)) return 'url'
  if (asText(record.cmd) || asText(record.command)) return 'cmd'
  return 'file'
}

export function normalizeLauncherItem(value: unknown): LauncherItem | null {
  const record = asRecord(value)
  if (!record) return null

  const type = inferType(record)
  const path = asText(record.path) || asText(record.url) || asText(record.cmd) || asText(record.command)
  const displayName = asText(record.displayName)
  const name = asText(record.name) || displayName
  const platform = asText(record.platform)

  if (!path || !name) return null

  const item: LauncherItem = {
    ...record,
    id: asText(record.id) || createId(),
    type,
    path,
    name,
    ...(type === 'cmd' && COMMAND_PLATFORM_SET.has(platform) && platform !== 'all'
      ? { platform: platform as LauncherItem['platform'] }
      : {}),
    ...(displayName ? { displayName } : {}),
    ...(asText(record.customIcon) ? { customIcon: asText(record.customIcon) } : {})
  }

  if (type !== 'cmd' || !COMMAND_PLATFORM_SET.has(platform) || platform === 'all') delete item.platform
  return item
}

export function migrateLauncherData(value: unknown): MigrationResult {
  const record = asRecord(value)
  const source = Array.isArray(value) ? value : Array.isArray(record?.data) ? record.data : []
  const items: LauncherItem[] = []
  let discarded = 0

  for (const rawItem of source) {
    const item = normalizeLauncherItem(rawItem)
    if (item) items.push(item)
    else discarded += 1
  }

  return { items, discarded }
}

export function normalizeUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function nameFromPath(value: string): string {
  const segments = value.split(/[\\/]/).filter(Boolean)
  return segments.at(-1) || value
}

export function validateDraft(draft: LauncherDraft): string | null {
  if (!draft.name.trim()) return '请输入启动名称'
  if (!draft.path.trim()) {
    if (draft.type === 'url') return '请输入网址'
    if (draft.type === 'cmd') return '请输入命令'
    return '请选择文件或文件夹'
  }
  if (draft.type === 'url') {
    try {
      const url = new URL(normalizeUrl(draft.path))
      if (!['http:', 'https:'].includes(url.protocol)) return '仅支持 HTTP 或 HTTPS 网址'
    } catch {
      return '请输入有效网址'
    }
  }
  return null
}

export function itemFromDraft(draft: LauncherDraft, original?: LauncherItem): LauncherItem {
  const path = draft.type === 'url' ? normalizeUrl(draft.path) : draft.path.trim()
  const optionalFields = {
    ...(draft.displayName.trim() ? { displayName: draft.displayName.trim() } : {}),
    ...(draft.customIcon.trim() ? { customIcon: draft.customIcon.trim() } : {})
  }

  const item: LauncherItem = {
    ...(original ?? {}),
    id: original?.id ?? createId(),
    type: original?.type ?? draft.type,
    path,
    name: draft.name.trim(),
    createdAt: original?.createdAt ?? Math.floor(Date.now() / 1000),
    ...optionalFields,
    ...(!draft.displayName.trim() && original?.displayName ? { displayName: undefined } : {}),
    ...(!draft.customIcon.trim() && original?.customIcon ? { customIcon: undefined } : {})
  }

  if (item.type === 'cmd' && draft.platform && draft.platform !== 'all') item.platform = draft.platform
  else delete item.platform

  return item
}

export function mergeImportedItems(current: LauncherItem[], input: unknown): ImportResult {
  const migration = migrateLauncherData(input)
  const knownIds = new Set(current.map((item) => item.id))
  const knownPaths = new Set(current.map((item) => `${item.type}:${item.path}`.toLocaleLowerCase()))
  const added: LauncherItem[] = []
  let duplicates = 0

  for (const item of migration.items) {
    const pathKey = `${item.type}:${item.path}`.toLocaleLowerCase()
    if (knownIds.has(item.id) || knownPaths.has(pathKey)) {
      duplicates += 1
      continue
    }
    knownIds.add(item.id)
    knownPaths.add(pathKey)
    added.push(item)
  }

  return {
    items: [...current, ...added],
    added,
    duplicates,
    discarded: migration.discarded
  }
}

export function reorderItems(items: LauncherItem[], sourceId: string, targetId: string): LauncherItem[] {
  const sourceIndex = items.findIndex((item) => item.id === sourceId)
  const targetIndex = items.findIndex((item) => item.id === targetId)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return items

  const next = [...items]
  const [source] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, source)
  return next
}

export function matchesSearch(item: LauncherItem, keyword: string): boolean {
  const query = keyword.trim().toLocaleLowerCase()
  if (!query) return true
  return [item.name, item.displayName, item.path, item.type]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => value.toLocaleLowerCase().includes(query))
}
