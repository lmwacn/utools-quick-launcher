import { beforeEach, describe, expect, it, vi } from 'vitest'
import { launchItem } from './platform'

describe('资源启动适配层', () => {
  const runCommand = vi.fn(async () => ({ ok: true }))
  const openExternal = vi.fn(async () => ({ ok: true }))
  const openPath = vi.fn(async () => ({ ok: true }))
  const getPlatform = vi.fn(() => 'darwin')

  beforeEach(() => {
    runCommand.mockClear()
    openExternal.mockClear()
    openPath.mockClear()
    getPlatform.mockReset()
    getPlatform.mockReturnValue('darwin')
    window.services = {
      runCommand,
      openExternal,
      openPath,
      getPlatform,
      selectFile: vi.fn(),
      inspectPath: vi.fn(),
      readTextFile: vi.fn(),
      writeTextFile: vi.fn(),
      selectImage: vi.fn(),
      readFileAsBase64: vi.fn(),
      fetchFavicon: vi.fn()
    } as unknown as NonNullable<typeof window.services>
  })

  it('将命令高级参数完整传给 preload', async () => {
    await launchItem({
      id: 'command',
      type: 'cmd',
      path: 'npm run dev',
      name: '开发服务',
      platform: 'darwin',
      commandMode: 'terminal',
      workingDirectory: '/projects/demo',
      environment: { NODE_ENV: 'test' }
    })

    expect(runCommand).toHaveBeenCalledWith('npm run dev', {
      mode: 'terminal',
      workingDirectory: '/projects/demo',
      environment: { NODE_ENV: 'test' }
    })
  })

  it('阻止在不匹配的平台运行命令', async () => {
    getPlatform.mockReturnValue('win32')
    const result = await launchItem({
      id: 'mac-only',
      type: 'cmd',
      path: 'open .',
      name: '打开目录',
      platform: 'darwin'
    })

    expect(result).toEqual({ ok: false, error: '该命令仅支持 macOS，当前系统为 Windows' })
    expect(runCommand).not.toHaveBeenCalled()
  })

  it('分别委托网页和本地路径启动', async () => {
    await launchItem({ id: 'site', type: 'url', path: 'https://example.com', name: '站点' })
    await launchItem({ id: 'file', type: 'file', path: '/tmp/demo.txt', name: '文件' })

    expect(openExternal).toHaveBeenCalledWith('https://example.com')
    expect(openPath).toHaveBeenCalledWith('/tmp/demo.txt')
  })
})
