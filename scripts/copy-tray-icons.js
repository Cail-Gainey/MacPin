/**
 * 复制托盘图标到构建目录
 * @author Cail Gainey <cailgainey@foxmail.com>
 */
const fs = require('fs');
const path = require('path');

// 确保目标目录存在
const targetDir = path.join(__dirname, '../dist/main/assets');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`创建目录: ${targetDir}`);
}

// 复制托盘图标
const resourcesDir = path.join(__dirname, '../resources');
const iconFiles = fs.readdirSync(resourcesDir).filter(file => 
  (file.startsWith('tray') || file === 'icon.png') && 
  (file.endsWith('.png') || file.endsWith('.ico'))
);

if (iconFiles.length === 0) {
  console.log('警告: 未找到托盘图标文件');
} else {
  iconFiles.forEach(file => {
    const sourcePath = path.join(resourcesDir, file);
    const targetPath = path.join(targetDir, file);
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`复制图标: ${file} -> ${targetPath}`);
  });
  console.log(`成功复制 ${iconFiles.length} 个托盘图标文件`);
} 