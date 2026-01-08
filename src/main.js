import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
// 导入BigInteger库
import { BigInteger } from 'jsbn'
// 导入学校配置服务
import schoolService from './services/schoolService'

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

// 配置应用插件
app.use(router)
app.use(ElementPlus, { size: 'default' })

/**
 * 初始化应用
 * 在挂载前完成学校配置服务的初始化
 */
const initApp = async () => {
    try {
        // 初始化学校配置服务
        await schoolService.init()
        console.log(`[App] 学校配置已加载: ${schoolService.schoolName}`)
        console.log(`[App] 当前学校ID: ${schoolService.currentSchoolId}`)
    } catch (error) {
        console.error('[App] 学校配置初始化失败，使用默认配置:', error)
        // 失败时 schoolService 内部会回退到默认配置
    } finally {
        // 无论成功失败都挂载应用
        app.mount('#app')
        console.log('[App] 应用已挂载')
    }
}

// 执行初始化
initApp()

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
