# 贡献指南

感谢你帮助改进“快速启动”。

## 开始之前

1. 先搜索现有 Issue，避免重复工作。
2. 较大的新功能或数据结构变更请先建 Issue 讨论。
3. 修改前阅读 [ARCHITECTURE.md](./ARCHITECTURE.md) 中的数据兼容合同。

## 本地检查

```bash
npm install
npm run check
```

与本地能力有关的变更还应在 uTools 开发者工具中验证。

## 代码要求

- 使用 TypeScript strict mode，不要使用无理由的 `any`。
- 业务规则放在 `domain`，外部 API 放在 `adapters`。
- React 组件不直接引入 Node.js 或 Electron。
- 不打包、压缩或混淆 `public/preload` 中的代码。
- 改变用户数据时必须补充迁移测试和回滚说明。
- 界面交互必须考虑键盘焦点、深色模式和窄窗口。

## 提交与 Pull Request

- 提交信息使用简洁明确的中文。
- 一个 PR 聚焦一个主题，不夹带无关重构。
- PR 说明中列出用户可见变化、数据影响和验证结果。
- 界面变更建议提供截图。

## 安全

不要在公开 Issue 中提交可被利用的命令执行漏洞细节、用户路径或私密数据。请先与维护者私下联系。
