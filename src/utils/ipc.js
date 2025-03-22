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

        const value = await window.electronStore.get(key);
        return value !== undefined ? value : defaultValue;
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
            localStorage.setItem(key, JSON.stringify(value));
            return;
        }

        await window.electronStore.set(key, value);
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

        await window.electron.minimize();
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

        await window.electron.maximize();
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

        await window.electron.close();
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
     * 发送 EAS 请求
     * @param {string} method 请求方法
     * @param {string} url 请求URL
     * @param {Object} data 请求数据
     * @param {Object} options 请求选项
     * @returns {Promise<Object>} 响应对象
     */
    async easRequest(method, url, data = null, options = {}) {
        if (!window.ipcRenderer) {
            throw new Error('ipcRenderer不可用，无法发送EAS请求');
        }

        return await window.ipcRenderer.invoke('eas:request', {
            method,
            url,
            data,
            ...options
        });
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
    }
};