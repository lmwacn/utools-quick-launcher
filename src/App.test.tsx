import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
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
})
