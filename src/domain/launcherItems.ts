import {
  COMMAND_MODES,
  COMMAND_PLATFORMS,
  RESOURCE_TYPES,
  type ImportResult,
  type ImportPreview,
  type ImportStrategy,
  type LauncherDraft,
  type LauncherItem,
  type MigrationResult,
  type ResourceType
} from '../types/launcher'
import { match } from 'pinyin-pro'

const RESOURCE_TYPE_SET = new Set<string>(RESOURCE_TYPES)
const COMMAND_PLATFORM_SET = new Set<string>(COMMAND_PLATFORMS)
const COMMAND_MODE_SET = new Set<string>(COMMAND_MODES)

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(asText).filter(Boolean))].slice(0, 20)
}

function normalizeEnvironment(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value)
  if (!record) return undefined
  const entries: Array<[string, string]> = []
  for (const [key, entry] of Object.entries(record)) {
    if (entries.length >= 30) break
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && typeof entry === 'string') entries.push([key, entry])
  }
  return entries.length ? Object.fromEntries(entries) : undefined
}

export function parseEnvironment(value: string): Record<string, string> {
  const environment: Record<string, string> = {}
  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 1) throw new Error(`环境变量格式错误：${trimmed}`)
    const key = trimmed.slice(0, separator).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`环境变量名称无效：${key}`)
    environment[key] = trimmed.slice(separator + 1)
  }
  return environment
}

export function formatEnvironment(value: LauncherItem['environment']): string {
  return value ? Object.entries(value).map(([key, entry]) => `${key}=${entry}`).join('\n') : ''
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
  const commandMode = asText(record.commandMode)
  const workingDirectory = asText(record.workingDirectory)
  const tags = normalizeTags(record.tags)
  const environment = normalizeEnvironment(record.environment)

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
    ...(asText(record.customIcon) ? { customIcon: asText(record.customIcon) } : {}),
    ...(tags.length ? { tags } : {}),
    ...(record.favorite === true ? { favorite: true } : {}),
    ...(record.trusted === false ? { trusted: false } : {})
  }

  if (type === 'cmd') {
    if (!COMMAND_PLATFORM_SET.has(platform) || platform === 'all') delete item.platform
    if (COMMAND_MODE_SET.has(commandMode) && commandMode !== 'background') item.commandMode = commandMode as LauncherItem['commandMode']
    else delete item.commandMode
    if (workingDirectory) item.workingDirectory = workingDirectory
    else delete item.workingDirectory
    if (environment) item.environment = environment
    else delete item.environment
  } else {
    delete item.platform
    delete item.commandMode
    delete item.workingDirectory
    delete item.environment
    delete item.trusted
  }
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
  if (draft.type === 'cmd') {
    try {
      parseEnvironment(draft.environment ?? '')
    } catch (error) {
      return error instanceof Error ? error.message : '环境变量格式错误'
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
  const tags = [...new Set((draft.tags ?? '').split(/[,，]/).map((tag) => tag.trim()).filter(Boolean))].slice(0, 20)

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

  if (tags.length) item.tags = tags
  else delete item.tags

  if (item.type === 'cmd') {
    if (draft.platform && draft.platform !== 'all') item.platform = draft.platform
    else delete item.platform
    if (draft.commandMode && draft.commandMode !== 'background') item.commandMode = draft.commandMode
    else delete item.commandMode
    if (draft.workingDirectory?.trim()) item.workingDirectory = draft.workingDirectory.trim()
    else delete item.workingDirectory
    const environment = parseEnvironment(draft.environment ?? '')
    if (Object.keys(environment).length) item.environment = environment
    else delete item.environment
  } else {
    delete item.platform
    delete item.commandMode
    delete item.workingDirectory
    delete item.environment
  }

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

function importKey(item: LauncherItem): string {
  return `${item.type}:${item.path}`.toLocaleLowerCase()
}

function sameImportContent(left: LauncherItem, right: LauncherItem): boolean {
  const comparable = (item: LauncherItem) => ({
    type: item.type,
    path: item.path,
    name: item.name,
    displayName: item.displayName,
    customIcon: item.customIcon,
    platform: item.platform,
    commandMode: item.commandMode,
    workingDirectory: item.workingDirectory,
    environment: item.environment,
    tags: item.tags,
    favorite: item.favorite
  })
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right))
}

export function prepareImport(current: LauncherItem[], input: unknown): ImportPreview {
  const migration = migrateLauncherData(input)
  const byId = new Map(current.map((item) => [item.id, item]))
  const byPath = new Map(current.map((item) => [importKey(item), item]))
  const seenImportIds = new Set<string>()
  const seenImportPaths = new Set<string>()
  const newItems: LauncherItem[] = []
  const conflicts: ImportPreview['conflicts'] = []
  let duplicates = 0

  for (const sourceItem of migration.items) {
    const incoming = { ...sourceItem, ...(sourceItem.type === 'cmd' ? { trusted: false } : {}) }
    const pathKey = importKey(incoming)
    if (seenImportIds.has(incoming.id) || seenImportPaths.has(pathKey)) {
      duplicates += 1
      continue
    }
    seenImportIds.add(incoming.id)
    seenImportPaths.add(pathKey)
    const existing = byId.get(incoming.id) ?? byPath.get(pathKey)
    if (!existing) {
      newItems.push(incoming)
      continue
    }
    if (sameImportContent(existing, incoming)) duplicates += 1
    else conflicts.push({ existing, incoming })
  }

  return { newItems, conflicts, duplicates, discarded: migration.discarded }
}

export function applyImport(current: LauncherItem[], preview: ImportPreview, strategy: ImportStrategy): LauncherItem[] {
  const next = [...current]
  if (strategy === 'overwrite') {
    for (const conflict of preview.conflicts) {
      const index = next.findIndex((item) => item.id === conflict.existing.id)
      if (index >= 0) next[index] = { ...conflict.incoming, id: conflict.existing.id }
    }
  } else if (strategy === 'keep-both') {
    for (const conflict of preview.conflicts) next.unshift({ ...conflict.incoming, id: createId() })
  }
  return [...preview.newItems, ...next]
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
  return [item.name, item.displayName, item.path, item.type, ...(item.tags ?? [])]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => {
      const candidate = value.toLocaleLowerCase()
      if (candidate.includes(query) || match(value, query)) return true
      let queryIndex = 0
      for (const character of candidate) {
        if (character === query[queryIndex]) queryIndex += 1
        if (queryIndex === query.length) return true
      }
      return false
    })
}
