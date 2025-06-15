import { globalShortcut } from 'electron';
import { Settings } from '../settings';
import { toggleWindow } from '../window/windowManager';
import logger from '../utils/logger';

/**
 * @file shortcutManager.ts
 * @description 快捷键管理模块，负责注册和管理全局快捷键
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

/**
 * 应用快捷键设置
 * @param settings 应用设置
 * @param mainWindow 主窗口引用，用于通知快捷键注册失败
 */
export function applyShortcutSettings(settings: Settings, mainWindow: Electron.BrowserWindow | null): void {
  // 重新注册快捷键
  globalShortcut.unregisterAll();
  logger.debug('已注销所有全局快捷键');
  
  try {
    // 处理快捷键格式，确保兼容性
    let shortcutToRegister = settings.shortcut;
    
    // 如果是macOS，将CommandOrControl替换为Command
    if (process.platform === 'darwin') {
      shortcutToRegister = shortcutToRegister.replace('CommandOrControl', 'Command');
    } else {
      shortcutToRegister = shortcutToRegister.replace('CommandOrControl', 'Control');
    }
    
    logger.info(`尝试注册快捷键: ${shortcutToRegister}`);
    
    // 注册快捷键
    const registered = globalShortcut.register(shortcutToRegister, () => {
      toggleWindow();
    });
    
    if (!registered) {
      logger.error(`快捷键注册失败: ${shortcutToRegister}`);
      // 尝试使用默认快捷键
      tryRegisterDefaultShortcut();
      
      // 如果有主窗口，通知用户快捷键注册失败
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('shortcut-registration-failed', {
          message: `快捷键 ${shortcutToRegister} 注册失败，已尝试使用默认快捷键`
        });
        logger.debug('已通知渲染进程快捷键注册失败');
      }
    } else {
      logger.info(`快捷键注册成功: ${shortcutToRegister}`);
    }
  } catch (error) {
    logger.error('应用快捷键设置时出错:', error);
  }
}

/**
 * 尝试注册默认快捷键
 * @returns 是否成功注册默认快捷键
 */
export function tryRegisterDefaultShortcut(): boolean {
  try {
    // 根据平台选择默认快捷键
    const defaultShortcut = process.platform === 'darwin' ? 'Command+Shift+V' : 'Control+Shift+V';
    
    logger.info(`尝试注册默认快捷键: ${defaultShortcut}`);
    
    const registered = globalShortcut.register(defaultShortcut, () => {
      toggleWindow();
    });
    
    if (registered) {
      logger.info(`已回退到默认快捷键: ${defaultShortcut}`);
      return true;
    } else {
      logger.error(`默认快捷键注册也失败: ${defaultShortcut}`);
      return false;
    }
  } catch (fallbackError) {
    logger.error('默认快捷键注册也失败:', fallbackError);
    return false;
  }
}

/**
 * 注销所有全局快捷键
 */
export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll();
  logger.info('已注销所有全局快捷键');
} 