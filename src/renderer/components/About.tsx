import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import iconImage from '../assets/icon.png';
import '../styles/About.css';

/**
 * @file About.tsx
 * @description 应用关于页面组件
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

interface AboutProps {
  onClose: () => void;
}

const About: React.FC<AboutProps> = ({ onClose }) => {
  return (
    <div className="about-page">
      <div className="about-container">
        <div className="about-header">
          <h2>关于 MacPins</h2>
          <button 
            className="about-close-button" 
            onClick={onClose}
            title="关闭"
          >
            <XMarkIcon className="about-close-icon" />
          </button>
        </div>
        
        <div className="about-content">
          <div className="about-logo">
            <img src={iconImage} alt="MacPins Logo" />
          </div>
          
          <div className="about-info">
            <h3>MacPins 剪贴板管理工具</h3>
            <p className="about-version">版本 1.0.0</p>
            <p className="about-description">
              MacPins 是一个简洁高效的剪贴板历史管理工具，帮助您快速访问和管理复制过的内容。
            </p>
            <p className="about-copyright">
              © Cail Gainey
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About; 