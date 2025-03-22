import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import Store from 'electron-store'

// 获取__dirname的等效值
const __dirname = fileURLToPath(new URL('.', import.meta.url))

// 创建持久化存储
const store = new Store()

// 初始化配置
if (!store.has('settings')) {
    store.set('settings', {
        entranceTime: new Date().getFullYear() - 4,
        timeTable: 0,
        showAllLesson: true,
        hideFinishLesson: false,
        hideTeacher: true,
        lockLesson: false
    })
}

// 保持对窗口对象的全局引用，如果不这样做，
// 当JavaScript对象被垃圾回收，窗口将自动关闭
let mainWindow

function createWindow() {
    // 创建浏览器窗口
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        }
    })

    // 加载应用
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
        // 开发模式下打开开发者工具
        mainWindow.webContents.openDevTools()
    } else {
        // 生产模式下加载打包后的index.html
        mainWindow.loadFile(path.join(process.env.DIST, 'index.html'))
    }
}

// 应用准备就绪时创建窗口
app.whenReady().then(() => {
    createWindow()

    app.on('activate', function () {
        // 在macOS上，当点击dock图标并且没有其他窗口打开时，通常会重新创建一个窗口
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// 当所有窗口都关闭时退出，除了在macOS上
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

// IPC通信
ipcMain.handle('get-store-value', (event, key) => {
    return store.get(key)
})

ipcMain.handle('set-store-value', (event, key, value) => {
    store.set(key, value)
    return true
})