import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import '../main.css'
import ResourceCard from './ResourceCard'
import TrashDialog from './TrashDialog'

describe('视觉回归', () => {
  it('存在资源图片时隐藏默认类型图标，图片失败后恢复默认图标', () => {
    const { container } = render(
      <ResourceCard
        item={{
          id: 'custom-icon',
          type: 'url',
          path: 'https://example.com',
          name: '自定义图标',
          customIcon: 'data:image/png;base64,invalid'
        }}
        sortable={false}
        dragging={false}
        selectionMode={false}
        selected={false}
        onLaunch={vi.fn()}
        onToggleSelect={vi.fn()}
        onToggleFavorite={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDragStart={vi.fn()}
        onDrop={vi.fn()}
        onDragEnd={vi.fn()}
      />
    )

    const icon = container.querySelector<HTMLElement>('.resource-icon')
    const fallback = icon?.querySelector('svg')
    const image = icon?.querySelector('img')
    expect(icon).toHaveClass('has-image')
    expect(getComputedStyle(fallback as SVGElement).visibility).toBe('hidden')

    fireEvent.error(image as HTMLImageElement)
    expect(icon).not.toHaveClass('has-image')
    expect(getComputedStyle(fallback as SVGElement).visibility).toBe('visible')
  })

  it('长路径使用省略号且不会挤压恢复按钮', () => {
    render(
      <TrashDialog
        items={[{
          deletedAt: 1,
          item: {
            id: 'long-path',
            type: 'folder',
            name: '开机启动',
            path: 'C:\\Users\\meng\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup'
          }
        }]}
        onClose={vi.fn()}
        onRestore={vi.fn()}
        onEmpty={vi.fn()}
      />
    )

    const restore = screen.getByRole('button', { name: '恢复' })
    const path = screen.getByText(/C:\\Users/)
    const textGroup = path.parentElement as HTMLElement
    expect(getComputedStyle(restore).whiteSpace).toBe('nowrap')
    expect(getComputedStyle(restore).flexShrink).toBe('0')
    expect(getComputedStyle(path).textOverflow).toBe('ellipsis')
    expect(getComputedStyle(textGroup).overflow).toBe('hidden')
  })
})
