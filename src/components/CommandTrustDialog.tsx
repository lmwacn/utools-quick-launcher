import type { LauncherItem } from '../types/launcher'
import Modal from './Modal'

export default function CommandTrustDialog({
  item,
  onClose,
  onConfirm
}: {
  item: LauncherItem
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal title="确认运行导入的命令" description="该命令来自导入文件，确认后会标记为可信" onClose={onClose} size="medium">
      <div className="command-warning">
        <b>{item.displayName || item.name}</b>
        <code>{item.path}</code>
        {item.workingDirectory && <small>工作目录：{item.workingDirectory}</small>}
        <p>命令将拥有当前用户权限。请只运行你理解并信任的内容。</p>
      </div>
      <footer className="modal-actions">
        <button className="button button--secondary" type="button" onClick={onClose}>取消</button>
        <button className="button button--primary" type="button" onClick={onConfirm}>信任并运行</button>
      </footer>
    </Modal>
  )
}
