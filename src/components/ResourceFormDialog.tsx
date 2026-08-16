import { useState, type FormEvent } from 'react'
import { validateDraft } from '../domain/launcherItems'
import type { CommandPlatform, LauncherDraft, LauncherItem, ResourceType } from '../types/launcher'
import Modal from './Modal'

interface ResourceFormDialogProps {
  type: ResourceType
  item?: LauncherItem
  currentPlatform: CommandPlatform
  onClose: () => void
  onSubmit: (draft: LauncherDraft) => void
  onSelectImage: () => Promise<string | null>
  onSelectPath: (type: 'file' | 'folder') => Promise<string | null>
}

const TYPE_LABELS: Record<ResourceType, string> = {
  folder: '文件夹',
  file: '文件',
  url: '网页',
  cmd: '命令'
}

const PLATFORM_OPTIONS: Array<{ value: CommandPlatform; label: string }> = [
  { value: 'darwin', label: 'macOS · zsh' },
  { value: 'win32', label: 'Windows · CMD' },
  { value: 'linux', label: 'Linux · Bash / sh' },
  { value: 'all', label: '所有系统（命令需自行兼容）' }
]

const COMMAND_PLACEHOLDERS: Record<CommandPlatform, string> = {
  darwin: '例如：open -a "Visual Studio Code"',
  win32: '例如：start "" "C:\\Projects"',
  linux: '例如：xdg-open ~/Projects',
  all: '输入当前系统可执行的 Shell 命令'
}

export default function ResourceFormDialog({
  type,
  item,
  currentPlatform,
  onClose,
  onSubmit,
  onSelectImage,
  onSelectPath
}: ResourceFormDialogProps) {
  const [draft, setDraft] = useState<LauncherDraft>({
    type,
    path: item?.path ?? '',
    name: item?.name ?? '',
    displayName: item?.displayName ?? '',
    customIcon: item?.customIcon ?? '',
    platform: item?.platform ?? (type === 'cmd' ? currentPlatform : undefined)
  })
  const [error, setError] = useState('')
  const [selectingImage, setSelectingImage] = useState(false)
  const [selectingPath, setSelectingPath] = useState(false)
  const localResource = type === 'file' || type === 'folder'

  const update = <K extends keyof LauncherDraft>(field: K, value: LauncherDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setError('')
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const validationError = validateDraft(draft)
    if (validationError) {
      setError(validationError)
      return
    }
    onSubmit(draft)
  }

  const handleSelectImage = async () => {
    setSelectingImage(true)
    const image = await onSelectImage()
    setSelectingImage(false)
    if (image) update('customIcon', image)
  }

  const handleSelectPath = async () => {
    if (!localResource) return
    setSelectingPath(true)
    const targetPath = await onSelectPath(type)
    setSelectingPath(false)
    if (targetPath) update('path', targetPath)
  }

  return (
    <Modal
      title={`${item ? '编辑' : '添加'}${TYPE_LABELS[type]}`}
      description="启动名称同时会成为 uTools 中可搜索的动态指令"
      onClose={onClose}
      size="medium"
    >
      <form className="resource-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>启动名称 <b aria-hidden="true">*</b></span>
          <input
            value={draft.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="例如：微信公众平台"
            autoComplete="off"
          />
          <small>在 uTools 搜索框中输入这个名称即可直接启动</small>
        </label>

        <label className="field">
          <span>卡片名称 <em>可选</em></span>
          <input
            value={draft.displayName}
            onChange={(event) => update('displayName', event.target.value)}
            placeholder="留空则显示启动名称"
            autoComplete="off"
          />
        </label>

        <div className="field">
          <span>{type === 'url' ? '网址' : type === 'cmd' ? '命令' : '路径'} <b aria-hidden="true">*</b></span>
          {localResource ? (
            <div className="inline-field">
              <input
                value={draft.path}
                onChange={(event) => update('path', event.target.value)}
                placeholder={type === 'folder' ? '/Users/name/Projects' : '/Users/name/file.ext'}
                autoComplete="off"
                aria-label="本地资源路径"
              />
              <button className="button button--secondary" type="button" onClick={handleSelectPath} disabled={selectingPath}>
                {selectingPath ? '选择中…' : '重新选择'}
              </button>
            </div>
          ) : (
            <input
              value={draft.path}
              onChange={(event) => update('path', event.target.value)}
              placeholder={type === 'url' ? 'https://example.com' : COMMAND_PLACEHOLDERS[draft.platform ?? currentPlatform]}
              autoComplete="off"
              aria-label={type === 'url' ? '网址' : '命令'}
            />
          )}
          {localResource && <small>可直接修改路径，也可以重新选择；保存时会检查路径和资源类型</small>}
        </div>

        {type === 'cmd' && (
          <label className="field">
            <span>运行平台</span>
            <select
              aria-label="运行平台"
              value={draft.platform ?? currentPlatform}
              onChange={(event) => update('platform', event.target.value as CommandPlatform)}
            >
              {PLATFORM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <small>macOS 使用登录式 zsh，Windows 使用 CMD，Linux 优先使用 Bash</small>
          </label>
        )}

        <div className="field">
          <span>自定义图标 <em>可选</em></span>
          <div className="inline-field">
            <input
              value={draft.customIcon}
              onChange={(event) => update('customIcon', event.target.value)}
              placeholder="图片 URL、Base64，或选择本地图片"
              autoComplete="off"
              aria-label="自定义图标地址"
            />
            <button className="button button--secondary" type="button" onClick={handleSelectImage} disabled={selectingImage}>
              {selectingImage ? '读取中…' : '选择图片'}
            </button>
          </div>
          {draft.customIcon && (
            <div className="icon-preview">
              <img src={draft.customIcon} alt="自定义图标预览" onError={() => setError('图标无法加载，请检查地址')} />
              <button type="button" className="text-button" onClick={() => update('customIcon', '')}>移除</button>
            </div>
          )}
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}

        <footer className="modal-actions">
          <button className="button button--secondary" type="button" onClick={onClose}>取消</button>
          <button className="button button--primary" type="submit">{item ? '保存修改' : '添加资源'}</button>
        </footer>
      </form>
    </Modal>
  )
}
