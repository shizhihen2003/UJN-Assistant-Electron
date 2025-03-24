// src/utils/store.js
import ipc from './ipc';

/**
 * 将对象安全序列化为可存储的格式
 * 处理循环引用、不可序列化的值等问题
 * @param {*} obj 要序列化的对象
 * @returns {*} 安全的可序列化对象
 */
function safeSerialize(obj) {
    try {
        // 尝试直接通过JSON序列化，如果成功就直接返回解析后的对象
        return JSON.parse(JSON.stringify(obj));
    } catch (error) {
        console.warn('对象包含无法直接序列化的内容，将进行安全处理', error);

        // 如果是数组，处理每个元素
        if (Array.isArray(obj)) {
            return obj.map(item => safeSerialize(item));
        }

        // 如果是对象，递归处理每个属性
        if (obj && typeof obj === 'object' && obj !== null) {
            const result = {};

            // 获取所有可枚举的属性
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    try {
                        const value = obj[key];

                        // 跳过函数
                        if (typeof value === 'function') continue;

                        // 处理Date对象
                        if (value instanceof Date) {
                            result[key] = value.toISOString();
                            continue;
                        }

                        // 处理其他类型
                        if (value === undefined) {
                            // 跳过undefined
                            continue;
                        } else if (value === null) {
                            result[key] = null;
                        } else if (typeof value === 'object') {
                            // 递归处理嵌套对象，但避免循环引用
                            try {
                                result[key] = safeSerialize(value);
                            } catch (e) {
                                // 如果无法序列化，用空对象或数组替代
                                result[key] = Array.isArray(value) ? [] : {};
                            }
                        } else {
                            // 处理原始类型
                            result[key] = value;
                        }
                    } catch (propError) {
                        console.warn(`无法序列化属性 ${key}`, propError);
                        // 跳过无法处理的属性
                    }
                }
            }
            return result;
        }

        // 其他情况返回原始值的字符串表示或空字符串
        return obj?.toString ? obj.toString() : '';
    }
}

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
    getInt(key, defaultValue = 0) {
        if (this.useElectron) {
            return ipc.getStoreValue(this.getFullKey(key), defaultValue);
        } else {
            const value = localStorage.getItem(this.getFullKey(key));

            // 添加详细日志
            console.log(`从本地存储获取整数值: ${key} = ${value}`);

            if (value === null) {
                console.log(`键 ${key} 不存在，使用默认值: ${defaultValue}`);
                return defaultValue;
            }

            const parsed = parseInt(value, 10);
            if (isNaN(parsed)) {
                console.log(`键 ${key} 的值 ${value} 无法解析为整数，使用默认值: ${defaultValue}`);
                return defaultValue;
            }

            return parsed;
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
        const safeValue = safeSerialize(value);

        if (this.useElectron) {
            await ipc.setStoreValue(this.getFullKey(key), Array.from(safeValue));
        } else {
            localStorage.setItem(this.getFullKey(key), JSON.stringify(Array.from(safeValue)));
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
     * 安全地设置对象
     * @param {string} key 键名
     * @param {Object} value 值
     */
    async putObject(key, value) {
        try {
            // 安全序列化对象
            const safeValue = safeSerialize(value);

            if (this.useElectron) {
                await ipc.setStoreValue(this.getFullKey(key), safeValue);
            } else {
                localStorage.setItem(this.getFullKey(key), JSON.stringify(safeValue));
            }
        } catch (error) {
            console.error('存储对象失败:', error);

            // 尝试使用更简单的方式存储
            try {
                // 创建一个简单的保底版本
                let fallbackValue = {};

                // 如果是数组，创建一个空数组
                if (Array.isArray(value)) {
                    fallbackValue = [];
                    // 尝试处理每个元素，只保存基本类型
                    for (const item of value) {
                        if (item && typeof item === 'object') {
                            // 只取对象的id和name属性（如果有的话）
                            const simpleItem = {};
                            if ('id' in item) simpleItem.id = String(item.id);
                            if ('name' in item) simpleItem.name = String(item.name);
                            fallbackValue.push(simpleItem);
                        } else if (typeof item !== 'function') {
                            // 直接添加基本类型
                            fallbackValue.push(item);
                        }
                    }
                }

                if (this.useElectron) {
                    await ipc.setStoreValue(this.getFullKey(key), fallbackValue);
                } else {
                    localStorage.setItem(this.getFullKey(key), JSON.stringify(fallbackValue));
                }

                console.warn('使用简化版本存储对象成功');
            } catch (fallbackError) {
                console.error('备选存储方式也失败:', fallbackError);
                throw new Error('无法存储对象，所有尝试都失败');
            }
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
            try {
                const value = await ipc.getStoreValue(this.getFullKey(key));
                return value || defaultValue;
            } catch (error) {
                console.error('获取对象失败:', error);
                return defaultValue;
            }
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

    /**
     * 安全地存储对象，如果无法存储则不抛出异常
     * @param {string} key 键名
     * @param {Object} value 对象
     * @param {Object} fallback 备选存储对象，如果提供则在主存储失败时使用
     * @returns {Promise<boolean>} 是否成功存储
     */
    async safePutObject(key, value, fallback = null) {
        try {
            await this.putObject(key, value);
            return true;
        } catch (error) {
            console.error(`安全存储对象失败: ${key}`, error);

            // 如果提供了备选对象，尝试存储它
            if (fallback !== null) {
                try {
                    await this.putObject(key, fallback);
                    console.log(`使用备选对象存储成功: ${key}`);
                    return true;
                } catch (fallbackError) {
                    console.error(`备选存储也失败: ${key}`, fallbackError);
                }
            }

            return false;
        }
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
     * 安全设置对象，失败时不抛出异常
     * @param {string} key 键名
     * @param {Object} value 值
     * @param {Object} fallback 备选值
     * @returns {StoreEditor} 编辑器实例
     */
    async safePutObject(key, value, fallback = null) {
        await this.store.safePutObject(key, value, fallback);
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