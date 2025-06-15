/**
 * @file clipboardItem.ts
 * @description 剪贴板项目类型定义
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

/**
 * 剪贴板项目接口
 */
export interface ClipboardItem {
  /** 唯一标识符 */
  id: string;
  /** 项目类型：文本或图片 */
  type: 'text' | 'image';
  /** 内容：文本或图片哈希 */
  content: string;
  /** 时间戳 */
  timestamp: number;
  /** 预览文本 */
  preview: string;
  /** 是否置顶 */
  pinned: boolean;
  /** 图片文件路径（仅图片类型） */
  imagePath?: string;
} 