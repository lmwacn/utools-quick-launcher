import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('快速启动首页', () => {
  beforeEach(() => {
    window.utools = undefined
    window.services = undefined
  })

  it('显示新用户空状态和主要操作', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: '快速启动' })).toBeInTheDocument()
    expect(screen.getByText('建立你的快速启动库')).toBeInTheDocument()
    expect(screen.getByLabelText('添加资源')).toBeInTheDocument()
  })

  it('搜索框位于顶部标题栏中', () => {
    render(<App />)
    const header = screen.getByRole('banner')
    expect(within(header).getByRole('searchbox')).toBeInTheDocument()
  })

  it('可以添加网页并通过搜索过滤', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByLabelText('添加资源'))
    await user.click(screen.getByRole('button', { name: '添加网页' }))
    await user.type(screen.getByLabelText(/启动名称/), '示例站点')
    await user.type(screen.getByLabelText(/网址/), 'example.com')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '添加资源' }))

    expect(screen.getByRole('button', { name: '启动示例站点' })).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox'), '不存在')
    expect(screen.getByText('没有匹配的资源')).toBeInTheDocument()
  })

  it('可以收藏资源并在收藏筛选中查看', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByLabelText('添加资源'))
    await user.click(screen.getByRole('button', { name: '添加网页' }))
    await user.type(screen.getByLabelText(/启动名称/), '收藏站点')
    await user.type(screen.getByLabelText('网址'), 'favorite.example.com')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '添加资源' }))
    await user.click(screen.getByRole('button', { name: '收藏收藏站点' }))
    await user.click(screen.getByRole('button', { name: /收藏1/ }))

    expect(screen.getByRole('button', { name: '启动收藏站点' })).toBeInTheDocument()
  })

  it('清除筛选时同时重置类型、关键词和标签', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByLabelText('添加资源'))
    await user.click(screen.getByRole('button', { name: '添加网页' }))
    await user.type(screen.getByLabelText(/启动名称/), '标签站点')
    await user.type(screen.getByLabelText('网址'), 'tag.example.com')
    await user.type(screen.getByLabelText(/标签/), '工作')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '添加资源' }))
    await user.selectOptions(screen.getByLabelText('标签'), '工作')
    await user.click(screen.getByRole('button', { name: /命令0/ }))
    await user.type(screen.getByRole('searchbox'), '标签')
    await user.click(screen.getByRole('button', { name: '清除筛选' }))

    expect(screen.getByRole('button', { name: '启动标签站点' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByLabelText('标签')).toHaveValue('')
  })

  it('导入命令后要求确认信任再运行', async () => {
    const user = userEvent.setup()
    const runCommand = vi.fn(async () => ({ ok: true }))
    window.utools = {
      db: { get: vi.fn(() => null), put: vi.fn(() => ({ ok: true })) },
      getFeatures: vi.fn(() => []),
      setFeature: vi.fn(),
      removeFeature: vi.fn(() => true),
      onPluginEnter: vi.fn(),
      onPluginOut: vi.fn(),
      getFileIcon: vi.fn(() => ''),
      showNotification: vi.fn(),
      hideMainWindow: vi.fn(),
      outPlugin: vi.fn(),
      showOpenDialog: vi.fn(() => ['/tmp/import.json']),
      showSaveDialog: vi.fn(() => null)
    }
    window.services = {
      openPath: vi.fn(async () => ({ ok: true })),
      openExternal: vi.fn(async () => ({ ok: true })),
      runCommand,
      selectFile: vi.fn(async () => null),
      inspectPath: vi.fn(() => ({ exists: true, isDirectory: false })),
      readTextFile: vi.fn(() => ({
        ok: true,
        data: JSON.stringify([{ id: 'import-command', type: 'cmd', path: 'echo imported', name: '导入命令' }])
      })),
      writeTextFile: vi.fn(() => ({ ok: true })),
      selectImage: vi.fn(async () => null),
      readFileAsBase64: vi.fn(() => ({ ok: false })),
      fetchFavicon: vi.fn(async () => ({ ok: false })),
      getPlatform: vi.fn(() => 'darwin')
    }
    render(<App />)

    await user.click(screen.getByRole('button', { name: '更多操作' }))
    await user.click(screen.getByRole('button', { name: '导入数据' }))
    expect(screen.getByRole('dialog', { name: '预览导入数据' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认导入' }))
    await user.click(screen.getByRole('button', { name: '启动导入命令' }))
    expect(screen.getByRole('dialog', { name: '确认运行导入的命令' })).toBeInTheDocument()
    expect(runCommand).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '信任并运行' }))

    expect(runCommand).toHaveBeenCalledWith('echo imported', expect.objectContaining({ mode: 'background' }))
  })
})
