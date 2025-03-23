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
     * 处理和记录响应
     * @param {Object} response 响应对象
     * @returns {Object} 响应对象
     */
    _logResponse(response) {
        if (response.success) {
            console.log(`[响应状态] ${response.status}`);

            if (response.headers) {
                console.log(`[响应头] ${JSON.stringify(response.headers)}`);
            }

            if (response.location) {
                console.log(`[重定向地址] ${response.location}`);
            }

            if (response.cookies && response.cookies.length > 0) {
                console.log(`[响应Cookie] 收到 ${response.cookies.length} 个Cookie`);
                // 打印每个Cookie的内容以便调试
                response.cookies.forEach((cookie, index) => {
                    console.log(`Cookie ${index + 1}: ${cookie}`);
                });
            }

            if (response.data) {
                const previewLength = 200;
                const contentPreview = typeof response.data === 'string' && response.data.length > previewLength
                    ? response.data.substring(0, previewLength) + "..."
                    : response.data;
                console.log(`[响应内容预览] ${contentPreview}`);
            }
        } else {
            console.error(`[响应错误] ${response.error || '未知错误'}`);
            console.error(`[错误详情]`, response.errorDetails || {});
        }

        return response;
    },

    /**
     * 发送 IPASS 请求 - 通过 IPC 通信
     * @param {string} method 请求方法
     * @param {string} url 请求URL
     * @param {Object} data 请求数据
     * @param {Object} options 请求选项
     * @returns {Promise<Object>} 响应对象
     */
    async ipassRequest(method, url, data = null, options = {}) {
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
            const response = await window.ipcRenderer.invoke('ipass:request', requestArgs);

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
        return this.ipassRequest('GET', url, null, options);
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
    }
};