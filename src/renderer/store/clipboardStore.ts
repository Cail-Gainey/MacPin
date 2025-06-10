import { create } from 'zustand';
import { ClipboardItem } from '../types/electron';

/**
 * @file clipboardStore.ts
 * @description 剪贴板历史状态管理
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

interface ClipboardState {
  clipboardHistory: ClipboardItem[];
  setClipboardHistory: (history: ClipboardItem[]) => void;
  clearHistory: () => void;
  deleteItem: (id: string) => void;
  setClipboardContent: (item: ClipboardItem) => Promise<void>;
  togglePinned: (id: string) => void;
}

type SetState = (
  partial: ClipboardState | Partial<ClipboardState> | ((state: ClipboardState) => ClipboardState | Partial<ClipboardState>)
) => void;

export const useClipboardStore = create<ClipboardState>((set: SetState) => ({
  clipboardHistory: [],
  
  setClipboardHistory: (history: ClipboardItem[]) => {
    // 确保所有项目的pinned属性都是布尔值
    history.forEach(item => {
      item.pinned = item.pinned === true;
    });
    
    // 确保置顶项在前面
    const pinnedItems = history.filter(item => item.pinned === true);
    const unpinnedItems = history.filter(item => item.pinned !== true);
    
    console.log(`设置历史记录时，置顶项: ${pinnedItems.length}个, 未置顶项: ${unpinnedItems.length}个`);
    
    // 按时间戳降序排序
    pinnedItems.sort((a, b) => b.timestamp - a.timestamp);
    unpinnedItems.sort((a, b) => b.timestamp - a.timestamp);
    
    set({ clipboardHistory: [...pinnedItems, ...unpinnedItems] });
  },
  
  clearHistory: async () => {
    // 调用主进程的clearClipboardHistory，它会返回保留的置顶项
    const pinnedItems = await window.electronAPI.clearClipboardHistory();
    console.log(`从主进程返回的置顶项数量: ${pinnedItems.length}`);
    
    if (pinnedItems.length > 0) {
      // 记录置顶项的ID，方便调试
      pinnedItems.forEach((item: ClipboardItem) => {
        console.log(`接收到置顶项ID: ${item.id}, pinned: ${item.pinned}, 内容预览: ${item.preview?.substring(0, 20) || '(无预览)'}`);
      });
    }
    
    // 使用主进程返回的置顶项更新状态
    set({ clipboardHistory: pinnedItems });
  },
  
  deleteItem: async (id: string) => {
    await window.electronAPI.deleteClipboardItem(id);
    set((state: ClipboardState) => ({
      clipboardHistory: state.clipboardHistory.filter((item: ClipboardItem) => item.id !== id)
    }));
  },
  
  setClipboardContent: async (item: ClipboardItem) => {
    await window.electronAPI.setClipboardContent(item);
  },
  
  togglePinned: async (id: string) => {
    console.log(`渲染进程切换置顶状态，ID: ${id}`);
    
    // 先通知主进程更新置顶状态
    await window.electronAPI.togglePinned(id);
    
    // 然后等待主进程通过clipboard-updated事件更新状态
    // 不在这里直接修改状态，避免与主进程不同步
  }
})); 