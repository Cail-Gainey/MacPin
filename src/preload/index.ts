import { contextBridge, ipcRenderer } from 'electron';

/**
 * @file index.ts
 * @description Electron预加载脚本
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

// 剪贴板历史记录项接口
interface ClipboardItem {
  id: string;
  type: 'text' | 'image';
  content: string;
  timestamp: number;
  preview?: string;
  pinned?: boolean;
  imagePath?: string; // 图片文件路径，仅当type为'image'时有效
}

// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取剪贴板历史
  getClipboardHistory: () => ipcRenderer.invoke('get-clipboard-history'),
  
  // 设置剪贴板内容
  setClipboardContent: (item: ClipboardItem) => ipcRenderer.invoke('set-clipboard-content', item),
  
  // 清空剪贴板历史
  clearClipboardHistory: () => ipcRenderer.invoke('clear-clipboard-history'),
  
  // 删除特定剪贴板项
  deleteClipboardItem: (id: string) => ipcRenderer.invoke('delete-clipboard-item', id),
  
  // 隐藏窗口
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  
  // 退出应用程序
  exitApplication: () => ipcRenderer.invoke('exit-application'),
  
  // 置顶/取消置顶项目
  togglePinned: (id: string) => ipcRenderer.invoke('toggle-pinned', id),
  
  // 切换窗口置顶状态
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  
  // 获取窗口置顶状态
  getAlwaysOnTopStatus: () => ipcRenderer.invoke('get-always-on-top-status'),
  
  // 监听剪贴板更新事件
  onClipboardUpdated: (callback: (history: ClipboardItem[]) => void) => {
    ipcRenderer.on('clipboard-updated', (_, history) => callback(history));
    return () => {
      ipcRenderer.removeAllListeners('clipboard-updated');
    };
  },
  
  // 监听粘贴失败事件
  onClipboardPasteFailed: (callback: (data: {message: string}) => void) => {
    ipcRenderer.on('clipboard-paste-failed', (_, data) => callback(data));
    return () => {
      ipcRenderer.removeAllListeners('clipboard-paste-failed');
    };
  },
  
  // 监听快捷键注册失败事件
  onShortcutRegistrationFailed: (callback: (data: {message: string}) => void) => {
    ipcRenderer.on('shortcut-registration-failed', (_, data) => callback(data));
    return () => {
      ipcRenderer.removeAllListeners('shortcut-registration-failed');
    };
  },
  
  // 监听显示关于页面事件
  onShowAbout: (callback: () => void) => {
    ipcRenderer.on('show-about', () => callback());
    return () => {
      ipcRenderer.removeAllListeners('show-about');
    };
  },
  
  // 通知主进程已显示关于页面
  showAboutResponse: () => ipcRenderer.send('show-about-response')
}); 