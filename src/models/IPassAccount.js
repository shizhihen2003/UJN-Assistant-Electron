// src/models/IPassAccount.js
import axios from 'axios'
import Account, { NeedLoginException } from './Account'
import CookieJar from './CookieJar'
import { UJNAPI } from '../constants/api'
import store from '../utils/store'
import VpnEncodeUtils from '../utils/vpnEncodeUtils'
import ipc from '../utils/ipc'

/**
 * 智慧济大账号类
 */
class IPassAccount extends Account {
    /**
     * 私有构造函数，使用 getInstance 获取实例
     */
    constructor() {
        // 动态获取 SSO 主机地址
        const ssoHost = UJNAPI.IPASS_HOST || 'sso.ujn.edu.cn';
        
        super(
            ssoHost,
            'IPASS_ACCOUNT',
            'IPASS_PASSWORD',
            'http',
            'ipassCookie'
        )

        // 使用CookieJar管理Cookie
        this.cookieJar = new CookieJar(this.scheme, this.host, this.cookieName)

        // VPN的Cookie单独管理 - 动态获取VPN主机地址
        const vpnHost = UJNAPI.VPN_HOST || 'webvpn.ujn.edu.cn';
        this.vpnCookieJar = new CookieJar('https', vpnHost, 'vpnCookie')

        // 添加VPN设置属性
        this._useVpn = false

        // 创建axios实例
        this.axiosInstance = axios.create({
            timeout: 30000,
            withCredentials: true
        })

        // 请求拦截器
        this.axiosInstance.interceptors.request.use(
            config => {
                // 使用内部的VPN设置
                config.headers.Cookie = this._useVpn
                    ? this.vpnCookieJar.getCookieString()
                    : this.cookieJar.getCookieString()
                return config
            },
            error => Promise.reject(error)
        )

        // 响应拦截器
        this.axiosInstance.interceptors.response.use(
            response => {
                // 使用内部的VPN设置保存Cookie
                if (this._useVpn) {
                    this.vpnCookieJar.saveFromResponse(response)
                } else {
                    this.cookieJar.saveFromResponse(response)
                }
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
     * 重置单例实例（学校切换时调用）
     */
    static resetInstance() {
        if (IPassAccount.instance) {
            IPassAccount.instance.clearCookies();
            IPassAccount.instance = null;
        }
    }

    /**
     * 刷新配置（学校切换时调用）
     * 更新host和CookieJar以匹配新学校
     */
    refreshConfig() {
        const ssoHost = UJNAPI.IPASS_HOST || 'sso.ujn.edu.cn';
        const vpnHost = UJNAPI.VPN_HOST || 'webvpn.ujn.edu.cn';
        
        console.log(`[IPassAccount] 刷新配置: SSO=${ssoHost}, VPN=${vpnHost}`);
        
        // 更新主机地址
        this.host = ssoHost;
        
        // 重新创建CookieJar
        this.cookieJar = new CookieJar(this.scheme, this.host, this.cookieName);
        this.vpnCookieJar = new CookieJar('https', vpnHost, 'vpnCookie');
        
        // 重置登录状态
        this.isLogin = false;
    }

    /**
     * 获取VPN使用状态
     * @returns {boolean} 是否使用VPN
     */
    get useVpn() {
        return this._useVpn
    }

    /**
     * 设置VPN使用状态
     * @param {boolean} value 是否使用VPN
     */
    set useVpn(value) {
        this._useVpn = !!value // 强制转换为布尔值
        console.log(`IPassAccount VPN设置已更新为: ${this._useVpn}`)
    }

    /**
     * 获取完整URL
     * @param {string} path 路径
     * @returns {string} 完整URL
     */
    getFullUrl(path) {
        // 动态获取当前主机地址
        const currentHost = UJNAPI.IPASS_HOST || this.host;
        
        if (this._useVpn) {
            // VPN模式下，需要使用加密URL
            const originalUrl = `${this.scheme}://${currentHost}/${path || ''}`;
            // 生成加密后的URL
            const encryptedUrl = VpnEncodeUtils.encryptUrl(originalUrl);
            // 返回VPN格式的URL
            return encryptedUrl;
        } else {
            // 普通模式下，直接拼接URL
            return `${this.scheme}://${currentHost}/${path || ''}`;
        }
    }

    /**
     * 检查登录状态
     * @returns {Promise<boolean>} 是否已登录
     */
    async absCheckLogin() {
        try {
            // 首先加载存储中的VPN设置
            try {
                const savedUseVpn = await store.getBoolean('EA_USE_VPN', false)
                this._useVpn = !!savedUseVpn
            } catch (error) {
                console.error('加载VPN设置失败', error)
                // 默认为false
                this._useVpn = false
            }

            console.log(`===== 检查智慧济大登录状态 =====`)
            console.log(`使用VPN模式: ${this._useVpn}`)
            console.log(`当前学校: ${UJNAPI.SCHOOL_NAME}`)

            // 直接尝试访问主页确认登录状态
            const isLoggedIn = await this.tryAccessHomePage();
            console.log(`登录状态检查结果: ${isLoggedIn ? '已登录' : '未登录'}`);

            return isLoggedIn;
        } catch (error) {
            console.error('检查登录状态失败:', error)
            if (error.stack) {
                console.error('错误堆栈:', error.stack)
            }
            return false;
        } finally {
            console.log(`===== 检查登录状态结束 =====`)
        }
    }

    /**
     * 登录实现方法 - 动态获取学校配置版
     * @param {string} account 账号
     * @param {string} password 密码
     * @returns {Promise<boolean>} 登录是否成功
     */
    async absLogin(account, password) {
        try {
            console.log(`==== 智慧济大登录过程开始 ====`);
            console.log(`账号: ${account}`);
            console.log(`密码长度: ${password.length}`);
            console.log(`使用VPN: ${this._useVpn}`);
            console.log(`当前学校: ${UJNAPI.SCHOOL_NAME} (${UJNAPI.SCHOOL_ID})`);

            // 动态获取配置
            const ssoHost = UJNAPI.IPASS_HOST || 'sso.ujn.edu.cn';
            const ssoLoginUrl = UJNAPI.IPASS_LOGIN || `http://${ssoHost}/tpass/login/`;
            const vpnHost = UJNAPI.VPN_HOST || 'webvpn.ujn.edu.cn';
            const portalUrl = UJNAPI.PORTAL_URL || 'http://one.ujn.edu.cn/';
            
            console.log(`SSO主机: ${ssoHost}`);
            console.log(`SSO登录URL: ${ssoLoginUrl}`);
            console.log(`VPN主机: ${vpnHost}`);

            // 清空相应的Cookie
            if (this._useVpn) {
                console.log('清空VPN Cookie');
                this.vpnCookieJar.clearCookies();
            } else {
                console.log('清空普通Cookie');
                this.cookieJar.clearCookies();
            }

            // 准备基础URL - 动态构建
            let loginPageUrl;
            if (this._useVpn) {
                // VPN模式下，需要加密URL并添加正确的service参数
                // 动态构建SSO登录URL
                const baseUrl = ssoLoginUrl.endsWith('/') ? ssoLoginUrl.slice(0, -1) : ssoLoginUrl;
                // service参数指向VPN登录回调
                const serviceParam = `?service=https%3A%2F%2F${vpnHost}%2Flogin%3Fcas_login%3Dtrue`;
                const fullUrl = baseUrl + serviceParam;
                loginPageUrl = VpnEncodeUtils.encryptUrl(fullUrl);
                console.log(`VPN模式登录URL: ${loginPageUrl}`);
            } else {
                // 非VPN模式，使用硬编码的济南大学URL格式（确保格式正确）
                // 原始格式：http://sso.ujn.edu.cn/tpass/login?service=http%3A%2F%2Fone.ujn.edu.cn%2Fup%2Fview%3Fm%3Dup
                const serviceParam = "?service=http%3A%2F%2Fone.ujn.edu.cn%2Fup%2Fview%3Fm%3Dup";
                loginPageUrl = `${this.scheme}://${ssoHost}/tpass/login${serviceParam}`;
                console.log(`普通模式登录URL: ${loginPageUrl}`);
            }

            // 步骤1: 获取登录页面
            console.log(`\n[步骤1] 请求登录页面: ${loginPageUrl}`);
            const loginPageResult = await ipc.ipassGet(loginPageUrl);

            if (!loginPageResult.success) {
                console.error("获取登录页面失败:", loginPageResult.error || '未知错误', loginPageResult);
                return false;
            }

            console.log(`登录页面请求成功，状态码: ${loginPageResult.status}`);

            // 保存初始Cookie并详细记录
            if (loginPageResult.cookies && loginPageResult.cookies.length > 0) {
                console.log(`接收到初始Cookie: ${loginPageResult.cookies.length}个`);
                console.log("Cookie详情:", loginPageResult.cookies);

                if (this._useVpn) {
                    await this.vpnCookieJar.saveCookies(loginPageResult.cookies);
                    console.log("已保存VPN Cookie:", await this.vpnCookieJar.getCookies());
                } else {
                    await this.cookieJar.saveCookies(loginPageResult.cookies);
                    console.log("已保存普通Cookie:", await this.cookieJar.getCookies());
                }
            } else {
                console.warn("登录页面未返回Cookie");
            }

            const loginPageHtml = loginPageResult.data;

            // 步骤2: 提取lt值
            console.log(`\n[步骤2] 从登录页面提取lt值`);
            const ltPattern = /name="lt" value="(LT-\d+-[a-zA-Z\d]+-tpass)"/;
            const ltMatch = loginPageHtml.match(ltPattern);

            if (!ltMatch) {
                console.error("无法获取lt值，登录页面HTML片段:", loginPageHtml.substring(0, 200));
                return false;
            }

            const lt = ltMatch[1];
            console.log(`成功获取lt值: ${lt}`);

            // 步骤3: 加密账号密码
            console.log(`\n[步骤3] 加密账号密码`);
            const accountLength = account.length.toString();
            const passwordLength = password.length.toString();
            const secret = await VpnEncodeUtils.encode(account, password, lt);
            console.log("账号长度:", accountLength);
            console.log("密码长度:", passwordLength);
            console.log("加密数据已生成");

            // 获取当前的Cookie
            const currentCookies = this._useVpn ?
                await this.vpnCookieJar.getCookies() :
                await this.cookieJar.getCookies();

            console.log("当前Cookie:", currentCookies);

            // 创建登录数据
            const loginData = {
                rsa: secret,
                ul: accountLength,
                pl: passwordLength,
                lt: lt,
                execution: 'e1s1',
                _eventId: 'submit'
            };
            console.log("登录表单数据:", loginData);

            // 步骤4: 发起登录请求
            console.log(`\n[步骤4] 发起登录请求 URL: ${loginPageUrl}`);
            const loginHeaders = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': loginPageUrl,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };
            console.log("登录请求头:", loginHeaders);

            const loginResult = await ipc.ipassPost(loginPageUrl, loginData, {
                headers: loginHeaders,
                cookies: currentCookies
            });

            // 步骤5: 分析登录结果
            console.log(`\n[步骤5] 分析登录结果`);
            console.log(`登录状态码: ${loginResult.status || 'unknown'}`);

            // 保存登录返回的Cookie
            if (loginResult.cookies && loginResult.cookies.length > 0) {
                console.log(`登录返回Cookie: ${loginResult.cookies.length}个`);
                console.log("Cookie详情:", loginResult.cookies);

                if (this._useVpn) {
                    await this.vpnCookieJar.saveCookies(loginResult.cookies);
                    console.log("保存后的VPN Cookie:", await this.vpnCookieJar.getCookies());
                } else {
                    await this.cookieJar.saveCookies(loginResult.cookies);
                    console.log("保存后的普通Cookie:", await this.cookieJar.getCookies());
                }
            } else {
                console.warn("登录请求未返回Cookie");
            }

            // 处理重定向，关键修复点
            if (loginResult.status === 302 || loginResult.location) {
                const locationHeader = loginResult.location || '';
                console.log(`检测到重定向，目标URL: ${locationHeader}`);

                // VPN模式下，检查是否重定向到VPN登录成功页面
                if (this._useVpn && locationHeader.includes(vpnHost)) {
                    console.log("VPN模式登录成功，正在跟随重定向...");

                    // 跟随重定向以获取VPN Cookie
                    try {
                        const vpnCookies = await this.vpnCookieJar.getCookies();
                        const redirectResult = await ipc.ipassGet(locationHeader, {
                            cookies: vpnCookies,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        });

                        if (redirectResult.cookies && redirectResult.cookies.length > 0) {
                            console.log(`VPN重定向返回Cookie: ${redirectResult.cookies.length}个`);
                            await this.vpnCookieJar.saveCookies(redirectResult.cookies);
                        }

                        // 如果还有进一步重定向
                        if (redirectResult.location) {
                            console.log(`继续重定向到: ${redirectResult.location}`);
                            const finalResult = await ipc.ipassGet(redirectResult.location, {
                                cookies: await this.vpnCookieJar.getCookies(),
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                }
                            });

                            if (finalResult.cookies && finalResult.cookies.length > 0) {
                                await this.vpnCookieJar.saveCookies(finalResult.cookies);
                            }
                        }
                    } catch (e) {
                        console.warn(`跟随VPN重定向失败: ${e.message}，但不影响登录结果`);
                    }

                    console.log("==== 智慧济大VPN登录成功 ====");
                    return true;
                }

                // 非VPN模式，检查是否重定向到门户
                if (!this._useVpn && (locationHeader.includes('one.ujn.edu.cn') || locationHeader.includes(portalUrl))) {
                    console.log("非VPN模式登录成功，正在跟随门户重定向...");

                    // 尝试访问门户以获取完整的Cookie
                    try {
                        const portalCookies = await this.cookieJar.getCookies();
                        const portalResult = await ipc.ipassGet(locationHeader, {
                            cookies: portalCookies,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        });

                        if (portalResult.cookies && portalResult.cookies.length > 0) {
                            console.log(`门户返回Cookie: ${portalResult.cookies.length}个`);
                            // 特别处理iPlanetDirectoryPro Cookie
                            for (const cookie of portalResult.cookies) {
                                if (cookie.includes('iPlanetDirectoryPro')) {
                                    // 确保设置正确的域名
                                    const enhancedCookie = cookie.includes('Domain=') ?
                                        cookie :
                                        cookie + '; Domain=.ujn.edu.cn; Path=/' + (cookie.includes('HttpOnly') ? '' : '; HttpOnly');
                                    console.log(`增强门户Cookie: ${enhancedCookie}`);
                                    await this.cookieJar.saveCookies([enhancedCookie]);
                                } else {
                                    // 其他Cookie正常保存
                                    await this.cookieJar.saveCookies([cookie]);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn(`跟随门户重定向失败: ${e.message}，但不影响登录结果`);
                    }

                    console.log("==== 智慧济大登录成功 ====");
                    return true;
                } else if (locationHeader.includes('login')) {
                    console.log("登录失败，重定向回登录页面");
                    return false;
                } else {
                    console.log("未检测到标准重定向，尝试访问主页验证");
                    const canAccessHome = await this.tryAccessHomePage();
                    return canAccessHome;
                }
            } else if (!loginResult.success) {
                // 其他失败情况
                console.error("登录请求失败:", loginResult.error || '未知错误');
                console.error("完整错误信息:", loginResult);
                return false;
            }

            // 处理非重定向响应
            if (loginResult.status === 200 && loginResult.data) {
                // 检查是否有登录表单或密码错误提示
                const hasLoginForm = loginResult.data.includes('id="loginForm"') ||
                    loginResult.data.includes('name="loginForm"');
                const hasPasswordError = loginResult.data.includes('密码错误') ||
                    loginResult.data.includes('用户名不存在');

                if (hasPasswordError) {
                    console.log("用户名或密码错误");
                    return false;
                } else if (!hasLoginForm) {
                    console.log("登录成功，直接返回主页");
                    return true;
                } else {
                    console.log("登录失败，仍在登录页面");
                    return false;
                }
            }

            // 其他所有情况都视为登录失败
            console.log("登录失败，状态码:", loginResult.status);
            return false;
        } catch (error) {
            console.error("登录过程发生错误:", error);
            if (error.stack) {
                console.error("错误堆栈:", error.stack);
            }
            return false;
        } finally {
            console.log("==== 智慧济大登录过程结束 ====");
        }
    }

    /**
     * 尝试访问主页验证登录状态
     * @returns {Promise<boolean>} 是否能够访问主页
     */
    async tryAccessHomePage() {
        try {
            // 动态获取门户URL
            const portalUrl = UJNAPI.PORTAL_URL || 'http://one.ujn.edu.cn/';
            const vpnHost = UJNAPI.VPN_HOST || 'webvpn.ujn.edu.cn';
            
            let homeUrl;
            if (this._useVpn) {
                // VPN模式下访问VPN主页
                homeUrl = `https://${vpnHost}/`;
            } else {
                // 普通模式下访问门户
                homeUrl = portalUrl;
            }

            const cookies = this._useVpn ?
                await this.vpnCookieJar.getCookies() :
                await this.cookieJar.getCookies();

            console.log(`尝试访问主页URL: ${homeUrl}`);
            console.log(`使用 ${cookies.length} 个Cookie`);

            // 尝试访问主页
            const homeResult = await ipc.ipassGet(homeUrl, {
                cookies: cookies,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            // 保存返回的Cookie
            if (homeResult.cookies && homeResult.cookies.length > 0) {
                console.log(`主页访问返回 ${homeResult.cookies.length} 个Cookie`);
                if (this._useVpn) {
                    await this.vpnCookieJar.saveCookies(homeResult.cookies);
                } else {
                    await this.cookieJar.saveCookies(homeResult.cookies);
                }
            }

            // 检查返回状态
            if (homeResult.status === 200) {
                console.log(`成功访问主页，状态码: 200`);

                // 检查页面内容是否包含登录表单
                if (homeResult.data && (homeResult.data.includes('id="loginForm"') || homeResult.data.includes('name="loginForm"'))) {
                    console.log(`页面包含登录表单，登录状态无效`);
                    return false;
                }

                console.log(`页面不包含登录表单，登录状态有效`);
                return true;
            } else if (homeResult.status === 302 && homeResult.location) {
                // 处理重定向
                console.log(`主页访问返回状态码302，重定向到: ${homeResult.location}`);

                if (homeResult.location.includes('login')) {
                    console.log(`重定向到登录页面，登录状态无效`);
                    return false;
                } else {
                    // 尝试跟随这个重定向
                    console.log(`尝试跟随重定向...`);
                    try {
                        const redirect = homeResult.location.startsWith('http') ?
                            homeResult.location :
                            `https://${vpnHost}${homeResult.location.startsWith('/') ? '' : '/'}${homeResult.location}`;

                        const redirectResult = await ipc.ipassGet(redirect, {
                            cookies: cookies,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        });

                        // 保存Cookie
                        if (redirectResult.cookies && redirectResult.cookies.length > 0) {
                            if (this._useVpn) {
                                await this.vpnCookieJar.saveCookies(redirectResult.cookies);
                            } else {
                                await this.cookieJar.saveCookies(redirectResult.cookies);
                            }
                        }

                        // 检查最终页面
                        if (redirectResult.status === 200 && redirectResult.data) {
                            if (redirectResult.data.includes('id="loginForm"') || redirectResult.data.includes('name="loginForm"')) {
                                console.log(`重定向后页面包含登录表单，登录状态无效`);
                                return false;
                            }
                            console.log(`重定向后成功访问，登录状态有效`);
                            return true;
                        }
                    } catch (e) {
                        console.warn(`跟随重定向失败: ${e.message}`);
                    }

                    return false;
                }
            } else {
                console.log(`主页访问状态异常: ${homeResult.status}`);
                return false;
            }
        } catch (error) {
            console.error(`验证登录状态失败:`, error);
            return false;
        }
    }

    /**
     * GET请求
     * @param {string} url 请求路径
     * @returns {Promise<Object>} 响应对象
     * @throws {Error} 网络错误
     */
    async get(url) {
        try {
            // 选择正确的Cookie
            const cookies = this._useVpn ?
                await this.vpnCookieJar.getCookies() :
                await this.cookieJar.getCookies();

            const response = await ipc.ipassGet(this.getFullUrl(url), {
                cookies: cookies
            });

            if (!response.success) {
                throw new Error(response.error || "Request failed");
            }

            return response;
        } catch (error) {
            console.error('GET请求失败', error);
            throw error;
        }
    }

    /**
     * POST请求
     * @param {string} url 请求路径
     * @param {Object} data 请求数据
     * @returns {Promise<Object>} 响应对象
     * @throws {Error} 网络错误
     */
    async post(url, data) {
        try {
            // 选择正确的Cookie
            const cookies = this._useVpn ?
                await this.vpnCookieJar.getCookies() :
                await this.cookieJar.getCookies();

            const response = await ipc.ipassPost(this.getFullUrl(url), data, {
                cookies: cookies,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (!response.success) {
                throw new Error(response.error || "Request failed");
            }

            return response;
        } catch (error) {
            console.error('POST请求失败', error);
            throw error;
        }
    }

    /**
     * POST请求（不跟随重定向）
     * @param {string} url 请求路径
     * @param {Object} data 请求数据
     * @returns {Promise<Object>} 响应对象
     * @throws {Error} 网络错误
     */
    async postNoRedirect(url, data) {
        try {
            // 选择正确的Cookie
            const cookies = this._useVpn ?
                await this.vpnCookieJar.getCookies() :
                await this.cookieJar.getCookies();

            const response = await ipc.ipassPost(this.getFullUrl(url), data, {
                cookies: cookies,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                maxRedirects: 0,
                validateStatus: status => (status >= 200 && status < 300) || (status >= 300 && status < 400)
            });

            if (!response.success) {
                throw new Error(response.error || "Request failed");
            }

            return response;
        } catch (error) {
            console.error('POST请求失败', error);
            throw error;
        }
    }

    /**
     * 清除Cookie
     */
    clearCookies() {
        this.cookieJar.clearCookies()
        this.vpnCookieJar.clearCookies()
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
        return this._useVpn ? this.vpnCookieJar.cookiesList : this.cookieJar.cookiesList
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
            const result = await this.ipass.absCheckLogin()

            if (!result) {
                // 如果未登录，尝试登录
                return await this.login()
            }

            // 登录后的额外处理
            if (this.needLogin) {
                return await this.afterLogin()
            }

            return true
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
                throw new NeedLoginException()
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
                throw new NeedLoginException()
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
     * 封装请求方法，自动加密URL
     * @param {string} method 请求方法
     * @param {string} url 请求URL
     * @param {Object} data 请求数据
     * @param {Object} options 请求选项
     * @returns {Promise<Object>} 响应结果
     */
    async request(method, url, data = null, options = {}) {
        // 确保已登录
        if (!await this.checkLogin()) {
            throw new NeedLoginException()
        }

        // 加密URL
        const encryptedUrl = VpnEncodeUtils.encryptUrl(url)

        // 创建请求参数
        const requestOptions = {
            ...options,
            method,
            url: encryptedUrl
        }

        // 如果是POST请求，添加数据
        if (method === 'POST' && data) {
            requestOptions.data = data
        }

        // 发起请求
        return await this.ipass.axiosInstance.request(requestOptions)
    }

    /**
     * 带协议和主机的GET请求
     * @param {string} scheme 协议
     * @param {string} host 主机
     * @param {string} url 路径
     * @returns {Promise<Object>} 响应对象
     */
    async get(scheme, host, url) {
        const fullUrl = `${scheme}://${host}/${url}`
        return await this.request('GET', fullUrl)
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
        const fullUrl = `${scheme}://${host}/${url}`
        return await this.request('POST', fullUrl, body)
    }

    /**
     * GET请求
     * @param {string} url 路径
     * @returns {Promise<Object>} 响应对象
     */
    async get(url) {
        const fullUrl = `${this.scheme}://${this.host}/${url}`
        return await this.request('GET', fullUrl)
    }

    /**
     * POST请求
     * @param {string} url 路径
     * @param {Object} body 请求体
     * @returns {Promise<Object>} 响应对象
     */
    async post(url, body) {
        const fullUrl = `${this.scheme}://${this.host}/${url}`
        return await this.request('POST', fullUrl, body)
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
