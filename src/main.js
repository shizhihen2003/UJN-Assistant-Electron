import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
// 导入BigInteger库
import { BigInteger } from 'jsbn'

// 暂时注释掉样式文件的引入，因为该文件还不存在
// import './assets/styles/index.scss'

// 创建Vue应用实例
const app = createApp(App)

// 注册所有ElementPlus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}

// 注册全局属性和方法
app.config.globalProperties.$electron = window.electron
app.config.globalProperties.$ipcRenderer = window.ipcRenderer

// 使其全局可用
window.BigInteger = BigInteger

// 错误处理
app.config.errorHandler = (err, vm, info) => {
    console.error('Vue Error:', err)
    console.error('Info:', info)
}

// 挂载应用
app.use(router)
    .use(ElementPlus, { size: 'default' })
    .mount('#app')

// 防止拖拽文件到应用窗口
document.addEventListener('dragover', (e) => {
    e.preventDefault()
    return false
}, false)

document.addEventListener('drop', (e) => {
    e.preventDefault()
    return false
}, false)

// 处理来自主进程的消息
window.ipcRenderer?.on('app-update', (event, message) => {
    console.log('Update message from main process:', message)
})