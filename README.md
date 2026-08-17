# 快速启动

一款以用户体验为中心的 uTools 资源启动器，统一管理文件、文件夹、网页和系统命令。

## 主要功能

- 添加和启动本地文件、文件夹、网页与跨平台命令。
- macOS 使用登录式 zsh、Windows 使用 CMD、Linux 优先使用 Bash，并可为命令限定运行平台。
- 命令支持工作目录、环境变量、后台运行和终端运行，导入命令首次执行前需要确认。
- 按名称、路径、标签、模糊文本或中文拼音搜索，并按类型、收藏、最近使用和失效状态筛选。
- 拖入多个本地资源，拖拽卡片调整排序。
- 自动注册 uTools 动态指令，从 uTools 搜索框直接启动。
- 支持站点图标、自定义图标压缩、批量操作、导入冲突预览、回收站和失效路径修复。
- 支持浅色/深色主题、键盘导航、窄窗口和减少动画偏好。
- 兼容 1.0.4 及更早版本的 `launcher-items` 数据。

## 技术栈

- React 19.2.3
- Vite 8
- TypeScript 6（strict mode）
- Vitest 4
- React Testing Library
- ESLint 10

## 开发环境

- Node.js 20.19 或更高版本
- npm 10 或更高版本
- uTools 及 uTools 开发者工具

```bash
npm install
npm run dev
```

在 uTools 开发者工具中选择 `public/plugin.json` 接入开发。开发环境会访问 `http://localhost:5173`。

## 常用命令

```bash
npm run dev          # 启动本地开发服务器
npm run lint         # 检查代码规范
npm run test         # 执行测试
npm run test:watch   # 监听模式测试
npm run build        # 类型检查并生成 dist
npm run check        # 完整执行规范、测试和构建检查
npm run release:check # 检查可发布的 dist 目录
```

uTools 打包时只使用 `dist` 产物，不要打包整个源码目录。`public` 中的 `plugin.json`、`logo.png` 和 `preload` 会被 Vite 原样复制到 `dist`。

### 图标维护

- `public/logo.svg` 是蓝色纸飞机 Logo 的可编辑源文件，界面和主动态指令直接使用 SVG。
- `public/logo.png` 是 256×256 的发布图标，`plugin.json` 保持引用 PNG，兼容上传和展示环境。
- 修改 SVG 后需重新生成 PNG；macOS 可执行 `sips -z 256 256 -s format png public/logo.svg --out public/logo.png`。
- uTools 官方允许功能指令图标使用 PNG、JPG 或 SVG，详见 [plugin.json 配置说明](https://www.u-tools.cn/docs/developer/information/plugin-json.html)。

## 历史数据兼容

新版本保留以下兼容合同：

- 插件标识：`zqbyq8zn`
- 数据库文档 ID：`launcher-items`
- 资源数组字段：`data`
- 动态指令：`item_${id}`
- 历史字段：`id` / `type` / `path` / `name` / `displayName` / `customIcon`
- 新增可选字段：`platform` / `commandMode` / `workingDirectory` / `environment` / `tags` / `favorite`

导入时同时兼容历史 `url`、`cmd` 和 `command` 字段。新版本将 `schemaVersion` 作为附加字段写入原文档，不会改变旧版的 `data` 数组结构。

旧命令缺少高级字段时继续按全平台、后台运行处理。使用次数和回收站只保存在本机，不进入同步文档。

uTools 同步文档上限为 1 MB。新选择的原始图标最大 2 MB，保存前会自动缩放到 128px 并压缩到 120 KB 以内，同时检查整个同步文档体积。

## 目录结构

```text
src/
├── adapters/       uTools、数据库和 preload 适配层
├── components/     界面组件
├── domain/         数据迁移、校验和业务规则
├── test/           测试环境
└── types/          资源与 uTools 类型定义
public/
├── plugin.json
├── logo.svg        可维护的纸飞机品牌源文件
├── logo.png        uTools 插件主图标
└── preload/         未打包的 CommonJS 本地能力层
```

更详细的模块边界见 [ARCHITECTURE.md](./ARCHITECTURE.md)，参与开发前请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)，发布前执行 [RELEASE.md](./RELEASE.md) 中的检查。

## 安全说明

命令类资源会通过当前操作系统的 Shell 执行：macOS 为 `/bin/zsh -lc`，Windows 为 `cmd.exe`，Linux 优先为 `/bin/bash -lc`。Shell 命令拥有当前用户权限；导入的命令首次执行前会显示完整内容并请求确认。

## 许可证

本项目采用 [MIT License](./LICENSE)。
