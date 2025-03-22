// src/utils/store.js
import ipc from './ipc';

/**
 * 数据存储工具类
 * 用于持久化用户数据和设置
 * 支持Electron和Web环境
 */
class Store {
    constructor() {
        this.prefix = 'ujn_assistant_';
        this.useElectron = typeof window !== 'undefined' && window.electronStore;
    }

    /**
     * 获取完整键名
     * @param {string} key 键名
     * @returns {string} 完整键名
     */
    getFullKey(key) {
        return this.prefix + key;
    }

    /**
     * 设置字符串值
     * @param {string} key 键名
     * @param {string} value 值
     */
    async putString(key, value) {
        if (this.useElectron) {
            await ipc.setStoreValue(this.getFullKey(key), value);
        } else {
            localStorage.setItem(this.getFullKey(key), value);
        }
    }

    /**
     * 获取字符串值
     * @param {string} key 键名
     * @param {string} defaultValue 默认值
     * @returns {Promise<string>|string} 值
     */
    async getString(key, defaultValue = '') {
        if (this.useElectron) {
            return await ipc.getStoreValue(this.getFullKey(key), defaultValue);
        } else {
            const value = localStorage.getItem(this.getFullKey(key));
            return value !== null ? value : defaultValue;
        }
    }

    /**
     * 设置整数值
     * @param {string} key 键名
     * @param {number} value 值
     */
    async putInt(key, value) {
        if (this.useElectron) {
            await ipc.setStoreValue(this.getFullKey(key), value);
        } else {
            localStorage.setItem(this.getFullKey(key), value.toString());
        }
    }

    /**
     * 获取整数值
     * @param {string} key 键名
     * @param {number} defaultValue 默认值
     * @returns {Promise<number>|number} 值
     */
    async getInt(key, defaultValue = 0) {
        if (this.useElectron) {
            return await ipc.getStoreValue(this.getFullKey(key), defaultValue);
        } else {
            const value = localStorage.getItem(this.getFullKey(key));
            return value !== null ? parseInt(value, 10) : defaultValue;
        }
    }

    /**
     * 设置布尔值
     * @param {string} key 键名
     * @param {boolean} value 值
     */
    async putBoolean(key, value) {
        if (this.useElectron) {
            await ipc.setStoreValue(this.getFullKey(key), value);
        } else {
            localStorage.setItem(this.getFullKey(key), value ? 'true' : 'false');
        }
    }

    /**
     * 获取布尔值
     * @param {string} key 键名
     * @param {boolean} defaultValue 默认值
     * @returns {Promise<boolean>|boolean} 值
     */
    async getBoolean(key, defaultValue = false) {
        if (this.useElectron) {
            return await ipc.getStoreValue(this.getFullKey(key), defaultValue);
        } else {
            const value = localStorage.getItem(this.getFullKey(key));
            if (value === null) return defaultValue;
            return value === 'true';
        }
    }

    /**
     * 设置字符串集合
     * @param {string} key 键名
     * @param {Set<string>} value 值
     */
    async putStringSet(key, value) {
        if (this.useElectron) {
            await ipc.setStoreValue(this.getFullKey(key), Array.from(value));
        } else {
            localStorage.setItem(this.getFullKey(key), JSON.stringify(Array.from(value)));
        }
    }

    /**
     * 获取字符串集合
     * @param {string} key 键名
     * @param {Set<string>} defaultValue 默认值
     * @returns {Promise<Set<string>>|Set<string>} 值
     */
    async getStringSet(key, defaultValue = new Set()) {
        if (this.useElectron) {
            const value = await ipc.getStoreValue(this.getFullKey(key));
            return value ? new Set(value) : defaultValue;
        } else {
            const value = localStorage.getItem(this.getFullKey(key));
            if (value === null) return defaultValue;
            try {
                return new Set(JSON.parse(value));
            } catch (e) {
                console.error('解析字符串集合失败', e);
                return defaultValue;
            }
        }
    }

    /**
     * 设置对象
     * @param {string} key 键名
     * @param {Object} value 值
     */
    async putObject(key, value) {
        if (this.useElectron) {
            await ipc.setStoreValue(this.getFullKey(key), value);
        } else {
            localStorage.setItem(this.getFullKey(key), JSON.stringify(value));
        }
    }

    /**
     * 获取对象
     * @param {string} key 键名
     * @param {Object} defaultValue 默认值
     * @returns {Promise<Object>|Object} 值
     */
    async getObject(key, defaultValue = {}) {
        if (this.useElectron) {
            const value = await ipc.getStoreValue(this.getFullKey(key));
            return value || defaultValue;
        } else {
            const value = localStorage.getItem(this.getFullKey(key));
            if (value === null) return defaultValue;
            try {
                return JSON.parse(value);
            } catch (e) {
                console.error('解析对象失败', e);
                return defaultValue;
            }
        }
    }

    /**
     * 移除键
     * @param {string} key 键名
     */
    async remove(key) {
        if (this.useElectron) {
            await ipc.deleteStoreValue(this.getFullKey(key));
        } else {
            localStorage.removeItem(this.getFullKey(key));
        }
    }

    /**
     * 清空所有数据
     */
    async clear() {
        if (this.useElectron) {
            await ipc.clearStore();
        } else {
            // 只清除带前缀的键
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                }
            });
        }
    }

    /**
     * 编辑操作
     * @param {Function} editCallback 编辑回调
     */
    async edit(editCallback) {
        const editor = new StoreEditor(this);
        await editCallback(editor);
    }
}

/**
 * 存储编辑器
 */
class StoreEditor {
    /**
     * 构造函数
     * @param {Store} store 存储实例
     */
    constructor(store) {
        this.store = store;
    }

    /**
     * 设置字符串值
     * @param {string} key 键名
     * @param {string} value 值
     * @returns {StoreEditor} 编辑器实例
     */
    async putString(key, value) {
        await this.store.putString(key, value);
        return this;
    }

    /**
     * 设置整数值
     * @param {string} key 键名
     * @param {number} value 值
     * @returns {StoreEditor} 编辑器实例
     */
    async putInt(key, value) {
        await this.store.putInt(key, value);
        return this;
    }

    /**
     * 设置布尔值
     * @param {string} key 键名
     * @param {boolean} value 值
     * @returns {StoreEditor} 编辑器实例
     */
    async putBoolean(key, value) {
        await this.store.putBoolean(key, value);
        return this;
    }

    /**
     * 设置字符串集合
     * @param {string} key 键名
     * @param {Set<string>} value 值
     * @returns {StoreEditor} 编辑器实例
     */
    async putStringSet(key, value) {
        await this.store.putStringSet(key, value);
        return this;
    }

    /**
     * 设置对象
     * @param {string} key 键名
     * @param {Object} value 值
     * @returns {StoreEditor} 编辑器实例
     */
    async putObject(key, value) {
        await this.store.putObject(key, value);
        return this;
    }

    /**
     * 移除键
     * @param {string} key 键名
     * @returns {StoreEditor} 编辑器实例
     */
    async remove(key) {
        await this.store.remove(key);
        return this;
    }
}

// 创建单例实例
const store = new Store();

export default store;