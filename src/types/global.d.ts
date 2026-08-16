import type { PathInspection, ServiceResult } from './launcher'

interface UtoolsDbResult {
  ok?: boolean
  error?: boolean
  rev?: string
  message?: string
}

interface UtoolsFeature {
  code: string
  explain?: string
  icon?: string
  platform?: string[]
  cmds: string[]
}

interface UtoolsBridge {
  db: {
    get: (id: string) => Record<string, unknown> | null
    put: (document: Record<string, unknown>) => UtoolsDbResult
  }
  getFeatures: () => UtoolsFeature[]
  setFeature: (feature: UtoolsFeature) => void
  removeFeature: (code: string) => boolean
  onPluginEnter: (callback: (action: PluginEnterAction) => void) => void
  onPluginOut: (callback: (isKill: boolean) => void) => void
  getFileIcon: (path: string) => string
  showNotification: (message: string) => void
  hideMainWindow: () => void
  outPlugin: () => void
  showOpenDialog: (options: Record<string, unknown>) => string[] | null
  showSaveDialog: (options: Record<string, unknown>) => string | null
}

interface PluginEnterAction {
  code: string
  type?: string
  payload?: unknown
}

interface QuickLauncherServices {
  openPath: (targetPath: string) => Promise<ServiceResult>
  openExternal: (url: string) => Promise<ServiceResult>
  runCommand: (command: string) => Promise<ServiceResult<{ pid?: number; shell?: string; platform?: string }>>
  selectFile: (type: 'file' | 'folder') => Promise<string[] | null>
  inspectPath: (targetPath: string) => PathInspection
  readTextFile: (targetPath: string) => ServiceResult<string>
  writeTextFile: (targetPath: string, content: string) => ServiceResult
  selectImage: () => Promise<string[] | null>
  readFileAsBase64: (targetPath: string) => ServiceResult<string>
  getPlatform: () => string
}

declare global {
  interface Window {
    utools?: UtoolsBridge
    services?: QuickLauncherServices
  }
}

export {}
