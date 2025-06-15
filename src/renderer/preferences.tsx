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
  logLevel: string;
}

// 默认设置值
const defaultSettings: Settings = {
  shortcut: 'CommandOrControl+Shift+V',
  historyRetention: 0,
  launchAtStartup: false,
  showTrayIcon: true,
  showInDock: false,
  maxHistoryItems: 50,
  disableGPU: true,
  logLevel: 'info'
};

// 历史记录数量选项
const historyItemsOptions = [
  { value: 10, label: '10条' },
  { value: 20, label: '20条' },
  { value: 50, label: '50条' },
  { value: 100, label: '100条' },
  { value: 200, label: '200条' },
  { value: 500, label: '500条' },
  { value: 999999, label: '不限制' }
];

// 日志级别选项
const logLevelOptions = [
  { value: 'debug', label: '调试 (Debug) - 详细日志' },
  { value: 'info', label: '信息 (Info) - 标准日志' },
  { value: 'warn', label: '警告 (Warn) - 仅警告和错误' },
  { value: 'error', label: '错误 (Error) - 仅错误' }
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
  // 状态
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  const [displayShortcut, setDisplayShortcut] = useState('');
  const [lastShortcut, setLastShortcut] = useState(''); // 保存上一次的快捷键
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  // 引用
  const shortcutInputRef = useRef<HTMLInputElement>(null);
  const shortcutContainerRef = useRef<HTMLDivElement>(null);
  
  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await window.preferencesAPI.getSettings();
        // 确保所有必需的字段都存在
        const completeSettings: Settings = {
          ...defaultSettings,
          ...loadedSettings
        };
        setSettings(completeSettings);
        
        // 处理快捷键显示
        const formattedShortcut = formatShortcutForDisplay(completeSettings.shortcut);
        setDisplayShortcut(formattedShortcut);
        setLastShortcut(formattedShortcut); // 初始化上一次的快捷键
      } catch (error) {
        console.error('加载设置失败:', error);
      }
    };
    
    loadSettings();
  }, []);
  
  // 添加点击外部区域的事件监听器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isRecordingShortcut && 
        shortcutContainerRef.current && 
        !shortcutContainerRef.current.contains(event.target as Node)
      ) {
        // 点击了快捷键输入区域外部，取消记录并恢复上一次的快捷键
        setIsRecordingShortcut(false);
        setDisplayShortcut(lastShortcut);
      }
    };

    // 只有在记录快捷键状态下才添加事件监听器
    if (isRecordingShortcut) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    // 清理函数
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRecordingShortcut, lastShortcut]);
  
  // 格式化快捷键显示
  const formatShortcutForDisplay = (shortcut: string): string => {
    return shortcut
      .replace('CommandOrControl', isMac() ? '⌘' : 'Ctrl')
      .replace('Command', '⌘')
      .replace('Control', 'Ctrl')
      .replace('Alt', isMac() ? '⌥' : 'Alt')
      .replace('Shift', isMac() ? '⇧' : 'Shift')
      .replace('Meta', isMac() ? '⌘' : 'Win')
      .replace(/\+/g, ' + ');
  };
  
  // 检测是否为macOS
  const isMac = (): boolean => {
    return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  };
  
  // 开始记录快捷键
  const startRecordingShortcut = () => {
    setIsRecordingShortcut(true);
    if (shortcutInputRef.current) {
      shortcutInputRef.current.focus();
    }
  };
  
  // 处理按键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    
    if (isRecordingShortcut) {
      // 如果按下了Escape键，取消记录并恢复上一次的快捷键
      if (e.key === 'Escape') {
        setIsRecordingShortcut(false);
        setDisplayShortcut(lastShortcut);
        return;
      }
      
      // 忽略单独的修饰键
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }
      
      // 构建快捷键字符串
      let shortcut = '';
      if (e.ctrlKey) shortcut += 'Control+';
      if (e.shiftKey) shortcut += 'Shift+';
      if (e.altKey) shortcut += 'Alt+';
      if (e.metaKey) shortcut += (isMac() ? 'Command+' : 'Meta+');
      
      // 添加主键
      shortcut += e.key.toUpperCase();
      
      // 替换为通用格式
      if (shortcut.includes('Control+') || shortcut.includes('Command+')) {
        shortcut = shortcut.replace(/^(Control|Command)\+/, 'CommandOrControl+');
      }
      
      // 更新设置和显示
      const formattedShortcut = formatShortcutForDisplay(shortcut);
      handleChange('shortcut', shortcut);
      setDisplayShortcut(formattedShortcut);
      setLastShortcut(formattedShortcut); // 更新上一次的快捷键
      setIsRecordingShortcut(false);
    }
  };
  
  // 处理按键释放
  const handleKeyUp = (e: React.KeyboardEvent) => {
    // 如果只按了修饰键然后释放，不做任何处理
    // 让点击外部区域的处理器来处理这种情况
  };
  
  // 处理设置变更
  const handleChange = (key: keyof Settings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setUnsavedChanges(true);
  };
  
  // 保存设置
  const handleSave = async () => {
    try {
      await window.preferencesAPI.saveSettings(settings);
      setUnsavedChanges(false);
    } catch (error) {
      console.error('保存设置失败:', error);
    }
  };
  
  // 取消更改
  const handleCancel = async () => {
    try {
      const loadedSettings = await window.preferencesAPI.getSettings();
      // 确保所有必需的字段都存在
      const completeSettings: Settings = {
        ...defaultSettings,
        ...loadedSettings
      };
      setSettings(completeSettings);
      
      // 更新显示的快捷键和上一次的快捷键
      const formattedShortcut = formatShortcutForDisplay(completeSettings.shortcut);
      setDisplayShortcut(formattedShortcut);
      setLastShortcut(formattedShortcut);
      
      setUnsavedChanges(false);
    } catch (error) {
      console.error('重新加载设置失败:', error);
    }
  };

  return (
    <div className="preferences-container">
      <h1 className="preferences-title">偏好设置</h1>
      
      <div className="preferences-section">
        <h2 className="section-title">通用</h2>
        
        <div className="preference-item" ref={shortcutContainerRef}>
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
            onKeyUp={handleKeyUp}
            onBlur={() => {
              // 输入框失去焦点时，如果仍在记录状态，则恢复上一次的快捷键
              if (isRecordingShortcut) {
                setIsRecordingShortcut(false);
                setDisplayShortcut(lastShortcut);
              }
            }}
            placeholder="点击记录快捷键"
            title="点击此处并按下新快捷键组合，按ESC取消"
          />
          {isRecordingShortcut && (
            <div className="shortcut-hint">
              按下快捷键组合，或按ESC取消
            </div>
          )}
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
        
        <div className="preference-item">
          <label htmlFor="logLevel">日志级别:</label>
          <select 
            id="logLevel" 
            value={settings.logLevel}
            onChange={(e) => handleChange('logLevel', e.target.value)}
            title="调整应用程序日志的详细程度"
          >
            {logLevelOptions.map(option => (
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
          <label htmlFor="showTrayIcon">显示顶栏图标</label>
        </div>
        
        {isMac() && (
          <div className="preference-item checkbox-item">
            <input 
              type="checkbox" 
              id="showInDock" 
              checked={settings.showInDock}
              onChange={(e) => handleChange('showInDock', e.target.checked)}
            />
            <label htmlFor="showInDock">在Dock栏显示图标</label>
          </div>
        )}
        
        <div className="preference-item checkbox-item">
          <input 
            type="checkbox" 
            id="disableGPU" 
            checked={settings.disableGPU}
            onChange={(e) => handleChange('disableGPU', e.target.checked)}
          />
          <label htmlFor="disableGPU">禁用GPU加速（减少内存占用，重启生效）</label>
        </div>
      </div>
      
      <div className="preferences-actions">
        <button 
          className="cancel-button" 
          onClick={handleCancel}
          disabled={!unsavedChanges}
        >
          取消
        </button>
        <button 
          className="save-button" 
          onClick={handleSave}
          disabled={!unsavedChanges}
        >
          保存
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