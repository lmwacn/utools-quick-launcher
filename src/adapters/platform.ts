import { COMMAND_PLATFORMS, type CommandPlatform, type LauncherItem, type PathInspection, type ServiceResult } from '../types/launcher'

const PLATFORM_LABELS: Record<CommandPlatform, string> = {
  all: '所有系统',
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux'
}

export function getCurrentPlatform(): CommandPlatform {
  const platform = window.services?.getPlatform()
  return COMMAND_PLATFORMS.includes(platform as CommandPlatform) ? platform as CommandPlatform : 'all'
}

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
  if (item.type === 'cmd') {
    const currentPlatform = getCurrentPlatform()
    if (item.platform && item.platform !== 'all' && currentPlatform !== item.platform) {
      return { ok: false, error: `该命令仅支持 ${PLATFORM_LABELS[item.platform]}，当前系统为 ${PLATFORM_LABELS[currentPlatform]}` }
    }
    return window.services.runCommand(item.path, {
      mode: item.commandMode ?? 'background',
      workingDirectory: item.workingDirectory,
      environment: item.environment
    })
  }
  return window.services.openPath(item.path)
}
