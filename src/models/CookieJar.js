// src/models/CookieJar.js
import store from '../utils/store'

/**
 * Cookie管理类
 * 处理Cookie的存储和获取
 */
class CookieJar {
    /**
     * 构造函数
     * @param {string} scheme 协议
     * @param {string} host 主机
     * @param {string} cookieName 存储键名
     */
    constructor(scheme, host, cookieName) {
        this.scheme = scheme
        this.host = host
        this.cookieName = cookieName
        this.cookiesList = []

        // 初始化时加载Cookie
        this.loadCookie(scheme, host)
    }

    /**
     * 加载Cookie
     * @param {string} scheme 协议
     * @param {string} host 主机
     */
    async loadCookie(scheme, host) {
        try {
            const cookieStrings = await store.getStringSet(this.cookieName, new Set())
            this.cookiesList = Array.from(cookieStrings).map(cookieString => {
                try {
                    // 尝试解析Cookie字符串
                    return this.parseCookie(cookieString, host)
                } catch (e) {
                    console.error('解析Cookie失败', e)
                    return null
                }
            }).filter(cookie => cookie !== null)
        } catch (e) {
            console.error('加载Cookie失败', e)
            this.cookiesList = []
        }
    }

    /**
     * 解析Cookie字符串为对象
     * @param {string} cookieString Cookie字符串
     * @param {string} defaultHost 默认主机
     * @returns {Object} Cookie对象
     */
    parseCookie(cookieString, defaultHost) {
        const parts = cookieString.split(';')
        const cookiePair = parts[0].trim().split('=')

        if (cookiePair.length < 2) {
            throw new Error('无效的Cookie格式')
        }

        const cookie = {
            name: cookiePair[0].trim(),
            value: cookiePair[1].trim(),
            domain: defaultHost,
            path: '/',
            expires: null,
            secure: false,
            httpOnly: false
        }

        // 解析其他Cookie属性
        for (let i = 1; i < parts.length; i++) {
            const part = parts[i].trim()
            if (!part) continue

            if (part.includes('=')) {
                const [attrName, attrValue] = part.split('=', 2)
                const name = attrName.trim().toLowerCase()
                const value = attrValue.trim()

                if (name === 'domain') cookie.domain = value
                else if (name === 'path') cookie.path = value
                else if (name === 'expires') cookie.expires = new Date(value)
                else if (name === 'max-age') {
                    const seconds = parseInt(value, 10)
                    if (!isNaN(seconds)) {
                        cookie.expires = new Date(Date.now() + seconds * 1000)
                    }
                }
            } else {
                const name = part.trim().toLowerCase()
                if (name === 'httponly') cookie.httpOnly = true
                else if (name === 'secure') cookie.secure = true
            }
        }

        return cookie
    }

    /**
     * 将Cookie对象转换为字符串
     * @param {Object} cookie Cookie对象
     * @returns {string} Cookie字符串
     */
    stringifyCookie(cookie) {
        let result = `${cookie.name}=${cookie.value}`

        if (cookie.domain) result += `; Domain=${cookie.domain}`
        if (cookie.path) result += `; Path=${cookie.path}`
        if (cookie.expires) result += `; Expires=${cookie.expires.toUTCString()}`
        if (cookie.maxAge) result += `; Max-Age=${cookie.maxAge}`
        if (cookie.secure) result += '; Secure'
        if (cookie.httpOnly) result += '; HttpOnly'

        return result
    }

    /**
     * 清空所有Cookie
     */
    clearCookies() {
        this.cookiesList = []
        store.edit(editor => editor.remove(this.cookieName))
    }

    /**
     * 是否已过期
     * @param {Object} cookie Cookie对象
     * @returns {boolean} 是否已过期
     */
    isExpired(cookie) {
        return cookie.expires && cookie.expires.getTime() < Date.now()
    }

    /**
     * 保存响应中的Cookie
     * @param {Object} response 响应对象
     */
    saveFromResponse(response) {
        if (!response.headers || !response.headers['set-cookie']) {
            return
        }

        // 获取Set-Cookie头
        let cookies = response.headers['set-cookie']
        if (!Array.isArray(cookies)) {
            cookies = [cookies]
        }

        // 处理每个新Cookie
        for (const cookieStr of cookies) {
            try {
                const newCookie = this.parseCookie(cookieStr, this.host)

                // 查找是否已存在同名Cookie
                const existingIndex = this.cookiesList.findIndex(c =>
                    c.name === newCookie.name &&
                    c.domain === newCookie.domain &&
                    c.path === newCookie.path
                )

                // 替换或添加新Cookie
                if (existingIndex !== -1) {
                    this.cookiesList[existingIndex] = newCookie
                } else {
                    this.cookiesList.push(newCookie)
                }
            } catch (e) {
                console.error('解析响应Cookie失败', e)
            }
        }

        // 移除过期Cookie
        this.cookiesList = this.cookiesList.filter(cookie => !this.isExpired(cookie))

        // 保存到存储
        this.persistCookies()
    }

    /**
     * 持久化保存Cookie
     */
    persistCookies() {
        const cookieStrings = this.cookiesList.map(cookie => this.stringifyCookie(cookie))
        store.edit(editor => editor.putStringSet(this.cookieName, new Set(cookieStrings)))
    }

    /**
     * 获取适用于当前请求的Cookie
     * @param {string} url 请求URL
     * @returns {Array} Cookie列表
     */
    loadForRequest(url) {
        // 简化实现，返回所有未过期的Cookie
        return this.cookiesList.filter(cookie => !this.isExpired(cookie))
    }

    /**
     * 获取所有Cookie的字符串形式
     * @returns {string} Cookie字符串
     */
    getCookieString() {
        return this.cookiesList
            .filter(cookie => !this.isExpired(cookie))
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ')
    }
}

export default CookieJar