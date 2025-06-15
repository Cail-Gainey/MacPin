import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { loadSettings, saveSettings, setAutoLaunch, Settings } from './settings';
import logger from './utils/logger';

/**
 * @file preferencesWindow.ts
 * @description 偏好设置窗口管理
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

let preferencesWindow: BrowserWindow | null = null;
let ipcHandlersRegistered = false; // 标记IPC处理程序是否已注册

/**
 * 创建偏好设置窗口
 */
export function createPreferencesWindow(): void {
  // 如果窗口已存在，则聚焦
  if (preferencesWindow) {
    logger.debug('偏好设置窗口已存在，聚焦窗口');
    preferencesWindow.focus();
    return;
  }

  logger.info('创建偏好设置窗口');
  
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
    logger.debug('开发环境：加载本地开发服务器的偏好设置页面');
    preferencesWindow.loadURL('http://localhost:5173/preferences.html');
    // 注释掉自动打开开发者工具
    // preferencesWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    logger.debug('生产环境：加载本地HTML文件的偏好设置页面');
    preferencesWindow.loadFile(join(__dirname, '../renderer/preferences.html'));
  }

  // 窗口准备好后显示
  preferencesWindow.once('ready-to-show', () => {
    preferencesWindow?.show();
    logger.debug('偏好设置窗口已准备好并显示');
  });

  // 窗口关闭时清除引用
  preferencesWindow.on('closed', () => {
    logger.debug('偏好设置窗口已关闭');
    preferencesWindow = null;
  });

  // 设置IPC事件处理（只注册一次）
  if (!ipcHandlersRegistered) {
    setupPreferencesIPC();
    ipcHandlersRegistered = true;
  }
}

/**
 * 设置偏好设置相关的IPC事件处理
 */
function setupPreferencesIPC(): void {
  logger.info('设置偏好设置相关的IPC事件处理');
  
  // 移除可能存在的旧处理程序
  if (ipcMain.listenerCount('get-settings') > 0) {
    logger.debug('移除现有的get-settings处理程序');
    ipcMain.removeHandler('get-settings');
  }
  
  if (ipcMain.listenerCount('save-settings') > 0) {
    logger.debug('移除现有的save-settings处理程序');
    ipcMain.removeHandler('save-settings');
  }
  
  // 获取设置
  ipcMain.handle('get-settings', () => {
    logger.debug('IPC: 处理get-settings请求');
    return loadSettings();
  });

  // 保存设置
  ipcMain.handle('save-settings', (_, settings: Partial<Settings>) => {
    logger.info('IPC: 处理save-settings请求');
    logger.debug('要保存的设置:', settings);
    
    // 处理开机自启
    if (settings.launchAtStartup !== undefined) {
      logger.debug(`设置开机自启动: ${settings.launchAtStartup}`);
      setAutoLaunch(settings.launchAtStartup);
    }
    
    // 保存设置
    saveSettings(settings);
    
    // 返回更新后的设置
    const updatedSettings = loadSettings();
    logger.debug('设置已更新并返回');
    return updatedSettings;
  });
} 