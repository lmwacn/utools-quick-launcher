import { MAX_TRASH_ITEMS, type TrashedItem } from '../adapters/localState'
import Modal from './Modal'

export default function TrashDialog({
  items,
  onClose,
  onRestore,
  onEmpty
}: {
  items: TrashedItem[]
  onClose: () => void
  onRestore: (entry: TrashedItem) => void
  onEmpty: () => void
}) {
  return (
    <Modal title="回收站" description={`最多保留最近删除的 ${MAX_TRASH_ITEMS} 个资源，仅保存在本机`} onClose={onClose} size="medium">
      {items.length ? (
        <div className="trash-list">
          {items.map((entry) => (
            <div key={`${entry.item.id}:${entry.deletedAt}`}>
              <span><b>{entry.item.displayName || entry.item.name}</b><small>{entry.item.path}</small></span>
              <button className="button button--secondary" type="button" onClick={() => onRestore(entry)}>恢复</button>
            </div>
          ))}
        </div>
      ) : <div className="dialog-empty">回收站是空的</div>}
      <footer className="modal-actions">
        {items.length > 0 && <button className="button danger-button" type="button" onClick={onEmpty}>清空回收站</button>}
        <button className="button button--primary" type="button" onClick={onClose}>完成</button>
      </footer>
    </Modal>
  )
}
