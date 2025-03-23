// electron/main.js
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import FormData from 'form-data';
import Store from 'electron-store';

// 获取__dirname的替代方法（ES模块中不存在__dirname）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建存储实例
const store = new Store();

// 创建主窗口
function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        titleBarStyle: 'hidden',
        frame: false
    });

    // 加载应用
    if (app.isPackaged) {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    } else {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }

    return mainWindow;
}

// 设置 IPC 处理程序
function setupIPC() {
    // 窗口控制
    ipcMain.on('window:minimize', (event) => {
        BrowserWindow.fromWebContents(event.sender).minimize();
    });

    ipcMain.on('window:maximize', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window.isMaximized()) {
            window.unmaximize();
        } else {
            window.maximize();
        }
    });

    ipcMain.on('window:close', (event) => {
        BrowserWindow.fromWebContents(event.sender).close();
    });

    // 版本信息
    ipcMain.handle('app:version', () => {
        return app.getVersion();
    });

    // 存储相关
    ipcMain.handle('store:get', (event, key) => {
        return store.get(key);
    });

    ipcMain.handle('store:set', (event, key, value) => {
        store.set(key, value);
        return true;
    });

    ipcMain.handle('store:has', (event, key) => {
        return store.has(key);
    });

    ipcMain.handle('store:delete', (event, key) => {
        store.delete(key);
        return true;
    });

    ipcMain.handle('store:clear', () => {
        store.clear();
        return true;
    });

    // 统一的 EAS 请求处理函数
    // 统一的 EAS 请求处理函数
    ipcMain.handle('eas:request', async (event, args) => {
        try {
            const { method, url, data, cookies, headers = {} } = args;

            // 创建请求头
            const requestHeaders = { ...headers };

            // 添加 Cookie
            if (cookies && cookies.length > 0) {
                requestHeaders.Cookie = cookies.join('; ');
            }

            // 准备请求选项
            const options = {
                method: method,
                headers: requestHeaders,
                redirect: 'manual'
            };

            // 如果是 POST 请求，添加表单数据
            if (method === 'POST' && data) {
                // 检查Content-Type
                if (headers['Content-Type'] === 'application/x-www-form-urlencoded') {
                    // 如果是表单提交，确保数据是字符串格式
                    if (typeof data !== 'string') {
                        const params = new URLSearchParams();
                        for (const key in data) {
                            params.append(key, data[key]);
                        }
                        options.body = params.toString();
                        console.log(`[主进程] 已转换表单数据: ${options.body}`);
                    } else {
                        options.body = data;
                    }
                } else {
                    // 默认使用FormData
                    const formData = new FormData();
                    for (const key in data) {
                        formData.append(key, data[key]);
                    }
                    options.body = formData;

                    // 添加表单头部
                    if (formData.getBoundary) {
                        requestHeaders['Content-Type'] = `multipart/form-data; boundary=${formData.getBoundary()}`;
                    }
                }
            }

            // 执行请求
            console.log(`[主进程] 发送${method}请求: ${url}`);
            console.log(`[主进程] 请求头: ${JSON.stringify(requestHeaders)}`);
            if (options.body) {
                console.log(`[主进程] 请求数据: ${typeof options.body === 'string' ? options.body : '(FormData)'}`);
            }

            const response = await fetch(url, options);

            // 获取响应内容
            let responseData;
            try {
                responseData = await response.text();
            } catch (e) {
                responseData = '';
            }

            // 获取设置的 Cookie
            const responseCookies = response.headers.raw()['set-cookie'] || [];
            console.log(`[主进程] 响应状态: ${response.status}`);
            if (responseCookies.length > 0) {
                console.log(`[主进程] 收到Cookie: ${responseCookies.length}个`);
            }

            // 确定请求是否成功
            let success = response.status >= 200 && response.status < 300;

            // POST 登录请求的特殊处理
            if (method === 'POST' && url.includes('login') && response.status === 302) {
                success = !response.headers.get('location')?.includes('login');
            }

            return {
                success,
                status: response.status,
                data: responseData,
                cookies: responseCookies,
                headers: Object.fromEntries(response.headers.entries()),
                location: response.headers.get('location')
            };
        } catch (error) {
            console.error('eas:request error', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // 统一的 IPASS 请求处理函数
    ipcMain.handle('ipass:request', async (event, args) => {
        try {
            const { method, url, data, cookies, headers = {} } = args;

            // 创建请求头
            const requestHeaders = { ...headers };

            // 添加 Cookie
            if (cookies && cookies.length > 0) {
                requestHeaders.Cookie = cookies.join('; ');
            }

            // 准备请求选项
            const options = {
                method: method,
                headers: requestHeaders,
                redirect: 'manual'
            };

            // 如果是 POST 请求，添加表单数据
            if (method === 'POST' && data) {
                const formData = new FormData();
                for (const key in data) {
                    formData.append(key, data[key]);
                }

                options.body = formData;
                // 添加表单头部
                if (formData.getBoundary) {
                    requestHeaders['Content-Type'] = `multipart/form-data; boundary=${formData.getBoundary()}`;
                }
            }

            // 执行请求
            const response = await fetch(url, options);

            // 获取响应内容
            let responseData;
            try {
                responseData = await response.text();
            } catch (e) {
                responseData = '';
            }

            // 获取设置的 Cookie
            const responseCookies = response.headers.raw()['set-cookie'] || [];

            // 确定请求是否成功
            let success = response.status >= 200 && response.status < 300;

            // POST 登录请求的特殊处理
            if (method === 'POST' && url.includes('login') && response.status === 302) {
                success = !response.headers.get('location')?.includes('login');
            }

            return {
                success,
                status: response.status,
                data: responseData,
                cookies: responseCookies,
                headers: Object.fromEntries(response.headers.entries()),
                location: response.headers.get('location')
            };
        } catch (error) {
            console.error('ipass:request error', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
}

// 初始化 app©∫
app.whenReady().then(() => {
    const mainWindow = createWindow();
    setupIPC();

    // 在 macOS 上，当点击 dock 图标且没有其他窗口打开时，
    // 通常在应用程序中重新创建一个窗口
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// 当所有窗口关闭时退出应用，除了在 macOS 上
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// 在 macOS 上，用户通常通过 Cmd + Q 显式退出应用程序
app.on('before-quit', () => {
    // 在这里执行应用退出前的清理工作
});