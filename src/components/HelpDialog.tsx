import Modal from './Modal'

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="使用帮助" description="更快地管理和启动常用资源" onClose={onClose} size="medium">
      <div className="help-grid">
        <section><b>快速查找</b><p>搜索名称、卡片名称或路径，也可以使用类型标签过滤。</p></section>
        <section><b>uTools 直达</b><p>每个启动名称都会注册为动态指令，无需打开首页也能启动。</p></section>
        <section><b>拖放添加</b><p>将文件或文件夹直接拖入窗口，支持一次添加多个资源。</p></section>
        <section><b>排序与管理</b><p>在“全部”且未搜索时拖动卡片排序；卡片右上角可编辑或删除。</p></section>
        <section><b>安全备份</b><p>导出的 JSON 与旧版格式兼容，重装前建议导出备份。</p></section>
        <section><b>跨平台命令</b><p>macOS 使用 zsh、Windows 使用 CMD、Linux 优先使用 Bash；可限制命令只在指定系统显示和运行。</p></section>
      </div>
      <footer className="modal-actions"><button className="button button--primary" type="button" onClick={onClose}>我知道了</button></footer>
    </Modal>
  )
}
