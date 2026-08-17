# 发布检查清单

## 自动检查

```bash
npm ci
npm run release:check
```

该命令会执行 ESLint、35 项自动化测试、preload 语法检查、TypeScript、Vite 构建，并验证：

- `package.json` 与 `plugin.json` 版本一致。
- 插件标识仍为 `zqbyq8zn`。
- PNG Logo 至少为 256×256。
- `dist` 包含 preload、Logo 和 MIT `LICENSE`。
- 发布目录没有 source map，且总体积小于 5 MB。

## uTools 人工验收

在开发者工具中选择 `dist/plugin.json`，分别在支持的平台验证：

- 文件与文件夹选择、修改路径、失效检测和恢复。
- 网页启动、站点图标获取和自定义图标压缩。
- 后台命令、终端命令、工作目录、环境变量和平台限制。
- 收藏、最近使用、标签、排序、键盘导航和批量操作。
- 1.0.4 数据读取、导入冲突处理、导出和回收站恢复。
- 浅色、深色、窄窗口和高 DPI 显示。

preload 修改不会热更新。验证 preload 后，应在 uTools 开发者工具中彻底退出插件进程再重新打开。

## 发布

1. 更新 `CHANGELOG.md` 和版本号。
2. 确认 Git 工作区干净并创建版本提交。
3. 只选择 `dist` 目录发布，不上传源码根目录。
4. 在应用市场说明中明确：命令会以当前用户权限执行，导入命令首次运行需要确认。
5. 提交审核前保存最终页面截图和安装包备份。
