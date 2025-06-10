# MacPins 代码风格指南

为了保持代码库的一致性和可维护性，请遵循以下代码风格指南。

## TypeScript/JavaScript

### 命名约定

- **变量和函数名**: 使用驼峰命名法 (`camelCase`)
  ```typescript
  const clipboardItem = getClipboardContent();
  function handleItemClick() { /* ... */ }
  ```

- **组件名**: 使用帕斯卡命名法 (`PascalCase`)
  ```typescript
  function ClipboardItem(props: ClipboardItemProps) { /* ... */ }
  ```

- **接口和类型**: 使用帕斯卡命名法，接口不使用 `I` 前缀
  ```typescript
  interface ClipboardItemProps { /* ... */ }
  type ClipboardItemType = 'text' | 'image';
  ```

- **常量**: 使用全大写加下划线
  ```typescript
  const MAX_HISTORY_ITEMS = 100;
  ```

### 格式

- 使用 2 个空格缩进
- 使用单引号 `'` 而不是双引号 `"`
- 每行代码不超过 100 个字符
- 语句结尾使用分号 `;`
- 花括号始终使用 K&R 风格（左花括号不换行）

### 最佳实践

- 优先使用 `const`，其次是 `let`，避免使用 `var`
- 使用显式类型标注增强代码可读性
- 避免使用 `any` 类型
- 使用箭头函数保持 `this` 上下文
- 使用可选链 `?.` 和空值合并 `??` 操作符

## React

### 组件结构

- 使用函数式组件和 Hooks，而不是类组件
- 每个文件只导出一个组件
- 组件文件名与组件名相同

```typescript
// ClipboardItem.tsx
export default function ClipboardItem(props: ClipboardItemProps) {
  // ...
}
```

### Hooks 使用

- 遵循 Hooks 的使用规则（只在顶层调用，只在函数组件中调用）
- 自定义 Hooks 名称以 `use` 开头
- 依赖数组要完整

```typescript
const [items, setItems] = useState<ClipboardItem[]>([]);
useEffect(() => {
  // 副作用逻辑
}, [dependency1, dependency2]);
```

### 事件处理

- 事件处理函数名以 `handle` 开头
- 传递给子组件的回调函数名以 `on` 开头

```typescript
function handleClick() { /* ... */ }
<Button onClick={handleClick} />
```

## CSS

- 使用 CSS 模块或直接 CSS 文件
- 类名使用小写加连字符 (`kebab-case`)
- 避免使用内联样式，除非是动态计算的值
- 使用 CSS 变量保持一致的主题

## 注释

- 为复杂逻辑添加注释
- 使用 JSDoc 风格为函数和组件添加文档
- 避免无意义的注释

```typescript
/**
 * 剪贴板项组件
 * @param props - 组件属性
 * @returns 剪贴板项 React 元素
 */
function ClipboardItem(props: ClipboardItemProps) {
  // ...
}
```

## 导入顺序

1. 外部库
2. 内部模块
3. 类型导入
4. 样式导入

```typescript
// 外部库
import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';

// 内部模块
import { formatDate } from '../utils/date';
import Button from './Button';

// 类型
import type { ClipboardItem } from '../types';

// 样式
import './ClipboardItem.css';
```

## 测试

- 为每个组件和工具函数编写单元测试
- 测试文件与被测试文件放在同一目录下，命名为 `*.test.ts(x)`
- 使用有意义的测试描述

## Git 提交信息

使用符合约定式提交规范的提交信息：

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更改
- `style`: 不影响代码含义的更改（空格、格式等）
- `refactor`: 既不修复 bug 也不添加功能的代码更改
- `perf`: 改进性能的代码更改
- `test`: 添加或修正测试
- `chore`: 对构建过程或辅助工具的更改

示例：`feat: 添加剪贴板历史记录搜索功能` 