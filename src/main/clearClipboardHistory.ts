/**
 * @file clearClipboardHistory.ts
 * @description 清除剪贴板历史但保留置顶项的功能
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

import { BrowserWindow } from 'electron';

/**
 * 剪贴板历史记录项接口
 */
export interface ClipboardItem {
  id: string;
  type: 'text' | 'image';
  content: string;
  timestamp: number;
  preview?: string;
  pinned?: boolean;
  imagePath?: string; // 图片文件路径，仅当type为'image'时有效
}

/**
 * 清除剪贴板历史但保留置顶项
 * @param clipboardHistory 剪贴板历史数组
 * @param mainWindow 主窗口引用
 * @param saveCallback 保存历史记录的回调函数
 * @returns 保留的置顶项
 */
export function clearClipboardHistoryKeepPinned(
  clipboardHistory: ClipboardItem[],
  mainWindow: BrowserWindow | null,
  saveCallback: () => void
): ClipboardItem[] {
  console.log(`清除前总记录数: ${clipboardHistory.length}`);
  
  // 打印所有项目的置顶状态
  clipboardHistory.forEach(item => {
    console.log(`项目ID: ${item.id}, pinned类型: ${typeof item.pinned}, pinned值: ${item.pinned}`);
  });
  
  // 确保所有项目的pinned属性都是布尔值
  clipboardHistory.forEach(item => {
    item.pinned = item.pinned === true;
  });
  
  // 保留置顶项，使用严格的布尔值比较
  const pinnedItems = clipboardHistory.filter(item => item.pinned === true);
  console.log(`找到置顶项: ${pinnedItems.length}个`);
  
  // 记录置顶项的ID，方便调试
  pinnedItems.forEach(item => {
    console.log(`保留置顶项ID: ${item.id}, pinned类型: ${typeof item.pinned}, pinned值: ${item.pinned}, 内容预览: ${item.preview?.substring(0, 20) || '(无预览)'}`);
  });
  
  // 清空历史记录
  clipboardHistory.length = 0;
  
  // 将置顶项添加回历史记录
  if (pinnedItems.length > 0) {
    clipboardHistory.push(...pinnedItems);
    console.log(`已将${pinnedItems.length}个置顶项添加回历史记录`);
  }
  
  // 通知渲染进程
  mainWindow?.webContents.send('clipboard-updated', clipboardHistory);
  
  // 保存更新后的历史记录到本地
  saveCallback();
  console.log(`清除后总记录数: ${clipboardHistory.length}`);
  
  // 返回保留的置顶项
  return clipboardHistory;
} 