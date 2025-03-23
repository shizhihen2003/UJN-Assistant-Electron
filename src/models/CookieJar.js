// src/models/CookieJar.js
import ipc from '../utils/ipc'

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
        this.loadCookie()
    }

    /**
     * 加载Cookie
     */
    async loadCookie() {
        try {
            const cookieStrings = await ipc.getStoreValue(this.cookieName, [])
            if (cookieStrings && cookieStrings.length > 0) {
                this.loadCookiesFromArray(cookieStrings)
                console.log(`已从存储加载 ${this.cookiesList.length} 个Cookie`)
            }
        } catch (e) {
            console.error('加载Cookie失败', e)
            this.cookiesList = []
        }
    }

    /**
     * 从字符串数组加载Cookie
     * @param {Array<string>} cookieStrings Cookie字符串数组
     */
    loadCookiesFromArray(cookieStrings) {
        if (!cookieStrings || !Array.isArray(cookieStrings)) {
            console.warn('无效的Cookie数组')
            return
        }

        this.cookiesList = cookieStrings.map(cookieString => {
            try {
                // 解析Cookie字符串
                return this.parseCookie(cookieString)
            } catch (e) {
                console.error('解析Cookie失败', e, cookieString)
                return null
            }
        }).filter(cookie => cookie !== null)
    }

    /**
     * 解析Cookie字符串为对象
     * @param {string} cookieString Cookie字符串
     * @returns {Object} Cookie对象
     */
    parseCookie(cookieString) {
        // Cookie格式: name=value; Domain=domain; Path=path; Expires=date; Secure; HttpOnly
        const parts = cookieString.split(';')
        const mainPart = parts[0].trim().split('=')

        if (mainPart.length < 2) {
            throw new Error(`无效的Cookie格式: ${cookieString}`)
        }

        const name = mainPart[0].trim()
        const value = mainPart.slice(1).join('=').trim() // 处理值中可能含有等号的情况

        const cookie = {
            name,
            value,
            domain: this.host,
            path: '/',
            expires: null,
            secure: false,
            httpOnly: false
        }

        // 解析其他属性
        for (let i = 1; i < parts.length; i++) {
            const part = parts[i].trim()
            if (!part) continue

            if (part.includes('=')) {
                const [attrName, attrValue] = part.split('=', 2)
                const name = attrName.trim().toLowerCase()
                const value = attrValue.trim()

                if (name === 'domain') cookie.domain = value
                else if (name === 'path') cookie.path = value
                else if (name === 'expires') {
                    try {
                        cookie.expires = new Date(value)
                    } catch (e) {
                        console.warn('无法解析Cookie过期时间', value)
                    }
                }
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
        ipc.setStoreValue(this.cookieName, [])
        console.log('已清空Cookie')
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
     * @param {Array<string>} cookies Cookie字符串数组
     */
    async saveCookies(cookies) {
        if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
            console.warn("没有需要保存的Cookie");
            return;
        }

        console.log(`接收到 ${cookies.length} 个Cookie`);

        try {
            // 处理每个新Cookie
            for (const cookieStr of cookies) {
                try {
                    // 特殊处理 JSESSIONID cookie
                    if (cookieStr.includes('JSESSIONID')) {
                        console.log("处理 JSESSIONID Cookie:", cookieStr);
                        // 查找是否已存在 JSESSIONID cookie
                        const existingIndex = this.cookiesList.findIndex(c =>
                            c.name === 'JSESSIONID'
                        );

                        const newCookie = this.parseCookie(cookieStr);

                        // 替换或添加新Cookie
                        if (existingIndex !== -1) {
                            this.cookiesList[existingIndex] = newCookie;
                            console.log("替换现有 JSESSIONID Cookie");
                        } else {
                            this.cookiesList.push(newCookie);
                            console.log("添加新 JSESSIONID Cookie");
                        }
                    } else {
                        // 处理其他 cookie
                        const newCookie = this.parseCookie(cookieStr);

                        // 查找是否已存在同名Cookie
                        const existingIndex = this.cookiesList.findIndex(c =>
                            c.name === newCookie.name &&
                            c.domain === newCookie.domain &&
                            c.path === newCookie.path
                        );

                        // 替换或添加新Cookie
                        if (existingIndex !== -1) {
                            this.cookiesList[existingIndex] = newCookie;
                        } else {
                            this.cookiesList.push(newCookie);
                        }
                    }
                } catch (e) {
                    console.error('解析Cookie失败', e, cookieStr);
                }
            }

            // 移除过期Cookie
            this.cookiesList = this.cookiesList.filter(cookie => !this.isExpired(cookie));

            // 保存到存储
            await this.persistCookies();
            console.log(`已保存 ${this.cookiesList.length} 个Cookie到存储`);
        } catch (error) {
            console.error("保存Cookie时出错:", error);
        }
    }

    /**
     * 持久化保存Cookie
     */
    async persistCookies() {
        try {
            const cookieStrings = this.cookiesList.map(cookie => this.stringifyCookie(cookie));
            if (cookieStrings.length > 0) {
                await ipc.setStoreValue(this.cookieName, cookieStrings);
                console.log(`已保存 ${cookieStrings.length} 个Cookie到存储`);
            } else {
                console.warn("没有Cookie需要保存");
            }
        } catch (error) {
            console.error("持久化保存Cookie失败:", error);
        }
    }

    /**
     * 获取适用于当前请求的Cookie列表
     * @returns {Array<string>} Cookie字符串数组
     */
    async getCookies() {
        return this.cookiesList
            .filter(cookie => !this.isExpired(cookie))
            .map(cookie => this.stringifyCookie(cookie));
    }
}

export default CookieJar;