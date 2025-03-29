// electron/main.js
import { app, BrowserWindow, ipcMain, shell } from 'electron';
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
    ipcMain.handle('eas:request', async (event, args) => {
        try {
            const { method, url, data, cookies, headers = {} } = args;

            // 创建请求头
            const requestHeaders = { ...headers };

            // 添加 Cookie
            if (cookies && cookies.length > 0) {
                requestHeaders.Cookie = cookies.join('; ');
            }

            // 记录详细请求信息以便调试
            console.log(`[主进程] 请求详情:`, {
                method,
                url,
                headers: requestHeaders,
                dataType: data ? typeof data : 'none'
            });

            // 准备请求选项
            const options = {
                method: method,
                headers: requestHeaders,
                redirect: 'manual'
            };

            // 如果是 POST 请求，添加数据
            if (method === 'POST' && data) {
                // 检查Content-Type
                if (headers['Content-Type'] === 'application/x-www-form-urlencoded') {
                    // 处理表单数据
                    if (typeof data === 'string') {
                        // 如果数据已经是字符串格式，直接使用
                        options.body = data;
                        console.log(`[主进程] 使用原始表单数据: ${data.substring(0, 100)}${data.length > 100 ? '...' : ''}`);
                    } else {
                        // 将对象转换为表单数据
                        try {
                            const params = new URLSearchParams();
                            for (const key in data) {
                                params.append(key, data[key]);
                            }
                            options.body = params.toString();
                            console.log(`[主进程] 已转换表单数据: ${options.body.substring(0, 100)}${options.body.length > 100 ? '...' : ''}`);
                        } catch (e) {
                            console.error(`[主进程] 表单数据转换错误:`, e);
                            throw new Error(`表单数据转换错误: ${e.message}`);
                        }
                    }
                } else if (headers['Content-Type'] && headers['Content-Type'].includes('application/json')) {
                    // JSON数据
                    try {
                        options.body = typeof data === 'string' ? data : JSON.stringify(data);
                        console.log(`[主进程] JSON数据: ${options.body.substring(0, 100)}${options.body.length > 100 ? '...' : ''}`);
                    } catch (e) {
                        console.error(`[主进程] JSON数据转换错误:`, e);
                        throw new Error(`JSON数据转换错误: ${e.message}`);
                    }
                } else {
                    // 默认使用FormData
                    try {
                        const formData = new FormData();
                        for (const key in data) {
                            formData.append(key, data[key]);
                        }
                        options.body = formData;
                        console.log(`[主进程] 使用FormData`);

                        // 注意：node-fetch的FormData不一定有getBoundary方法
                        // 让 node-fetch 自动处理Content-Type
                        delete requestHeaders['Content-Type'];
                    } catch (e) {
                        console.error(`[主进程] FormData创建错误:`, e);
                        throw new Error(`FormData创建错误: ${e.message}`);
                    }
                }
            }

            // 执行请求
            console.log(`[主进程] 发送${method}请求: ${url}`);

            // 捕获任何网络错误
            let response;
            try {
                response = await fetch(url, options);
            } catch (fetchError) {
                console.error(`[主进程] 网络请求错误:`, fetchError);
                throw new Error(`网络请求错误: ${fetchError.message}`);
            }

            // 获取响应内容
            let responseData;
            try {
                responseData = await response.text();
            } catch (e) {
                console.error(`[主进程] 响应内容读取错误:`, e);
                responseData = '';
            }

            // 获取设置的 Cookie
            const responseCookies = response.headers.raw()['set-cookie'] || [];
            console.log(`[主进程] 响应状态: ${response.status}`);
            if (responseCookies.length > 0) {
                console.log(`[主进程] 收到Cookie: ${responseCookies.length}个`);
                console.log(`[主进程] Cookie内容:`, responseCookies);
            }

            // 特殊处理302重定向状态码
            const isLoginRedirect = method === 'POST' && url.includes('login') && response.status === 302;
            const isLoginSuccess = isLoginRedirect && !response.headers.get('location')?.includes('login');

            console.log(`[主进程] 是否为登录重定向: ${isLoginRedirect}, 登录是否成功: ${isLoginSuccess}`);

            return {
                success: (response.status >= 200 && response.status < 300) || isLoginSuccess,
                status: response.status,
                data: responseData,
                cookies: responseCookies,
                headers: Object.fromEntries(response.headers.entries()),
                location: response.headers.get('location')
            };
        } catch (error) {
            console.error('[主进程] eas:request 错误:', error);
            return {
                success: false,
                error: error.message,
                errorDetails: {
                    name: error.name,
                    stack: error.stack,
                    code: error.code
                }
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

    // 打开外部链接
    ipcMain.handle('open-external-url', async (event, url) => {
        try {
            // 使用shell.openExternal在系统默认浏览器中打开URL
            await shell.openExternal(url, { activate: true });
            return true;
        } catch (error) {
            console.error('打开URL失败:', error);
            return false;
        }
    });

    // 处理检查GitHub最新版本的请求
    ipcMain.handle('check-github-release', async () => {
        try {
            // 发送请求到GitHub API获取最新的release信息
            const response = await fetch('https://api.github.com/repos/shizhihen2003/UJN-Assistant-Electron/releases/latest');

            // 检查API请求是否成功
            if (!response.ok) {
                throw new Error(`GitHub API响应错误: ${response.status}`);
            }

            // 解析响应JSON数据
            const releaseData = await response.json();

            // 提取版本号并移除前缀'v'（如果有）
            const latestVersion = releaseData.tag_name.replace('v', '');

            // 获取当前应用版本号
            const currentVersion = app.getVersion();

            // 返回版本比较结果和相关信息
            return {
                hasUpdate: compareVersions(latestVersion, currentVersion) > 0, // 是否有更新版本
                currentVersion: currentVersion,                                // 当前版本
                latestVersion: latestVersion,                                  // 最新版本
                releaseUrl: releaseData.html_url,                              // 发布页面URL
                releaseNotes: releaseData.body                                 // 发布说明
            };
        } catch (error) {
            // 记录错误并返回失败状态
            console.error('检查GitHub更新失败:', error);
            return {
                hasUpdate: false,
                error: error.message
            };
        }
    });
}

// 版本比较函数：比较两个版本号的大小
// 返回值: 1(a>b), -1(a<b), 0(a=b)
function compareVersions(a, b) {
    // 将版本号按点分割并转换为数字数组
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);

    // 遍历版本号的每一部分进行比较
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        // 如果某个版本号部分不存在，视为0
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;

        // 比较当前部分的值
        if (aVal > bVal) return 1;   // a版本更新
        if (aVal < bVal) return -1;  // b版本更新
    }

    return 0; // 版本相同
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