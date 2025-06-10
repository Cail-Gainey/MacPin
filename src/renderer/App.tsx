import React, { useEffect, useState } from 'react';
import { useClipboardStore } from './store/clipboardStore';
import ClipboardHistory from './components/ClipboardHistory';
import Header from './components/Header';
import About from './components/About';
import './styles/App.css';

/**
 * @file App.tsx
 * @description 应用主组件
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

const App: React.FC = () => {
  const { setClipboardHistory } = useClipboardStore();
  const [notification, setNotification] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    // 初始化时获取剪贴板历史
    const fetchClipboardHistory = async () => {
      try {
        const history = await window.electronAPI.getClipboardHistory();
        setClipboardHistory(history);
      } catch (error) {
        console.error('获取剪贴板历史失败:', error);
      }
    };

    fetchClipboardHistory();

    // 监听剪贴板更新
    const unsubscribeUpdates = window.electronAPI.onClipboardUpdated((history) => {
      setClipboardHistory(history);
    });
    
    // 监听粘贴失败
    const unsubscribePasteFailed = window.electronAPI.onClipboardPasteFailed((data) => {
      setNotification(data.message);
      
      // 3秒后清除通知
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    });
    
    // 监听快捷键注册失败
    const unsubscribeShortcutFailed = window.electronAPI.onShortcutRegistrationFailed((data) => {
      setNotification(data.message);
      
      // 5秒后清除通知
      setTimeout(() => {
        setNotification(null);
      }, 5000);
    });
    
    // 监听显示关于页面事件
    const unsubscribeShowAbout = window.electronAPI.onShowAbout(() => {
      setShowAbout(true);
      window.electronAPI.showAboutResponse();
    });

    // 组件卸载时取消监听
    return () => {
      unsubscribeUpdates();
      unsubscribePasteFailed();
      unsubscribeShortcutFailed();
      unsubscribeShowAbout();
    };
  }, [setClipboardHistory]);

  const handleToggleAbout = (show: boolean) => {
    setShowAbout(show);
  };

  return (
    <div className="app">
      <Header onShowAbout={() => handleToggleAbout(true)} />
      <div className="content-container">
        {showAbout ? (
          <About onClose={() => handleToggleAbout(false)} />
        ) : (
          <ClipboardHistory />
        )}
      </div>
      {notification && (
        <div className="notification">
          {notification}
        </div>
      )}
    </div>
  );
};

export default App; 