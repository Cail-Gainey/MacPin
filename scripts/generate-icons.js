/**
 * @file generate-icons.js
 * @description 生成应用图标文件的脚本
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 资源目录
const resourcesDir = path.join(__dirname, '../resources');

// 确保资源目录存在
if (!fs.existsSync(resourcesDir)) {
  console.log(`创建资源目录: ${resourcesDir}`);
  fs.mkdirSync(resourcesDir, { recursive: true });
}

// 源图标文件路径
const sourceIconPath = path.join(resourcesDir, 'icon.png');

// 检查源图标是否存在
if (!fs.existsSync(sourceIconPath)) {
  console.error(`错误: 源图标文件不存在: ${sourceIconPath}`);
  console.log('请确保在resources目录中放置icon.png文件');
  process.exit(1);
}

// 创建临时目录
const tempDir = path.join(__dirname, '../temp-iconset');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
} else {
  // 清空临时目录
  fs.readdirSync(tempDir).forEach(file => {
    fs.unlinkSync(path.join(tempDir, file));
  });
}

try {
  console.log('开始生成macOS图标文件...');
  
  // 检查是否安装了sips和iconutil (macOS工具)
  try {
    execSync('which sips', { stdio: 'ignore' });
    execSync('which iconutil', { stdio: 'ignore' });
  } catch (error) {
    console.error('错误: 需要macOS的sips和iconutil工具');
    console.log('此脚本只能在macOS系统上运行');
    process.exit(1);
  }
  
  // 创建.iconset目录
  const iconsetDir = path.join(resourcesDir, 'icon.iconset');
  if (fs.existsSync(iconsetDir)) {
    // 清空目录
    fs.readdirSync(iconsetDir).forEach(file => {
      fs.unlinkSync(path.join(iconsetDir, file));
    });
  } else {
    fs.mkdirSync(iconsetDir, { recursive: true });
  }
  
  // 定义标准iconset尺寸和文件名 (Apple官方规范)
  const iconsetSizes = [
    { size: 16, scale: 1, name: 'icon_16x16.png' },
    { size: 16, scale: 2, name: 'icon_16x16@2x.png' },
    { size: 32, scale: 1, name: 'icon_32x32.png' },
    { size: 32, scale: 2, name: 'icon_32x32@2x.png' },
    { size: 128, scale: 1, name: 'icon_128x128.png' },
    { size: 128, scale: 2, name: 'icon_128x128@2x.png' },
    { size: 256, scale: 1, name: 'icon_256x256.png' },
    { size: 256, scale: 2, name: 'icon_256x256@2x.png' },
    { size: 512, scale: 1, name: 'icon_512x512.png' },
    { size: 512, scale: 2, name: 'icon_512x512@2x.png' }
  ];
  
  // 为每个尺寸创建图标
  iconsetSizes.forEach(({ size, scale, name }) => {
    const pixelSize = size * scale;
    const outputPath = path.join(iconsetDir, name);
    
    console.log(`生成 ${name} (${pixelSize}x${pixelSize}像素)...`);
    
    // 使用sips调整图标大小，添加-s format png确保格式正确
    execSync(`sips -s format png -z ${pixelSize} ${pixelSize} "${sourceIconPath}" --out "${outputPath}"`, {
      stdio: ['ignore', 'inherit', 'inherit']
    });
  });
  
  // 使用iconutil生成.icns文件
  console.log('正在生成.icns文件...');
  execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(resourcesDir, 'icon.icns')}"`, {
    stdio: ['ignore', 'inherit', 'inherit']
  });
  
  console.log(`成功生成macOS图标文件: ${path.join(resourcesDir, 'icon.icns')}`);
  
  // 为DMG封面创建高质量图标 (1024x1024)
  const highResIconPath = path.join(resourcesDir, 'icon-1024.png');
  execSync(`sips -s format png -z 1024 1024 "${sourceIconPath}" --out "${highResIconPath}"`, {
    stdio: ['ignore', 'inherit', 'inherit']
  });
  console.log(`已创建高分辨率图标: ${highResIconPath}`);
  
  // 清理临时文件
  if (fs.existsSync(tempDir)) {
    fs.readdirSync(tempDir).forEach(file => {
      fs.unlinkSync(path.join(tempDir, file));
    });
    fs.rmdirSync(tempDir);
  }
  
} catch (error) {
  console.error('生成图标文件时出错:', error);
  process.exit(1);
}

console.log('图标生成完成'); 