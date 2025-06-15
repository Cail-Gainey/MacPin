import { Tray, Menu, nativeImage, app } from 'electron';
import { join } from 'path';
import * as fs from 'fs';
import { Settings } from '../settings';
import { toggleWindow, getMainWindow, showWindow } from '../window/windowManager';
import { createPreferencesWindow } from '../preferencesWindow';
import logger from '../utils/logger';

/**
 * @file trayManager.ts
 * @description 托盘图标管理模块，负责创建和管理系统托盘图标
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

// 托盘图标引用
let tray: Tray | null = null;

/**
 * 创建系统托盘图标
 * @param settings 应用设置
 * @param exitCallback 退出应用的回调函数
 */
export function createTray(settings: Settings, exitCallback: () => void): Tray | null {
  // 如果设置为不显示托盘图标，则不创建
  if (!settings.showTrayIcon) {
    logger.info('根据用户设置不显示托盘图标');
    return null;
  }

  logger.info('开始创建系统托盘图标');
  
  // 根据环境获取正确的图标路径
  let iconPath;
  if (process.env.NODE_ENV === 'development') {
    iconPath = join(__dirname, '../../resources/icon.png');
    logger.debug(`开发环境使用图标路径: ${iconPath}`);
  } else {
    // 生产环境下尝试多个可能的路径
    const possiblePaths = [
      join(__dirname, 'assets/icon.png'),  // 首先检查 dist/main/assets 目录
      join(process.resourcesPath, 'icon.png'),  // 然后检查 resources 目录
      join(app.getAppPath(), 'dist/main/assets/icon.png')  // 最后检查应用根目录
    ];
    
    logger.debug(`尝试在以下路径查找托盘图标: ${JSON.stringify(possiblePaths)}`);
    
    // 尝试找到第一个存在的图标文件
    iconPath = possiblePaths.find(p => {
      try {
        return fs.existsSync(p);
      } catch (e) {
        return false;
      }
    });
    
    // 如果找不到图标，使用默认路径
    if (!iconPath) {
      logger.error('找不到托盘图标文件，使用默认路径');
      iconPath = join(process.resourcesPath, 'icon.png');
    } else {
      logger.info(`使用托盘图标: ${iconPath}`);
    }
  }

  // 创建托盘图标
  try {
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    
    logger.debug('成功创建托盘图标');
    
    const contextMenu = Menu.buildFromTemplate([
      { label: '显示剪贴板历史', click: () => toggleWindow() },
      { type: 'separator' },
      { label: '关于 MacPins', click: () => {
        // 通知渲染进程显示关于页面
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isVisible()) {
          showWindow();
        }
        mainWindow?.webContents.send('show-about');
        logger.debug('用户点击了"关于 MacPins"菜单项');
      }},
      { label: '偏好设置...', click: () => {
        createPreferencesWindow();
        logger.debug('用户点击了"偏好设置"菜单项');
      }},
      { type: 'separator' },
      { label: '退出', click: () => {
        logger.info('用户从托盘菜单选择退出应用');
        exitCallback();
      }}
    ]);
    
    tray.setToolTip('MacPins 剪贴板历史');
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => {
      logger.debug('用户点击了托盘图标');
      tray?.popUpContextMenu();
    });
    
    logger.info('托盘图标和上下文菜单创建完成');
    return tray;
  } catch (error) {
    logger.error('创建托盘图标失败:', error);
    return null;
  }
}

/**
 * 销毁托盘图标
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
    logger.info('托盘图标已销毁');
  }
}

/**
 * 获取托盘图标引用
 */
export function getTray(): Tray | null {
  return tray;
} 