import type { LauncherItem, PathInspection, ServiceResult } from '../types/launcher'

export function notify(message: string): void {
  if (window.utools) window.utools.showNotification(message)
  else console.info(message)
}

export function getFileIcon(targetPath: string): string | null {
  try {
    return window.utools?.getFileIcon(targetPath) || null
  } catch {
    return null
  }
}

export function inspectItem(item: LauncherItem): PathInspection | null {
  if (!['file', 'folder'].includes(item.type) || !window.services) return null
  return window.services.inspectPath(item.path)
}

export async function launchItem(item: LauncherItem): Promise<ServiceResult<unknown>> {
  if (!window.services) return { ok: false, error: '请在 uTools 开发环境中测试启动功能' }

  if (item.type === 'url') return window.services.openExternal(item.path)
  if (item.type === 'cmd') return window.services.runCommand(item.path)
  return window.services.openPath(item.path)
}
