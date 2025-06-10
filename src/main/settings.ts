import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

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
}

// 默认设置值
const defaultSettings: Settings = {
  shortcut: 'CommandOrControl+Shift+V', // 默认快捷键
  historyRetention: 0,                  // 不限时间
  launchAtStartup: false,
  showTrayIcon: true,
  showInDock: false,
  maxHistoryItems: 50,
  disableGPU: true                      // 默认禁用GPU加速以减少内存占用
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
      const data = fs.readFileSync(settingsPath, 'utf8');
      const userSettings = JSON.parse(data);
      // 合并默认设置和用户设置，确保所有字段都存在
      return { ...defaultSettings, ...userSettings };
    }
  } catch (error) {
    console.error('加载设置失败:', error);
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
    
    console.log('设置已保存');
  } catch (error) {
    console.error('保存设置失败:', error);
  }
}

/**
 * 获取特定设置项
 * @param key 设置项键名
 * @returns 设置项的值
 */
export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  const settings = loadSettings();
  return settings[key];
}

/**
 * 设置特定设置项
 * @param key 设置项键名
 * @param value 设置项的值
 */
export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  const settings = loadSettings();
  settings[key] = value;
  saveSettings(settings);
}

/**
 * 设置开机自启
 * @param enable 是否启用开机自启
 */
export function setAutoLaunch(enable: boolean): void {
  try {
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: process.execPath
    });
    setSetting('launchAtStartup', enable);
  } catch (error) {
    console.error('设置开机自启失败:', error);
  }
} 