// src/utils/ipc.js
/**
 * IPC通信封装
 * 提供渲染进程与主进程通信的工具函数
 */
export default {
    /**
     * 获取存储值
     * @param {string} key 键名
     * @param {*} defaultValue 默认值
     * @returns {Promise<*>} 值
     */
    async getStoreValue(key, defaultValue = null) {
        if (!window.electronStore) {
            console.warn('electronStore不可用，使用localStorage替代');
            const value = localStorage.getItem(key);
            return value !== null ? JSON.parse(value) : defaultValue;
        }

        try {
            const value = await window.electronStore.get(key);
            return value !== undefined ? value : defaultValue;
        } catch (error) {
            console.error('获取存储值失败:', error);
            return defaultValue;
        }
    },

    /**
     * 设置存储值
     * @param {string} key 键名
     * @param {*} value 值
     * @returns {Promise<void>}
     */
    async setStoreValue(key, value) {
        if (!window.electronStore) {
            console.warn('electronStore不可用，使用localStorage替代');
            try {
                // 确保值是可以被JSON序列化的
                const serializedValue = JSON.stringify(value);
                localStorage.setItem(key, serializedValue);
            } catch (error) {
                console.error('设置存储值失败:', error);
                // 尝试简化对象，移除可能导致循环引用的属性
                if (typeof value === 'object' && value !== null) {
                    const simplifiedValue = this._simplifyObject(value);
                    localStorage.setItem(key, JSON.stringify(simplifiedValue));
                } else {
                    throw error; // 如果不是对象，则无法简化，抛出原始错误
                }
            }
            return;
        }

        try {
            await window.electronStore.set(key, value);
        } catch (error) {
            console.error('设置存储值失败:', error);
            // 尝试简化对象，移除可能导致循环引用的属性
            if (typeof value === 'object' && value !== null) {
                const simplifiedValue = this._simplifyObject(value);
                await window.electronStore.set(key, simplifiedValue);
            } else {
                throw error; // 如果不是对象，则无法简化，抛出原始错误
            }
        }
    },

    /**
     * 简化对象，移除可能导致循环引用和不可序列化的属性
     * @param {Object} obj 要简化的对象
     * @returns {Object} 简化后的对象
     */
    _simplifyObject(obj) {
        const seen = new WeakSet();

        const simplify = (value) => {
            // 处理基本类型和null
            if (value === null || typeof value !== 'object') {
                return value;
            }

            // 处理数组
            if (Array.isArray(value)) {
                return value.map(item => simplify(item));
            }

            // 处理对象
            if (seen.has(value)) {
                return '[Circular Reference]'; // 避免循环引用
            }

            seen.add(value);

            const result = {};
            for (const key in value) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    try {
                        // 测试属性是否可以被复制
                        const clone = JSON.parse(JSON.stringify({ test: value[key] }));
                        result[key] = simplify(value[key]);
                    } catch (error) {
                        // 如果无法序列化，则跳过该属性
                        result[key] = '[Unserializable]';
                    }
                }
            }

            return result;
        };

        return simplify(obj);
    },

    /**
     * 检查存储值是否存在
     * @param {string} key 键名
     * @returns {Promise<boolean>} 是否存在
     */
    async hasStoreValue(key) {
        if (!window.electronStore) {
            console.warn('electronStore不可用，使用localStorage替代');
            return localStorage.getItem(key) !== null;
        }

        return await window.electronStore.has(key);
    },

    /**
     * 删除存储值
     * @param {string} key 键名
     * @returns {Promise<void>}
     */
    async deleteStoreValue(key) {
        if (!window.electronStore) {
            console.warn('electronStore不可用，使用localStorage替代');
            localStorage.removeItem(key);
            return;
        }

        await window.electronStore.delete(key);
    },

    /**
     * 清空存储
     * @returns {Promise<void>}
     */
    async clearStore() {
        if (!window.electronStore) {
            console.warn('electronStore不可用，使用localStorage替代');
            localStorage.clear();
            return;
        }

        await window.electronStore.clear();
    },

    /**
     * 最小化窗口
     * @returns {Promise<void>}
     */
    async minimizeWindow() {
        if (!window.electron) {
            console.warn('electron不可用');
            return;
        }

        window.electron.minimize();
    },

    /**
     * 最大化/还原窗口
     * @returns {Promise<void>}
     */
    async maximizeWindow() {
        if (!window.electron) {
            console.warn('electron不可用');
            return;
        }

        window.electron.maximize();
    },

    /**
     * 关闭窗口
     * @returns {Promise<void>}
     */
    async closeWindow() {
        if (!window.electron) {
            console.warn('electron不可用');
            return;
        }

        window.electron.close();
    },

    /**
     * 发送消息到主进程
     * @param {string} channel 通道
     * @param {*} data 数据
     */
    send(channel, data) {
        if (!window.electron) {
            console.warn('electron不可用');
            return;
        }

        window.electron.send(channel, data);
    },

    /**
     * 监听主进程消息
     * @param {string} channel 通道
     * @param {Function} callback 回调函数
     */
    on(channel, callback) {
        if (!window.electron) {
            console.warn('electron不可用');
            return;
        }

        window.electron.on(channel, callback);
    },

    /**
     * 移除监听器
     * @param {string} channel 通道
     */
    removeAllListeners(channel) {
        if (!window.electron) {
            console.warn('electron不可用');
            return;
        }

        window.electron.removeAllListeners(channel);
    },

    /**
     * 发送 EAS 请求 - 通过 IPC 通信
     * @param {string} method 请求方法
     * @param {string} url 请求URL
     * @param {Object} data 请求数据
     * @param {Object} options 请求选项
     * @returns {Promise<Object>} 响应对象
     */
    async easRequest(method, url, data = null, options = {}) {
        try {
            // 确保URL是完整的URL
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                // 如果不是完整URL并且不是相对URL，则报错
                if (!url.includes('/')) {
                    console.error(`[请求错误] 无效的URL: ${url}`);
                    return {
                        success: false,
                        error: `无效的URL: ${url}`
                    };
                }
            }

            console.log(`[网络请求] ${method} ${url}`);
            if (data) {
                console.log("[请求数据]", data);
            }
            console.log("[请求选项]", JSON.stringify(options));

            // 使用 IPC 通信，请求主进程执行网络请求
            if (!window.ipcRenderer) {
                throw new Error('IPC Renderer 不可用，请在 Electron 环境中运行');
            }

            // 处理查询参数
            if (options.params) {
                try {
                    const urlObj = new URL(url);
                    Object.entries(options.params).forEach(([key, value]) => {
                        urlObj.searchParams.append(key, value);
                    });
                    url = urlObj.toString();
                } catch (e) {
                    console.error(`[URL解析错误] ${e.message}, URL: ${url}`);
                    throw new Error(`URL解析错误: ${e.message}`);
                }
            }

            // 处理表单数据
            let processedData = data;
            if (data && options.headers && options.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
                // 将对象转换为URL编码格式
                if (typeof data === 'object' && !(data instanceof URLSearchParams) && !(data instanceof FormData)) {
                    const formData = new URLSearchParams();
                    Object.entries(data).forEach(([key, value]) => {
                        formData.append(key, value);
                    });
                    processedData = formData.toString();
                }
            }

            // 添加默认请求头
            if (!options.headers) {
                options.headers = {};
            }
            // 设置一些默认请求头
            if (!options.headers['User-Agent']) {
                options.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            }

            // 如果有Cookie但没有设置Cookie头
            if (options.cookies && options.cookies.length > 0 && !options.headers['Cookie']) {
                // 将Cookie数组转换为字符串形式
                options.headers['Cookie'] = options.cookies.join('; ');
            }

            // 创建请求参数
            const requestArgs = {
                method,
                url,
                data: processedData,
                cookies: options.cookies || [],
                headers: options.headers
            };

            // 输出详细请求信息以便调试
            console.log("[完整请求信息]", {
                method,
                url,
                dataType: typeof processedData,
                cookiesCount: requestArgs.cookies?.length || 0,
                headers: options.headers
            });

            // 发送请求到主进程
            const response = await window.ipcRenderer.invoke('eas:request', requestArgs);

            // 处理响应
            return this._logResponse(response);
        } catch (error) {
            console.error('[请求失败]', error);
            return {
                success: false,
                error: error.message || '请求失败'
            };
        }
    },

    /**
     * 处理和记录响应 - 改进错误处理版
     * @param {Object} response 响应对象
     * @returns {Object} 响应对象
     */
    _logResponse(response) {
        const requestId = response.requestId || 'unknown';

        if (response.success) {
            console.log(`[响应 ${requestId}] 状态码: ${response.status}`);

            if (response.headers) {
                console.log(`[响应 ${requestId}] 头信息:`, response.headers);
            }

            if (response.location) {
                console.log(`[响应 ${requestId}] 重定向地址: ${response.location}`);

                // 分析重定向URL
                try {
                    const locationURL = new URL(response.location.startsWith('http') ?
                        response.location :
                        `http://example.com/${response.location}`);

                    // 检查重要参数
                    if (locationURL.searchParams.has('ticket')) {
                        console.log(`[响应 ${requestId}] 重定向URL包含ticket: ${locationURL.searchParams.get('ticket')}`);
                    }
                } catch (e) {
                    console.error(`[响应 ${requestId}] 无法解析重定向URL:`, e);
                }
            }

            if (response.cookies && response.cookies.length > 0) {
                console.log(`[响应 ${requestId}] 收到 ${response.cookies.length} 个Cookie`);
                // 详细记录每个Cookie
                response.cookies.forEach((cookie, index) => {
                    console.log(`[响应 ${requestId}] Cookie ${index + 1}: ${cookie}`);
                });
            }
        } else {
            console.error(`[响应 ${requestId}] 错误: ${response.error || '未知错误'}`);

            if (response.errorDetails) {
                console.error(`[响应 ${requestId}] 错误详情:`, response.errorDetails);
            } else {
                console.error(`[响应 ${requestId}] 没有提供错误详情`);

                // 添加主进程响应检查
                console.error(`[响应 ${requestId}] 请检查主进程日志 (main.js) 是否有更多信息`);
                console.error(`[响应 ${requestId}] 可能的原因:`);
                console.error(`[响应 ${requestId}] 1. 网络连接问题`);
                console.error(`[响应 ${requestId}] 2. 重定向处理问题`);
                console.error(`[响应 ${requestId}] 3. 校园网资源访问需要VPN`);
                console.error(`[响应 ${requestId}] 4. 服务器拒绝请求`);
            }
        }

        return response;
    },

    /**
     * 发送 IPASS 请求 - 修复版本
     * @param {string} method 请求方法
     * @param {string} url 请求URL
     * @param {Object} data 请求数据
     * @param {Object} options 请求选项
     * @returns {Promise<Object>} 响应对象
     */
    async ipassRequest(method, url, data = null, options = {}) {
        const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        console.log(`\n[请求 ${requestId}] ${method} ${url}`);

        try {
            // 确保URL是完整的URL
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                if (!url.includes('/')) {
                    console.error(`[请求 ${requestId}] 无效的URL: ${url}`);
                    return {
                        success: false,
                        error: `无效的URL: ${url}`
                    };
                }
            }

            // 记录请求详情
            if (data) {
                console.log(`[请求 ${requestId}] 数据:`, typeof data === 'object' ? JSON.stringify(data) : data);
            }

            // 详细记录请求选项
            const optionsLog = { ...options };
            if (optionsLog.cookies) {
                optionsLog.cookiesCount = optionsLog.cookies.length;
                optionsLog.cookiesSample = optionsLog.cookies.slice(0, 2);
                delete optionsLog.cookies; // 避免记录过长
            }
            console.log(`[请求 ${requestId}] 选项:`, optionsLog);

            // 使用 IPC 通信
            if (!window.ipcRenderer) {
                throw new Error('IPC Renderer 不可用，请在 Electron 环境中运行');
            }

            // 处理查询参数
            const originalUrl = url;
            if (options.params) {
                try {
                    const urlObj = new URL(url);
                    Object.entries(options.params).forEach(([key, value]) => {
                        urlObj.searchParams.append(key, value);
                    });
                    url = urlObj.toString();
                    console.log(`[请求 ${requestId}] 添加查询参数后的URL: ${url}`);
                } catch (e) {
                    console.error(`[URL解析错误] ${e.message}, URL: ${url}`);
                    throw new Error(`URL解析错误: ${e.message}`);
                }
            }

            // 处理表单数据
            let processedData = data;
            if (data && options.headers && options.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
                if (typeof data === 'object' && !(data instanceof URLSearchParams) && !(data instanceof FormData)) {
                    const formData = new URLSearchParams();
                    Object.entries(data).forEach(([key, value]) => {
                        formData.append(key, value);
                    });
                    processedData = formData.toString();
                    console.log(`[请求 ${requestId}] 转换表单数据:`, processedData);
                }
            }

            // 添加默认请求头
            if (!options.headers) {
                options.headers = {};
            }

            // 设置默认User-Agent
            if (!options.headers['User-Agent']) {
                options.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            }

            // 处理Cookie
            if (options.cookies && options.cookies.length > 0 && !options.headers['Cookie']) {
                // 将Cookie数组转换为字符串
                options.headers['Cookie'] = options.cookies.join('; ');
                console.log(`[请求 ${requestId}] 设置Cookie头:`, options.headers['Cookie']);
            }

            // 创建请求参数
            const requestArgs = {
                method,
                url,
                data: processedData,
                cookies: options.cookies || [],
                headers: options.headers
            };

            // 输出完整请求信息
            console.log(`[请求 ${requestId}] 完整请求信息:`, {
                method,
                url,
                dataType: typeof processedData,
                cookiesCount: requestArgs.cookies?.length || 0,
                headers: { ...options.headers } // 克隆以避免修改原对象
            });

            // 发送请求到主进程
            console.log(`[请求 ${requestId}] 发送到主进程`);
            const response = await window.ipcRenderer.invoke('ipass:request', requestArgs);

            // 添加请求ID用于跟踪
            if (response) {
                response.requestId = requestId;
            } else {
                console.error(`[请求 ${requestId}] 响应为空`);
                return {
                    success: false,
                    error: '响应为空',
                    requestId
                };
            }

            // 处理响应
            console.log(`[请求 ${requestId}] 收到响应`);

            // 对错误情况进行更详细处理
            if (!response.success) {
                console.error(`[请求 ${requestId}] 响应失败:`, response.error || '未知错误');

                // 检查错误详情
                if (response.errorDetails) {
                    console.error(`[请求 ${requestId}] 错误详情:`, response.errorDetails);
                } else {
                    console.error(`[请求 ${requestId}] 没有提供错误详情`);

                    // 添加主进程响应检查
                    console.error(`[请求 ${requestId}] 请检查主进程日志 (main.js) 是否有更多信息`);
                    console.error(`[请求 ${requestId}] 可能的原因:`);
                    console.error(`[请求 ${requestId}] 1. 网络连接问题`);
                    console.error(`[请求 ${requestId}] 2. 重定向处理问题`);
                    console.error(`[请求 ${requestId}] 3. 校园网资源访问需要VPN`);
                    console.error(`[请求 ${requestId}] 4. 服务器拒绝请求`);
                }

                // URL分析（检查是否有丢失参数）
                try {
                    const urlObj = new URL(url);
                    if (originalUrl.includes('?') && !url.includes('?')) {
                        console.error(`[请求 ${requestId}] 警告：URL参数可能丢失！原始URL: ${originalUrl}`);
                    }
                    if (urlObj.searchParams.has('ticket')) {
                        console.log(`[请求 ${requestId}] URL包含ticket参数: ${urlObj.searchParams.get('ticket')}`);
                    }
                } catch (e) {
                    console.error(`[请求 ${requestId}] URL解析失败:`, e);
                }
            }

            return this._logResponse(response);
        } catch (currentError) {
            // 修复：使用参数变量名currentError，避免与外部error混淆
            console.error(`[请求 ${requestId}] 失败:`, currentError);

            // 提供更详细的错误信息
            let errorMessage = currentError.message || '未知错误';
            let errorDetails = {
                name: currentError.name,
                code: currentError.code,
                stack: currentError.stack
            };

            // 网络错误特殊处理
            if (currentError.code === 'ECONNREFUSED') {
                errorMessage = `连接被拒绝 (${url})`;
                console.error(`[请求 ${requestId}] 连接被拒绝，服务器可能未启动或不可达`);
            } else if (currentError.code === 'ENOTFOUND') {
                errorMessage = `找不到主机 (${url})`;
                console.error(`[请求 ${requestId}] DNS解析失败，域名可能错误或网络未连接`);
            } else if (currentError.code === 'ETIMEDOUT') {
                errorMessage = `连接超时 (${url})`;
                console.error(`[请求 ${requestId}] 连接超时，服务器响应过慢或网络问题`);
            }

            // 重定向错误特殊处理
            if (currentError.message && currentError.message.includes('maxRedirects')) {
                errorMessage = `重定向次数过多 (${url})`;
                console.error(`[请求 ${requestId}] 重定向循环或重定向链过长`);
            }

            return {
                success: false,
                error: errorMessage,
                errorDetails: errorDetails,
                requestId
            };
        }
    },

    /**
     * 发送 EAS GET 请求
     * @param {string} url 请求URL
     * @param {Object} options 请求选项
     * @returns {Promise<Object>} 响应对象
     */
    async easGet(url, options = {}) {
        return this.easRequest('GET', url, null, options);
    },

    /**
     * 发送 EAS POST 请求
     * @param {string} url 请求URL
     * @param {Object} data 请求数据
     * @param {Object} options 请求选项
     * @returns {Promise<Object>} 响应对象
     */
    async easPost(url, data, options = {}) {
        return this.easRequest('POST', url, data, options);
    },

    /**
     * 发送 IPASS GET 请求
     * @param {string} url 请求URL
     * @param {Object} options 请求选项
     * @returns {Promise<Object>} 响应对象
     */
    async ipassGet(url, options = {}) {
        try {
            console.log(`===== IPASS GET请求开始 =====`);
            console.log(`请求URL: ${url}`);

            // 检查并记录Cookie
            if (options.cookies && options.cookies.length > 0) {
                console.log(`请求携带 ${options.cookies.length} 个Cookie`);
                options.cookies.forEach((cookie, index) => {
                    console.log(`请求Cookie ${index + 1}: ${cookie}`);
                });
            } else {
                console.log(`请求未携带Cookie数组`);
            }

            // 检查并记录headers中的Cookie
            if (options.headers && options.headers.Cookie) {
                console.log(`请求Headers中的Cookie: ${options.headers.Cookie}`);
            } else if (options.headers) {
                console.log(`请求Headers中不包含Cookie`);
            }

            // 确保options中同时包含cookies数组和headers中的Cookie
            if (!options.headers) {
                options.headers = {};
            }

            if (options.cookies && options.cookies.length > 0 && !options.headers.Cookie) {
                options.headers.Cookie = options.cookies.join('; ');
                console.log(`已自动添加Cookie到headers: ${options.headers.Cookie}`);
            }

            // 记录完整请求信息
            console.log(`完整请求信息:`, {
                method: 'GET',
                url: url,
                dataType: typeof options,
                cookiesCount: options.cookies ? options.cookies.length : 0,
                headers: options.headers
            });

            // 发起请求
            const response = await this.ipassRequest('GET', url, null, options);

            // 记录响应概要
            console.log(`请求完成，状态码: ${response.status}, 成功: ${response.success}`);

            // 返回响应结果
            return response;
        } catch (error) {
            console.error(`IPASS GET请求失败:`, error);
            if (error.stack) {
                console.error(`错误堆栈:`, error.stack);
            }
            throw error;
        } finally {
            console.log(`===== IPASS GET请求结束 =====`);
        }
    },

    /**
     * 发送 IPASS POST 请求
     * @param {string} url 请求URL
     * @param {Object} data 请求数据
     * @param {Object} options 请求选项
     * @returns {Promise<Object>} 响应对象
     */
    async ipassPost(url, data, options = {}) {
        return this.ipassRequest('POST', url, data, options);
    },

    // 在 ipc.js 中添加网络测试功能
    /**
     * 测试直接访问
     * @returns {Promise<boolean>} 是否可访问
     */
    async testDirectAccess() {
        try {
            if (window.ipcRenderer) {
                return await window.ipcRenderer.invoke('test-direct-access');
            } else {
                // 浏览器环境下使用fetch直接测试
                const response = await fetch('http://sso.ujn.edu.cn/tpass/login/', {
                    method: 'HEAD',
                    mode: 'no-cors',
                    cache: 'no-cache',
                });

                return true; // 如果能执行到这里，说明没有抛出错误
            }
        } catch (error) {
            console.error('测试直接访问失败:', error);
            return false;
        }
    },

    /**
     * 测试VPN访问
     * @returns {Promise<boolean>} 是否可访问
     */
    async testVpnAccess() {
        try {
            if (window.ipcRenderer) {
                return await window.ipcRenderer.invoke('test-vpn-access');
            } else {
                // 浏览器环境下使用fetch直接测试
                const response = await fetch('https://webvpn.ujn.edu.cn/', {
                    method: 'HEAD',
                    mode: 'no-cors',
                    cache: 'no-cache',
                });

                return true; // 如果能执行到这里，说明没有抛出错误
            }
        } catch (error) {
            console.error('测试VPN访问失败:', error);
            return false;
        }
    }
};