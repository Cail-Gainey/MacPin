import React, { useState, useEffect } from 'react';
import { XMarkIcon, TrashIcon, InformationCircleIcon, ArrowUpCircleIcon } from '@heroicons/react/24/outline';
import { ArrowUpCircleIcon as ArrowUpCircleIconSolid } from '@heroicons/react/24/solid';
import { useClipboardStore } from '../store/clipboardStore';
import '../styles/Header.css';

/**
 * @file Header.tsx
 * @description 应用标题栏组件
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

interface HeaderProps {
  onShowAbout: () => void;
}

const Header: React.FC<HeaderProps> = ({ onShowAbout }) => {
  const { clearHistory } = useClipboardStore();
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState('');

  // 获取窗口当前置顶状态
  useEffect(() => {
    const getAlwaysOnTopStatus = async () => {
      const status = await window.electronAPI.getAlwaysOnTopStatus();
      setIsAlwaysOnTop(status);
    };
    
    getAlwaysOnTopStatus();
  }, []);

  // 监听来自主进程的show-about事件
  useEffect(() => {
    const handleShowAboutEvent = () => {
      onShowAbout();
      // 通知主进程已显示关于页面
      window.electronAPI.showAboutResponse();
    };

    // 添加事件监听
    const unsubscribeShowAbout = window.electronAPI.onShowAbout(handleShowAboutEvent);

    // 组件卸载时取消监听
    return () => {
      unsubscribeShowAbout();
    };
  }, [onShowAbout]);

  const handleClose = () => {
    window.electronAPI.hideWindow();
  };

  const handleClearHistory = () => {
    clearHistory();
  };
  
  const handleToggleAlwaysOnTop = async () => {
    const newStatus = await window.electronAPI.toggleAlwaysOnTop();
    setIsAlwaysOnTop(newStatus);
    
    // 显示提示
    setTooltipMessage(newStatus ? '窗口已置顶' : '已取消置顶');
    setShowTooltip(true);
    
    // 2秒后隐藏提示
    setTimeout(() => {
      setShowTooltip(false);
    }, 2000);
  };

  return (
    <div className="header">
      <div className="header-title">剪贴板历史</div>
      <div className="header-actions">
        <button 
          className={`header-button pin-button ${isAlwaysOnTop ? 'active' : ''}`}
          onClick={handleToggleAlwaysOnTop}
          title={isAlwaysOnTop ? "取消置顶" : "窗口置顶"}
        >
          {isAlwaysOnTop ? 
            <ArrowUpCircleIconSolid className="header-icon" /> : 
            <ArrowUpCircleIcon className="header-icon" />
          }
        </button>
        <button 
          className="header-button about-button" 
          onClick={onShowAbout}
          title="关于"
        >
          <InformationCircleIcon className="header-icon" />
        </button>
        <button 
          className="header-button clear-button" 
          onClick={handleClearHistory}
          title="清空历史"
        >
          <TrashIcon className="header-icon" />
        </button>
        <button 
          className="header-button close-button" 
          onClick={handleClose}
          title="关闭"
        >
          <XMarkIcon className="header-icon" />
        </button>
      </div>
      
      {/* 状态变化提示 */}
      {showTooltip && (
        <div className="header-tooltip">
          {tooltipMessage}
        </div>
      )}
    </div>
  );
};

export default Header; 