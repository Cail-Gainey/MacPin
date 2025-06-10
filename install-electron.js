/**
 * @file install-electron.js
 * @description Electron安装脚本
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

const { execSync } = require('child_process');

// 设置环境变量
process.env.ELECTRON_MIRROR = 'https://registry.npmmirror.com/-/binary/electron/';
process.env.ELECTRON_BUILDER_BINARIES_MIRROR = 'https://registry.npmmirror.com/-/binary/electron-builder-binaries/';

console.log('开始安装Electron...');
console.log('使用镜像: ' + process.env.ELECTRON_MIRROR);

try {
  // 先尝试安装cnpm
  console.log('安装cnpm...');
  execSync('npm install -g cnpm --registry=https://registry.npmmirror.com', { stdio: 'inherit' });
  
  // 使用cnpm安装electron
  console.log('使用cnpm安装electron...');
  execSync('cnpm install electron@25.8.4 --save-dev', { stdio: 'inherit' });
  
  console.log('Electron安装成功!');
} catch (error) {
  console.error('Electron安装失败:', error);
  process.exit(1);
} 