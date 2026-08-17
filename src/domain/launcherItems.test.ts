import { describe, expect, it } from 'vitest'
import {
  applyImport,
  itemFromDraft,
  matchesSearch,
  mergeImportedItems,
  migrateLauncherData,
  normalizeUrl,
  prepareImport,
  reorderItems,
  validateDraft
} from './launcherItems'
import type { LauncherItem } from '../types/launcher'
import legacyFixture from '../test/fixtures/legacy-v1.json'

const legacyItem: LauncherItem = {
  id: 'old-1',
  type: 'url',
  path: 'https://example.com',
  name: '工作台',
  displayName: '公司工作台',
  customIcon: 'data:image/png;base64,old'
}

describe('历史数据兼容', () => {
  it('完整读取从 1.x 数据结构整理的回归样本', () => {
    const result = migrateLauncherData(legacyFixture)
    expect(result.items).toHaveLength(3)
    expect(result.items[2]).toMatchObject({ type: 'cmd', path: 'echo legacy' })
  })

  it('保留旧 launcher-items.data 的字段', () => {
    const result = migrateLauncherData({
      _id: 'launcher-items',
      _rev: '1-test',
      data: [{ ...legacyItem, legacyExtra: 'keep-me' }]
    })

    expect(result.discarded).toBe(0)
    expect(result.items).toEqual([{ ...legacyItem, legacyExtra: 'keep-me' }])
  })

  it('识别旧导入数据中的 url 和 cmd 字段', () => {
    const result = migrateLauncherData([
      { id: 'url-1', type: 'url', url: 'https://u.tools', name: 'uTools' },
      { id: 'cmd-1', cmd: 'calc', name: '计算器' }
    ])

    expect(result.items[0].path).toBe('https://u.tools')
    expect(result.items[1]).toMatchObject({ type: 'cmd', path: 'calc' })
    expect(result.items[1].platform).toBeUndefined()
  })

  it('忽略缺少名称或路径的损坏数据', () => {
    const result = migrateLauncherData([{ id: 'bad' }, null, legacyItem])
    expect(result.items).toHaveLength(1)
    expect(result.discarded).toBe(2)
  })
})

describe('资源业务规则', () => {
  it('为未带协议的网址补全 HTTPS', () => {
    expect(normalizeUrl('example.com/path')).toBe('https://example.com/path')
  })

  it('校验必填字段和网址协议', () => {
    expect(validateDraft({ type: 'url', name: '', path: '', displayName: '', customIcon: '' })).toBe('请输入启动名称')
    expect(validateDraft({ type: 'url', name: '站点', path: 'file:///tmp', displayName: '', customIcon: '' })).toBe('仅支持 HTTP 或 HTTPS 网址')
  })

  it('创建新资源时保留旧版数据形状', () => {
    const item = itemFromDraft({
      type: 'url',
      path: 'example.com',
      name: '示例',
      displayName: '',
      customIcon: ''
    })
    expect(item).toMatchObject({ type: 'url', path: 'https://example.com', name: '示例' })
    expect(item.id).toBeTruthy()
  })

  it('保存命令平台并允许恢复为全平台兼容', () => {
    const macCommand = itemFromDraft({
      type: 'cmd',
      path: 'open -a "Safari"',
      name: '打开 Safari',
      displayName: '',
      customIcon: '',
      platform: 'darwin'
    })
    expect(macCommand.platform).toBe('darwin')

    const compatibleCommand = itemFromDraft({
      type: 'cmd',
      path: macCommand.path,
      name: macCommand.name,
      displayName: '',
      customIcon: '',
      platform: 'all'
    }, macCommand)
    expect(compatibleCommand.platform).toBeUndefined()
  })

  it('保存命令运行方式、工作目录、环境变量和标签', () => {
    const item = itemFromDraft({
      type: 'cmd',
      path: 'npm run dev',
      name: '开发服务',
      displayName: '',
      customIcon: '',
      platform: 'darwin',
      commandMode: 'terminal',
      workingDirectory: '/projects/demo',
      environment: 'NODE_ENV=development\nPORT=5173',
      tags: '开发, 常用'
    })

    expect(item).toMatchObject({
      commandMode: 'terminal',
      workingDirectory: '/projects/demo',
      environment: { NODE_ENV: 'development', PORT: '5173' },
      tags: ['开发', '常用']
    })
  })

  it('拒绝格式错误的环境变量', () => {
    expect(validateDraft({
      type: 'cmd',
      name: '测试',
      path: 'echo ok',
      displayName: '',
      customIcon: '',
      environment: 'INVALID LINE'
    })).toContain('环境变量格式错误')
  })

  it('导入时按 ID 或类型+路径去重', () => {
    const result = mergeImportedItems([legacyItem], [
      legacyItem,
      { id: 'new-id', type: 'url', path: 'https://example.com', name: '重复路径' },
      { id: 'new-2', type: 'cmd', path: 'calc', name: '计算器' }
    ])
    expect(result.added).toHaveLength(1)
    expect(result.duplicates).toBe(2)
  })

  it('支持排序和多字段搜索', () => {
    const command: LauncherItem = { id: 'cmd', type: 'cmd', path: 'npm run dev', name: '启动项目' }
    const reordered = reorderItems([legacyItem, command], 'cmd', 'old-1')
    expect(reordered.map((item) => item.id)).toEqual(['cmd', 'old-1'])
    expect(matchesSearch(command, 'npm')).toBe(true)
    expect(matchesSearch(legacyItem, '公司')).toBe(true)
    expect(matchesSearch(legacyItem, 'gzt')).toBe(true)
  })

  it('导入前识别冲突并支持保留两者', () => {
    const preview = prepareImport([legacyItem], [
      { ...legacyItem, name: '新版工作台' },
      { id: 'cmd-new', type: 'cmd', path: 'npm test', name: '运行测试' }
    ])
    expect(preview.conflicts).toHaveLength(1)
    expect(preview.newItems[0]).toMatchObject({ id: 'cmd-new', trusted: false })

    const result = applyImport([legacyItem], preview, 'keep-both')
    expect(result).toHaveLength(3)
    expect(result.filter((item) => item.type === 'url')).toHaveLength(2)
  })

  it('导入时将命令高级配置差异识别为冲突', () => {
    const current: LauncherItem = {
      id: 'cmd-advanced',
      type: 'cmd',
      path: 'npm run dev',
      name: '开发服务',
      workingDirectory: '/projects/old'
    }
    const preview = prepareImport([current], [{ ...current, workingDirectory: '/projects/new' }])
    expect(preview.conflicts).toHaveLength(1)
    expect(preview.duplicates).toBe(0)
  })
})
