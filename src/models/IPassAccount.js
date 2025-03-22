// src/models/IPassAccount.js
import axios from 'axios'
import Account from './Account'
import CookieJar from './CookieJar'
import { UJNAPI } from '../constants/api'
import store from '../utils/store'
import { VpnEncodeUtils } from '../utils/vpnEncodeUtils'

/**
 * 智慧济大账号类
 */
class IPassAccount extends Account {
    /**
     * 私有构造函数，使用 getInstance 获取实例
     */
    constructor() {
        super(
            UJNAPI.VPN_HOST,
            'IPASS_ACCOUNT',
            'IPASS_PASSWORD',
            'https',
            'ipassCookie'
        )

        // 使用CookieJar管理Cookie
        this.cookieJar = new CookieJar(this.scheme, this.host, this.cookieName)

        // 创建axios实例
        this.axiosInstance = axios.create({
            timeout: 30000,
            withCredentials: true
        })

        // 请求拦截器
        this.axiosInstance.interceptors.request.use(
            config => {
                // 添加Cookie
                config.headers.Cookie = this.cookieJar.getCookieString()
                return config
            },
            error => Promise.reject(error)
        )

        // 响应拦截器
        this.axiosInstance.interceptors.response.use(
            response => {
                // 保存响应中的Cookie
                this.cookieJar.saveFromResponse(response)
                return response
            },
            error => Promise.reject(error)
        )
    }

    /**
     * 单例实例
     */
    static instance = null

    /**
     * 获取单例实例
     * @returns {IPassAccount} 实例
     */
    static getInstance() {
        if (!IPassAccount.instance) {
            IPassAccount.instance = new IPassAccount()
        }

        return IPassAccount.instance
    }

    /**
     * 获取完整URL
     * @param {string} path 路径
     * @returns {string} 完整URL
     */
    getFullUrl(path) {
        return `${this.scheme}://${this.host}/${path}`
    }

    /**
     * 检查登录状态
     * @returns {Promise<boolean>} 是否已登录
     */
    async absCheckLogin() {
        try {
            const response = await this.axiosInstance.get(
                this.getFullUrl(''),
                {
                    maxRedirects: 0,
                    validateStatus: status => (status >= 200 && status < 300) || status === 302
                }
            )

            // 检查是否需要重定向到登录页面
            if (response.status === 302) {
                const location = response.headers.location
                return location && !location.includes('login')
            }

            return true
        } catch (error) {
            // 如果是重定向到登录页面，说明未登录
            if (error.response && error.response.status === 302 &&
                error.response.headers.location &&
                error.response.headers.location.includes('login')) {
                return false
            }

            // 其他错误
            console.error('检查登录状态失败', error)
            return false
        }
    }

    /**
     * 登录
     * @param {string} account 账号
     * @param {string} password 密码
     * @returns {Promise<boolean>} 登录是否成功
     */
    async absLogin(account, password) {
        // 清空Cookie
        this.cookieJar.clearCookies()

        try {
            // 获取登录页面，提取lt值
            const loginPageResponse = await this.axiosInstance.get(
                this.getFullUrl('')
            )

            const loginPageHtml = loginPageResponse.data

            // 提取lt值
            const ltMatch = loginPageHtml.match(VpnEncodeUtils.LT_PATTERN)
            if (!ltMatch) {
                throw new Error('无法获取lt值')
            }
            const lt = ltMatch[1]

            // 获取请求URL
            const loginUrl = loginPageResponse.request.responseURL || ''

            // 使用VpnEncodeUtils加密
            const secret = VpnEncodeUtils.encode(account, password, lt)

            // 提取路径部分
            const urlSegments = loginUrl.split('/')
            const path = urlSegments.slice(3).join('/') || UJNAPI.IPASS_LOGIN

            // 登录请求
            const loginResponse = await this.axiosInstance.post(
                this.getFullUrl(path),
                new URLSearchParams({
                    rsa: secret,
                    ul: account.length.toString(),
                    pl: password.length.toString(),
                    lt: lt,
                    execution: 'e1s1',
                    _eventId: 'submit'
                }),
                {
                    maxRedirects: 0,
                    validateStatus: status => (status >= 200 && status < 300) || (status >= 300 && status < 400)
                }
            )

            // 检查登录是否成功
            if (loginResponse.status === 302 && loginResponse.headers.location) {
                // 跟随重定向
                try {
                    await this.axiosInstance.get(
                        loginResponse.headers.location.startsWith('http')
                            ? loginResponse.headers.location
                            : new URL(loginResponse.headers.location, this.getFullUrl('')).href
                    )
                } catch (error) {
                    console.error('跟随重定向失败', error)
                }

                return true
            }

            return false
        } catch (error) {
            console.error('登录失败', error)
            return false
        }
    }

    /**
     * 清除Cookie
     */
    clearCookies() {
        this.cookieJar.clearCookies()
    }

    /**
     * 获取账号
     * @returns {Promise<string>} 账号
     */
    async getAccount() {
        return await store.getString(this.accountName, '')
    }

    /**
     * 获取Cookie
     * @returns {Array} Cookie列表
     */
    getCookie() {
        return this.cookieJar.cookiesList
    }

    /**
     * 登出
     */
    logout() {
        this.clearCookies()
        this.isLogin = false
    }
}

/**
 * VPN账号类，用于VPN访问各种服务
 */
export class VpnAccount extends Account {
    /**
     * 构造函数
     * @param {string} host 主机地址
     * @param {string} scheme 协议类型
     * @param {IPassAccount} ipass 智慧济大账号实例
     */
    constructor(host, scheme = 'https', ipass = IPassAccount.getInstance()) {
        super(
            host,
            'VPN_ACCOUNT',
            'VPN_PASSWORD',
            scheme,
            'vpnCookie'
        )

        this.needLogin = true
        this.ipass = ipass
    }

    /**
     * 获取登录状态
     */
    get isLogin() {
        return this.ipass.isLogin
    }

    /**
     * 设置登录状态
     */
    set isLogin(value) {
        // 空实现，实际登录状态由 ipass 控制
    }

    /**
     * 获取账号
     * @returns {Promise<string>} 账号
     */
    async getAccount() {
        return this.ipass.getAccount()
    }

    /**
     * 获取Cookie
     * @returns {Array} Cookie列表
     */
    getCookie() {
        return this.ipass.getCookie()
    }

    /**
     * 检查登录状态
     * @returns {Promise<boolean>} 是否已登录
     */
    async checkLogin() {
        try {
            const response = await this.ipass.axiosInstance.get(
                this.ipass.getFullUrl(''),
                {
                    maxRedirects: 0,
                    validateStatus: status => (status >= 200 && status < 300) || status === 302
                }
            )

            // 检查重定向
            if (response.status === 302) {
                const location = response.headers.location
                if (!location || !location.includes('login')) {
                    if (this.needLogin) {
                        return await this.afterLogin()
                    } else {
                        return true
                    }
                } else {
                    return await this.login()
                }
            } else if (this.needLogin) {
                return await this.afterLogin()
            } else {
                return true
            }
        } catch (error) {
            console.error('检查登录状态失败', error)
            return false
        }
    }

    /**
     * 登录后的处理
     * @returns {Promise<boolean>} 处理结果
     */
    async afterLogin() {
        return true
    }

    /**
     * 登录
     * @returns {Promise<boolean>} 登录是否成功
     */
    async login() {
        try {
            await this.ipass.login()

            if (!this.ipass.isLogin) {
                this.needLogin = true
                throw new Error('需要登录')
            } else {
                this.needLogin = false
            }

            return await this.afterLogin()
        } catch (error) {
            console.error('登录失败', error)
            throw error
        }
    }

    /**
     * 登录
     * @param {string} account 账号
     * @param {string} password 密码
     * @param {boolean} saveData 是否保存数据
     * @returns {Promise<boolean>} 登录是否成功
     */
    async login(account, password, saveData = true) {
        try {
            await this.ipass.login(account, password, saveData)

            if (!this.ipass.isLogin) {
                this.needLogin = true
                throw new Error('需要登录')
            } else {
                this.needLogin = false
            }

            return await this.afterLogin()
        } catch (error) {
            console.error('登录失败', error)
            throw error
        }
    }

    /**
     * 带协议和主机的GET请求
     * @param {string} scheme 协议
     * @param {string} host 主机
     * @param {string} url 路径
     * @returns {Promise<Object>} 响应对象
     */
    async get(scheme, host, url) {
        const encryptedUrl = VpnEncodeUtils.encryptUrl(`${scheme}://${host}/${url}`)
        return await this.ipass.axiosInstance.get(encryptedUrl)
    }

    /**
     * 带协议和主机的POST请求
     * @param {string} scheme 协议
     * @param {string} host 主机
     * @param {string} url 路径
     * @param {Object} body 请求体
     * @returns {Promise<Object>} 响应对象
     */
    async post(scheme, host, url, body) {
        const encryptedUrl = VpnEncodeUtils.encryptUrl(`${scheme}://${host}/${url}`)
        return await this.ipass.axiosInstance.post(encryptedUrl, body)
    }

    /**
     * GET请求
     * @param {string} url 路径
     * @returns {Promise<Object>} 响应对象
     */
    async get(url) {
        const encryptedUrl = VpnEncodeUtils.encryptUrl(`${this.scheme}://${this.host}/${url}`)
        return await this.ipass.axiosInstance.get(encryptedUrl)
    }

    /**
     * POST请求
     * @param {string} url 路径
     * @param {Object} body 请求体
     * @returns {Promise<Object>} 响应对象
     */
    async post(url, body) {
        const encryptedUrl = VpnEncodeUtils.encryptUrl(`${this.scheme}://${this.host}/${url}`)
        return await this.ipass.axiosInstance.post(encryptedUrl, body)
    }

    /**
     * 登出
     */
    logout() {
        this.ipass.logout()
    }
}

// 导出智慧济大账号类
export default IPassAccount