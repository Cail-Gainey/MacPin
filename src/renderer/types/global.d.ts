/**
 * @file global.d.ts
 * @description 全局类型声明
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

declare module 'zustand' {
  export function create<T>(initializer: (set: any, get: any) => T): () => T;
}

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
} 