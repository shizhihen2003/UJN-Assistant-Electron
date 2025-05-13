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

// 改进 main.js 中的 store:set 处理函数
    ipcMain.handle('store:set', async (event, key, value) => {
        try {
            // 详细记录接收数据情况
            console.log(`[主进程] store:set - 接收键: ${key}`);
            console.log(`[主进程] store:set - 接收值类型: ${typeof value}`);

            // 空值检查
            if (value === null || value === undefined) {
                console.log(`[主进程] store:set - 收到空值: ${key}`);
                store.delete(key);
                return true;
            }

            // 更详细的日志，仅当值是对象时
            if (typeof value === 'object' && value !== null) {
                console.log(`[主进程] store:set - 对象键: ${Object.keys(value).join(', ')}`);

                // 对话数据特殊处理
                if (key.startsWith('ai_conversation_') && value.messages) {
                    console.log(`[主进程] store:set - 消息数量: ${value.messages.length}`);
                }
            }

            // 尝试序列化再反序列化，确保数据可以安全传输
            let processedValue;
            try {
                const serialized = JSON.stringify(value);
                console.log(`[主进程] store:set - 序列化数据长度: ${serialized.length}`);
                processedValue = JSON.parse(serialized);
            } catch (serializeError) {
                console.error(`[主进程] store:set - 序列化错误: ${serializeError.message}`);
                return false;
            }

            // 保存到store
            store.set(key, processedValue);

            // 验证保存结果
            const saved = store.get(key);
            if (saved === undefined) {
                console.warn(`[主进程] store:set - 验证失败: ${key} 未成功存储`);
                return false;
            }

            console.log(`[主进程] store:set - 成功: ${key}`);
            return true;
        } catch (error) {
            console.error('[主进程] store:set 错误:', error);
            return false;
        }
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
            const requestId = Date.now().toString(36); // 请求ID，用于跟踪

            // 创建请求头
            const requestHeaders = { ...headers };

            // 添加 Cookie
            if (cookies && cookies.length > 0) {
                requestHeaders.Cookie = cookies.join('; ');
            }

            // 记录详细请求信息以便调试
            console.log(`[主进程 ${requestId}] ipass:request 请求详情:`, {
                method,
                url,
                headers: requestHeaders,
                dataType: data ? typeof data : 'none'
            });

            // URL分析和记录
            try {
                const urlObj = new URL(url);
                // 检查并记录查询参数
                if (urlObj.search) {
                    console.log(`[主进程 ${requestId}] URL查询参数:`, urlObj.search);
                    // 特别记录ticket参数
                    if (urlObj.searchParams.has('ticket')) {
                        console.log(`[主进程 ${requestId}] 发现ticket参数:`, urlObj.searchParams.get('ticket'));
                    }
                }
            } catch (e) {
                console.log(`[主进程 ${requestId}] URL解析失败:`, e.message);
            }

            // 特殊处理token-login请求
            if (url.includes('token-login')) {
                console.log(`[主进程 ${requestId}] 检测到token-login请求: ${url}`);

                try {
                    // 提取token参数
                    const tokenMatch = url.match(/token=([^&]+)/);
                    if (tokenMatch) {
                        console.log(`[主进程 ${requestId}] 提取到token: ${tokenMatch[1]}`);
                    }

                    // 修改请求选项以适应token-login
                    options.redirect = 'manual'; // 保持手动重定向模式
                    options.timeout = 10000; // 增加超时时间

                    // 确保所有Cookie都被发送
                    console.log(`[主进程 ${requestId}] Cookie数量: ${cookies?.length || 0}`);
                    if (cookies && cookies.length > 0) {
                        // 记录每个Cookie
                        cookies.forEach((cookie, idx) => {
                            console.log(`[主进程 ${requestId}] Cookie ${idx+1}: ${cookie.substring(0, 50)}...`);
                        });
                    }
                } catch (error) {
                    console.warn(`[主进程 ${requestId}] token-login参数处理错误:`, error);
                }
            }

            // 准备请求选项
            const options = {
                method: method,
                headers: requestHeaders,
                // 修改：默认允许最多3次重定向，除非显式指定
                redirect: 'manual'
            };

            // 如果是 POST 请求，添加数据
            if (method === 'POST' && data) {
                // 检查内容类型
                if (headers['Content-Type'] === 'application/x-www-form-urlencoded') {
                    console.log(`[主进程 ${requestId}] 处理表单数据，类型: ${typeof data}`);

                    if (typeof data === 'string') {
                        // 已经是字符串格式，直接使用
                        options.body = data;
                        console.log(`[主进程 ${requestId}] 使用原始表单数据: ${data.substring(0, 100)}${data.length > 100 ? '...' : ''}`);
                    } else if (typeof data === 'object') {
                        // 将对象转换为表单数据
                        try {
                            const params = new URLSearchParams();
                            for (const key in data) {
                                params.append(key, data[key]);
                            }
                            options.body = params.toString();
                            console.log(`[主进程 ${requestId}] 转换对象为表单数据: ${options.body.substring(0, 100)}${options.body.length > 100 ? '...' : ''}`);
                        } catch (e) {
                            console.error(`[主进程 ${requestId}] 表单数据转换错误:`, e);
                            throw new Error(`表单数据转换错误: ${e.message}`);
                        }
                    }
                } else if (headers['Content-Type'] && headers['Content-Type'].includes('application/json')) {
                    // JSON数据
                    try {
                        options.body = typeof data === 'string' ? data : JSON.stringify(data);
                        console.log(`[主进程 ${requestId}] JSON数据: ${options.body.substring(0, 100)}${options.body.length > 100 ? '...' : ''}`);
                    } catch (e) {
                        console.error(`[主进程 ${requestId}] JSON数据转换错误:`, e);
                        throw new Error(`JSON数据转换错误: ${e.message}`);
                    }
                } else {
                    // 使用传统表单数据处理
                    try {
                        if (typeof data === 'string') {
                            // 如果数据已经是字符串，直接使用
                            options.body = data;
                            console.log(`[主进程 ${requestId}] 使用原始数据字符串: ${data.substring(0, 100)}${data.length > 100 ? '...' : ''}`);
                        } else {
                            // 对象转换
                            const formData = new FormData();
                            for (const key in data) {
                                formData.append(key, data[key]);
                            }
                            options.body = formData;
                            console.log(`[主进程 ${requestId}] 创建FormData成功`);

                            // 删除Content-Type以便node-fetch自动设置
                            delete requestHeaders['Content-Type'];
                        }
                    } catch (e) {
                        console.error(`[主进程 ${requestId}] 表单数据处理错误:`, e);
                        throw new Error(`表单数据处理错误: ${e.message}`);
                    }
                }
            }

            // 执行请求
            console.log(`[主进程 ${requestId}] 发送${method}请求: ${url}`);

            // 捕获任何网络错误
            let response;
            try {
                response = await fetch(url, options);
            } catch (fetchError) {
                console.error(`[主进程 ${requestId}] 网络请求错误:`, fetchError);
                throw new Error(`网络请求错误: ${fetchError.message}`);
            }

            // 获取响应内容
            let responseData;
            try {
                responseData = await response.text();
            } catch (e) {
                console.error(`[主进程 ${requestId}] 响应内容读取错误:`, e);
                responseData = '';
            }

            // 获取设置的 Cookie
            const responseCookies = response.headers.raw()['set-cookie'] || [];
            console.log(`[主进程 ${requestId}] 响应状态码: ${response.status}`);
            if (responseCookies.length > 0) {
                console.log(`[主进程 ${requestId}] 收到Cookie: ${responseCookies.length}个`);
                // 详细记录Cookie内容
                responseCookies.forEach((cookie, index) => {
                    console.log(`[主进程 ${requestId}] Cookie ${index + 1}:`, cookie);
                });
            }

            // 处理重定向
            const location = response.headers.get('location');
            if (response.status >= 300 && response.status < 400 && location) {
                console.log(`[主进程 ${requestId}] 重定向到: ${location}`);

                // 分析重定向URL
                try {
                    // 如果location是相对URL，需要转换为绝对URL
                    let fullRedirectUrl = location;
                    if (!location.startsWith('http')) {
                        // 从原始URL解析并组合新URL
                        const originalUrl = new URL(url);
                        if (location.startsWith('/')) {
                            // 绝对路径
                            fullRedirectUrl = `${originalUrl.protocol}//${originalUrl.host}${location}`;
                        } else {
                            // 相对路径
                            const basePath = originalUrl.pathname.split('/').slice(0, -1).join('/');
                            fullRedirectUrl = `${originalUrl.protocol}//${originalUrl.host}${basePath}/${location}`;
                        }
                    }

                    // 解析重定向URL
                    const redirectUrl = new URL(fullRedirectUrl);
                    console.log(`[主进程 ${requestId}] 重定向主机: ${redirectUrl.host}`);
                    console.log(`[主进程 ${requestId}] 重定向路径: ${redirectUrl.pathname}`);

                    // 检查查询参数，特别是ticket
                    if (redirectUrl.search) {
                        console.log(`[主进程 ${requestId}] 重定向查询参数: ${redirectUrl.search}`);
                        for (const [key, value] of redirectUrl.searchParams.entries()) {
                            console.log(`[主进程 ${requestId}] 参数 ${key}: ${value}`);
                        }
                    }
                } catch (e) {
                    console.error(`[主进程 ${requestId}] 重定向URL解析失败:`, e);
                }
            }

            // 特殊处理302重定向状态码
            const isLoginRedirect = method === 'POST' && url.includes('login') && response.status === 302;
            const isLoginSuccess = isLoginRedirect && (!location?.includes('login') || location?.includes('ticket='));

            // 特殊处理ticket参数和token参数
            const hasTicket = location?.includes('ticket=');
            const isTokenLogin = location?.includes('token-login') ||
                url.includes('token-login');

            console.log(`[主进程 ${requestId}] 是否为登录重定向: ${isLoginRedirect}, 登录是否成功: ${isLoginSuccess}`);
            console.log(`[主进程 ${requestId}] 包含ticket: ${hasTicket}, 是否token-login: ${isTokenLogin}`);

            // 修改返回值判断逻辑
            return {
                success: (response.status >= 200 && response.status < 300) ||
                    (response.status === 302 && (isLoginSuccess || hasTicket || isTokenLogin || method === 'POST')),
                status: response.status,
                data: responseData,
                cookies: responseCookies,
                headers: Object.fromEntries(response.headers.entries()),
                location: location,
                requestId: requestId // 返回请求ID方便跟踪
            };
        } catch (error) {
            console.error('[主进程] ipass:request 处理错误:', error);

            // 提供更详细的错误信息
            let errorMessage = error.message || '未知错误';
            let errorDetails = {
                name: error.name,
                stack: error.stack,
                code: error.code
            };

            // 网络错误特殊处理
            if (error.code === 'ECONNREFUSED') {
                errorMessage = `连接被拒绝 (${url})`;
                console.error('[主进程] 连接被拒绝，服务器可能未启动或不可达');
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = `找不到主机 (${url})`;
                console.error('[主进程] DNS解析失败，域名可能错误或网络未连接');
            } else if (error.code === 'ETIMEDOUT') {
                errorMessage = `连接超时 (${url})`;
                console.error('[主进程] 连接超时，服务器响应过慢或网络问题');
            }

            // 重定向错误特殊处理
            if (error.message && error.message.includes('maxRedirects')) {
                errorMessage = `重定向次数过多 (${url})`;
                console.error('[主进程] 重定向循环或重定向链过长');
            }

            return {
                success: false,
                error: errorMessage,
                errorDetails: errorDetails
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

    // 获取所有键的处理器
    ipcMain.handle('store:getAllKeys', async (event, prefix = '') => {
        try {
            let keys = store.store ? Object.keys(store.store) : [];

            // 如果提供了前缀，进行过滤
            if (prefix) {
                keys = keys.filter(key => key.startsWith(prefix));
            }

            return keys;
        } catch (error) {
            console.error('获取所有键失败:', error);
            return [];
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