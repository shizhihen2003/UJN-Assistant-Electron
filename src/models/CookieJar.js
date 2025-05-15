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
                console.log(`已从存储加载 ${this.cookiesList.length} 个Cookie，存储键: ${this.cookieName}`)
            }
        } catch (e) {
            console.error(`加载Cookie失败 (${this.cookieName})`, e)
            this.cookiesList = []
        }
    }

    /**
     * 从字符串数组加载Cookie
     * @param {Array<string>} cookieStrings Cookie字符串数组
     */
    loadCookiesFromArray(cookieStrings) {
        if (!cookieStrings || !Array.isArray(cookieStrings)) {
            console.warn(`无效的Cookie数组 (${this.cookieName})`)
            return
        }

        this.cookiesList = cookieStrings.map(cookieString => {
            try {
                // 解析Cookie字符串
                return this.parseCookie(cookieString)
            } catch (e) {
                console.error(`解析Cookie失败 (${this.cookieName})`, e, cookieString)
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
     * 保存响应中的Cookie
     * @param {Object} response 响应对象
     */
    saveFromResponse(response) {
        if (!response || !response.headers) return

        // 获取Set-Cookie头
        const setCookieHeaders = response.headers['set-cookie']
        if (!setCookieHeaders) return

        // 将字符串或数组转换为数组
        const cookiesArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders]

        // 保存每个Cookie
        this.saveCookies(cookiesArray)
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
        console.log(`已清空Cookie (${this.cookieName})`)
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
     * 保存Cookie字符串数组 - 增强版，处理跨域问题
     * @param {Array<string>} cookies Cookie字符串数组
     */
    async saveCookies(cookies) {
        if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
            console.warn(`没有需要保存的Cookie (${this.cookieName})`);
            return;
        }

        console.log(`接收到 ${cookies.length} 个Cookie (${this.cookieName})`);
        console.log(`Cookie列表:`, cookies);

        try {
            // 处理每个新Cookie
            for (const cookieStr of cookies) {
                try {
                    console.log(`处理Cookie: ${cookieStr}`);

                    // 解析Cookie字符串获取基本信息
                    const cookieParts = cookieStr.split(';');
                    const mainPart = cookieParts[0].trim().split('=');

                    if (mainPart.length < 2) {
                        console.warn(`无效的Cookie格式: ${cookieStr}`);
                        continue;
                    }

                    const name = mainPart[0].trim();
                    const value = mainPart.slice(1).join('=').trim();

                    // 确定Cookie的域和路径
                    let domain = this.host; // 默认使用当前主机
                    let path = '/';
                    let httpOnly = false;
                    let expires = null;

                    // 从Cookie字符串中提取属性
                    for (let i = 1; i < cookieParts.length; i++) {
                        const part = cookieParts[i].trim();
                        if (!part) continue;

                        if (part.toLowerCase().includes('domain=')) {
                            const domainMatch = part.match(/domain=([^;]+)/i);
                            if (domainMatch) domain = domainMatch[1].trim();
                        } else if (part.toLowerCase().includes('path=')) {
                            const pathMatch = part.match(/path=([^;]+)/i);
                            if (pathMatch) path = pathMatch[1].trim();
                        } else if (part.toLowerCase() === 'httponly') {
                            httpOnly = true;
                        } else if (part.toLowerCase().includes('expires=')) {
                            const expiresMatch = part.match(/expires=([^;]+)/i);
                            if (expiresMatch) {
                                try {
                                    expires = new Date(expiresMatch[1].trim());
                                } catch (e) {
                                    console.warn(`解析Cookie过期时间失败: ${expiresMatch[1]}`);
                                }
                            }
                        }
                    }

                    // 特殊处理：使用路径来确定域
                    // 关键修复：检测主系统Cookie
                    if (name === 'JSESSIONID' && path === '/up') {
                        domain = 'one.ujn.edu.cn';
                        console.log(`指定JSESSIONID Cookie域为: one.ujn.edu.cn，路径: ${path}`);
                    }

                    // 创建Cookie对象
                    const cookie = {
                        name,
                        value,
                        domain,
                        path,
                        expires,
                        httpOnly
                    };

                    console.log(`解析后的Cookie对象:`, {
                        name: cookie.name,
                        value: cookie.value.substring(0, 10) + '...',
                        domain: cookie.domain,
                        path: cookie.path,
                        expires: cookie.expires ? cookie.expires.toISOString() : null,
                        httpOnly: cookie.httpOnly
                    });

                    // 查找是否已存在同名Cookie
                    const existingIndex = this.cookiesList.findIndex(c =>
                        c.name === cookie.name &&
                        c.domain === cookie.domain &&
                        c.path === cookie.path
                    );

                    // 替换或添加新Cookie
                    if (existingIndex !== -1) {
                        console.log(`替换已存在的Cookie: ${cookie.name} (${cookie.domain})`);
                        this.cookiesList[existingIndex] = cookie;
                    } else {
                        console.log(`添加新Cookie: ${cookie.name} (${cookie.domain})`);
                        this.cookiesList.push(cookie);
                    }
                } catch (e) {
                    console.error(`解析Cookie失败 (${this.cookieName})`, e, cookieStr);
                }
            }

            // 移除过期Cookie
            const beforeCount = this.cookiesList.length;
            this.cookiesList = this.cookiesList.filter(cookie => !this.isExpired(cookie));
            const afterCount = this.cookiesList.length;

            if (beforeCount !== afterCount) {
                console.log(`已移除 ${beforeCount - afterCount} 个过期Cookie`);
            }

            // 保存到存储
            await this.persistCookies();
            console.log(`已保存 ${this.cookiesList.length} 个Cookie到存储 (${this.cookieName})`);

            // 打印当前所有保存的Cookie
            console.log(`当前保存的所有Cookie:`, this.cookiesList.map(c => ({
                name: c.name,
                domain: c.domain,
                path: c.path,
                value: c.value.substring(0, 10) + '...'
            })));
        } catch (error) {
            console.error(`保存Cookie失败 (${this.cookieName})`, error);
        }
    }

    /**
     * 持久化保存Cookie
     */
    async persistCookies() {
        try {
            const cookieStrings = this.cookiesList.map(cookie => this.stringifyCookie(cookie))
            if (cookieStrings.length > 0) {
                await ipc.setStoreValue(this.cookieName, cookieStrings)
                console.log(`已持久化 ${cookieStrings.length} 个Cookie (${this.cookieName})`)
            } else {
                console.warn(`没有Cookie需要保存 (${this.cookieName})`)
            }
        } catch (error) {
            console.error(`持久化保存Cookie失败 (${this.cookieName})`, error)
        }
    }

    /**
     * 获取适用于当前请求的Cookie列表
     * @returns {Promise<Array<string>>} Cookie字符串数组
     */
    async getCookies() {
        const validCookies = this.cookiesList.filter(cookie => !this.isExpired(cookie))
        return validCookies.map(cookie => this.stringifyCookie(cookie))
    }
}

export default CookieJar