import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isElectron = mode === 'electron'

  return {
    plugins: [
      vue(),

      // 仅在Electron模式下启用插件
      isElectron && electron({
        entry: 'electron/main.js',
      }),

      isElectron && renderer(),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    build: {
      // 防止源码映射生成
      sourcemap: mode !== 'production',
    },
    // 防止vite清空控制台
    clearScreen: false,
  }
})