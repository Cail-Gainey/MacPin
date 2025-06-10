# MacPins

MacPins是一款适用于macOS的剪贴板历史管理工具，允许用户方便地访问和重用之前复制的文本

## 功能特点

- 保存文本剪贴板历史
- 支持无限历史记录
- 通过全局快捷键快速访问
- 本地存储剪贴板历史
- 系统托盘图标快速访问
- 窗口置顶功能
- 高级设置选项

## 安装

1. 从[Releases](https://github.com/Cail-Gainey/MacPin/releases)页面下载最新版本的DMG文件
2. 打开DMG文件并将MacPins拖到Applications文件夹中
3. 首次运行时，系统可能会要求授予辅助功能权限，以便应用能够模拟键盘操作

## 使用方法

1. 启动应用后，它会在后台运行并监控剪贴板变化
2. 使用默认快捷键 `Command+Shift+V` 打开剪贴板历史窗口
3. 通过系统托盘图标访问更多功能
4. 使用窗口顶部的置顶按钮让剪贴板历史窗口保持在其他窗口之上

## 开发

### 环境要求

- Node.js 22
- pnpm
- macOS 10.13+

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
pnpm run dev
```

### 构建应用

```bash
# 生成图标文件
pnpm run generate-icons

# 构建macOS应用
pnpm run build:mac
```

构建完成后，可以在`release`目录中找到打包好的应用。

## 权限说明

MacPins需要以下权限才能正常工作：

- **辅助功能权限**：用于模拟键盘操作，自动粘贴剪贴板内容

## 项目文档

- [贡献指南](CONTRIBUTING.md)
- [代码风格](CODE_STYLE.md)
- [变更日志](CHANGELOG.md)

## 如何贡献

我们欢迎所有形式的贡献！请参阅[贡献指南](CONTRIBUTING.md)了解如何参与项目开发。

## 许可证

[MIT](LICENSE)

## 作者

Cail Gainey <cailgainey@foxmail.com> 