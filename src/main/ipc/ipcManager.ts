import { ipcMain, clipboard, BrowserWindow } from 'electron';
import { loadClipboardHistory, clipboardHistory, saveClipboardHistory, loadImageFromFile } from '../clipboard/clipboardManager';
import { runAppleScript } from '../window/windowManager';
import { Settings } from '../settings';
import { clearClipboardHistoryKeepPinned } from '../clearClipboardHistory';
import logger from '../utils/logger';

/**
 * @file ipcManager.ts
 * @description IPC通信管理模块，负责处理与渲染进程的通信
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

/**
 * 注册与剪贴板相关的IPC处理程序
 * @param mainWindow 主窗口引用
 */
export function registerClipboardIpcHandlers(mainWindow: BrowserWindow | null): void {
  logger.info('注册剪贴板相关IPC处理程序');
  
  // 获取剪贴板历史
  ipcMain.handle('get-clipboard-history', () => {
    logger.debug('IPC: 处理get-clipboard-history请求');
    return clipboardHistory;
  });
  
  // 设置剪贴板内容并模拟粘贴
  ipcMain.handle('set-clipboard-content', async (_, item: any) => {
    logger.debug(`IPC: 处理set-clipboard-content请求，类型: ${item.type}`);
    
    // 设置剪贴板内容
    if (item.type === 'text') {
      clipboard.writeText(item.content);
      logger.debug('已将文本内容写入剪贴板');
    } else if (item.type === 'image') {
      // 如果有imagePath，从文件系统加载图片
      if (item.imagePath) {
        const image = loadImageFromFile(item.imagePath);
        if (image) {
          clipboard.writeImage(image);
          logger.debug(`已从文件系统加载图片并写入剪贴板: ${item.imagePath}`);
        } else {
          logger.error('从文件系统加载图片失败');
          return { success: false, error: '加载图片失败' };
        }
      } else {
        // 兼容旧版本：如果没有imagePath，尝试从content中加载base64图片
        try {
          const imageData = item.content.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(imageData, 'base64');
          const image = require('electron').nativeImage.createFromBuffer(buffer);
          clipboard.writeImage(image);
          logger.debug('已从base64数据加载图片并写入剪贴板');
        } catch (error) {
          logger.error('从base64加载图片失败:', error);
          return { success: false, error: '加载图片失败' };
        }
      }
    }
    
    // 尝试模拟在当前鼠标位置粘贴内容
    logger.debug('尝试执行AppleScript模拟粘贴操作');
    const result = await runAppleScript(`
      tell application "System Events"
        -- 获取当前活跃的应用
        set frontApp to name of first application process whose frontmost is true
        
        -- 在当前光标位置模拟粘贴操作
        tell application process frontApp
          keystroke "v" using command down
        end tell
      end tell
    `);
    
    // 隐藏窗口
    mainWindow?.hide();
    logger.debug('粘贴操作完成，已隐藏主窗口');
    
    // 返回成功状态
    return { success: true };
  });
  
  // 删除剪贴板项目
  ipcMain.handle('delete-clipboard-item', (_, id: string) => {
    logger.debug(`IPC: 处理delete-clipboard-item请求，ID: ${id}`);
    
    const index = clipboardHistory.findIndex(item => item.id === id);
    if (index !== -1) {
      clipboardHistory.splice(index, 1);
      mainWindow?.webContents.send('clipboard-updated', clipboardHistory);
      
      // 保存更新后的历史记录到本地
      saveClipboardHistory();
      logger.info(`已删除剪贴板项目，ID: ${id}`);
    } else {
      logger.warn(`未找到要删除的剪贴板项目，ID: ${id}`);
    }
  });
  
  // 清除剪贴板历史
  ipcMain.handle('clear-clipboard-history', () => {
    logger.info('IPC: 处理clear-clipboard-history请求');
    // 使用新的函数清除历史记录但保留置顶项
    return clearClipboardHistoryKeepPinned(clipboardHistory, mainWindow, saveClipboardHistory);
  });
  
  // 处理加载历史记录的请求
  ipcMain.handle('load-clipboard-history', () => {
    logger.info('IPC: 处理load-clipboard-history请求');
    loadClipboardHistory();
    return clipboardHistory;
  });
  
  // 处理置顶/取消置顶
  ipcMain.handle('toggle-pinned', (_, id: string) => {
    logger.debug(`IPC: 处理toggle-pinned请求，ID: ${id}`);
    
    const index = clipboardHistory.findIndex(item => item.id === id);
    
    if (index !== -1) {
      // 切换置顶状态，确保是布尔值
      const currentPinned = Boolean(clipboardHistory[index].pinned);
      clipboardHistory[index].pinned = !currentPinned;
      
      logger.info(`项目 ${id} 的置顶状态从 ${currentPinned} 变为 ${clipboardHistory[index].pinned}`);
      
      // 重新排序历史记录，确保置顶项在前面
      const pinnedItems = clipboardHistory.filter(item => item.pinned === true);
      const unpinnedItems = clipboardHistory.filter(item => item.pinned !== true);
      
      logger.debug(`置顶项数量: ${pinnedItems.length}, 未置顶项数量: ${unpinnedItems.length}`);
      
      // 按时间戳降序排序
      pinnedItems.sort((a, b) => b.timestamp - a.timestamp);
      unpinnedItems.sort((a, b) => b.timestamp - a.timestamp);
      
      // 清空历史记录并重新添加排序后的项
      clipboardHistory.length = 0;
      clipboardHistory.push(...pinnedItems, ...unpinnedItems);
      
      // 通知渲染进程
      mainWindow?.webContents.send('clipboard-updated', clipboardHistory);
      
      // 保存更新后的历史记录到本地
      saveClipboardHistory();
    } else {
      logger.warn(`未找到ID为 ${id} 的项目`);
    }
  });
}

/**
 * 注册与设置相关的IPC处理程序
 * @param settingsUpdatedCallback 设置更新后的回调函数
 */
export function registerSettingsIpcHandlers(settingsUpdatedCallback: () => void): void {
  logger.info('注册设置相关IPC处理程序');
  
  // 监听设置变更
  ipcMain.on('settings-updated', () => {
    logger.info('IPC: 收到settings-updated事件');
    settingsUpdatedCallback();
  });
}

/**
 * 注册与应用生命周期相关的IPC处理程序
 * @param exitCallback 退出应用的回调函数
 */
export function registerAppLifecycleIpcHandlers(exitCallback: () => void): void {
  logger.info('注册应用生命周期相关IPC处理程序');
  
  // 添加强制退出的IPC处理
  ipcMain.handle('exit-application', () => {
    logger.info('IPC: 处理exit-application请求，准备退出应用');
    exitCallback();
  });
  
  // 添加show-about事件处理
  ipcMain.on('show-about-response', () => {
    logger.debug('IPC: 收到show-about-response事件');
    // 空实现，只是为了响应渲染进程的确认
  });
} 