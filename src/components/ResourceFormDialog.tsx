import { useState, type FormEvent } from 'react'
import { formatEnvironment, validateDraft } from '../domain/launcherItems'
import type { CommandMode, CommandPlatform, LauncherDraft, LauncherItem, ResourceType } from '../types/launcher'
import Modal from './Modal'

interface ResourceFormDialogProps {
  type: ResourceType
  item?: LauncherItem
  currentPlatform: CommandPlatform
  onClose: () => void
  onSubmit: (draft: LauncherDraft) => void
  onSelectImage: () => Promise<string | null>
  onSelectPath: (type: 'file' | 'folder') => Promise<string | null>
  onFetchWebsiteIcon: (url: string) => Promise<string | null>
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

const COMMAND_TEMPLATES: Record<CommandPlatform, Array<{ label: string; command: string }>> = {
  darwin: [
    { label: '打开 Finder', command: 'open .' },
    { label: '打开 VS Code', command: 'open -a "Visual Studio Code" .' },
    { label: '启动开发服务', command: 'npm run dev' }
  ],
  win32: [
    { label: '打开资源管理器', command: 'explorer .' },
    { label: '打开 VS Code', command: 'code .' },
    { label: '启动开发服务', command: 'npm run dev' }
  ],
  linux: [
    { label: '打开文件管理器', command: 'xdg-open .' },
    { label: '打开 VS Code', command: 'code .' },
    { label: '启动开发服务', command: 'npm run dev' }
  ],
  all: [
    { label: '启动开发服务', command: 'npm run dev' },
    { label: '查看 Git 状态', command: 'git status' }
  ]
}

export default function ResourceFormDialog({
  type,
  item,
  currentPlatform,
  onClose,
  onSubmit,
  onSelectImage,
  onSelectPath,
  onFetchWebsiteIcon
}: ResourceFormDialogProps) {
  const [draft, setDraft] = useState<LauncherDraft>({
    type,
    path: item?.path ?? '',
    name: item?.name ?? '',
    displayName: item?.displayName ?? '',
    customIcon: item?.customIcon ?? '',
    platform: item?.platform ?? (type === 'cmd' ? currentPlatform : undefined),
    commandMode: item?.commandMode ?? 'background',
    workingDirectory: item?.workingDirectory ?? '',
    environment: formatEnvironment(item?.environment),
    tags: item?.tags?.join(', ') ?? ''
  })
  const [error, setError] = useState('')
  const [selectingImage, setSelectingImage] = useState(false)
  const [selectingPath, setSelectingPath] = useState(false)
  const [fetchingIcon, setFetchingIcon] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(item?.workingDirectory || item?.environment))
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

  const handleSelectWorkingDirectory = async () => {
    setSelectingPath(true)
    const targetPath = await onSelectPath('folder')
    setSelectingPath(false)
    if (targetPath) update('workingDirectory', targetPath)
  }

  const handleFetchWebsiteIcon = async () => {
    if (type !== 'url' || !draft.path.trim() || draft.customIcon.trim()) return
    setFetchingIcon(true)
    const image = await onFetchWebsiteIcon(draft.path)
    setFetchingIcon(false)
    if (image) update('customIcon', image)
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
              onBlur={() => { if (type === 'url') void handleFetchWebsiteIcon() }}
              placeholder={type === 'url' ? 'https://example.com' : COMMAND_PLACEHOLDERS[draft.platform ?? currentPlatform]}
              autoComplete="off"
              aria-label={type === 'url' ? '网址' : '命令'}
            />
          )}
          {localResource && <small>可直接修改路径，也可以重新选择；保存时会检查路径和资源类型</small>}
        </div>

        {type === 'cmd' && (
          <>
            <div className="form-split">
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
              </label>
              <label className="field">
                <span>运行方式</span>
                <select
                  aria-label="运行方式"
                  value={draft.commandMode ?? 'background'}
                  onChange={(event) => update('commandMode', event.target.value as CommandMode)}
                >
                  <option value="background">后台运行</option>
                  <option value="terminal">在终端中运行</option>
                </select>
              </label>
            </div>

            <div className="command-templates" aria-label="命令模板">
              <span>常用模板</span>
              {(COMMAND_TEMPLATES[draft.platform ?? currentPlatform]).map((template) => (
                <button key={template.label} type="button" onClick={() => update('path', template.command)}>{template.label}</button>
              ))}
            </div>

            <details
              className="advanced-options"
              open={advancedOpen}
              onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
            >
              <summary>高级设置（工作目录、环境变量）</summary>
              <div className="advanced-options__content">
                <div className="field">
                  <span>工作目录 <em>可选</em></span>
                  <div className="inline-field">
                    <input
                      value={draft.workingDirectory ?? ''}
                      onChange={(event) => update('workingDirectory', event.target.value)}
                      placeholder="命令执行前进入的目录"
                      aria-label="命令工作目录"
                    />
                    <button className="button button--secondary" type="button" onClick={handleSelectWorkingDirectory} disabled={selectingPath}>
                      选择目录
                    </button>
                  </div>
                </div>

                <label className="field">
                  <span>环境变量 <em>可选</em></span>
                  <textarea
                    value={draft.environment ?? ''}
                    onChange={(event) => update('environment', event.target.value)}
                    placeholder={'每行一个，例如：\nNODE_ENV=development\nPORT=5173'}
                    rows={3}
                  />
                  <small>macOS 使用 zsh、Windows 使用 CMD、Linux 优先使用 Bash</small>
                </label>
              </div>
            </details>
          </>
        )}

        <label className="field">
          <span>标签 <em>可选</em></span>
          <input
            value={draft.tags ?? ''}
            onChange={(event) => update('tags', event.target.value)}
            placeholder="例如：工作, 开发, 常用"
          />
          <small>使用逗号分隔，便于筛选和搜索</small>
        </label>

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
            {type === 'url' && (
              <button className="button button--secondary" type="button" onClick={handleFetchWebsiteIcon} disabled={fetchingIcon || !draft.path.trim()}>
                {fetchingIcon ? '获取中…' : '获取站点图标'}
              </button>
            )}
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
