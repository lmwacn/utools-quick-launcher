import { useState } from 'react'
import type { ImportPreview, ImportStrategy } from '../types/launcher'
import Modal from './Modal'

export default function ImportPreviewDialog({
  preview,
  onClose,
  onConfirm
}: {
  preview: ImportPreview
  onClose: () => void
  onConfirm: (strategy: ImportStrategy) => void
}) {
  const [strategy, setStrategy] = useState<ImportStrategy>('skip')
  const total = preview.newItems.length + preview.conflicts.length

  return (
    <Modal title="预览导入数据" description="导入前不会修改现有资源" onClose={onClose} size="medium">
      <div className="import-summary">
        <span><b>{preview.newItems.length}</b> 新资源</span>
        <span><b>{preview.conflicts.length}</b> 冲突</span>
        <span><b>{preview.duplicates}</b> 完全重复</span>
        <span><b>{preview.discarded}</b> 无效</span>
      </div>

      {preview.conflicts.length > 0 && (
        <label className="field">
          <span>冲突处理方式</span>
          <select value={strategy} onChange={(event) => setStrategy(event.target.value as ImportStrategy)}>
            <option value="skip">跳过冲突，保留现有资源</option>
            <option value="overwrite">使用导入数据覆盖现有资源</option>
            <option value="keep-both">保留两者，为导入项创建新 ID</option>
          </select>
        </label>
      )}

      <div className="import-list">
        {preview.conflicts.slice(0, 5).map(({ existing, incoming }) => (
          <div key={`${existing.id}:${incoming.id}`}>
            <b>{incoming.displayName || incoming.name}</b>
            <small>与“{existing.displayName || existing.name}”冲突</small>
          </div>
        ))}
        {preview.conflicts.length > 5 && <small>另有 {preview.conflicts.length - 5} 条冲突</small>}
      </div>

      <footer className="modal-actions">
        <button className="button button--secondary" type="button" onClick={onClose}>取消</button>
        <button className="button button--primary" type="button" onClick={() => onConfirm(strategy)} disabled={!total}>确认导入</button>
      </footer>
    </Modal>
  )
}
