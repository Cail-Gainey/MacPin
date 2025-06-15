import { contextBridge, ipcRenderer } from 'electron';

/**
 * @file preferences.ts
 * @description 偏好设置窗口预加载脚本
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

// 设置接口
interface Settings {
  shortcut: string;
  historyRetention: number;
  launchAtStartup: boolean;
  showTrayIcon: boolean;
  showInDock: boolean;
  maxHistoryItems: number;
  disableGPU: boolean;
  logLevel: string;
}

// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('preferencesAPI', {
  // 获取设置
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('get-settings'),
  
  // 保存设置
  saveSettings: async (settings: Partial<Settings>): Promise<Settings> => {
    const updatedSettings = await ipcRenderer.invoke('save-settings', settings);
    // 通知主进程设置已更新
    ipcRenderer.send('settings-updated');
    return updatedSettings;
  },
}); 