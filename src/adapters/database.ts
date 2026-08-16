import { migrateLauncherData } from '../domain/launcherItems'
import type { LauncherDocument, LauncherItem, MigrationResult } from '../types/launcher'

export const LEGACY_DOCUMENT_ID = 'launcher-items' as const
const LOCAL_STORAGE_KEY = 'quick-launcher:launcher-items'
const MAX_DOCUMENT_BYTES = 950_000

function loadRawDocument(): unknown {
  if (window.utools) return window.utools.db.get(LEGACY_DOCUMENT_ID)

  const localValue = window.localStorage.getItem(LOCAL_STORAGE_KEY)
  if (!localValue) return null
  try {
    return JSON.parse(localValue) as unknown
  } catch {
    return null
  }
}

export function loadLauncherItems(): MigrationResult {
  return migrateLauncherData(loadRawDocument())
}

export function saveLauncherItems(items: LauncherItem[]): void {
  const current = loadRawDocument() as Partial<LauncherDocument> | null
  const document: LauncherDocument = {
    _id: LEGACY_DOCUMENT_ID,
    ...(current?._rev ? { _rev: current._rev } : {}),
    data: items,
    schemaVersion: 2,
    updatedAt: Math.floor(Date.now() / 1000)
  }

  const serialized = JSON.stringify(document)
  if (new Blob([serialized]).size > MAX_DOCUMENT_BYTES) {
    throw new Error('数据已接近 uTools 同步数据库的 1 MB 上限，请删除较大的自定义图标后重试')
  }

  if (!window.utools) {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, serialized)
    return
  }

  const result = window.utools.db.put(document as unknown as Record<string, unknown>)
  if (result.error || result.ok === false) throw new Error(result.message || '保存数据失败')
}
