import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useClipboardStore } from '../store/clipboardStore';
import { ClipboardItem as ClipboardItemType } from '../types/electron';
import '../styles/ClipboardHistory.css';

/**
 * @file ClipboardHistory.tsx
 * @description 剪贴板历史列表组件，使用虚拟列表优化性能
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

// 导入ClipboardItem组件
const ClipboardItem = React.lazy(() => import('./ClipboardItem'));

// 虚拟列表配置
const ITEM_HEIGHT = 150; // 估计的每个项目高度（像素）
const BUFFER_SIZE = 5; // 可视区域外的缓冲项目数量

const ClipboardHistory: React.FC = () => {
  const { clipboardHistory } = useClipboardStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const [scrollTop, setScrollTop] = useState(0);
  
  // 计算可见项目范围
  const calculateVisibleRange = useCallback(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    
    // 计算可见范围内的起始和结束索引
    let start = Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE;
    let end = Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER_SIZE;
    
    // 确保索引在有效范围内
    start = Math.max(0, start);
    end = Math.min(clipboardHistory.length, end);
    
    setVisibleRange({ start, end });
    setScrollTop(scrollTop);
  }, [clipboardHistory.length]);
  
  // 监听滚动事件
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    // 初始计算可见范围
    calculateVisibleRange();
    
    // 添加滚动事件监听器
    const handleScroll = () => {
      // 使用requestAnimationFrame减少滚动时的计算频率
      window.requestAnimationFrame(calculateVisibleRange);
    };
    
    container.addEventListener('scroll', handleScroll);
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [calculateVisibleRange]);
  
  // 当剪贴板历史变化时重新计算可见范围
  useEffect(() => {
    calculateVisibleRange();
  }, [clipboardHistory, calculateVisibleRange]);

  if (clipboardHistory.length === 0) {
    return (
      <div className="clipboard-empty">
        <p>剪贴板历史为空</p>
        <p className="clipboard-empty-hint">复制内容后将显示在这里</p>
      </div>
    );
  }

  // 计算总内容高度
  const totalHeight = clipboardHistory.length * ITEM_HEIGHT;
  
  // 计算可见项目的偏移量
  const offsetTop = visibleRange.start * ITEM_HEIGHT;
  
  // 获取可见范围内的项目
  const visibleItems = clipboardHistory.slice(visibleRange.start, visibleRange.end);

  return (
    <div 
      ref={containerRef}
      className="clipboard-history"
    >
      <div 
        className="clipboard-history-content"
        style={{ height: `${totalHeight}px`, position: 'relative' }}
      >
        <div 
          className="clipboard-history-items"
          style={{ 
            position: 'absolute',
            top: `${offsetTop}px`,
            left: 0,
            right: 0
          }}
        >
          <React.Suspense fallback={<div>加载中...</div>}>
            {visibleItems.map((item: ClipboardItemType) => (
              <ClipboardItem key={item.id} item={item} />
            ))}
          </React.Suspense>
        </div>
      </div>
    </div>
  );
};

export default ClipboardHistory; 