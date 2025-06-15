import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import logger from './utils/logger';

/**
 * @file settings.ts
 * @description 用户偏好设置管理
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

// 默认设置
export interface Settings {
  shortcut: string;         // 显示历史面板的快捷键
  historyRetention: number; // 历史记录保存时间（天）
  launchAtStartup: boolean; // 开机自启
  showTrayIcon: boolean;    // 显示顶栏图标
  showInDock: boolean;      // 显示Dock栏图标
  maxHistoryItems: number;  // 最大历史记录数量
  disableGPU: boolean;      // 禁用GPU加速
  logLevel: string;         // 日志级别
}

// 默认设置值
const defaultSettings: Settings = {
  shortcut: 'CommandOrControl+Shift+V', // 默认快捷键
  historyRetention: 0,                  // 不限时间
  launchAtStartup: false,
  showTrayIcon: true,
  showInDock: false,
  maxHistoryItems: 50,
  disableGPU: true,                     // 默认禁用GPU加速以减少内存占用
  logLevel: 'info'                      // 默认日志级别
};

// 设置文件路径
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

/**
 * 加载设置
 * @returns 用户设置
 */
export function loadSettings(): Settings {
  try {
    if (fs.existsSync(settingsPath)) {
      logger.info(`从 ${settingsPath} 加载设置`);
      const data = fs.readFileSync(settingsPath, 'utf8');
      const userSettings = JSON.parse(data);
      // 合并默认设置和用户设置，确保所有字段都存在
      return { ...defaultSettings, ...userSettings };
    } else {
      logger.info('设置文件不存在，使用默认设置');
    }
  } catch (error) {
    logger.error('加载设置失败:', error);
  }
  
  // 如果设置文件不存在或加载失败，返回默认设置
  return defaultSettings;
}

/**
 * 保存设置
 * @param settings 要保存的设置
 */
export function saveSettings(settings: Partial<Settings>): void {
  try {
    // 合并现有设置和新设置
    const currentSettings = loadSettings();
    const newSettings = { ...currentSettings, ...settings };
    
    // 写入文件
    fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2), 'utf8');
    
    logger.info(`设置已保存到 ${settingsPath}`);
    logger.debug('保存的设置内容:', newSettings);
  } catch (error) {
    logger.error('保存设置失败:', error);
  }
}

/**
 * 获取特定设置项
 * @param key 设置项键名
 * @returns 设置项的值
 */
export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  const settings = loadSettings();
  logger.debug(`获取设置项 ${key}: ${settings[key]}`);
  return settings[key];
}

/**
 * 设置特定设置项
 * @param key 设置项键名
 * @param value 设置项的值
 */
export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  logger.info(`设置 ${key} = ${value}`);
  const settings = loadSettings();
  settings[key] = value;
  saveSettings(settings);
}

/**
 * 创建 Launch Agent plist 文件
 * @param enable 是否启用
 */
function createLaunchAgent(enable: boolean): void {
  try {
    const appName = app.getName();
    const appPath = process.execPath;
    const plistPath = path.join(os.homedir(), 'Library/LaunchAgents', `com.cailgainey.${appName}.plist`);

    if (enable) {
      logger.info(`创建 Launch Agent: ${plistPath}`);
      
      // 创建 plist 内容
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.cailgainey.${appName}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${appPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ProcessType</key>
  <string>Interactive</string>
</dict>
</plist>`;

      // 确保目录存在
      const launchAgentsDir = path.dirname(plistPath);
      if (!fs.existsSync(launchAgentsDir)) {
        fs.mkdirSync(launchAgentsDir, { recursive: true });
        logger.debug(`创建目录: ${launchAgentsDir}`);
      }

      // 写入 plist 文件
      fs.writeFileSync(plistPath, plistContent);
      logger.info(`已创建 Launch Agent: ${plistPath}`);

      // 加载 Launch Agent
      try {
        execSync(`launchctl load -w ${plistPath}`);
        logger.info('已加载 Launch Agent');
      } catch (loadError) {
        logger.error('加载 Launch Agent 失败:', loadError);
      }
    } else if (fs.existsSync(plistPath)) {
      // 卸载 Launch Agent
      try {
        execSync(`launchctl unload -w ${plistPath}`);
        logger.info('已卸载 Launch Agent');
      } catch (unloadError) {
        logger.error('卸载 Launch Agent 失败:', unloadError);
      }

      // 删除 plist 文件
      fs.unlinkSync(plistPath);
      logger.info(`已删除 Launch Agent: ${plistPath}`);
    }
  } catch (error) {
    logger.error('处理 Launch Agent 失败:', error);
  }
}

/**
 * 设置开机自启
 * @param enable 是否启用开机自启
 */
export function setAutoLaunch(enable: boolean): void {
  try {
    logger.info(`尝试${enable ? '启用' : '禁用'}开机自启动...`);
    
    // 首先尝试使用 Electron 内置方法
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: process.execPath
    });
    
    // 检查设置是否成功应用
    const loginSettings = app.getLoginItemSettings();
    logger.debug('登录项设置状态:', loginSettings);
    
    // 如果是 macOS 系统，使用 Launch Agent 作为备选方法
    if (process.platform === 'darwin') {
      logger.info('在 macOS 上使用 Launch Agent 作为备选方法');
      createLaunchAgent(enable);
    }
    
    // 保存设置
    setSetting('launchAtStartup', enable);
    logger.info(`开机自启动已${enable ? '启用' : '禁用'}`);
  } catch (error) {
    logger.error('设置开机自启失败:', error);
  }
}

/**
 * 清理 Launch Agent
 * 在应用卸载前调用，以避免残留文件
 */
export function cleanupLaunchAgent(): void {
  if (process.platform !== 'darwin') {
    logger.debug('非 macOS 平台，跳过 Launch Agent 清理');
    return;
  }
  
  try {
    const appName = app.getName();
    const plistPath = path.join(os.homedir(), 'Library/LaunchAgents', `com.cailgainey.${appName}.plist`);
    
    if (fs.existsSync(plistPath)) {
      logger.info(`发现 Launch Agent: ${plistPath}，准备清理`);
      
      // 卸载 Launch Agent
      try {
        execSync(`launchctl unload -w ${plistPath}`);
        logger.info('已卸载 Launch Agent');
      } catch (unloadError) {
        logger.error('卸载 Launch Agent 失败:', unloadError);
      }

      // 删除 plist 文件
      fs.unlinkSync(plistPath);
      logger.info(`已删除 Launch Agent: ${plistPath}`);
    } else {
      logger.debug('没有找到 Launch Agent 文件，无需清理');
    }
  } catch (error) {
    logger.error('清理 Launch Agent 失败:', error);
  }
}

/**
 * 检查并修复开机自启动设置
 * 确保设置与实际状态一致
 */
export function checkAndFixAutoLaunch(settings: Settings): void {
  try {
    const shouldAutoLaunch = settings.launchAtStartup;
    logger.info(`检查开机自启动设置，用户设置为: ${shouldAutoLaunch ? '启用' : '禁用'}`);
    
    // 检查当前的登录项设置
    const loginSettings = app.getLoginItemSettings();
    logger.debug('当前登录项设置:', loginSettings);
    
    // 检查 Launch Agent 设置 (macOS)
    if (process.platform === 'darwin') {
      const appName = app.getName();
      const plistPath = path.join(os.homedir(), 'Library/LaunchAgents', `com.cailgainey.${appName}.plist`);
      const launchAgentExists = fs.existsSync(plistPath);
      logger.debug(`Launch Agent ${launchAgentExists ? '已存在' : '不存在'}`);
      
      // 如果设置与实际状态不一致，进行修复
      if (shouldAutoLaunch !== launchAgentExists || shouldAutoLaunch !== loginSettings.openAtLogin) {
        logger.info('检测到开机自启动设置不一致，进行修复');
        setAutoLaunch(shouldAutoLaunch);
      } else {
        logger.info('开机自启动设置正常，无需修复');
      }
    }
  } catch (error) {
    logger.error('检查和修复开机自启动设置失败:', error);
  }
} 