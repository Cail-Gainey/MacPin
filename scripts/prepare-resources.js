/**
 * @file prepare-resources.js
 * @description 准备应用资源文件的脚本
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

const fs = require('fs');
const path = require('path');

// 资源目录
const resourcesDir = path.join(__dirname, '../resources');

// 确保资源目录存在
if (!fs.existsSync(resourcesDir)) {
  console.log(`创建资源目录: ${resourcesDir}`);
  fs.mkdirSync(resourcesDir, { recursive: true });
}

// 检查图标文件
const iconPath = path.join(resourcesDir, 'icon.png');
const iconIcnsPath = path.join(resourcesDir, 'icon.icns');

if (!fs.existsSync(iconPath)) {
  console.warn(`警告: 图标文件不存在: ${iconPath}`);
  console.log('请确保在resources目录中放置icon.png文件');
} else {
  console.log(`图标文件已存在: ${iconPath}`);
}

if (!fs.existsSync(iconIcnsPath)) {
  console.warn(`警告: macOS图标文件不存在: ${iconIcnsPath}`);
  console.log('请确保在resources目录中放置icon.icns文件');
} else {
  console.log(`macOS图标文件已存在: ${iconIcnsPath}`);
}

console.log('资源文件检查完成'); 