/**
 * @file electron.d.ts
 * @description Electron API类型定义
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

export interface ClipboardItem {
  id: string;
  type: 'text' | 'image';
  content: string;
  timestamp: number;
  preview?: string;
  pinned?: boolean;
  imagePath?: string;
}

declare global {
  interface Window {
    electronAPI: {
      getClipboardHistory: () => Promise<ClipboardItem[]>;
      setClipboardContent: (item: ClipboardItem) => Promise<void>;
      clearClipboardHistory: () => Promise<ClipboardItem[]>;
      deleteClipboardItem: (id: string) => Promise<void>;
      hideWindow: () => Promise<void>;
      exitApplication: () => Promise<void>;
      togglePinned: (id: string) => Promise<void>;
      toggleAlwaysOnTop: () => Promise<boolean>;
      getAlwaysOnTopStatus: () => Promise<boolean>;
      onClipboardUpdated: (callback: (history: ClipboardItem[]) => void) => () => void;
      onClipboardPasteFailed: (callback: (data: {message: string}) => void) => () => void;
      onShortcutRegistrationFailed: (callback: (data: {message: string}) => void) => () => void;
      onShowAbout: (callback: () => void) => () => void;
      showAboutResponse: () => void;
    }
  }
} 