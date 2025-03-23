// src/models/Account.js
import axios from 'axios'
import store from '../utils/store'

/**
 * 账号基类，提供共同的账号功能
 */
class Account {
    /**
     * 构造函数
     * @param {string} host 服务器主机地址
     * @param {string} accountName 账号存储键名
     * @param {string} passwordName 密码存储键名
     * @param {string} scheme 协议类型 (http/https)
     * @param {string} cookieName Cookie存储键名
     */
    constructor(host, accountName, passwordName, scheme = 'http', cookieName) {
        this.host = host
        this.accountName = accountName
        this.passwordName = passwordName
        this.scheme = scheme
        this.cookieName = cookieName
        this.isLogin = false
    }

    /**
     * 获取完整URL
     * @param {string} path 路径
     * @returns {string} 完整URL
     */
    getFullUrl(path) {
        if (!path) return `${this.scheme}://${this.host}`
        return `${this.scheme}://${this.host}/${path}`
    }

    /**
     * 登录（使用存储的账号密码）
     * @throws {Error} 网络错误或需要登录错误
     * @returns {Promise<boolean>} 登录是否成功
     */
    async login() {
        const account = await store.getString(this.accountName)
        const password = await store.getString(this.passwordName)
        return this.login(account, password, false)
    }

    /**
     * 登录
     * @param {string} account 账号，为null则使用储存的账号
     * @param {string} password 密码，为null则使用储存的密码
     * @param {boolean} saveData 是否保存数据
     * @returns {Promise<boolean>} 登录是否成功
     * @throws {Error} 网络错误
     */
// 在 Account.js 中确保 login 方法正确处理结果
    async login(account, password, saveData = true) {
        if (!account || !password) {
            this.isLogin = false;
            return false;
        }

        try {
            // 调用抽象登录方法并获取结果
            const loginSuccess = await this.absLogin(account, password);
            this.isLogin = loginSuccess;

            // 如果登录成功且需要保存数据
            if (saveData && loginSuccess) {
                await store.edit(async editor => {
                    await editor.putString(this.accountName, account);
                    await editor.putString(this.passwordName, password);
                });
            }

            return loginSuccess;
        } catch (error) {
            console.error('登录失败', error);
            this.isLogin = false;
            throw error;
        }
    }

    /**
     * 检查登录状态
     * @returns {Promise<boolean>} 登录状态
     * @throws {Error} 需要登录错误
     */
    async checkLogin() {
        try {
            // 检查是否已登录
            const isAlreadyLoggedIn = await this.absCheckLogin();
            this.isLogin = isAlreadyLoggedIn;

            // 如果未登录，尝试使用保存的账号密码自动登录
            if (!isAlreadyLoggedIn) {
                console.log("未登录，尝试自动登录");
                const account = await store.getString(this.accountName);
                const password = await store.getString(this.passwordName);

                if (account && password) {
                    const loginSuccess = await this.login(account, password, false);
                    this.isLogin = loginSuccess;

                    if (!loginSuccess) {
                        console.error("自动登录失败");
                        throw new NeedLoginException();
                    }

                    console.log("自动登录成功");
                    return true;
                } else {
                    console.error("没有保存的账号密码，无法自动登录");
                    throw new NeedLoginException();
                }
            }

            return true;
        } catch (error) {
            console.error('检查登录状态失败', error);
            this.isLogin = false;
            throw error;
        }
    }

    /**
     * GET请求
     * @param {string} url 请求路径
     * @returns {Promise<Object>} 响应对象
     * @throws {Error} 网络错误或需要登录错误
     */
    async get(url) {
        if (!this.isLogin) {
            throw new NeedLoginException()
        }

        try {
            const response = await axios.get(this.getFullUrl(url))

            // 检查重定向到登录页面的情况
            if (response.request && response.request.responseURL &&
                response.request.responseURL.includes('login')) {
                this.isLogin = await this.login()
                if (!this.isLogin) {
                    throw new NeedLoginException()
                }

                return this.get(url)
            }

            return response
        } catch (error) {
            console.error('GET请求失败', error)
            throw error
        }
    }

    /**
     * POST请求
     * @param {string} url 请求路径
     * @param {Object} data 请求数据
     * @returns {Promise<Object>} 响应对象
     * @throws {Error} 网络错误或需要登录错误
     */
    async post(url, data) {
        if (!await this.checkLogin()) {
            throw new NeedLoginException()
        }

        try {
            return await axios.post(this.getFullUrl(url), data)
        } catch (error) {
            console.error('POST请求失败', error)
            throw error
        }
    }

    /**
     * GET请求，不检查登录状态
     * @param {string} url 请求路径
     * @returns {Promise<Object>} 响应对象
     * @throws {Error} 网络错误
     */
    async getNoCheck(url) {
        try {
            return await axios.get(this.getFullUrl(url))
        } catch (error) {
            console.error('GET请求失败', error)
            throw error
        }
    }

    /**
     * POST请求，不检查登录状态
     * @param {string} url 请求路径
     * @param {Object} data 请求数据
     * @returns {Promise<Object>} 响应对象
     * @throws {Error} 网络错误
     */
    async postNoCheck(url, data) {
        try {
            return await axios.post(this.getFullUrl(url), data)
        } catch (error) {
            console.error('POST请求失败', error)
            throw error
        }
    }

    /**
     * GET请求，不跟随重定向
     * @param {string} url 请求路径
     * @returns {Promise<Object>} 响应对象
     * @throws {Error} 网络错误
     */
    async getNoRedirect(url) {
        try {
            return await axios.get(this.getFullUrl(url), {
                maxRedirects: 0,
                validateStatus: status => (status >= 200 && status < 300) || (status >= 300 && status < 400)
            })
        } catch (error) {
            console.error('GET请求失败', error)
            throw error
        }
    }

    /**
     * POST请求，不跟随重定向
     * @param {string} url 请求路径
     * @param {Object} data 请求数据
     * @returns {Promise<Object>} 响应对象
     * @throws {Error} 网络错误
     */
    async postNoRedirect(url, data) {
        try {
            return await axios.post(this.getFullUrl(url), data, {
                maxRedirects: 0,
                validateStatus: status => (status >= 200 && status < 300) || (status >= 300 && status < 400)
            })
        } catch (error) {
            console.error('POST请求失败', error)
            throw error
        }
    }

    /**
     * 子类必须实现的检查登录方法
     * @returns {Promise<boolean>} 是否已登录
     */
    async absCheckLogin() {
        throw new Error('子类必须实现 absCheckLogin 方法')
    }

    /**
     * 子类必须实现的登录方法
     * @param {string} account 账号
     * @param {string} password 密码
     * @returns {Promise<boolean>} 登录是否成功
     */
    async absLogin(account, password) {
        throw new Error('子类必须实现 absLogin 方法')
    }
}

// 定义错误类
export class NeedLoginException extends Error {
    constructor() {
        super('需要登录')
        this.name = 'NeedLoginException'
    }
}

export class WrongAccountException extends Error {
    constructor() {
        super('用户名或密码错误')
        this.name = 'WrongAccountException'
    }
}

export class WrongLogicException extends Error {
    constructor(msg) {
        super(`逻辑错误: ${msg}`)
        this.name = 'WrongLogicException'
    }
}

export default Account