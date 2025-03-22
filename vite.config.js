import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import { fileURLToPath, URL } from 'node:url'
import vitePluginVueDevtools from 'vite-plugin-vue-devtools'

export default defineConfig({
  plugins: [
    vue(),
    vitePluginVueDevtools(),
    electron([
      {
        // 主进程配置
        entry: 'electron/main.js',
      },
      {
        // 预加载脚本配置
        entry: 'electron/preload.js',
        onstart(options) {
          options.reload()
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})