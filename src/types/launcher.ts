export const RESOURCE_TYPES = ['folder', 'file', 'url', 'cmd'] as const

export type ResourceType = (typeof RESOURCE_TYPES)[number]

export interface LauncherItem {
  id: string
  type: ResourceType
  path: string
  name: string
  displayName?: string
  customIcon?: string
  createdAt?: number
  [key: string]: unknown
}

export interface LauncherDocument {
  _id: 'launcher-items'
  _rev?: string
  data: LauncherItem[]
  schemaVersion?: number
  updatedAt?: number
}

export interface LauncherDraft {
  type: ResourceType
  path: string
  name: string
  displayName: string
  customIcon: string
}

export interface MigrationResult {
  items: LauncherItem[]
  discarded: number
}

export interface ImportResult extends MigrationResult {
  added: LauncherItem[]
  duplicates: number
}

export interface PathInspection {
  exists: boolean
  isDirectory: boolean
}

export interface ServiceResult<T = undefined> {
  ok: boolean
  data?: T
  error?: string
}
