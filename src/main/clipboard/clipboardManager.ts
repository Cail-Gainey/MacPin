import { clipboard, nativeImage, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ClipboardItem } from '../types/clipboardItem';
import { Settings } from '../settings';
import logger from '../utils/logger';

/**
 * @file clipboardManager.ts
 * @description 剪贴板管理模块，负责监控剪贴板变化和管理历史记录
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

// 剪贴板历史记录
export const clipboardHistory: ClipboardItem[] = [];
let lastClipboardContent: string = '';
let clipboardMonitoringInterval: NodeJS.Timeout | null = null;

// 历史记录文件路径和图片存储目录
let historyFilePath: string;
let imagesDir: string;

/**
 * 初始化剪贴板管理器
 * @param userDataPath 用户数据路径
 * @param mainWindow 主窗口引用
 * @param settings 应用设置
 */
export function initClipboardManager(userDataPath: string, mainWindow: BrowserWindow | null, settings: Settings): void {
  historyFilePath = path.join(userDataPath, 'clipboard-history.json');
  imagesDir = path.join(userDataPath, 'clipboard-images');

  // 确保图片存储目录存在
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    logger.info(`已创建图片存储目录: ${imagesDir}`);
  }
  
  // 加载历史记录
  loadClipboardHistory();
  
  // 清理未使用的图片文件
  cleanupUnusedImages();
  
  // 设置定期清理的定时器（每小时清理一次）
  setInterval(cleanupUnusedImages, 60 * 60 * 1000);
  
  logger.info('剪贴板管理器初始化完成');
}

/**
 * 开始监控剪贴板变化
 * @param mainWindow 主窗口引用
 * @param settings 应用设置
 */
export function startClipboardMonitoring(mainWindow: BrowserWindow | null, settings: Settings): void {
  // 初始化剪贴板内容
  lastClipboardContent = clipboard.readText();
  
  // 定期检查剪贴板变化
  clipboardMonitoringInterval = setInterval(() => {
    try {
      monitorTextClipboard(mainWindow, settings);
      monitorImageClipboard(mainWindow, settings);
    } catch (error) {
      logger.error('剪贴板监控错误:', error);
    }
  }, 1500);
  
  logger.info('剪贴板监控已启动');
}

/**
 * 监控文本剪贴板变化
 */
function monitorTextClipboard(mainWindow: BrowserWindow | null, settings: Settings): void {
  const currentText = clipboard.readText();
  
  // 如果剪贴板内容变化了
  if (currentText && currentText !== lastClipboardContent) {
    lastClipboardContent = currentText;
    
    // 添加到历史记录
    const newItem: ClipboardItem = {
      id: Date.now().toString(),
      type: 'text',
      content: currentText,
      timestamp: Date.now(),
      preview: currentText.substring(0, 100),
      pinned: false
    };
    
    clipboardHistory.unshift(newItem);
    logger.debug('添加新的文本剪贴板项');
    
    // 限制历史记录数量（如果设置了限制）
    limitHistoryItems(settings);
    
    // 通知渲染进程
    mainWindow?.webContents.send('clipboard-updated', clipboardHistory);
    
    // 保存历史记录到本地
    saveClipboardHistory();
  }
}

/**
 * 监控图片剪贴板变化
 */
function monitorImageClipboard(mainWindow: BrowserWindow | null, settings: Settings): void {
  if (clipboard.availableFormats().some(format => format.includes('image'))) {
    const image = clipboard.readImage();
    if (!image.isEmpty()) {
      const imageBuffer = image.toPNG();
      // 生成图片的哈希值用于比较
      const imageHash = crypto.createHash('md5').update(imageBuffer).digest('hex');
      
      // 检查是否已存在相同图片（通过哈希值比较）
      const existingImage = clipboardHistory.find(item => 
        item.type === 'image' && item.content === imageHash
      );
      
      if (!existingImage) {
        // 保存图片到文件系统
        const fileName = saveImageToFile(imageBuffer);
        
        const newItem: ClipboardItem = {
          id: Date.now().toString(),
          type: 'image',
          content: imageHash, // 存储哈希值而不是base64数据
          timestamp: Date.now(),
          preview: 'Image',
          pinned: false,
          imagePath: fileName // 添加图片文件路径
        };
        
        clipboardHistory.unshift(newItem);
        logger.debug('添加新的图片剪贴板项');
        
        // 限制历史记录数量
        limitHistoryItems(settings);
        
        // 通知渲染进程
        mainWindow?.webContents.send('clipboard-updated', clipboardHistory);
        
        // 保存历史记录到本地
        saveClipboardHistory();
      }
    }
  }
}

/**
 * 限制历史记录数量
 */
function limitHistoryItems(settings: Settings): void {
  if (settings.maxHistoryItems < 999999 && clipboardHistory.length > settings.maxHistoryItems) {
    // 找到第一个未置顶的项目从末尾开始删除
    const indexToRemove = [...clipboardHistory].reverse().findIndex(item => !item.pinned);
    if (indexToRemove !== -1) {
      // 将反转后的索引转换为原数组的索引
      const actualIndex = clipboardHistory.length - 1 - indexToRemove;
      const removedItem = clipboardHistory[actualIndex];
      
      // 如果是图片，检查是否需要删除文件
      if (removedItem.type === 'image' && removedItem.imagePath) {
        // 检查是否有其他项目引用同一图片
        const otherReferences = clipboardHistory.some(
          item => item !== removedItem && 
          item.type === 'image' && 
          item.imagePath === removedItem.imagePath
        );
        
        // 如果没有其他引用，删除图片文件
        if (!otherReferences) {
          try {
            const filePath = path.join(imagesDir, removedItem.imagePath);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              logger.debug(`已删除未使用的图片: ${filePath}`);
            }
          } catch (error) {
            logger.error('删除图片文件失败:', error);
          }
        }
      }
      
      clipboardHistory.splice(actualIndex, 1);
      logger.debug('已删除超出限制的历史记录项');
    }
  }
}

/**
 * 保存剪贴板历史到本地文件
 */
export function saveClipboardHistory(): void {
  try {
    // 确保所有项目的pinned属性都是布尔值
    clipboardHistory.forEach(item => {
      item.pinned = item.pinned === true;
    });
    
    // 检查有多少置顶项
    const pinnedCount = clipboardHistory.filter(item => item.pinned === true).length;
    logger.debug(`保存时置顶项数量: ${pinnedCount}`);
    
    fs.writeFileSync(historyFilePath, JSON.stringify(clipboardHistory), 'utf8');
    logger.debug('剪贴板历史已保存到本地');
  } catch (error) {
    logger.error('保存剪贴板历史失败:', error);
  }
}

/**
 * 从本地文件加载剪贴板历史
 */
export function loadClipboardHistory(): void {
  try {
    if (fs.existsSync(historyFilePath)) {
      const data = fs.readFileSync(historyFilePath, 'utf8');
      const history = JSON.parse(data) as ClipboardItem[];
      
      // 确保所有项目的pinned属性都是布尔值
      history.forEach(item => {
        // 明确将pinned转换为布尔值
        item.pinned = item.pinned === true;
        logger.debug(`加载项目ID: ${item.id}, pinned: ${item.pinned}`);
      });
      
      // 清空当前历史
      clipboardHistory.length = 0;
      
      // 分离置顶项和非置顶项
      const pinnedItems = history.filter(item => item.pinned === true);
      const unpinnedItems = history.filter(item => item.pinned !== true);
      
      logger.info(`加载时发现置顶项: ${pinnedItems.length}个, 未置顶项: ${unpinnedItems.length}个`);
      
      // 按时间戳降序排序
      pinnedItems.sort((a, b) => b.timestamp - a.timestamp);
      unpinnedItems.sort((a, b) => b.timestamp - a.timestamp);
      
      // 先添加置顶项，再添加非置顶项
      clipboardHistory.push(...pinnedItems, ...unpinnedItems);
      
      logger.info(`已从本地加载${clipboardHistory.length}条剪贴板历史记录`);
    } else {
      logger.info('剪贴板历史文件不存在，创建新的历史记录');
    }
  } catch (error) {
    logger.error('加载剪贴板历史失败:', error);
  }
}

/**
 * 清理未使用的图片文件
 */
export function cleanupUnusedImages(): void {
  try {
    // 如果剪贴板历史为空，先尝试加载
    if (clipboardHistory.length === 0) {
      try {
        if (fs.existsSync(historyFilePath)) {
          const data = fs.readFileSync(historyFilePath, 'utf8');
          const history = JSON.parse(data) as ClipboardItem[];
          
          // 只获取图片项的imagePath属性，不加载全部历史
          const imageItems = history.filter(item => item.type === 'image' && item.imagePath);
          
          // 获取所有图片文件
          const files = fs.readdirSync(imagesDir);
          
          // 获取所有在使用的图片文件名
          const usedImages = new Set<string>();
          imageItems.forEach(item => {
            if (item.imagePath) {
              usedImages.add(item.imagePath);
            }
          });
          
          // 删除未使用的图片文件
          let deletedCount = 0;
          files.forEach(file => {
            if (!usedImages.has(file)) {
              try {
                const filePath = path.join(imagesDir, file);
                fs.unlinkSync(filePath);
                deletedCount++;
              } catch (error) {
                logger.error(`删除未使用图片文件失败: ${file}`, error);
              }
            }
          });
          
          if (deletedCount > 0) {
            logger.info(`已清理${deletedCount}个未使用的图片文件`);
          }
        }
      } catch (error) {
        logger.error('清理未使用图片文件时出错:', error);
      }
    } else {
      // 如果历史记录已加载，使用原来的逻辑
      // 获取所有图片文件
      const files = fs.readdirSync(imagesDir);
      
      // 获取所有在使用的图片文件名
      const usedImages = new Set<string>();
      clipboardHistory.forEach(item => {
        if (item.type === 'image' && item.imagePath) {
          usedImages.add(item.imagePath);
        }
      });
      
      // 删除未使用的图片文件
      let deletedCount = 0;
      files.forEach(file => {
        if (!usedImages.has(file)) {
          try {
            const filePath = path.join(imagesDir, file);
            fs.unlinkSync(filePath);
            deletedCount++;
          } catch (error) {
            logger.error(`删除未使用图片文件失败: ${file}`, error);
          }
        }
      });
      
      if (deletedCount > 0) {
        logger.info(`已清理${deletedCount}个未使用的图片文件`);
      }
    }
  } catch (error) {
    logger.error('清理未使用图片文件时出错:', error);
  }
}

/**
 * 将图片保存到文件系统并返回文件路径
 * @param imageBuffer 图片数据Buffer
 * @returns 保存的文件路径
 */
export function saveImageToFile(imageBuffer: Buffer): string {
  // 生成唯一的文件名
  const hash = crypto.createHash('md5').update(imageBuffer).digest('hex');
  const fileName = `${hash}.png`;
  const filePath = path.join(imagesDir, fileName);
  
  // 如果文件不存在，则保存
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, imageBuffer);
    logger.debug(`图片已保存到: ${filePath}`);
  }
  
  return fileName;
}

/**
 * 从文件系统加载图片
 * @param fileName 图片文件名
 * @returns 图片的nativeImage对象
 */
export function loadImageFromFile(fileName: string): Electron.NativeImage | null {
  try {
    const filePath = path.join(imagesDir, fileName);
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      return nativeImage.createFromBuffer(buffer);
    }
  } catch (error) {
    logger.error('加载图片失败:', error);
  }
  return null;
}

/**
 * 停止剪贴板监控
 */
export function stopClipboardMonitoring(): void {
  if (clipboardMonitoringInterval) {
    clearInterval(clipboardMonitoringInterval);
    clipboardMonitoringInterval = null;
    logger.info('剪贴板监控已停止');
  }
} 