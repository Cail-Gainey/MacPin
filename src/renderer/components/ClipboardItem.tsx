import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TrashIcon, ClipboardDocumentCheckIcon, EllipsisHorizontalIcon, StarIcon as StarIconOutline } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { useClipboardStore } from '../store/clipboardStore';
import { ClipboardItem as ClipboardItemType } from '../types/electron';
import '../styles/ClipboardItem.css';

/**
 * @file ClipboardItem.tsx
 * @description 单个剪贴板项组件，支持懒加载图片
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

interface ClipboardItemProps {
  item: ClipboardItemType;
}

const ClipboardItem: React.FC<ClipboardItemProps> = ({ item }) => {
  const { deleteItem, setClipboardContent, togglePinned } = useClipboardStore();
  const [showCopied, setShowCopied] = useState(false);
  const [isSlideOpen, setIsSlideOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 设置交叉观察器，检测组件是否可见
  useEffect(() => {
    if (itemRef.current && item.type === 'image') {
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          // 组件可见后，不再需要观察
          if (observerRef.current) {
            observerRef.current.disconnect();
          }
        }
      }, { threshold: 0.1 }); // 当10%的组件可见时触发
      
      observerRef.current.observe(itemRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [item.type]);

  // 关闭其他打开的滑动菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (itemRef.current && !itemRef.current.contains(event.target as Node)) {
        setIsSlideOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 处理图片加载完成
  const handleImageLoaded = useCallback(() => {
    setImageLoaded(true);
  }, []);

  // 处理复制操作
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await setClipboardContent(item);
    // 显示复制成功提示
    setShowCopied(true);
    // 关闭滑动菜单
    setIsSlideOpen(false);
    // 3秒后隐藏提示
    setTimeout(() => {
      setShowCopied(false);
    }, 1500);
  };

  // 处理删除操作
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteItem(item.id);
    setIsSlideOpen(false);
  };

  // 处理更多操作按钮点击
  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSlideOpen(!isSlideOpen);
  };

  // 处理置顶操作
  const handleTogglePinned = (e: React.MouseEvent) => {
    e.stopPropagation();
    togglePinned(item.id);
  };

  // 处理项目点击
  const handleItemClick = () => {
    if (isSlideOpen) {
      setIsSlideOpen(false);
    } else {
      handleCopy({ stopPropagation: () => {} } as React.MouseEvent);
    }
  };

  // 格式化日期
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  };

  // 渲染图片内容
  const renderImageContent = () => {
    // 如果组件不可见，显示占位符
    if (!isVisible) {
      return <div className="image-placeholder">图片</div>;
    }
    
    // 组件可见，加载图片
    if (item.imagePath) {
      return (
        <img 
          className={imageLoaded ? 'loaded' : ''}
          src={`clipboard-image://${item.imagePath}`} 
          alt="剪贴板图片" 
          onLoad={handleImageLoaded}
          onError={(e) => {
            // 如果加载失败，尝试使用content中的base64数据（兼容旧版本）
            if (item.content.startsWith('data:image')) {
              (e.target as HTMLImageElement).src = item.content;
            }
          }}
        />
      );
    } else {
      // 兼容旧版本：直接使用base64数据
      return (
        <img 
          className={imageLoaded ? 'loaded' : ''}
          src={item.content} 
          alt="剪贴板图片" 
          onLoad={handleImageLoaded}
        />
      );
    }
  };

  return (
    <div 
      ref={itemRef}
      className={`clipboard-item ${showCopied ? 'copied' : ''} ${isSlideOpen ? 'slide-open' : ''} ${item.pinned ? 'pinned' : ''}`} 
    >
      {showCopied && (
        <div className="copy-success">
          <ClipboardDocumentCheckIcon className="copy-icon" />
          <span>已复制到剪贴板</span>
        </div>
      )}
      
      <div className="clipboard-item-container">
        {/* 内容区域 */}
        <div className="clipboard-item-inner" onClick={handleItemClick}>
          <div className="clipboard-item-content">
            {item.type === 'text' ? (
              <div className="clipboard-text">{item.content}</div>
            ) : (
              <div className="clipboard-image">
                {renderImageContent()}
              </div>
            )}
          </div>
          <div className="clipboard-item-footer">
            <span className="clipboard-item-time">{formatDate(item.timestamp)}</span>
            <div className="clipboard-item-actions-footer">
              <button 
                className="clipboard-item-pin" 
                onClick={handleTogglePinned}
                title={item.pinned ? "取消置顶" : "置顶"}
              >
                {item.pinned ? 
                  <StarIconSolid className="pin-icon pinned" /> : 
                  <StarIconOutline className="pin-icon" />
                }
              </button>
              <button 
                className="clipboard-item-more" 
                onClick={handleMoreClick}
                title="更多操作"
              >
                <EllipsisHorizontalIcon className="more-icon" />
              </button>
            </div>
          </div>
        </div>
        
        {/* 操作按钮区域 */}
        <div className="clipboard-item-actions">
          <button 
            className="action-button copy-button" 
            onClick={handleCopy}
            title="复制"
          >
            <ClipboardDocumentCheckIcon className="action-icon" />
            <span>复制</span>
          </button>
          <button 
            className="action-button delete-button" 
            onClick={handleDelete}
            title="删除"
          >
            <TrashIcon className="action-icon" />
            <span>删除</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClipboardItem; 