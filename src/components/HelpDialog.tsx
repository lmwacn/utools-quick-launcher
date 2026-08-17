import Modal from './Modal'

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="使用帮助" description="更快地管理和启动常用资源" onClose={onClose} size="medium">
      <div className="help-grid">
        <section><b>快速查找</b><p>支持名称、路径、标签、模糊匹配和中文拼音首字母搜索。</p></section>
        <section><b>uTools 直达</b><p>每个启动名称都会注册为动态指令，无需打开首页也能启动。</p></section>
        <section><b>拖放添加</b><p>将文件或文件夹直接拖入窗口，支持一次添加多个资源。</p></section>
        <section><b>键盘操作</b><p>⌘/Ctrl+K 搜索、⌘/Ctrl+N 添加，方向键选择卡片，⌘/Ctrl+1～9 快速启动。</p></section>
        <section><b>排序与批量管理</b><p>支持收藏、最近使用、标签、使用频率排序以及批量导出、收藏和删除。</p></section>
        <section><b>安全备份</b><p>导入前可预览冲突；删除资源进入本机回收站，导出格式继续兼容旧版。</p></section>
        <section><b>跨平台命令</b><p>支持工作目录、环境变量、后台或终端运行；导入命令首次执行前必须确认。</p></section>
      </div>
      <footer className="modal-actions"><button className="button button--primary" type="button" onClick={onClose}>我知道了</button></footer>
    </Modal>
  )
}
