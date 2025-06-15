import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { loadSettings, Settings, checkAndFixAutoLaunch } from './settings';
import { createMainWindow, getMainWindow } from './window/windowManager';
import { createTray } from './tray/trayManager';
import { initClipboardManager, startClipboardMonitoring } from './clipboard/clipboardManager';
import { checkAndPrepareResources, registerProtocols, exitApplication, setupAppEventListeners, monitorMemoryUsage, initMemoryManagement } from './app/appLifecycle';
import { applyShortcutSettings } from './shortcut/shortcutManager';
import { registerClipboardIpcHandlers, registerSettingsIpcHandlers, registerAppLifecycleIpcHandlers } from './ipc/ipcManager';
import logger, { LogCategory, setLogLevel } from './utils/logger';
import memoryManager from './utils/memoryManager';

/**
 * @file index.ts
 * @description Electron主进程入口文件
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

// 启用垃圾回收
// 确保 global.gc() 可用，需要在启动 Electron 时添加 --js-flags="--expose-gc"
try {
  // 启用垃圾回收
  app.commandLine.appendSwitch('js-flags', '--expose-gc');
  logger.debug('已添加垃圾回收命令行参数', LogCategory.MEMORY);
} catch (error) {
  logger.error('添加垃圾回收命令行参数失败:', LogCategory.MEMORY, { error });
}

// 记录应用启动信息
logger.info(`应用启动 - 版本: ${app.getVersion()}, 环境: ${process.env.NODE_ENV || 'production'}`, LogCategory.APP);
logger.debug(`运行平台: ${process.platform}, 架构: ${process.arch}`, LogCategory.SYSTEM);
logger.debug(`用户数据目录: ${app.getPath('userData')}`, LogCategory.SYSTEM);

// 尝试加载设置，以便在应用初始化前决定是否禁用GPU
let initialSettings: Settings;
try {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  if (fs.existsSync(settingsPath)) {
    const data = fs.readFileSync(settingsPath, 'utf8');
    initialSettings = JSON.parse(data);
    
    // 应用日志级别设置
    if (initialSettings.logLevel) {
      setLogLevel(initialSettings.logLevel);
    }
  }
} catch (error) {
  logger.error('加载初始设置失败:', LogCategory.SETTINGS, { error });
  // 如果无法加载设置，默认禁用GPU
  initialSettings = { disableGPU: true } as Settings;
}

// 根据设置决定是否禁用GPU加速
if (initialSettings?.disableGPU !== false) {
  logger.info('根据设置禁用GPU加速', LogCategory.SYSTEM);
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-smooth-scrolling');
  app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService');
}

// 应用设置
let settings: Settings;

// 应用初始化
app.whenReady().then(() => {
  logger.debug('应用就绪，开始初始化', LogCategory.APP);
  
  // 注册自定义协议处理程序
  registerProtocols();

  // 检查并准备资源文件
  checkAndPrepareResources();
  
  // 加载设置
  settings = loadSettings();
  logger.debug('已加载用户设置', LogCategory.SETTINGS);
  
  // 应用日志级别设置
  if (settings.logLevel) {
    setLogLevel(settings.logLevel);
  }
  
  // 初始化内存管理
  initMemoryManagement(300000); // 5分钟执行一次垃圾回收
  
  // 检查开机自启动设置
  checkAndFixAutoLaunch(settings);
  
  // 应用Dock栏设置（在创建窗口前）
  if (process.platform === 'darwin' && !settings.showInDock) {
    app.dock.hide();
    logger.debug('根据设置隐藏Dock栏图标', LogCategory.APP);
  }
  
  // 创建主窗口
  const mainWindow = createMainWindow();
  logger.debug('已创建主窗口', LogCategory.WINDOW);
  
  // 初始化剪贴板管理器
  initClipboardManager(app.getPath('userData'), mainWindow, settings);
  logger.debug('已初始化剪贴板管理器', LogCategory.CLIPBOARD);
  
  // 创建托盘图标
  createTray(settings, () => exitApplication(settings));
  logger.debug('已创建托盘图标', LogCategory.TRAY);
  
  // 开始监控剪贴板
  startClipboardMonitoring(mainWindow, settings);
  logger.debug('已开始监控剪贴板', LogCategory.CLIPBOARD);
  
  // 应用快捷键设置
  applyShortcutSettings(settings, mainWindow);
  
  // 注册IPC处理程序
  registerClipboardIpcHandlers(mainWindow);
  registerSettingsIpcHandlers(() => {
    settings = loadSettings();
    applySettings();
  });
  registerAppLifecycleIpcHandlers(() => exitApplication(settings));
  logger.debug('已注册所有IPC处理程序', LogCategory.IPC);
  
  // 开始内存监控（每10分钟检查一次）
  memoryManager.startMemoryMonitoring(10 * 60 * 1000);
  
  // 设置应用事件监听器
  setupAppEventListeners(settings, () => exitApplication(settings));
  logger.info('应用初始化完成', LogCategory.APP);
}).catch(error => {
  logger.error('应用初始化失败:', LogCategory.APP, { error });
});

/**
 * 应用设置
 * 根据用户设置更新应用行为
 */
function applySettings() {
  logger.debug('正在应用用户设置', LogCategory.SETTINGS);
  
  // 应用日志级别设置
  if (settings.logLevel) {
    setLogLevel(settings.logLevel);
  }
  
  // 应用快捷键设置
  applyShortcutSettings(settings, getMainWindow());
  
  // 处理Dock栏图标显示/隐藏（仅在macOS上有效）
  if (process.platform === 'darwin') {
    if (settings.showInDock) {
      app.dock.show();
      logger.debug('显示Dock栏图标', LogCategory.APP);
    } else {
      app.dock.hide();
      logger.debug('隐藏Dock栏图标', LogCategory.APP);
    }
  }
  
  logger.debug('用户设置已应用', LogCategory.SETTINGS);
} 