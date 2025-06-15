import { app, globalShortcut, BrowserWindow, protocol } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Settings, cleanupLaunchAgent } from '../settings';
import { destroyTray } from '../tray/trayManager';
import { setQuitting, createMainWindow } from '../window/windowManager';
import { stopClipboardMonitoring, saveClipboardHistory } from '../clipboard/clipboardManager';
import logger, { LogCategory } from '../utils/logger';
import memoryManager from '../utils/memoryManager';

/**
 * @file appLifecycle.ts
 * @description 应用生命周期管理模块，负责应用的初始化、退出和资源管理
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

/**
 * 检查并准备应用资源文件
 * 确保应用在开发和生产环境中都能正确访问资源
 */
export function checkAndPrepareResources(): void {
  try {
    // 确定资源目录
    const resourcesDir = app.isPackaged
      ? process.resourcesPath
      : path.join(__dirname, '../../resources');

    logger.debug('资源目录路径:', LogCategory.APP, { path: resourcesDir });

    // 检查资源目录是否存在
    if (!fs.existsSync(resourcesDir)) {
      logger.warn(`资源目录不存在: ${resourcesDir}`, LogCategory.APP);
      
      // 如果是打包环境但资源目录不存在，尝试创建
      if (app.isPackaged) {
        try {
          fs.mkdirSync(resourcesDir, { recursive: true });
          logger.info(`已创建资源目录: ${resourcesDir}`, LogCategory.APP);
        } catch (err) {
          logger.error('创建资源目录失败:', LogCategory.APP, { error: err });
        }
      }
    }

    // 检查图标文件
    const iconPath = path.join(resourcesDir, 'icon.png');
    if (!fs.existsSync(iconPath)) {
      logger.warn(`图标文件不存在: ${iconPath}`, LogCategory.APP);
    } else {
      logger.debug(`图标文件存在: ${iconPath}`, LogCategory.APP);
    }
  } catch (error) {
    logger.error('检查资源文件时出错:', LogCategory.APP, { error });
  }
}

/**
 * 监控内存使用情况
 * 使用内存管理器进行监控
 */
export function monitorMemoryUsage(): void {
  memoryManager.checkMemoryUsage();
}

/**
 * 初始化内存管理
 * @param gcInterval 垃圾回收间隔（毫秒）
 */
export function initMemoryManagement(gcInterval: number = 60000): void {
  memoryManager.initMemoryManager(gcInterval);
  logger.info('内存管理已初始化', LogCategory.MEMORY);
}

/**
 * 注册自定义协议处理程序
 */
export function registerProtocols(): void {
  protocol.registerFileProtocol('clipboard-image', (request, callback) => {
    try {
      const fileName = request.url.replace('clipboard-image://', '');
      const filePath = path.join(app.getPath('userData'), 'clipboard-images', fileName);
      callback({ path: filePath });
    } catch (error) {
      logger.error('处理clipboard-image协议时出错:', LogCategory.APP, { error });
      callback({ error: -2 /* 文件不存在 */ });
    }
  });
  
  logger.debug('已注册自定义协议: clipboard-image', LogCategory.APP);
}

/**
 * 完全退出应用程序
 * 确保清理所有资源并终止所有进程
 */
export function exitApplication(settings: Settings): void {
  logger.info('正在退出应用...', LogCategory.APP);
  
  // 设置退出标志
  setQuitting(true);
  
  // 保存剪贴板历史到本地
  saveClipboardHistory();
  
  // 停止剪贴板监控
  stopClipboardMonitoring();
  
  // 清理内存管理器
  memoryManager.cleanup();
  
  // 清理所有其他定时器
  const timers = global.setTimeout[Symbol.for('nodejs.util.promisify.custom')];
  if (timers && typeof timers === 'object') {
    Object.keys(timers).forEach(key => {
      try {
        clearTimeout(parseInt(key));
      } catch (error) {
        logger.error('清理定时器失败:', LogCategory.APP, { error });
      }
    });
  }
  
  // 注销全局快捷键
  globalShortcut.unregisterAll();
  
  // 销毁托盘图标
  destroyTray();
  
  // 关闭所有窗口
  BrowserWindow.getAllWindows().forEach(window => {
    window.removeAllListeners('close');
    window.destroy();
  });
  
  // 强制进行垃圾回收
  memoryManager.performGC();
  
  // 如果用户没有启用开机自启动，则清理 Launch Agent
  if (!settings.launchAtStartup) {
    logger.debug('用户未启用开机自启动，清理 Launch Agent', LogCategory.APP);
    cleanupLaunchAgent();
  }
  
  logger.info('应用退出完成', LogCategory.APP);
  
  // 强制退出应用
  app.exit(0);
}

/**
 * 设置应用事件监听器
 * @param settings 应用设置
 * @param exitCallback 退出应用的回调函数
 */
export function setupAppEventListeners(settings: Settings, exitCallback: () => void): void {
  // 处理macOS的应用激活
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      logger.debug('应用被激活，创建新窗口', LogCategory.APP);
    }
  });

  // 应用退出前的清理工作
  app.on('before-quit', () => {
    logger.debug('应用即将退出，执行清理工作', LogCategory.APP);
    setQuitting(true);
    stopClipboardMonitoring();
    globalShortcut.unregisterAll();
    memoryManager.cleanup();
  });

  // 阻止应用退出，而是隐藏窗口
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      logger.debug('所有窗口已关闭，准备退出应用', LogCategory.APP);
      exitCallback();
    } else {
      logger.debug('所有窗口已关闭，但在macOS上保持应用运行', LogCategory.APP);
    }
  });

  // 在应用退出前执行清理操作
  app.on('will-quit', () => {
    // 取消注册所有快捷键
    globalShortcut.unregisterAll();
    
    // 清理内存管理器
    memoryManager.cleanup();
    
    // 如果用户没有启用开机自启动，则清理 Launch Agent
    if (!settings.launchAtStartup) {
      logger.debug('用户未启用开机自启动，清理 Launch Agent', LogCategory.APP);
      cleanupLaunchAgent();
    }
  });

  // 处理SIGINT和SIGTERM信号
  process.on('SIGINT', () => {
    logger.info('收到SIGINT信号，正在退出...', LogCategory.APP);
    exitCallback();
  });

  process.on('SIGTERM', () => {
    logger.info('收到SIGTERM信号，正在退出...', LogCategory.APP);
    exitCallback();
  });

  // 处理未捕获的异常和拒绝
  process.on('uncaughtException', (error) => {
    logger.error('未捕获的异常:', LogCategory.APP, { error });
    exitCallback();
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的Promise拒绝:', LogCategory.APP, { reason });
    exitCallback();
  });
  
  logger.debug('已设置应用事件监听器', LogCategory.APP);
} 