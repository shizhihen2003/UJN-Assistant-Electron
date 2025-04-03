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
        super(
            UJNAPI.IPASS_HOST,
            'IPASS_ACCOUNT',
            'IPASS_PASSWORD',
            'http',
            'ipassCookie'
        )

        // 使用CookieJar管理Cookie
        this.cookieJar = new CookieJar(this.scheme, this.host, this.cookieName)

        // VPN的Cookie单独管理
        this.vpnCookieJar = new CookieJar('https', UJNAPI.VPN_HOST, 'vpnCookie')

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
        if (this._useVpn) {
            // VPN模式下，需要使用加密URL
            const originalUrl = `${this.scheme}://${this.host}/${path || ''}`;
            // 生成加密后的URL
            const encryptedUrl = VpnEncodeUtils.encryptUrl(originalUrl);
            // 返回VPN格式的URL
            return encryptedUrl;
        } else {
            // 普通模式下，直接拼接URL
            return `${this.scheme}://${this.host}/${path || ''}`;
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

            // 使用正确的URL检查登录状态
            let checkUrl;
            if (this._useVpn) {
                // VPN模式下使用加密URL
                const baseUrl = `http://one.ujn.edu.cn/up/`;
                checkUrl = VpnEncodeUtils.encryptUrl(baseUrl);
            } else {
                // 普通模式下直接使用URL
                checkUrl = `http://one.ujn.edu.cn/up/`;
            }

            console.log(`检查URL: ${checkUrl}`)

            // 获取正确的Cookie
            const cookies = this._useVpn ?
                await this.vpnCookieJar.getCookies() :
                await this.cookieJar.getCookies();

            console.log(`使用Cookie列表 (${cookies.length}个):`)
            cookies.forEach((cookie, index) => {
                console.log(`Cookie ${index + 1}: ${cookie}`)
            })

            // 手动构建Cookie字符串
            const cookieString = cookies.join('; ');
            console.log(`构建的Cookie字符串: ${cookieString}`);

            // 发起请求
            console.log(`发送请求...`)
            const response = await ipc.ipassGet(checkUrl, {
                cookies: cookies, // 添加cookies数组
                headers: {
                    'Cookie': cookieString,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                maxRedirects: 0,
                validateStatus: status => (status >= 200 && status < 300) || status === 302
            })

            console.log(`响应状态码: ${response.status}`)

            // 记录响应头
            console.log(`响应头:`)
            for (const [key, value] of Object.entries(response.headers || {})) {
                console.log(`${key}: ${value}`)
            }

            // 记录响应Cookie
            if (response.cookies && response.cookies.length > 0) {
                console.log(`响应包含 ${response.cookies.length} 个Cookie:`)
                response.cookies.forEach((cookie, index) => {
                    console.log(`响应Cookie ${index + 1}: ${cookie}`)
                })
            } else {
                console.log(`响应不包含Cookie`)
            }

            // 记录响应的重定向位置
            if (response.location) {
                console.log(`响应包含重定向: ${response.location}`)
            }

            // 输出响应内容的前200个字符，用于调试
            if (response.data) {
                const preview = typeof response.data === 'string' ?
                    response.data.substring(0, 200) :
                    JSON.stringify(response.data).substring(0, 200);
                console.log(`响应内容预览: ${preview}...`)

                // 检查内容中的关键标识
                const hasLoginForm = response.data.includes('id="loginForm"');
                const hasRefreshMeta = response.data.includes('url=http://one.ujn.edu.cn/up/view?m=up#act=portal/viewhome');

                console.log(`包含登录表单: ${hasLoginForm}`)
                console.log(`包含重定向meta标签: ${hasRefreshMeta}`)
            }

            // 判断登录状态
            if (response.data && response.data.includes('url=http://one.ujn.edu.cn/up/view?m=up#act=portal/viewhome')) {
                console.log("已检测到有效的登录会话，为已登录状态")
                return true;
            }

            // 检查响应内容是否包含登录表单
            if (response.data && response.data.includes('id="loginForm"')) {
                console.log("检测到未登录状态，发现登录表单")
                return false;
            }

            // 如果是302状态，检查重定向目标
            if (response.status === 302) {
                const location = response.location || '';
                const isLoginRedirect = location.includes('login');
                console.log(`收到重定向，目标: ${location}`)
                console.log(`是否为登录页面重定向: ${isLoginRedirect}`)

                return !isLoginRedirect;
            }

            // 默认情况处理
            console.log("无法确定登录状态，默认为未登录")
            return false;
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
     * 登录实现方法 - 完整修复版
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

            // 清空相应的Cookie
            if (this._useVpn) {
                console.log('清空VPN Cookie');
                this.vpnCookieJar.clearCookies();
            } else {
                console.log('清空普通Cookie');
                this.cookieJar.clearCookies();
            }

            // 准备基础URL
            let loginPageUrl;
            if (this._useVpn) {
                // VPN模式下，需要加密URL
                const baseUrl = "http://sso.ujn.edu.cn/tpass/login"; // 原始URL
                loginPageUrl = VpnEncodeUtils.encryptUrl(baseUrl); // 加密URL
                console.log(`VPN模式登录URL: ${loginPageUrl}`);
            } else {
                // 非VPN模式，使用普通URL
                loginPageUrl = `${this.scheme}://${this.host}/tpass/login`;
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

            // 检查请求是否成功
            if (!loginResult.success) {
                console.error("登录请求失败:", loginResult.error || '未知错误');
                console.error("完整错误信息:", loginResult);
                return false;
            }

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
            if (loginResult.status === 302) {
                // 获取重定向URL
                const locationHeader = loginResult.location || '';
                console.log(`接收到重定向URL: ${locationHeader}`);

                // 检查重定向URL是否包含login，如果包含则登录失败
                if (!locationHeader.includes('login')) {
                    console.log("登录成功，收到重定向到非登录页面");

                    // 尝试访问重定向URL获取更多Cookie
                    if (locationHeader) {
                        try {
                            // 修复: 确保使用完整重定向URL，包括查询参数(ticket)
                            let redirectUrl;

                            // 处理重定向URL
                            if (this._useVpn) {
                                if (locationHeader.startsWith('http')) {
                                    // 完整URL加密
                                    redirectUrl = VpnEncodeUtils.encryptUrl(locationHeader);
                                } else {
                                    // 相对URL需要补全
                                    const baseUrl = `http://sso.ujn.edu.cn${locationHeader.startsWith('/') ? '' : '/'}${locationHeader}`;
                                    redirectUrl = VpnEncodeUtils.encryptUrl(baseUrl);
                                }
                            } else {
                                // 非VPN模式直接使用完整URL
                                redirectUrl = locationHeader.startsWith('http') ?
                                    locationHeader : // 已经是绝对URL
                                    `${this.scheme}://${this.host}${locationHeader.startsWith('/') ? '' : '/'}${locationHeader}`;
                            }

                            console.log(`跟随重定向到: ${redirectUrl}`);

                            // 检查redirectUrl中是否包含ticket参数
                            if (!redirectUrl.includes('ticket=') && locationHeader.includes('ticket=')) {
                                console.warn(`警告: 重定向URL中ticket参数丢失，使用原始URL`);

                                // 如果处理后的URL丢失了ticket参数，使用原始URL
                                if (this._useVpn) {
                                    redirectUrl = VpnEncodeUtils.encryptUrl(locationHeader);
                                } else {
                                    redirectUrl = locationHeader;
                                }
                                console.log(`修正后的重定向URL: ${redirectUrl}`);
                            }

                            const currentCookiesUpdated = this._useVpn ?
                                await this.vpnCookieJar.getCookies() :
                                await this.cookieJar.getCookies();

                            console.log("重定向时的Cookie:", currentCookiesUpdated);

                            // 发起重定向请求，增加重试机制
                            let redirectResult;
                            try {
                                redirectResult = await ipc.ipassGet(redirectUrl, {
                                    cookies: currentCookiesUpdated,
                                    headers: {
                                        'Referer': loginPageUrl,
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                    }
                                });
                            } catch (retryError) {
                                console.warn("第一次重定向请求失败，尝试重试:", retryError);
                                // 等待1秒后重试
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                redirectResult = await ipc.ipassGet(redirectUrl, {
                                    cookies: currentCookiesUpdated,
                                    headers: {
                                        'Referer': loginPageUrl,
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                    }
                                });
                            }

                            console.log(`重定向请求状态: ${redirectResult.status}`);

                            // 保存重定向返回的Cookie
                            if (redirectResult.cookies && redirectResult.cookies.length > 0) {
                                console.log(`重定向返回Cookie: ${redirectResult.cookies.length}个`);
                                if (this._useVpn) {
                                    await this.vpnCookieJar.saveCookies(redirectResult.cookies);
                                } else {
                                    await this.cookieJar.saveCookies(redirectResult.cookies);
                                }
                            }

                            // 处理后续重定向
                            if (redirectResult.status === 302 && redirectResult.location) {
                                // 二次重定向
                                let nextRedirectUrl = redirectResult.location;
                                console.log(`检测到二次重定向: ${nextRedirectUrl}`);

                                // 确保URL是完整的
                                if (!nextRedirectUrl.startsWith('http')) {
                                    // 处理相对URL
                                    const urlParts = new URL(redirectUrl);
                                    const baseUrl = `${urlParts.protocol}//${urlParts.hostname}`;

                                    if (nextRedirectUrl.startsWith('/')) {
                                        nextRedirectUrl = `${baseUrl}${nextRedirectUrl}`;
                                    } else {
                                        // 获取路径的父目录
                                        const pathParts = urlParts.pathname.split('/');
                                        pathParts.pop();
                                        const parentPath = pathParts.join('/');
                                        nextRedirectUrl = `${baseUrl}${parentPath}/${nextRedirectUrl}`;
                                    }
                                }

                                // 如果需要加密
                                if (this._useVpn) {
                                    nextRedirectUrl = VpnEncodeUtils.encryptUrl(nextRedirectUrl);
                                }

                                console.log(`跟随二次重定向到: ${nextRedirectUrl}`);

                                // 确保二次重定向URL中的ticket参数不丢失
                                if (!nextRedirectUrl.includes('ticket=') && redirectResult.location.includes('ticket=')) {
                                    console.warn(`警告: 二次重定向URL中ticket参数丢失，使用原始URL`);

                                    if (this._useVpn) {
                                        nextRedirectUrl = VpnEncodeUtils.encryptUrl(redirectResult.location);
                                    } else {
                                        nextRedirectUrl = redirectResult.location;
                                    }
                                    console.log(`修正后的二次重定向URL: ${nextRedirectUrl}`);
                                }

                                // 获取最新Cookie
                                const updatedCookies = this._useVpn ?
                                    await this.vpnCookieJar.getCookies() :
                                    await this.cookieJar.getCookies();

                                // 发起二次重定向请求
                                const secondRedirectResult = await ipc.ipassGet(nextRedirectUrl, {
                                    cookies: updatedCookies,
                                    headers: {
                                        'Referer': redirectUrl,
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                    }
                                });

                                console.log(`二次重定向请求状态: ${secondRedirectResult.status}`);

                                // 保存二次重定向返回的Cookie
                                if (secondRedirectResult.cookies && secondRedirectResult.cookies.length > 0) {
                                    console.log(`二次重定向返回Cookie: ${secondRedirectResult.cookies.length}个`);
                                    if (this._useVpn) {
                                        await this.vpnCookieJar.saveCookies(secondRedirectResult.cookies);
                                    } else {
                                        await this.cookieJar.saveCookies(secondRedirectResult.cookies);
                                    }
                                }

                                // 处理三次重定向 - 新增部分
                                if (secondRedirectResult.status === 302 && secondRedirectResult.location) {
                                    let thirdRedirectUrl = secondRedirectResult.location;
                                    console.log(`检测到三次重定向: ${thirdRedirectUrl}`);

                                    // 确保URL是完整的
                                    if (!thirdRedirectUrl.startsWith('http')) {
                                        // 处理相对URL
                                        if (thirdRedirectUrl.startsWith('/')) {
                                            // 判断基础域名
                                            if (nextRedirectUrl.includes('one.ujn.edu.cn')) {
                                                thirdRedirectUrl = `http://one.ujn.edu.cn${thirdRedirectUrl}`;
                                            } else {
                                                thirdRedirectUrl = `${this.scheme}://${this.host}${thirdRedirectUrl}`;
                                            }
                                        } else {
                                            try {
                                                const urlParts = new URL(nextRedirectUrl);
                                                const baseUrl = `${urlParts.protocol}//${urlParts.hostname}`;
                                                const pathParts = urlParts.pathname.split('/');
                                                pathParts.pop();
                                                const parentPath = pathParts.join('/');
                                                thirdRedirectUrl = `${baseUrl}${parentPath}/${thirdRedirectUrl}`;
                                            } catch (e) {
                                                console.error("构建三次重定向URL失败:", e);
                                                thirdRedirectUrl = secondRedirectResult.location;
                                            }
                                        }
                                    }

                                    // 如果需要加密
                                    if (this._useVpn) {
                                        thirdRedirectUrl = VpnEncodeUtils.encryptUrl(thirdRedirectUrl);
                                    }

                                    console.log(`跟随三次重定向到: ${thirdRedirectUrl}`);

                                    // 确保ticket参数不丢失
                                    if (!thirdRedirectUrl.includes('ticket=') && secondRedirectResult.location.includes('ticket=')) {
                                        console.warn(`警告: 三次重定向URL中ticket参数丢失，使用原始URL`);
                                        if (this._useVpn) {
                                            thirdRedirectUrl = VpnEncodeUtils.encryptUrl(secondRedirectResult.location);
                                        } else {
                                            thirdRedirectUrl = secondRedirectResult.location;
                                        }
                                        console.log(`修正后的三次重定向URL: ${thirdRedirectUrl}`);
                                    }

                                    // 获取最新Cookie
                                    const thirdCookies = this._useVpn ?
                                        await this.vpnCookieJar.getCookies() :
                                        await this.cookieJar.getCookies();

                                    // 发起三次重定向请求
                                    try {
                                        const thirdRedirectResult = await ipc.ipassGet(thirdRedirectUrl, {
                                            cookies: thirdCookies,
                                            headers: {
                                                'Referer': nextRedirectUrl,
                                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                            }
                                        });

                                        console.log(`三次重定向请求状态: ${thirdRedirectResult.status}`);

                                        // 保存三次重定向返回的Cookie
                                        if (thirdRedirectResult.cookies && thirdRedirectResult.cookies.length > 0) {
                                            console.log(`三次重定向返回Cookie: ${thirdRedirectResult.cookies.length}个`);
                                            if (this._useVpn) {
                                                await this.vpnCookieJar.saveCookies(thirdRedirectResult.cookies);
                                            } else {
                                                await this.cookieJar.saveCookies(thirdRedirectResult.cookies);
                                            }
                                        }

                                        // 处理可能的四次重定向（如有必要）
                                        if (thirdRedirectResult.status === 302 && thirdRedirectResult.location) {
                                            console.log(`检测到四次重定向: ${thirdRedirectResult.location}`);
                                            // 处理四次重定向...
                                        }
                                    } catch (thirdRedirectError) {
                                        console.error("三次重定向请求失败", thirdRedirectError);
                                        console.error("尝试重试...");

                                        // 重试一次
                                        try {
                                            await new Promise(resolve => setTimeout(resolve, 1000));
                                            const thirdRetryResult = await ipc.ipassGet(thirdRedirectUrl, {
                                                cookies: thirdCookies,
                                                headers: {
                                                    'Referer': nextRedirectUrl,
                                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                                }
                                            });

                                            console.log(`三次重定向重试请求状态: ${thirdRetryResult.status}`);

                                            // 保存重试返回的Cookie
                                            if (thirdRetryResult.cookies && thirdRetryResult.cookies.length > 0) {
                                                console.log(`重试返回Cookie: ${thirdRetryResult.cookies.length}个`);
                                                if (this._useVpn) {
                                                    await this.vpnCookieJar.saveCookies(thirdRetryResult.cookies);
                                                } else {
                                                    await this.cookieJar.saveCookies(thirdRetryResult.cookies);
                                                }
                                            }
                                        } catch (retryError) {
                                            console.error("重试也失败了", retryError);
                                            // 忽略错误继续执行
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            console.error("跟随重定向失败", e);
                            // 记录错误详情，但不影响登录结果
                            console.error("错误详情:", {
                                message: e.message,
                                stack: e.stack
                            });
                        }
                    }

                    // 保存最终的Cookie状态
                    console.log(`\n[最终Cookie状态]`);
                    const finalCookies = this._useVpn ?
                        await this.vpnCookieJar.getCookies() :
                        await this.cookieJar.getCookies();

                    console.log("最终Cookie列表:", finalCookies);
                    console.log("==== 智慧济大登录成功 ====");
                    return true;
                } else {
                    console.log("登录失败，重定向到登录页面");
                    return false;
                }
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
            console.error('登录过程发生异常:', error);

            // 如果普通模式登录失败，尝试VPN模式
            if (!this._useVpn) {
                console.log("普通模式登录失败，尝试使用VPN模式");
                this._useVpn = true;
                try {
                    return await this.absLogin(account, password);
                } catch (vpnError) {
                    console.error("VPN模式也失败", vpnError);
                    this._useVpn = false; // 恢复原设置
                    return false;
                }
            }

            return false;
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
            throw new NeedLoginException();
        }

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

            // 检查重定向到登录页面的情况
            if (response.status === 302 && response.location && response.location.includes('login')) {
                this.isLogin = await this.login();
                if (!this.isLogin) {
                    throw new NeedLoginException();
                }
                return this.get(url);
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
     * @throws {Error} 网络错误或需要登录错误
     */
    async post(url, data) {
        if (!await this.checkLogin()) {
            throw new NeedLoginException();
        }

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
     * GET请求（不检查登录状态）
     * @param {string} url 请求路径
     * @returns {Promise<Object>} 响应对象
     * @throws {Error} 网络错误
     */
    async getNoCheck(url) {
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
     * POST请求（不检查登录状态）
     * @param {string} url 请求路径
     * @param {Object} data 请求数据
     * @returns {Promise<Object>} 响应对象
     * @throws {Error} 网络错误
     */
    async postNoCheck(url, data) {
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
     * GET请求（不跟随重定向）
     * @param {string} url 请求路径
     * @returns {Promise<Object>} 响应对象
     * @throws {Error} 网络错误
     */
    async getNoRedirect(url) {
        try {
            // 选择正确的Cookie
            const cookies = this._useVpn ?
                await this.vpnCookieJar.getCookies() :
                await this.cookieJar.getCookies();

            const response = await ipc.ipassGet(this.getFullUrl(url), {
                cookies: cookies,
                maxRedirects: 0,
                validateStatus: status => (status >= 200 && status < 300) || (status >= 300 && status < 400)
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