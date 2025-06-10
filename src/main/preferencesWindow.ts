import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { loadSettings, saveSettings, setAutoLaunch, Settings } from './settings';

/**
 * @file preferencesWindow.ts
 * @description 偏好设置窗口管理
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

let preferencesWindow: BrowserWindow | null = null;

/**
 * 创建偏好设置窗口
 */
export function createPreferencesWindow(): void {
  // 如果窗口已存在，则聚焦
  if (preferencesWindow) {
    preferencesWindow.focus();
    return;
  }

  // 创建新窗口
  preferencesWindow = new BrowserWindow({
    width: 480,
    height: 400,
    title: '偏好设置',
    resizable: false,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preferences.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 加载渲染进程
  if (process.env.NODE_ENV === 'development') {
    preferencesWindow.loadURL('http://localhost:5173/preferences.html');
    // 注释掉自动打开开发者工具
    // preferencesWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    preferencesWindow.loadFile(join(__dirname, '../renderer/preferences.html'));
  }

  // 窗口准备好后显示
  preferencesWindow.once('ready-to-show', () => {
    preferencesWindow?.show();
  });

  // 窗口关闭时清除引用
  preferencesWindow.on('closed', () => {
    preferencesWindow = null;
  });

  // 设置IPC事件处理
  setupPreferencesIPC();
}

/**
 * 设置偏好设置相关的IPC事件处理
 */
function setupPreferencesIPC(): void {
  // 获取设置
  ipcMain.handle('get-settings', () => {
    return loadSettings();
  });

  // 保存设置
  ipcMain.handle('save-settings', (_, settings: Partial<Settings>) => {
    // 处理开机自启
    if (settings.launchAtStartup !== undefined) {
      setAutoLaunch(settings.launchAtStartup);
    }
    
    // 保存设置
    saveSettings(settings);
    
    // 返回更新后的设置
    return loadSettings();
  });
} 