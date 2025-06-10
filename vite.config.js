import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * @file vite.config.js
 * @description Vite配置文件
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer'),
      '@components': resolve('src/renderer/components'),
      '@hooks': resolve('src/renderer/hooks'),
      '@store': resolve('src/renderer/store'),
      '@utils': resolve('src/renderer/utils'),
      '@styles': resolve('src/renderer/styles'),
    },
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html'),
        preferences: resolve(__dirname, 'src/renderer/preferences.html'),
      },
    },
  },
}); 