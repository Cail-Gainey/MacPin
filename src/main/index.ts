import { app, BrowserWindow, Tray, Menu, clipboard, globalShortcut, ipcMain, nativeImage, protocol } from 'electron';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { loadSettings, Settings } from './settings';
import { createPreferencesWindow } from './preferencesWindow';
import { clearClipboardHistoryKeepPinned, ClipboardItem } from './clearClipboardHistory';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * @file index.ts
 * @description Electron主进程入口文件
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

// 尝试加载设置，以便在应用初始化前决定是否禁用GPU
let initialSettings: Settings;
try {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  if (fs.existsSync(settingsPath)) {
    const data = fs.readFileSync(settingsPath, 'utf8');
    initialSettings = JSON.parse(data);
  }
} catch (error) {
  console.error('加载初始设置失败:', error);
  // 如果无法加载设置，默认禁用GPU
  initialSettings = { disableGPU: true } as Settings;
}

// 根据设置决定是否禁用GPU加速
if (initialSettings?.disableGPU !== false) {
  console.log('根据设置禁用GPU加速');
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-smooth-scrolling');
  app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService');
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const clipboardHistory: ClipboardItem[] = [];
let lastClipboardContent: string = '';
let isQuitting = false;
let clipboardMonitoringInterval: NodeJS.Timeout | null = null;
let settings: Settings;

// 历史记录文件路径
const historyFilePath = path.join(app.getPath('userData'), 'clipboard-history.json');
// 图片存储目录
const imagesDir = path.join(app.getPath('userData'), 'clipboard-images');

// 确保图片存储目录存在
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

/**
 * 保存剪贴板历史到本地文件
 */
function saveClipboardHistory(): void {
  try {
    // 确保所有项目的pinned属性都是布尔值
    clipboardHistory.forEach(item => {
      item.pinned = item.pinned === true;
    });
    
    // 检查有多少置顶项
    const pinnedCount = clipboardHistory.filter(item => item.pinned === true).length;
    console.log(`保存时置顶项数量: ${pinnedCount}`);
    
    fs.writeFileSync(historyFilePath, JSON.stringify(clipboardHistory), 'utf8');
    console.log('剪贴板历史已保存到本地');
  } catch (error) {
    console.error('保存剪贴板历史失败:', error);
  }
}

/**
 * 从本地文件加载剪贴板历史
 */
function loadClipboardHistory(): void {
  try {
    if (fs.existsSync(historyFilePath)) {
      const data = fs.readFileSync(historyFilePath, 'utf8');
      const history = JSON.parse(data) as ClipboardItem[];
      
      // 确保所有项目的pinned属性都是布尔值
      history.forEach(item => {
        // 明确将pinned转换为布尔值
        item.pinned = item.pinned === true;
        console.log(`加载项目ID: ${item.id}, pinned: ${item.pinned}`);
      });
      
      // 清空当前历史
      clipboardHistory.length = 0;
      
      // 分离置顶项和非置顶项
      const pinnedItems = history.filter(item => item.pinned === true);
      const unpinnedItems = history.filter(item => item.pinned !== true);
      
      console.log(`加载时发现置顶项: ${pinnedItems.length}个, 未置顶项: ${unpinnedItems.length}个`);
      
      // 按时间戳降序排序
      pinnedItems.sort((a, b) => b.timestamp - a.timestamp);
      unpinnedItems.sort((a, b) => b.timestamp - a.timestamp);
      
      // 先添加置顶项，再添加非置顶项
      clipboardHistory.push(...pinnedItems, ...unpinnedItems);
      
      console.log(`已从本地加载${clipboardHistory.length}条剪贴板历史记录`);
    }
  } catch (error) {
    console.error('加载剪贴板历史失败:', error);
  }
}

/**
 * 清理未使用的图片文件
 */
function cleanupUnusedImages(): void {
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
                console.error(`删除未使用图片文件失败: ${file}`, error);
              }
            }
          });
          
          if (deletedCount > 0) {
            console.log(`已清理${deletedCount}个未使用的图片文件`);
          }
        }
      } catch (error) {
        console.error('清理未使用图片文件时出错:', error);
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
            console.error(`删除未使用图片文件失败: ${file}`, error);
          }
        }
      });
      
      if (deletedCount > 0) {
        console.log(`已清理${deletedCount}个未使用的图片文件`);
      }
    }
  } catch (error) {
    console.error('清理未使用图片文件时出错:', error);
  }
}

// 创建主窗口
function createWindow() {
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
    mainWindow.loadURL('http://localhost:5173');
    // 注释掉自动打开开发者工具
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // 隐藏窗口而不是关闭
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  
  // 减少内存占用的优化
  mainWindow.webContents.setAudioMuted(true); // 静音
  
  // 当窗口隐藏时，尝试释放内存
  mainWindow.on('hide', () => {
    if (global.gc) {
      try {
        global.gc();
        console.log('窗口隐藏时执行垃圾回收');
      } catch (error) {
        console.error('垃圾回收失败:', error);
      }
    }
  });
}

// 创建系统托盘
function createTray() {
  // 如果设置为不显示托盘图标，则不创建
  if (!settings.showTrayIcon) return;

  // 根据环境获取正确的图标路径
  let iconPath;
  if (process.env.NODE_ENV === 'development') {
    iconPath = join(__dirname, '../../resources/icon.png');
  } else {
    // 生产环境下尝试多个可能的路径
    const possiblePaths = [
      join(__dirname, 'assets/icon.png'),  // 首先检查 dist/main/assets 目录
      join(process.resourcesPath, 'icon.png'),  // 然后检查 resources 目录
      join(app.getAppPath(), 'dist/main/assets/icon.png')  // 最后检查应用根目录
    ];
    
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
      console.error('找不到托盘图标文件，使用默认路径');
      iconPath = join(process.resourcesPath, 'icon.png');
    } else {
      console.log(`使用托盘图标: ${iconPath}`);
    }
  }

  // 创建托盘图标
  try {
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    
    const contextMenu = Menu.buildFromTemplate([
      { label: '显示剪贴板历史', click: () => toggleWindow() },
      { type: 'separator' },
      { label: '关于 MacPins', click: () => {
        // 显示窗口并触发关于页面显示
        if (!mainWindow?.isVisible()) {
          showWindow();
        }
        // 通知渲染进程显示关于页面
        mainWindow?.webContents.send('show-about');
      }},
      { label: '偏好设置...', click: () => createPreferencesWindow() },
      { type: 'separator' },
      { label: '退出', click: () => {
        exitApplication();
      }}
    ]);
    
    tray.setToolTip('MacPins 剪贴板历史');
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => {
      tray?.popUpContextMenu();
    });
  } catch (error) {
    console.error('创建托盘图标失败:', error);
  }
}

// 切换窗口显示状态
function toggleWindow() {
  if (mainWindow?.isVisible()) {
    mainWindow.hide();
  } else {
    showWindow();
  }
}

// 显示窗口
function showWindow() {
  if (!mainWindow) return;
  
  // 获取鼠标位置并定位窗口
  const { screen } = require('electron');
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  
  mainWindow.setPosition(
    Math.floor(display.workArea.x + (display.workArea.width - mainWindow.getSize()[0]) / 2),
    Math.floor(display.workArea.y + (display.workArea.height - mainWindow.getSize()[1]) / 2)
  );
  
  // 在显示窗口前，检查是否需要加载历史记录（如果剪贴板历史为空）
  if (clipboardHistory.length === 0) {
    loadClipboardHistory();
  }
  
  mainWindow.show();
  mainWindow.focus();
}

// 监控剪贴板变化
function startClipboardMonitoring() {
  // 初始化剪贴板内容
  lastClipboardContent = clipboard.readText();
  
  // 定期检查剪贴板变化
  clipboardMonitoringInterval = setInterval(() => {
    try {
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
        
        // 限制历史记录数量（如果设置了限制）
        if (settings.maxHistoryItems < 999999 && clipboardHistory.length > settings.maxHistoryItems) {
          // 找到第一个未置顶的项目从末尾开始删除
          const indexToRemove = [...clipboardHistory].reverse().findIndex(item => !item.pinned);
          if (indexToRemove !== -1) {
            // 将反转后的索引转换为原数组的索引
            const actualIndex = clipboardHistory.length - 1 - indexToRemove;
            clipboardHistory.splice(actualIndex, 1);
          }
        }
        
        // 通知渲染进程
        mainWindow?.webContents.send('clipboard-updated', clipboardHistory);
        
        // 保存历史记录到本地
        saveClipboardHistory();
      }
      
      // 检查图片
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
            
            // 限制历史记录数量（如果设置了限制）
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
                        console.log(`已删除未使用的图片: ${filePath}`);
                      }
                    } catch (error) {
                      console.error('删除图片文件失败:', error);
                    }
                  }
                }
                
                clipboardHistory.splice(actualIndex, 1);
              }
            }
            
            // 通知渲染进程
            mainWindow?.webContents.send('clipboard-updated', clipboardHistory);
            
            // 保存历史记录到本地
            saveClipboardHistory();
          }
        }
      }
    } catch (error) {
      console.error('剪贴板监控错误:', error);
    }
  }, 1500);
}

// 执行AppleScript
const execAppleScript = promisify(exec);
async function runAppleScript(script: string) {
  try {
    const { stdout } = await execAppleScript(`osascript -e '${script}'`);
    return stdout.trim();
  } catch (error: any) {
    // 检查是否是权限错误
    if (error.stderr && error.stderr.includes('不允许发送按键')) {
      console.error('AppleScript权限错误: 应用需要辅助功能权限');
      
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
          }
        });
      }
    } else {
      console.error('AppleScript执行错误:', error);
    }
    return null;
  }
}

/**
 * 完全退出应用程序
 * 确保清理所有资源并终止所有进程
 */
function exitApplication() {
  console.log('正在退出应用...');
  
  // 设置退出标志
  isQuitting = true;
  
  // 保存剪贴板历史到本地
  saveClipboardHistory();
  
  // 清理定时器
  if (clipboardMonitoringInterval) {
    clearInterval(clipboardMonitoringInterval);
    clipboardMonitoringInterval = null;
  }
  
  // 清理所有其他定时器
  const timers = global.setTimeout[Symbol.for('nodejs.util.promisify.custom')];
  if (timers && typeof timers === 'object') {
    Object.keys(timers).forEach(key => {
      try {
        clearTimeout(parseInt(key));
      } catch (error) {
        console.error('清理定时器失败:', error);
      }
    });
  }
  
  // 注销全局快捷键
  globalShortcut.unregisterAll();
  
  // 销毁托盘图标
  if (tray) {
    tray.destroy();
    tray = null;
  }
  
  // 关闭所有窗口
  BrowserWindow.getAllWindows().forEach(window => {
    window.removeAllListeners('close');
    window.destroy();
  });
  
  // 清理内存中的剪贴板历史
  clipboardHistory.length = 0;
  
  // 强制进行垃圾回收
  if (global.gc) {
    global.gc();
  }
  
  // 强制退出应用
  app.exit(0);
}

/**
 * 检查并准备应用资源文件
 * 确保应用在开发和生产环境中都能正确访问资源
 */
function checkAndPrepareResources(): void {
  try {
    // 确定资源目录
    const resourcesDir = app.isPackaged
      ? process.resourcesPath
      : join(__dirname, '../../resources');

    console.log('资源目录路径:', resourcesDir);

    // 检查资源目录是否存在
    if (!fs.existsSync(resourcesDir)) {
      console.warn(`资源目录不存在: ${resourcesDir}`);
      
      // 如果是打包环境但资源目录不存在，尝试创建
      if (app.isPackaged) {
        try {
          fs.mkdirSync(resourcesDir, { recursive: true });
          console.log(`已创建资源目录: ${resourcesDir}`);
        } catch (err) {
          console.error('创建资源目录失败:', err);
        }
      }
    }

    // 检查图标文件
    const iconPath = join(resourcesDir, 'icon.png');
    if (!fs.existsSync(iconPath)) {
      console.warn(`图标文件不存在: ${iconPath}`);
    } else {
      console.log(`图标文件存在: ${iconPath}`);
    }
  } catch (error) {
    console.error('检查资源文件时出错:', error);
  }
}

/**
 * 应用设置
 * 根据用户设置更新应用行为
 */
function applySettings() {
  // 重新注册快捷键
  globalShortcut.unregisterAll();
  
  try {
    // 处理快捷键格式，确保兼容性
    let shortcutToRegister = settings.shortcut;
    
    // 如果是macOS，将CommandOrControl替换为Command
    if (process.platform === 'darwin') {
      shortcutToRegister = shortcutToRegister.replace('CommandOrControl', 'Command');
      
      // 处理Dock栏图标显示/隐藏（仅在macOS上有效）
      if (settings.showInDock) {
        app.dock.show();
        console.log('显示Dock栏图标');
      } else {
        app.dock.hide();
        console.log('隐藏Dock栏图标');
      }
    } else {
      shortcutToRegister = shortcutToRegister.replace('CommandOrControl', 'Control');
    }
    
    console.log(`尝试注册快捷键: ${shortcutToRegister}`);
    
    // 注册快捷键
    const registered = globalShortcut.register(shortcutToRegister, () => {
      toggleWindow();
    });
    
    if (!registered) {
      console.error(`快捷键注册失败: ${shortcutToRegister}`);
      // 尝试使用默认快捷键
      tryRegisterDefaultShortcut();
      
      // 如果有主窗口，通知用户快捷键注册失败
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('shortcut-registration-failed', {
          message: `快捷键 ${shortcutToRegister} 注册失败，已尝试使用默认快捷键`
        });
      }
    } else {
      console.log(`快捷键注册成功: ${shortcutToRegister}`);
    }
  } catch (error) {
    console.error('应用设置时出错:', error);
  }
}

/**
 * 尝试注册默认快捷键
 */
function tryRegisterDefaultShortcut() {
  try {
    // 根据平台选择默认快捷键
    const defaultShortcut = process.platform === 'darwin' ? 'Command+Shift+V' : 'Control+Shift+V';
    
    const registered = globalShortcut.register(defaultShortcut, () => {
      toggleWindow();
    });
    
    if (registered) {
      console.log(`已回退到默认快捷键: ${defaultShortcut}`);
      // 更新设置中的快捷键为默认值
      settings.shortcut = process.platform === 'darwin' ? 'Command+Shift+V' : 'Control+Shift+V';
    } else {
      console.error(`默认快捷键注册也失败: ${defaultShortcut}`);
    }
  } catch (fallbackError) {
    console.error('默认快捷键注册也失败:', fallbackError);
  }
}

/**
 * 将图片保存到文件系统并返回文件路径
 * @param imageBuffer 图片数据Buffer
 * @returns 保存的文件路径
 */
function saveImageToFile(imageBuffer: Buffer): string {
  // 生成唯一的文件名
  const hash = crypto.createHash('md5').update(imageBuffer).digest('hex');
  const fileName = `${hash}.png`;
  const filePath = path.join(imagesDir, fileName);
  
  // 如果文件不存在，则保存
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, imageBuffer);
    console.log(`图片已保存到: ${filePath}`);
  }
  
  return fileName;
}

/**
 * 从文件系统加载图片
 * @param fileName 图片文件名
 * @returns 图片的nativeImage对象
 */
function loadImageFromFile(fileName: string): Electron.NativeImage | null {
  try {
    const filePath = path.join(imagesDir, fileName);
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      return nativeImage.createFromBuffer(buffer);
    }
  } catch (error) {
    console.error('加载图片失败:', error);
  }
  return null;
}

/**
 * 监控内存使用情况
 */
function monitorMemoryUsage(): void {
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = {
    rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
    external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100,
  };
  
  console.log('内存使用情况 (MB):', memoryUsageMB);
  
  // 如果堆内存使用超过200MB，尝试进行垃圾回收
  if (memoryUsageMB.heapUsed > 200 && global.gc) {
    console.log('尝试进行垃圾回收...');
    global.gc();
    
    // 垃圾回收后再次检查内存使用
    const afterGC = process.memoryUsage();
    const afterGCMB = {
      heapUsed: Math.round(afterGC.heapUsed / 1024 / 1024 * 100) / 100,
    };
    console.log('垃圾回收后堆内存使用 (MB):', afterGCMB.heapUsed);
  }
}

// 应用初始化
app.whenReady().then(() => {
  // 注册自定义协议处理程序
  protocol.registerFileProtocol('clipboard-image', (request, callback) => {
    try {
      const fileName = request.url.replace('clipboard-image://', '');
      const filePath = path.join(imagesDir, fileName);
      callback({ path: filePath });
    } catch (error) {
      console.error('处理clipboard-image协议时出错:', error);
      callback({ error: -2 /* 文件不存在 */ });
    }
  });

  // 检查并准备资源文件
  checkAndPrepareResources();
  
  // 加载设置
  settings = loadSettings();
  
  // 应用Dock栏设置（在创建窗口前）
  if (process.platform === 'darwin' && !settings.showInDock) {
    app.dock.hide();
    console.log('根据设置隐藏Dock栏图标');
  }
  
  // 不再在启动时加载所有历史记录，而是在需要时加载
  // 但仍然需要确保图片目录存在
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  
  // 清理未使用的图片文件
  cleanupUnusedImages();
  
  // 设置定期清理的定时器（每小时清理一次）
  setInterval(cleanupUnusedImages, 60 * 60 * 1000);
  
  createWindow();
  createTray();
  startClipboardMonitoring();
  
  // 应用设置
  applySettings();
  
  // 设置内存监控（每10分钟检查一次）
  setInterval(monitorMemoryUsage, 10 * 60 * 1000);
  
  // IPC事件处理
  ipcMain.handle('get-clipboard-history', () => {
    return clipboardHistory;
  });
  
  ipcMain.handle('set-clipboard-content', async (_, item: ClipboardItem) => {
    // 设置剪贴板内容
    if (item.type === 'text') {
      clipboard.writeText(item.content);
    } else if (item.type === 'image') {
      // 如果有imagePath，从文件系统加载图片
      if (item.imagePath) {
        const image = loadImageFromFile(item.imagePath);
        if (image) {
          clipboard.writeImage(image);
        } else {
          console.error('从文件系统加载图片失败');
          return { success: false, error: '加载图片失败' };
        }
      } else {
        // 兼容旧版本：如果没有imagePath，尝试从content中加载base64图片
        try {
          const imageData = item.content.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(imageData, 'base64');
          const image = nativeImage.createFromBuffer(buffer);
          clipboard.writeImage(image);
        } catch (error) {
          console.error('从base64加载图片失败:', error);
          return { success: false, error: '加载图片失败' };
        }
      }
    }
    
    // 尝试模拟在当前鼠标位置粘贴内容
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
    
    // 返回成功状态
    return { success: true };
  });
  
  ipcMain.handle('clear-clipboard-history', () => {
    // 使用新的函数清除历史记录但保留置顶项
    return clearClipboardHistoryKeepPinned(clipboardHistory, mainWindow, saveClipboardHistory);
  });
  
  ipcMain.handle('delete-clipboard-item', (_, id: string) => {
    const index = clipboardHistory.findIndex(item => item.id === id);
    if (index !== -1) {
      clipboardHistory.splice(index, 1);
      mainWindow?.webContents.send('clipboard-updated', clipboardHistory);
      
      // 保存更新后的历史记录到本地
      saveClipboardHistory();
    }
  });
  
  // 处理置顶/取消置顶
  ipcMain.handle('toggle-pinned', (_, id: string) => {
    console.log(`尝试切换置顶状态，ID: ${id}`);
    const index = clipboardHistory.findIndex(item => item.id === id);
    
    if (index !== -1) {
      // 切换置顶状态，确保是布尔值
      const currentPinned = Boolean(clipboardHistory[index].pinned);
      clipboardHistory[index].pinned = !currentPinned;
      
      console.log(`项目 ${id} 的置顶状态从 ${currentPinned} 变为 ${clipboardHistory[index].pinned}`);
      
      // 重新排序历史记录，确保置顶项在前面
      const pinnedItems = clipboardHistory.filter(item => item.pinned === true);
      const unpinnedItems = clipboardHistory.filter(item => item.pinned !== true);
      
      console.log(`置顶项数量: ${pinnedItems.length}, 未置顶项数量: ${unpinnedItems.length}`);
      
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
      console.log(`未找到ID为 ${id} 的项目`);
    }
  });
  
  ipcMain.handle('hide-window', () => {
    mainWindow?.hide();
  });
  
  // 添加强制退出的IPC处理
  ipcMain.handle('exit-application', () => {
    exitApplication();
  });
  
  // 监听设置变更
  ipcMain.on('settings-updated', () => {
    settings = loadSettings();
    applySettings();
  });
  
  // 添加show-about事件处理
  ipcMain.on('show-about-response', () => {

  });
  
  // 添加切换窗口置顶状态的处理程序
  ipcMain.handle('toggle-always-on-top', () => {
    if (mainWindow) {
      const isAlwaysOnTop = mainWindow.isAlwaysOnTop();
      mainWindow.setAlwaysOnTop(!isAlwaysOnTop);
      return !isAlwaysOnTop;
    }
    return false;
  });
  
  // 获取窗口当前置顶状态
  ipcMain.handle('get-always-on-top-status', () => {
    if (mainWindow) {
      return mainWindow.isAlwaysOnTop();
    }
    return false;
  });
});

// 处理macOS的应用激活
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 应用退出前的清理工作
app.on('before-quit', () => {
  isQuitting = true;
  
  // 停止剪贴板监控
  if (clipboardMonitoringInterval) {
    clearInterval(clipboardMonitoringInterval);
    clipboardMonitoringInterval = null;
  }
  
  globalShortcut.unregisterAll();
});

// 处理SIGINT和SIGTERM信号
process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在退出...');
  exitApplication();
});

process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在退出...');
  exitApplication();
});

// 处理未捕获的异常和拒绝
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  exitApplication();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  exitApplication();
});

// 阻止应用退出，而是隐藏窗口
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    exitApplication();
  }
});
