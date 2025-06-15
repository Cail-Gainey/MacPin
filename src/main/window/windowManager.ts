import { BrowserWindow, screen, ipcMain } from 'electron';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { clipboardHistory } from '../clipboard/clipboardManager';
import logger from '../utils/logger';

/**
 * @file windowManager.ts
 * @description 窗口管理模块，负责创建和管理应用窗口
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

// 主窗口引用
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

/**
 * 创建主窗口
 */
export function createMainWindow(): BrowserWindow {
  logger.info('开始创建主窗口');
  
  mainWindow = new BrowserWindow({
    width: 380,
    height: 500,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: false, // 默认不置顶
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // 内存优化选项
      backgroundThrottling: true, // 当窗口在后台时节流
      devTools: process.env.NODE_ENV === 'development', // 仅在开发环境启用开发者工具
      webgl: false, // 禁用WebGL
      offscreen: false, // 禁用离屏渲染
      spellcheck: false, // 禁用拼写检查
      enableWebSQL: false, // 禁用WebSQL
    },
  });

  // 加载渲染进程
  if (process.env.NODE_ENV === 'development') {
    logger.info('开发环境：加载本地开发服务器');
    mainWindow.loadURL('http://localhost:5173');
    // 注释掉自动打开开发者工具
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    logger.info('生产环境：加载本地HTML文件');
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // 隐藏窗口而不是关闭
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      logger.debug('窗口关闭事件被拦截，窗口已隐藏');
    } else {
      logger.info('应用正在退出，允许窗口关闭');
    }
  });
  
  // 减少内存占用的优化
  mainWindow.webContents.setAudioMuted(true); // 静音
  logger.debug('窗口音频已静音以减少资源占用');
  
  // 当窗口隐藏时，尝试释放内存
  mainWindow.on('hide', () => {
    if (global.gc) {
      try {
        global.gc();
        logger.debug('窗口隐藏时执行垃圾回收');
      } catch (error) {
        logger.error('垃圾回收失败:', error);
      }
    }
  });

  // 注册IPC事件处理
  registerIpcHandlers();
  
  logger.info('主窗口创建完成');
  return mainWindow;
}

/**
 * 切换窗口显示状态
 */
export function toggleWindow(): void {
  if (mainWindow?.isVisible()) {
    logger.debug('切换窗口状态：隐藏窗口');
    mainWindow.hide();
  } else {
    logger.debug('切换窗口状态：显示窗口');
    showWindow();
  }
}

/**
 * 显示窗口
 */
export function showWindow(): void {
  if (!mainWindow) {
    logger.warn('尝试显示窗口，但窗口实例不存在');
    return;
  }
  
  // 获取鼠标位置并定位窗口
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  
  mainWindow.setPosition(
    Math.floor(display.workArea.x + (display.workArea.width - mainWindow.getSize()[0]) / 2),
    Math.floor(display.workArea.y + (display.workArea.height - mainWindow.getSize()[1]) / 2)
  );
  
  logger.debug('窗口已定位到屏幕中央');
  
  // 在显示窗口前，检查是否需要加载历史记录（如果剪贴板历史为空）
  if (clipboardHistory.length === 0) {
    // 这里不再直接调用loadClipboardHistory，而是通过事件通知
    mainWindow.webContents.send('load-clipboard-history-if-empty');
    logger.debug('通知渲染进程加载剪贴板历史（如果为空）');
  }
  
  mainWindow.show();
  mainWindow.focus();
  logger.debug('窗口已显示并获得焦点');
}

/**
 * 设置退出标志
 */
export function setQuitting(value: boolean): void {
  isQuitting = value;
  logger.info(`设置应用退出标志: ${value}`);
}

/**
 * 获取主窗口引用
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * 执行AppleScript
 */
const execAppleScript = promisify(exec);
export async function runAppleScript(script: string): Promise<string | null> {
  try {
    logger.debug('执行AppleScript命令');
    const { stdout } = await execAppleScript(`osascript -e '${script}'`);
    return stdout.trim();
  } catch (error: any) {
    // 检查是否是权限错误
    if (error.stderr && error.stderr.includes('不允许发送按键')) {
      logger.error('AppleScript权限错误: 应用需要辅助功能权限');
      
      // 显示权限提示对话框
      if (mainWindow) {
        const { dialog } = require('electron');
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '需要辅助功能权限',
          message: 'MacPins需要辅助功能权限来模拟键盘操作',
          detail: '请前往系统偏好设置 > 安全性与隐私 > 隐私 > 辅助功能，并允许MacPins访问。',
          buttons: ['好的', '稍后再说'],
          defaultId: 0
        }).then(({ response }) => {
          if (response === 0) {
            // 打开系统偏好设置
            exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"');
            logger.info('用户选择打开系统偏好设置以授予权限');
          } else {
            logger.info('用户选择稍后授予权限');
          }
        });
      }
    } else {
      logger.error('AppleScript执行错误:', error);
    }
    return null;
  }
}

/**
 * 注册IPC事件处理
 */
function registerIpcHandlers(): void {
  logger.info('注册窗口相关IPC处理程序');
  
  ipcMain.handle('hide-window', () => {
    logger.debug('IPC: 处理hide-window请求');
    mainWindow?.hide();
  });
  
  // 添加切换窗口置顶状态的处理程序
  ipcMain.handle('toggle-always-on-top', () => {
    if (mainWindow) {
      const isAlwaysOnTop = mainWindow.isAlwaysOnTop();
      const newState = !isAlwaysOnTop;
      mainWindow.setAlwaysOnTop(newState);
      logger.info(`IPC: 切换窗口置顶状态为 ${newState}`);
      return newState;
    }
    logger.warn('IPC: 尝试切换窗口置顶状态，但窗口实例不存在');
    return false;
  });
  
  // 获取窗口当前置顶状态
  ipcMain.handle('get-always-on-top-status', () => {
    if (mainWindow) {
      const status = mainWindow.isAlwaysOnTop();
      logger.debug(`IPC: 获取窗口置顶状态: ${status}`);
      return status;
    }
    logger.warn('IPC: 尝试获取窗口置顶状态，但窗口实例不存在');
    return false;
  });
} 