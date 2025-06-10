import { defineConfig } from 'electron-vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

/**
 * @file electron.vite.config.ts
 * @description Electron Vite 配置文件
 * @author Cail Gainey <cailgainey@foxmail.com>
 */

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['@electron/remote'],
      },
      outDir: 'dist/main',
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          preferences: resolve(__dirname, 'src/preload/preferences.ts'),
        },
        external: ['@electron/remote'],
      },
      outDir: 'dist/preload',
    },
  },
  renderer: {
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
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          preferences: resolve(__dirname, 'src/renderer/preferences.html'),
        },
      },
      outDir: 'dist/renderer',
    },
    plugins: [react()],
  },
}); 