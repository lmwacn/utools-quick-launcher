import type { LauncherItem, UsageMap } from '../types/launcher'

const USAGE_KEY = 'quick-launcher:usage-v1'
const TRASH_KEY = 'quick-launcher:trash-v1'
const IMPORT_BACKUP_KEY = 'quick-launcher:import-backup-v1'
const MAX_TRASH_ITEMS = 12

export interface TrashedItem {
  item: LauncherItem
  deletedAt: number
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function loadUsage(): UsageMap {
  return readJson<UsageMap>(USAGE_KEY, {})
}

export function recordLaunch(usage: UsageMap, itemId: string): UsageMap {
  const previous = usage[itemId]
  const next = {
    ...usage,
    [itemId]: {
      count: (previous?.count ?? 0) + 1,
      lastLaunchedAt: Math.floor(Date.now() / 1000)
    }
  }
  writeJson(USAGE_KEY, next)
  return next
}

export function loadTrash(): TrashedItem[] {
  return readJson<TrashedItem[]>(TRASH_KEY, [])
    .filter((entry) => entry?.item?.id && Number.isFinite(entry.deletedAt))
    .slice(0, MAX_TRASH_ITEMS)
}

export function saveTrash(items: TrashedItem[]): TrashedItem[] {
  const next = items.slice(0, MAX_TRASH_ITEMS)
  writeJson(TRASH_KEY, next)
  return next
}

export function trashItems(current: TrashedItem[], items: LauncherItem[]): TrashedItem[] {
  const deletedAt = Math.floor(Date.now() / 1000)
  const deletedIds = new Set(items.map((item) => item.id))
  return saveTrash([
    ...items.map((item) => ({ item, deletedAt })),
    ...current.filter((entry) => !deletedIds.has(entry.item.id))
  ])
}

export function saveImportBackup(items: LauncherItem[]): boolean {
  return writeJson(IMPORT_BACKUP_KEY, items)
}

export function loadImportBackup(): LauncherItem[] {
  return readJson<LauncherItem[]>(IMPORT_BACKUP_KEY, [])
}
