# 贡献指南

感谢你考虑为 MacPins 做出贡献！这是一个简单的指南，帮助你了解如何贡献代码。

## 开发环境设置

1. 克隆仓库：
   ```bash
   git clone https://github.com/Cail-Gainey/MacPins.git
   cd MacPins
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 运行开发服务器：
   ```bash
   npm run dev
   ```

4. 启用垃圾回收的开发服务器：
   ```bash
   npm run dev:gc
   ```

## 构建应用

```bash
npm run build
npm run build:mac
```

## 代码风格

- 使用 TypeScript 进行类型安全
- 使用 React 函数式组件和 Hooks
- 保持代码简洁清晰
- 添加适当的注释

## 提交 Pull Request

1. 创建一个新分支：
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. 进行更改并提交：
   ```bash
   git commit -m "描述你的更改"
   ```

3. 推送到你的分支：
   ```bash
   git push origin feature/your-feature-name
   ```

4. 在 GitHub 上创建一个 Pull Request

## 版本控制

我们使用 [语义化版本控制](https://semver.org/lang/zh-CN/)。

- 主版本号：不兼容的 API 更改
- 次版本号：向后兼容的功能性新增
- 修订号：向后兼容的问题修正

## 发布流程

1. 更新 `package.json` 中的版本号
2. 创建一个新的标签：
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions 将自动构建并发布 Release

## 行为准则

- 尊重所有贡献者
- 提供建设性的反馈
- 保持专业态度

感谢你的贡献！ 