import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setItemFeature } from './features'

describe('动态指令平台', () => {
  const setFeature = vi.fn()

  beforeEach(() => {
    setFeature.mockReset()
    window.utools = { setFeature } as unknown as NonNullable<typeof window.utools>
  })

  it('按 uTools 格式将指定平台写为数组', () => {
    setItemFeature({
      id: 'mac-command',
      type: 'cmd',
      path: 'open -a "Safari"',
      name: '打开 Safari',
      platform: 'darwin'
    })

    expect(setFeature).toHaveBeenCalledWith(expect.objectContaining({ platform: ['darwin'] }))
  })

  it('历史命令不设置平台限制', () => {
    setItemFeature({ id: 'legacy-command', type: 'cmd', path: 'echo ok', name: '旧命令' })
    expect(setFeature).toHaveBeenCalledWith(expect.not.objectContaining({ platform: expect.anything() }))
  })
})
