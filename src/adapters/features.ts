import type { LauncherItem } from '../types/launcher'

const FEATURE_PREFIX = 'item_'

export function featureCode(itemId: string): string {
  return `${FEATURE_PREFIX}${itemId}`
}

export function parseFeatureItemId(code: string): string | null {
  return code.startsWith(FEATURE_PREFIX) ? code.slice(FEATURE_PREFIX.length) : null
}

export function setItemFeature(item: LauncherItem): void {
  window.utools?.setFeature({
    code: featureCode(item.id),
    explain: `快速打开：${item.displayName || item.name}`,
    ...(item.customIcon?.startsWith('data:image/') ? { icon: item.customIcon } : {}),
    ...(item.type === 'cmd' && item.platform && item.platform !== 'all' ? { platform: [item.platform] } : {}),
    cmds: [item.name]
  })
}

export function removeItemFeature(itemId: string): void {
  window.utools?.removeFeature(featureCode(itemId))
}

export function syncItemFeatures(items: LauncherItem[]): void {
  if (!window.utools) return

  const expectedCodes = new Set(items.map((item) => featureCode(item.id)))
  for (const feature of window.utools.getFeatures()) {
    if (feature.code.startsWith(FEATURE_PREFIX) && !expectedCodes.has(feature.code)) {
      window.utools.removeFeature(feature.code)
    }
  }
  items.forEach(setItemFeature)
}
