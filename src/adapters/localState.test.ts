import { describe, expect, it } from 'vitest'
import { loadImportBackup, loadTrash, loadUsage, recordLaunch, saveImportBackup, trashItems } from './localState'

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

  it('保存并读取导入前备份', () => {
    const items = [{ id: 'backup-1', type: 'url' as const, path: 'https://example.com', name: '备份' }]
    saveImportBackup(items)
    expect(loadImportBackup()).toEqual(items)
  })
})
