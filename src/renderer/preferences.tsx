import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/preferences.css';

/**
 * @file preferences.tsx
 * @description 偏好设置页面
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

// 设置接口
interface Settings {
  shortcut: string;
  historyRetention: number; // 保留此字段以兼容现有设置，但不再在UI中显示
  launchAtStartup: boolean;
  showTrayIcon: boolean;
  showInDock: boolean;
  maxHistoryItems: number;
  disableGPU: boolean;
}

// 历史记录数量选项
const historyItemsOptions = [
  { value: 50, label: '50条' },
  { value: 100, label: '100条' },
  { value: 200, label: '200条' },
  { value: 999999, label: '无限制' },
];

// 键盘按键映射
const keyMapping: Record<string, string> = {
  'Control': 'Ctrl',
  'Meta': 'Command',
  'Alt': 'Option',
  ' ': 'Space',
  'ArrowUp': '↑',
  'ArrowDown': '↓',
  'ArrowLeft': '←',
  'ArrowRight': '→',
};

const PreferencesApp: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    shortcut: 'CommandOrControl+Shift+V',
    historyRetention: 0, // 设置为0（无限制）
    launchAtStartup: true,
    showTrayIcon: true,
    showInDock: true,
    maxHistoryItems: 50,
    disableGPU: true, // 默认禁用GPU加速
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [isRecordingShortcut, setIsRecordingShortcut] = useState<boolean>(false);
  const [displayShortcut, setDisplayShortcut] = useState<string>('');
  const shortcutInputRef = useRef<HTMLInputElement>(null);

  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await window.preferencesAPI.getSettings();
        setSettings(loadedSettings);
        setDisplayShortcut(formatShortcut(loadedSettings.shortcut));
      } catch (error) {
        console.error('加载设置失败:', error);
      }
    };
    
    loadSettings();
  }, []);

  // 处理设置变更
  const handleChange = (key: keyof Settings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // 开始记录快捷键
  const startRecordingShortcut = () => {
    setIsRecordingShortcut(true);
    setDisplayShortcut('点击此处并按下快捷键...');
    // 聚焦到输入框
    shortcutInputRef.current?.focus();
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    
    // 忽略单独的修饰键
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      return;
    }
    
    // 构建快捷键字符串
    const modifiers = [];
    if (e.ctrlKey) modifiers.push('Control');
    if (e.metaKey) modifiers.push('Meta');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');
    
    // 至少需要一个修饰键
    if (modifiers.length === 0) {
      setDisplayShortcut('请至少按下一个修饰键 (Command/Ctrl/Alt/Shift)');
      return;
    }
    
    // 构建显示的快捷键
    const displayModifiers = modifiers.map(mod => keyMapping[mod] || mod);
    const displayKey = keyMapping[e.key] || e.key.toUpperCase();
    const displayShortcutValue = [...displayModifiers, displayKey].join('+');
    
    // 构建Electron格式的快捷键
    const electronModifiers = modifiers.join('+');
    const electronKey = e.key === ' ' ? 'Space' : e.key;
    const electronShortcut = `${electronModifiers}+${electronKey}`;
    
    setDisplayShortcut(displayShortcutValue);
    handleChange('shortcut', electronShortcut);
    setIsRecordingShortcut(false);
    
    // 自动保存设置
    autoSaveShortcut(electronShortcut);
  };
  
  // 自动保存快捷键设置
  const autoSaveShortcut = async (shortcut: string) => {
    try {
      // 只更新快捷键设置
      const settingsToSave = { ...settings, shortcut };
      await window.preferencesAPI.saveSettings(settingsToSave);
      
      // 显示短暂的成功提示
      setSaveMessage('快捷键已保存');
      setTimeout(() => {
        setSaveMessage('');
      }, 1500);
    } catch (error) {
      console.error('保存快捷键失败:', error);
      setSaveMessage('快捷键保存失败');
      setTimeout(() => {
        setSaveMessage('');
      }, 1500);
    }
  };

  // 保存所有设置
  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      // 保存时始终将historyRetention设置为0（无限制）
      const settingsToSave = { ...settings, historyRetention: 0 };
      await window.preferencesAPI.saveSettings(settingsToSave);
      setSaveMessage('设置已保存');
      
      // 3秒后清除消息
      setTimeout(() => {
        setSaveMessage('');
      }, 3000);
    } catch (error) {
      console.error('保存设置失败:', error);
      setSaveMessage('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 格式化显示快捷键
  const formatShortcut = (shortcut: string): string => {
    return shortcut
      .replace('CommandOrControl', 'Command')
      .replace('Alt', 'Option')
      .replace('Space', '空格');
  };

  return (
    <div className="preferences-container">
      <h1 className="preferences-title">偏好设置</h1>
      
      <div className="preferences-section">
        <h2 className="section-title">通用</h2>
        
        <div className="preference-item">
          <label htmlFor="shortcut">显示历史面板快捷键:</label>
          <input
            ref={shortcutInputRef}
            id="shortcut"
            type="text"
            className="shortcut-input full-width"
            value={isRecordingShortcut ? '点击此处并按下快捷键...' : (displayShortcut || '点击记录快捷键')}
            readOnly
            onClick={startRecordingShortcut}
            onKeyDown={handleKeyDown}
            placeholder="点击记录快捷键"
            title="点击此处并按下新快捷键组合"
          />
        </div>
        
        <div className="preference-item">
          <label htmlFor="maxHistoryItems">最大历史记录数量:</label>
          <select 
            id="maxHistoryItems" 
            value={settings.maxHistoryItems}
            onChange={(e) => handleChange('maxHistoryItems', Number(e.target.value))}
          >
            {historyItemsOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      
        <div className="preference-item checkbox-item">
          <input 
            type="checkbox" 
            id="launchAtStartup" 
            checked={settings.launchAtStartup}
            onChange={(e) => handleChange('launchAtStartup', e.target.checked)}
          />
          <label htmlFor="launchAtStartup">开机自动启动</label>
        </div>
        
        <div className="preference-item checkbox-item">
          <input 
            type="checkbox" 
            id="showTrayIcon" 
            checked={settings.showTrayIcon}
            onChange={(e) => handleChange('showTrayIcon', e.target.checked)}
          />
          <label htmlFor="showTrayIcon">在菜单栏显示图标</label>
        </div>
        
        <div className="preference-item checkbox-item">
          <input 
            type="checkbox" 
            id="showInDock" 
            checked={settings.showInDock}
            onChange={(e) => handleChange('showInDock', e.target.checked)}
          />
          <label htmlFor="showInDock">在Dock栏显示图标</label>
        </div>
      </div>
      
      <div className="preferences-section">
        <h2 className="section-title">高级选项</h2>
        
        <div className="preference-item checkbox-item">
          <input 
            type="checkbox" 
            id="disableGPU" 
            checked={settings.disableGPU}
            onChange={(e) => handleChange('disableGPU', e.target.checked)}
          />
          <label htmlFor="disableGPU">禁用GPU加速（降低内存占用，需要重启应用）</label>
        </div>
        
        <div className="preference-note">
          <p>注意：更改GPU加速设置需要重启应用才能生效。</p>
          <p>禁用GPU加速可以显著降低内存占用，但可能会影响界面流畅度。</p>
        </div>
      </div>
      
      <div className="preferences-footer">
        {saveMessage && <span className="save-message">{saveMessage}</span>}
        <button 
          className="save-button" 
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
};

// 渲染应用
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PreferencesApp />
  </React.StrictMode>
); 