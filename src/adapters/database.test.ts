import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LEGACY_DOCUMENT_ID, loadLauncherItems, saveLauncherItems } from './database'
import type { LauncherItem } from '../types/launcher'

const item: LauncherItem = {
  id: 'legacy-id',
  type: 'file',
  path: '/tmp/demo.txt',
  name: 'demo.txt'
}

describe('数据库适配层', () => {
  beforeEach(() => {
    window.utools = undefined
  })

  it('在浏览器预览中使用同样的文档格式', () => {
    saveLauncherItems([item])
    const raw = JSON.parse(window.localStorage.getItem('quick-launcher:launcher-items') || '{}')
    expect(raw).toMatchObject({ _id: LEGACY_DOCUMENT_ID, schemaVersion: 2, data: [item] })
    expect(loadLauncherItems().items).toEqual([item])
  })

  it('写回 uTools 时带上旧文档的 _rev', () => {
    const put = vi.fn(() => ({ ok: true, rev: '3-new' }))
    window.utools = {
      db: { get: () => ({ _id: LEGACY_DOCUMENT_ID, _rev: '2-old', data: [item] }), put },
      getFeatures: () => [],
      setFeature: vi.fn(),
      removeFeature: vi.fn(() => true),
      onPluginEnter: vi.fn(),
      onPluginOut: vi.fn(),
      getFileIcon: vi.fn(() => ''),
      showNotification: vi.fn(),
      hideMainWindow: vi.fn(),
      outPlugin: vi.fn(),
      showOpenDialog: vi.fn(() => null),
      showSaveDialog: vi.fn(() => null)
    }

    saveLauncherItems([item])
    expect(put).toHaveBeenCalledWith(expect.objectContaining({
      _id: LEGACY_DOCUMENT_ID,
      _rev: '2-old',
      data: [item]
    }))
  })
})
