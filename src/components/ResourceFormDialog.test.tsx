import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ResourceFormDialog from './ResourceFormDialog'

describe('资源编辑表单', () => {
  it('允许直接编辑本地路径并重新选择', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <ResourceFormDialog
        type="file"
        item={{ id: 'file-1', type: 'file', path: '/old/file.txt', name: '文档' }}
        currentPlatform="darwin"
        onClose={vi.fn()}
        onSubmit={onSubmit}
        onSelectImage={async () => null}
        onSelectPath={async () => '/new/file.txt'}
        onFetchWebsiteIcon={async () => null}
      />
    )

    const pathInput = screen.getByLabelText('本地资源路径')
    expect(pathInput).toBeEnabled()
    await user.clear(pathInput)
    await user.type(pathInput, '/manual/file.txt')
    expect(pathInput).toHaveValue('/manual/file.txt')

    await user.click(screen.getByRole('button', { name: '重新选择' }))
    expect(pathInput).toHaveValue('/new/file.txt')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '保存修改' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ path: '/new/file.txt' }))
  })

  it('在 macOS 上新建命令时默认选择 zsh', () => {
    render(
      <ResourceFormDialog
        type="cmd"
        currentPlatform="darwin"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onSelectImage={async () => null}
        onSelectPath={async () => null}
        onFetchWebsiteIcon={async () => null}
      />
    )

    expect(screen.getByRole('combobox', { name: '运行平台' })).toHaveValue('darwin')
    expect(screen.getByLabelText('命令')).toHaveAttribute('placeholder', '例如：open -a "Visual Studio Code"')
  })

  it('编辑旧命令时保持全平台兼容语义', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <ResourceFormDialog
        type="cmd"
        item={{ id: 'legacy-command', type: 'cmd', path: 'echo legacy', name: '旧命令' }}
        currentPlatform="darwin"
        onClose={vi.fn()}
        onSubmit={onSubmit}
        onSelectImage={async () => null}
        onSelectPath={async () => null}
        onFetchWebsiteIcon={async () => null}
      />
    )

    expect(screen.getByRole('combobox', { name: '运行平台' })).toHaveValue('all')
    await user.click(screen.getByRole('button', { name: '保存修改' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ platform: 'all' }))
  })

  it('可以通过模板配置终端命令和高级参数', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <ResourceFormDialog
        type="cmd"
        currentPlatform="darwin"
        onClose={vi.fn()}
        onSubmit={onSubmit}
        onSelectImage={async () => null}
        onSelectPath={async () => '/projects/demo'}
        onFetchWebsiteIcon={async () => null}
      />
    )

    await user.type(screen.getByLabelText(/启动名称/), '开发服务')
    await user.click(screen.getByRole('button', { name: '启动开发服务' }))
    await user.selectOptions(screen.getByLabelText('运行方式'), 'terminal')
    await user.click(screen.getByText(/高级设置/))
    await user.click(screen.getByRole('button', { name: '选择目录' }))
    await user.type(screen.getByLabelText(/环境变量/), 'NODE_ENV=development')
    await user.click(screen.getByRole('button', { name: '添加资源' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      path: 'npm run dev',
      commandMode: 'terminal',
      workingDirectory: '/projects/demo',
      environment: 'NODE_ENV=development'
    }))
  })
})
