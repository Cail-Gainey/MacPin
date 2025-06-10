/**
 * @file preferences.d.ts
 * @description 偏好设置API类型定义
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

export interface Settings {
  shortcut: string;
  historyRetention: number;
  launchAtStartup: boolean;
  showTrayIcon: boolean;
  maxHistoryItems: number;
}

declare global {
  interface Window {
    preferencesAPI: {
      getSettings: () => Promise<Settings>;
      saveSettings: (settings: Partial<Settings>) => Promise<Settings>;
    }
  }
} 