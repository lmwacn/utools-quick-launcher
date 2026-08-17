import { describe, expect, it } from 'vitest'
import { MAX_TRASH_ITEMS, loadImportBackup, loadTrash, loadUsage, recordLaunch, saveImportBackup, trashItems } from './localState'

describe('本机状态', () => {
  it('记录使用次数和最近启动时间', () => {
    const once = recordLaunch({}, 'item-1')
    const twice = recordLaunch(once, 'item-1')
    expect(loadUsage()['item-1'].count).toBe(2)
    expect(twice['item-1'].lastLaunchedAt).toBeGreaterThan(0)
  })

  it('将删除资源放入回收站', () => {
    trashItems([], [{ id: 'item-1', type: 'url', path: 'https://example.com', name: '示例' }])
    expect(loadTrash()[0].item.id).toBe('item-1')
  })

  it('回收站只保留限定数量的最近资源', () => {
    const items = Array.from({ length: MAX_TRASH_ITEMS + 3 }, (_, index) => ({
      id: `item-${index}`,
      type: 'url' as const,
      path: `https://example.com/${index}`,
      name: `示例 ${index}`
    }))
    trashItems([], items)
    expect(loadTrash()).toHaveLength(MAX_TRASH_ITEMS)
    expect(loadTrash()[0].item.id).toBe('item-0')
  })

  it('保存并读取导入前备份', () => {
    const items = [{ id: 'backup-1', type: 'url' as const, path: 'https://example.com', name: '备份' }]
    saveImportBackup(items)
    expect(loadImportBackup()).toEqual(items)
  })

  it('忽略损坏的本机状态和备份条目', () => {
    window.localStorage.setItem('quick-launcher:usage-v1', JSON.stringify({ good: { count: 2, lastLaunchedAt: 10 }, bad: { count: 'many' } }))
    window.localStorage.setItem('quick-launcher:trash-v1', JSON.stringify([
      { item: { id: 'good', type: 'url', path: 'https://example.com', name: '正常' }, deletedAt: 10 },
      { item: { id: 'bad' }, deletedAt: 20 }
    ]))
    window.localStorage.setItem('quick-launcher:import-backup-v1', JSON.stringify([
      { id: 'good', type: 'url', path: 'https://example.com', name: '正常' },
      { id: 'bad' }
    ]))

    expect(loadUsage()).toEqual({ good: { count: 2, lastLaunchedAt: 10 } })
    expect(loadTrash()).toHaveLength(1)
    expect(loadImportBackup()).toHaveLength(1)
  })
})
