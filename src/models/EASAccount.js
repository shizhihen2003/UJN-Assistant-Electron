// src/models/EASAccount.js
import Account from './Account';
import CookieJar from './CookieJar';
import { UJNAPI } from '../constants/api';
import store from '../utils/store';
import getenPassword from '../utils/cryptoUtils';
import { ElMessage } from 'element-plus';
import ipc from '../utils/ipc';
import VpnEncodeUtils from '../utils/vpnEncodeUtils';
import IPassAccount from './IPassAccount';

/**
 * 教务系统账号类
 */
class EASAccount extends Account {
    /**
     * 私有构造函数，使用 getInstance 获取实例
     */
    constructor() {
        // 添加调试信息
        console.log("UJNAPI对象:", UJNAPI);
        console.log("EA_HOSTS数组:", UJNAPI.EA_HOSTS);

        // 使用默认值初始化
        let hostIndex = 0;
        try {
            // 直接获取同步值，避免Promise问题
            const lastSuccessfulHost = localStorage.getItem('ujn_assistant_LAST_SUCCESSFUL_HOST');
            if (lastSuccessfulHost) {
                const parsed = parseInt(lastSuccessfulHost, 10);
                if (!isNaN(parsed) && parsed >= 0 && parsed < UJNAPI.EA_HOSTS.length) {
                    hostIndex = parsed;
                    console.log(`使用上次成功登录节点索引: ${hostIndex}`);
                }
            } else {
                const savedHost = localStorage.getItem('ujn_assistant_EA_HOST');
                if (savedHost) {
                    const parsed = parseInt(savedHost, 10);
                    if (!isNaN(parsed) && parsed >= 0 && parsed < UJNAPI.EA_HOSTS.length) {
                        hostIndex = parsed;
                        console.log(`使用保存的节点索引: ${hostIndex}`);
                    }
                }
            }
        } catch (e) {
            console.error("获取节点索引失败，使用默认值0", e);
        }

        // 确保获取到有效的主机地址
        const host = UJNAPI.EA_HOSTS[hostIndex];
        if (!host) {
            console.error("无法获取有效的主机地址！UJNAPI.EA_HOSTS:", UJNAPI.EA_HOSTS);
            throw new Error("初始化失败：无法获取有效的教务主机地址");
        }

        console.log(`初始化 EASAccount: 使用主机 ${host}`);

        super(
            host,
            'EAS_ACCOUNT',
            'EAS_PASSWORD',
            'http',
            'eaCookie'
        );

        // 保存当前使用的节点索引
        this._currentHostIndex = hostIndex;

        // 入学年份 - 同样使用同步方式
        this._entranceTime = localStorage.getItem('ujn_assistant_ENTRANCE_TIME') ?
            parseInt(localStorage.getItem('ujn_assistant_ENTRANCE_TIME'), 10) : -1;

        // 使用CookieJar管理Cookie
        this.cookieJar = new CookieJar(this.scheme, this.host, this.cookieName);

        // 加载VPN设置
        try {
            const savedUseVpn = localStorage.getItem('ujn_assistant_EA_USE_EAS_VPN') === 'true';
            EASAccount.useVpn = savedUseVpn;
            console.log(`从localStorage加载教务系统VPN设置: ${EASAccount.useVpn}`);
        } catch (e) {
            console.error("加载VPN设置失败，使用默认值false", e);
            EASAccount.useVpn = false;
        }
    }

    /**
     * 单例实例
     */
    static instance = null;

    /**
     * 获取单例实例
     * @returns {EASAccount} 实例
     */
    static getInstance() {
        if (EASAccount.useVpn) {
            // 在实际应用中实现 VpnEASAccount
            // return VpnEASAccount.getInstance()
            console.log('VPN模式暂未实现');

            if (!EASAccount.instance) {
                EASAccount.instance = new EASAccount();
            }

            return EASAccount.instance;
        }

        if (!EASAccount.instance) {
            EASAccount.instance = new EASAccount();
        }

        return EASAccount.instance;
    }

    /**
     * 是否使用VPN
     */
    static useVpn = store.getBoolean('EA_USE_VPN', false);

    /**
     * 切换教务节点
     * @param {number} index 节点索引
     */
    changeHost(index) {
        if (index >= UJNAPI.EA_HOSTS.length) return;

        this.isLogin = false;
        this.cookieJar.clearCookies();
        this.host = UJNAPI.EA_HOSTS[index];
        store.edit(editor => editor.putInt('EA_HOST', index));
    }

    /**
     * 获取入学年份
     * @returns {number} 入学年份
     */
    get entranceTime() {
        return this._entranceTime;
    }

    /**
     * 设置入学年份
     * @param {number} value 入学年份
     */
    set entranceTime(value) {
        this._entranceTime = value;
        store.edit(editor => editor.putInt('ENTRANCE_TIME', value));
    }

    // 静态VPN使用状态
    static useVpn = store.getBoolean('EA_USE_EAS_VPN', false);

    /**
     * 设置VPN使用状态
     * @param {boolean} value 是否使用VPN
     */
    set useVpn(value) {
        EASAccount.useVpn = !!value;
        console.log(`EASAccount VPN设置已更新为: ${EASAccount.useVpn}`);
    }

    /**
     * 获取VPN使用状态
     * @returns {boolean} 是否使用VPN
     */
    get useVpn() {
        return EASAccount.useVpn;
    }

    /**
     * 获取完整URL - 支持VPN模式
     * @param {string} path 路径
     * @returns {string} 完整URL
     */
    getFullUrl(path) {
        if (!this.host) {
            console.error("错误: 主机为undefined");
            throw new Error("主机未定义，无法构建URL");
        }

        // 构建原始URL
        const originalUrl = `${this.scheme}://${this.host}/${path || ''}`;

        // 如果使用VPN，通过VPN加密URL
        if (EASAccount.useVpn) {
            try {
                console.log(`构建VPN URL，原始URL: ${originalUrl}`);

                // 检查是否是教务系统URL
                if (this.host.includes('jwgl') && this.host.includes('ujn.edu.cn')) {
                    // 对于教务系统，使用固定的VPN前缀
                    const vpnUrl = `https://webvpn.ujn.edu.cn/http/77726476706e69737468656265737421fae046906925625e300d8db9d6562d/${path || ''}`;
                    console.log(`使用固定前缀构建教务系统VPN URL: ${vpnUrl}`);
                    return vpnUrl;
                }

                // 使用VpnEncodeUtils加密URL
                const vpnUrl = VpnEncodeUtils.encryptUrl(originalUrl);
                console.log(`加密后的VPN URL: ${vpnUrl}`);
                return vpnUrl;
            } catch (error) {
                console.error(`VPN URL加密失败: ${error.message}，使用原始URL`);
                return originalUrl;
            }
        }

        // 不使用VPN，直接返回普通URL
        return originalUrl;
    }

    /**
     * 检查页面内容是否有效（已登录）
     * @param {string} pageContent 页面内容
     * @returns {boolean} 是否有效
     */
    isValidLoggedInPage(pageContent) {
        if (!pageContent) {
            console.log("页面内容为空，无效");
            return false;
        }

        // 检查是否包含登录表单
        if (pageContent.includes("id=\"yhm\"") || pageContent.includes("name=\"yhm\"")) {
            console.log("页面包含登录表单，未登录");
            return false;
        }

        // 检查是否包含无权限信息
        if (pageContent.includes("无功能权限")) {
            console.log("页面包含'无功能权限'，无效");
            return false;
        }

        // 检查是否包含学号或姓名信息
        const hasStudentInfo = pageContent.includes("xh") || pageContent.includes("xm");
        if (hasStudentInfo) {
            console.log("页面包含学生信息，有效");
            return true;
        }

        console.log("页面内容检查不通过，无效");
        return false;
    }

    /**
     * 检查登录状态
     * @returns {Promise<boolean>} 是否已登录
     */
    async absCheckLogin() {
        try {
            console.log("检查教务系统登录状态, VPN模式:", EASAccount.useVpn);
            console.log("当前主机:", this.host);

            // 获取Cookie - 根据VPN模式选择不同的Cookie
            let cookies;
            if (EASAccount.useVpn) {
                // 在VPN模式下，使用智慧济大的VPN Cookie
                const ipassAccount = IPassAccount.getInstance();
                cookies = await ipassAccount.vpnCookieJar.getCookies();

                if (!cookies || cookies.length === 0) {
                    console.log("VPN模式下未获取到Cookie，登录状态无效");
                    return false;
                }

                console.log("使用VPN模式检查登录状态，Cookie数量:", cookies.length);
            } else {
                // 在普通模式下，使用教务系统的Cookie
                cookies = await this.cookieJar.getCookies();

                if (!cookies || cookies.length === 0) {
                    console.log("没有保存的Cookie，登录状态无效");
                    return false;
                }

                console.log("使用普通模式检查登录状态，Cookie数量:", cookies.length);
            }

            // 构建URL - getFullUrl方法会自动处理VPN加密
            const personalInfoUrl = this.getFullUrl('jwglxt/xsxxxggl/xsxxwh_cxCkDgxsxx.html?gnmkdm=N100801');
            console.log("检查登录状态URL:", personalInfoUrl);

            // 尝试访问个人信息页面验证登录状态
            const result = await (EASAccount.useVpn ? ipc.ipassGet : ipc.easGet)(
                personalInfoUrl,
                {
                    cookies: cookies,
                    headers: {
                        'Host': EASAccount.useVpn ? 'webvpn.ujn.edu.cn' : this.host,
                        'Proxy-Connection': 'keep-alive',
                        'Cache-Control': 'max-age=0',
                        'Upgrade-Insecure-Requests': '1',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                        'Accept-Encoding': 'gzip, deflate',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                        'Referer': this.getFullUrl('')
                    }
                }
            );

            // 检查响应是否包含个人信息
            const isLoggedIn = this.isValidLoggedInPage(result.data);

            if (isLoggedIn) {
                console.log("登录状态有效");

                // 如果登录状态有效，尝试提取姓名并保存到用户信息
                if (result.data) {
                    try {
                        // 尝试提取姓名
                        let studentName = null;
                        const patterns = [
                            /<input[^>]*id="xm"[^>]*value="([^"]+)"/i,
                            /<input[^>]*name="xm"[^>]*value="([^"]+)"/i,
                            /<input[^>]*value="([^"]+)"[^>]*id="xm"/i,
                            /<span[^>]*id="xm"[^>]*>([^<]+)<\/span>/i,
                            /<p[^>]*id="xm"[^>]*>([^<]+)<\/p>/i,
                            /<div[^>]*id="xhxm"[^>]*>([^<]+)<\/div>/i,
                            /"xm":"([^"]+)"/
                        ];

                        for (const pattern of patterns) {
                            const match = result.data.match(pattern);
                            if (match && match[1]) {
                                studentName = match[1].trim();
                                console.log(`成功提取到学生姓名: ${studentName}`);
                                break;
                            }
                        }

                        if (studentName) {
                            // 从存储中读取用户信息
                            const userInfo = await store.getObject('userInfo', {});

                            // 更新姓名并保存
                            userInfo.name = studentName;
                            await store.putObject('userInfo', userInfo);
                            console.log('登录状态检查时更新了用户姓名:', studentName);
                        }
                    } catch (error) {
                        console.error('提取姓名失败:', error);
                        // 提取姓名失败不影响登录状态检查
                    }
                }

                return true;
            }

            console.log("登录状态已失效，需要重新登录");
            return false;
        } catch (error) {
            console.error("检查登录状态时出错", error);
            return false;
        }
    }

    /**
     * 登录
     * @param {string} account 账号
     * @param {string} password 密码
     * @returns {Promise<boolean>} 登录是否成功
     */
    async absLogin(account, password) {
        try {
            // 清空之前的Cookie
            this.cookieJar.clearCookies();

            console.log("=== 开始登录流程 ===");
            console.log(`账号: ${account}`);
            console.log(`密码长度: ${password.length}`);

            // 步骤1: 获取登录页面获取CSRF令牌
            const timestamp = new Date().getTime();
            console.log(`\n[步骤1] 获取登录页面和CSRF令牌 (${timestamp})`);

            const loginPageUrl = this.getFullUrl(`${UJNAPI.EA_LOGIN}?time=${timestamp}`);
            console.log(`请求登录页面: ${loginPageUrl}`);

            const loginPageResult = await ipc.easGet(loginPageUrl);
            if (!loginPageResult.success) {
                console.error("获取登录页面失败:", loginPageResult.error || '未知错误');
                return false;
            }

            // 保存初始 cookie
            if (loginPageResult.cookies && loginPageResult.cookies.length > 0) {
                console.log("保存初始 Cookie:", loginPageResult.cookies);
                await this.cookieJar.saveCookies(loginPageResult.cookies);
            }

            const loginPageHtml = loginPageResult.data;
            // 提取CSRF令牌
            const csrfTokenRegex = /<input[^>]+name="csrftoken"[^>]+value="([^"]+)"/i;
            const csrfTokenMatch = loginPageHtml.match(csrfTokenRegex);

            if (!csrfTokenMatch) {
                console.error("无法获取CSRF令牌");
                console.log("登录页面内容片段:", loginPageHtml.substring(0, 500));
                return false;
            }

            const csrfToken = csrfTokenMatch[1];
            console.log("成功获取CSRF令牌:", csrfToken);

            // 步骤2: 获取RSA公钥
            console.log(`\n[步骤2] 获取RSA公钥`);

            const publicKeyUrl = this.getFullUrl(UJNAPI.EA_LOGIN_PUBLIC_KEY);
            console.log(`请求公钥URL: ${publicKeyUrl}`);

            const publicKeyParams = { time: timestamp, _: timestamp };
            const publicKeyHeaders = {
                'Referer': loginPageUrl
            };

            const currentCookies = await this.cookieJar.getCookies();
            const publicKeyResult = await ipc.easGet(publicKeyUrl, {
                params: publicKeyParams,
                headers: publicKeyHeaders,
                cookies: currentCookies
            });

            if (!publicKeyResult.success) {
                console.error("获取公钥失败:", publicKeyResult.error || '未知错误');
                return false;
            }

            let publicKeyData;
            try {
                publicKeyData = JSON.parse(publicKeyResult.data);
            } catch (e) {
                console.error("解析公钥JSON失败:", e);
                console.log("公钥响应内容:", publicKeyResult.data);
                return false;
            }

            if (!publicKeyData.modulus) {
                console.error("公钥数据不完整");
                console.log("公钥响应内容:", publicKeyResult.data);
                return false;
            }

            console.log("成功获取公钥:");
            console.log("- 模数(modulus)前20字符:", publicKeyData.modulus.substring(0, 20) + "...");
            console.log("- 指数(exponent):", publicKeyData.exponent);

            // 步骤3: 加密密码
            console.log(`\n[步骤3] 加密密码`);

            // 使用原始的cryptoUtils.js中的加密方法
            const rsaPassword = getenPassword(password, publicKeyData.modulus, publicKeyData.exponent);
            if (!rsaPassword) {
                console.error("密码加密失败");
                return false;
            }

            console.log("密码加密成功");

            // 步骤4: 提交登录请求
            console.log(`\n[步骤4] 提交登录请求`);

            // 构造登录表单数据
            const loginData = {
                csrftoken: csrfToken,
                language: 'zh_CN',
                yhm: account,
                mm: rsaPassword
            };

            console.log("登录表单数据:");
            console.log("- csrftoken:", csrfToken);
            console.log("- language: zh_CN");
            console.log("- yhm:", account);
            console.log("- mm: [已加密]");

            const loginUrl = this.getFullUrl(UJNAPI.EA_LOGIN);
            console.log("登录请求URL:", loginUrl);

            const loginHeaders = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': loginPageUrl,
                'Origin': this.getFullUrl(''),
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };

            console.log("发送登录请求...");
            const cookies = await this.cookieJar.getCookies();

            const loginResult = await ipc.easPost(loginUrl, loginData, {
                headers: loginHeaders,
                cookies: cookies
            });

            // 步骤5: 分析登录结果
            console.log(`\n[步骤5] 分析登录结果`);
            console.log(`登录请求状态码: ${loginResult.status}`);

            // 特别关注并保存 Set-Cookie 头中的 JSESSIONID cookie
            if (loginResult.cookies && loginResult.cookies.length > 0) {
                console.log("登录响应返回的 Cookie:", loginResult.cookies);
                const jsessionidCookie = loginResult.cookies.find(cookie => cookie.includes('JSESSIONID'));

                if (jsessionidCookie) {
                    console.log("找到 JSESSIONID Cookie:", jsessionidCookie);
                    // 清空旧 cookie 并设置新的 JSESSIONID cookie
                    this.cookieJar.clearCookies();
                    await this.cookieJar.saveCookies([jsessionidCookie]);
                    console.log("已保存 JSESSIONID Cookie");
                } else {
                    console.log("未找到 JSESSIONID Cookie");
                    // 保存所有返回的 cookie
                    await this.cookieJar.saveCookies(loginResult.cookies);
                }
            }

            // 修改: 优先处理302状态码，直接视为登录成功
            if (loginResult.status === 302) {
                console.log("收到302重定向状态码，登录成功");

                if (loginResult.cookies && loginResult.cookies.length > 0) {
                    console.log("验证方法1 (重定向): 通过");
                    // 已经在上面保存了Cookie，这里不需要重复保存

                    // 设置登录成功状态
                    this.isLogin = true;
                    // 记录当前成功使用的节点索引
                    const currentHostIndex = UJNAPI.EA_HOSTS.indexOf(this.host);
                    if (currentHostIndex >= 0) {
                        console.log(`登录成功，保存当前使用的节点索引: ${currentHostIndex}`);
                        localStorage.setItem('ujn_assistant_LAST_SUCCESSFUL_HOST', currentHostIndex.toString());
                    }
                    // 登录成功，同步保存入学年份
                    try {
                        if (this._entranceTime > 0) {
                            localStorage.setItem('ujn_assistant_ENTRANCE_TIME', this._entranceTime.toString());
                            console.log(`登录成功后同步入学年份到localStorage: ${this._entranceTime}`);

                            // 如果有store模块，也保存到store中
                            if (typeof store !== 'undefined' && store.putInt) {
                                store.putInt('ENTRANCE_TIME', this._entranceTime).catch(err => {
                                    console.error('登录后保存入学年份到store失败:', err);
                                });
                            }
                        }
                    } catch (e) {
                        console.error('登录成功后保存入学年份失败:', e);
                    }
                    return true;
                } else {
                    console.warn("登录成功但未收到Cookie，尝试二次验证");
                }
            } else {
                console.log("未收到302重定向状态码，验证方法1失败");
                console.log("验证方法1 (重定向): 失败");
            }

            // 备用验证: 访问个人信息页面
            console.log("\n尝试备用验证方式");
            const personalInfoUrl = this.getFullUrl('jwglxt/xsxxxggl/xsxxwh_cxCkDgxsxx.html?gnmkdm=N100801');
            console.log("请求个人信息页面:", personalInfoUrl);

            // 使用当前保存的Cookie和合适的请求头
            const savedCookies = await this.cookieJar.getCookies();
            console.log("使用已保存的Cookie进行验证:", savedCookies);

            const personalInfoResult = await ipc.easGet(personalInfoUrl, {
                cookies: savedCookies,
                headers: {
                    'Referer': this.getFullUrl(''),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            // 使用统一方法检查响应是否有效
            const hasStudentInfo = this.isValidLoggedInPage(personalInfoResult.data);

            console.log(`备用验证: ${hasStudentInfo ? '通过' : '失败'}`);

            if (hasStudentInfo) {
                console.log("登录成功 (备用验证)");
                this.isLogin = true;
                // 记录当前成功使用的节点索引
                const currentHostIndex = UJNAPI.EA_HOSTS.indexOf(this.host);
                if (currentHostIndex >= 0) {
                    console.log(`登录成功，保存当前使用的节点索引: ${currentHostIndex}`);
                    localStorage.setItem('ujn_assistant_LAST_SUCCESSFUL_HOST', currentHostIndex.toString());
                }
                // 登录成功，同步保存入学年份
                try {
                    if (this._entranceTime > 0) {
                        localStorage.setItem('ujn_assistant_ENTRANCE_TIME', this._entranceTime.toString());
                        console.log(`登录成功后同步入学年份到localStorage: ${this._entranceTime}`);

                        // 如果有store模块，也保存到store中
                        if (typeof store !== 'undefined' && store.putInt) {
                            store.putInt('ENTRANCE_TIME', this._entranceTime).catch(err => {
                                console.error('登录后保存入学年份到store失败:', err);
                            });
                        }
                    }
                } catch (e) {
                    console.error('登录成功后保存入学年份失败:', e);
                }
                return true;
            }

            // 如果所有验证方法都失败，尝试提取错误信息
            console.log("\n尝试提取错误信息");
            try {
                // 使用正则表达式提取错误信息
                const errorMatch = loginResult.data.match(/<div[^>]*id=['"]tips['"][^>]*>(.*?)<\/div>/i);
                if (errorMatch && errorMatch[1]) {
                    const errorMsg = errorMatch[1].trim();
                    console.error("登录失败，错误信息:", errorMsg);
                } else {
                    console.error("登录失败，无法提取错误信息");
                }
            } catch (e) {
                console.error("解析错误信息失败:", e);
            }

            console.log("=== 登录流程结束：失败 ===");
            this.isLogin = false;
            return false;
        } catch (error) {
            console.error('登录过程发生异常:', error);
            this.isLogin = false;
            return false;
        }
    }

    /**
     * 获取学生信息
     * @param {string} account 学号
     */
    async fetchStudentInfo(account) {
        try {
            console.log("开始获取学生信息");

            // 获取Cookie - 根据是否使用VPN模式选择不同的Cookie
            let cookies;
            if (EASAccount.useVpn) {
                // 在VPN模式下，使用智慧济大的VPN Cookie
                const ipassAccount = IPassAccount.getInstance();
                cookies = await ipassAccount.vpnCookieJar.getCookies();
                console.log("使用VPN模式获取学生信息，Cookie数量:", cookies ? cookies.length : 0);

                // 添加调试信息
                if (cookies && cookies.length > 0) {
                    console.log("VPN Cookie示例:", cookies[0].substring(0, 20) + "...");
                } else {
                    console.warn("VPN模式下Cookie为空，可能导致权限问题");
                }
            } else {
                // 在普通模式下，使用教务系统的Cookie
                cookies = await this.cookieJar.getCookies();
                console.log("使用普通模式获取学生信息，Cookie数量:", cookies ? cookies.length : 0);
            }

            // 构建请求URL - 灵活处理URL构建
            let personalInfoUrl;
            if (EASAccount.useVpn) {
                // 使用getFullUrl但确保正确处理VPN前缀
                // 保留原来的方法调用，让getFullUrl处理VPN加密
                personalInfoUrl = this.getFullUrl('jwglxt/xsxxxggl/xsxxwh_cxCkDgxsxx.html?gnmkdm=N100801');
                console.log("VPN模式下构建的URL:", personalInfoUrl);

                // 检查URL是否包含正确的VPN前缀，如果没有则添加
                if (!personalInfoUrl.includes('webvpn.ujn.edu.cn')) {
                    console.log("构建的URL不包含VPN前缀，添加备用VPN前缀");
                    personalInfoUrl = `https://webvpn.ujn.edu.cn/http/77726476706e69737468656265737421fae046906925625e300d8db9d6562d/jwglxt/xsxxxggl/xsxxwh_cxCkDgxsxx.html?gnmkdm=N100801`;
                }
            } else {
                personalInfoUrl = this.getFullUrl('jwglxt/xsxxxggl/xsxxwh_cxCkDgxsxx.html?gnmkdm=N100801');
            }
            console.log("获取学生信息URL:", personalInfoUrl);

            // 准备请求头
            const headers = {
                'Host': EASAccount.useVpn ? 'webvpn.ujn.edu.cn' : this.host,
                'Referer': EASAccount.useVpn ? 'https://webvpn.ujn.edu.cn' : this.getFullUrl(''),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
            };

            // 如果有Cookie，确保添加到header中
            if (cookies && cookies.length > 0) {
                headers['Cookie'] = cookies.join('; ');
            }

            // 获取学生信息
            const response = await (EASAccount.useVpn ? ipc.ipassGet : ipc.easGet)(
                personalInfoUrl,
                {
                    cookies: cookies,
                    headers: headers
                }
            );

            if (!response.success || response.status !== 200) {
                console.error("获取学生信息请求失败", response);
                return false;
            }

            // 添加调试信息
            console.log("响应状态:", response.status);
            console.log("响应数据前200字符:", response.data ? response.data.substring(0, 200) : "无数据");

            // 优先使用isValidLoggedInPage方法判断页面是否有效
            const isValid = this.isValidLoggedInPage(response.data);

            if (!isValid) {
                console.error("获取学生信息失败：无权限或未登录");
                console.debug("响应数据片段:", response.data?.substring(0, 500));
                return false;
            }

            // 提取学生姓名 - 复用absCheckLogin中的姓名提取逻辑
            if (response.data) {
                try {
                    // 尝试提取姓名
                    let studentName = null;
                    const patterns = [
                        /<input[^>]*id="xm"[^>]*value="([^"]+)"/i,
                        /<input[^>]*name="xm"[^>]*value="([^"]+)"/i,
                        /<input[^>]*value="([^"]+)"[^>]*id="xm"/i,
                        /<span[^>]*id="xm"[^>]*>([^<]+)<\/span>/i,
                        /<p[^>]*id="xm"[^>]*>([^<]+)<\/p>/i,
                        /<div[^>]*id="xhxm"[^>]*>([^<]+)<\/div>/i,
                        /"xm":"([^"]+)"/
                    ];

                    for (const pattern of patterns) {
                        const match = response.data.match(pattern);
                        if (match && match[1]) {
                            studentName = match[1].trim();
                            console.log(`成功提取到学生姓名: ${studentName}`);
                            break;
                        }
                    }

                    if (studentName) {
                        // 从存储中读取用户信息
                        const userInfo = await store.getObject('userInfo', {});

                        // 更新姓名并保存
                        userInfo.name = studentName;
                        await store.putObject('userInfo', userInfo);
                        console.log('获取学生信息时更新了用户姓名:', studentName);
                    } else {
                        console.log('未能从响应中提取到学生姓名');
                    }
                } catch (error) {
                    console.error('提取姓名失败:', error);
                    // 提取姓名失败不影响整体流程
                }
            }

            // 提取学号中的入学年份信息
            if (account && account.length >= 4) {
                const yearPrefix = account.substring(0, 4);
                const year = parseInt(yearPrefix, 10);

                if (!isNaN(year) && year >= 1990 && year <= new Date().getFullYear()) {
                    this.entranceTime = year;
                    console.log(`设置入学年份: ${year}`);

                    // 同时更新到localStorage，确保立即持久化
                    try {
                        localStorage.setItem('ujn_assistant_ENTRANCE_TIME', year.toString());
                        console.log(`入学年份 ${year} 已同步到localStorage`);
                    } catch (e) {
                        console.error('同步入学年份到localStorage失败:', e);
                    }
                }
            }

            console.log("获取学生信息成功");
            return true;
        } catch (error) {
            console.error('获取学生信息失败', error);
            return false;
        }
    }

    /**
     * 获取当前年级
     * @returns {number} 当前年级
     */
    getCurrentGrade() {
        const calendar = new Date();
        const y = calendar.getFullYear();

        if (y < this.entranceTime) {
            return 0;
        } else {
            // 计算当前年级，考虑学期
            const month = calendar.getMonth();
            return Math.min(
                (y - this.entranceTime) * 2 - (month < 7 ? 1 : 0),
                7 // 假设最多8个学期
            );
        }
    }

    /**
     * 查询成绩
     * @param {number} index 学期索引
     * @param {string} xnm 学年代码 20xx
     * @param {string} xqm 学期代码 12 | 3
     * @returns {Promise<Array>} 成绩列表
     */
    async queryMark(index, xnm, xqm) {
        try {
            console.log(`查询成绩, 学年:${xnm}, 学期:${xqm}, VPN模式:${EASAccount.useVpn}`);

            // 获取已保存的Cookie - 根据VPN模式选择不同的Cookie
            let cookies;
            if (EASAccount.useVpn) {
                // 在VPN模式下，使用智慧济大的VPN Cookie
                const ipassAccount = IPassAccount.getInstance();
                cookies = await ipassAccount.vpnCookieJar.getCookies();
                console.log("使用VPN模式查询成绩，Cookie数量:", cookies.length);
            } else {
                // 在普通模式下，使用教务系统的Cookie
                cookies = await this.cookieJar.getCookies();
                console.log("使用普通模式查询成绩，Cookie数量:", cookies.length);
            }

            // 构建URL - getFullUrl方法会自动处理VPN加密
            const markUrl = this.getFullUrl(UJNAPI.GET_MARK);
            console.log("查询成绩URL:", markUrl);

            // 查询成绩列表 - 根据VPN模式选择不同的请求方法
            const markResponse = await (EASAccount.useVpn ? ipc.ipassPost : ipc.easPost)(
                markUrl,
                {
                    xnm: xnm,
                    xqm: xqm,
                    'queryModel.showCount': '999'
                },
                {
                    cookies: cookies,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Referer': this.getFullUrl(''),
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                }
            );

            if (!markResponse.success) {
                throw new Error(markResponse.error || '查询成绩失败');
            }

            // 尝试解析成绩数据
            let markData;
            try {
                markData = JSON.parse(markResponse.data);
            } catch (parseError) {
                // 如果响应不是JSON，检查是否是HTML
                if (markResponse.data.includes('<!doctype html>') ||
                    markResponse.data.includes('<html>')) {
                    // 检查是否包含无权限信息
                    if (markResponse.data.includes('无功能权限') ||
                        markResponse.data.includes('错误提示')) {
                        throw new Error('无权限查询成绩或会话已过期，请重新登录');
                    }
                }
                // 抛出原始解析错误
                throw parseError;
            }

            const markMap = new Map();

            if (markData && markData.items) {
                for (const item of markData.items) {
                    const name = item.kcmc;
                    if (!markMap.has(name)) {
                        // 生成唯一ID
                        const id = `${index}_${item.kch_id}_${Date.now()}`;

                        // 尝试解析成绩
                        const scoreValue = parseFloat(item.cj || '0');

                        // 计算绩点
                        let gpaValue = '0';
                        if (scoreValue >= 60) {
                            if (item.ksxz === '正常考试') {
                                gpaValue = (scoreValue >= 95) ? '5.0' :
                                    ((5.0 - (95 - scoreValue) / 10).toFixed(2)).toString();
                            } else {
                                gpaValue = '1';
                            }
                        }

                        markMap.set(name, {
                            id,
                            kchId: item.kch_id,
                            name: name.trim(),
                            type: item.ksxz || '正常考试',
                            credit: item.xf,
                            mark: scoreValue,
                            gpa: gpaValue,
                            time: item.tjsj ? new Date(item.tjsj) : new Date(),
                            items: [],
                            index: index,
                            isNew: 1
                        });
                    }
                }
            }

            // 尝试查询成绩详情
            try {
                // 构建URL - getFullUrl方法会自动处理VPN加密
                const markDetailUrl = this.getFullUrl(UJNAPI.GET_MARK_DETAIL);
                console.log("查询成绩详情URL:", markDetailUrl);

                const markDetailResponse = await (EASAccount.useVpn ? ipc.ipassPost : ipc.easPost)(
                    markDetailUrl,
                    {
                        xnm: xnm,
                        xqm: xqm,
                        'queryModel.showCount': '999'
                    },
                    {
                        cookies: cookies,
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Referer': this.getFullUrl(''),
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        }
                    }
                );

                if (markDetailResponse.success) {
                    // 尝试解析成绩详情数据
                    try {
                        const markDetailData = JSON.parse(markDetailResponse.data);

                        if (markDetailData && markDetailData.items) {
                            for (const item of markDetailData.items) {
                                const name = item.kcmc;
                                let mark = markMap.get(name);

                                if (!mark) {
                                    continue; // 跳过不存在的课程
                                }

                                // 添加成绩项
                                if (item.xmblmc) {
                                    if (item.xmblmc === '总评' && mark.mark === 0 && item.xmcj) {
                                        mark.mark = parseFloat(item.xmcj || '0');

                                        // 计算绩点
                                        if (mark.mark < 60) {
                                            mark.gpa = '0';
                                        } else if (mark.type === '正常考试') {
                                            mark.gpa = (mark.mark >= 95) ? '5.0' : ((5.0 - (95 - mark.mark) / 10).toFixed(2)).toString();
                                        } else {
                                            mark.gpa = '1';
                                        }
                                    } else {
                                        mark.items.push({
                                            name: item.xmblmc,
                                            mark: item.xmcj || ''
                                        });
                                    }
                                }
                            }
                        }
                    } catch (detailParseError) {
                        console.warn('解析成绩详情失败，将只使用基本成绩信息', detailParseError);
                        // 不抛出错误，继续使用基本成绩信息
                    }
                } else {
                    console.warn('获取成绩详情失败，将只使用基本成绩信息');
                    // 不抛出错误，继续使用基本成绩信息
                }
            } catch (detailError) {
                console.warn('查询成绩详情出错，将只使用基本成绩信息', detailError);
                // 不抛出错误，继续使用基本成绩信息
            }

            console.log(`成功获取 ${markMap.size} 条成绩记录`);
            return Array.from(markMap.values());
        } catch (error) {
            console.error('查询成绩失败', error);
            throw error;
        }
    }

    /**
     * 查询教务通知
     * @param {number} page 页码
     * @param {number} pageSize 每页数量
     * @returns {Promise<Array>} 通知列表
     */
    async queryNotice(page = 1, pageSize = 1) {
        try {
            console.log(`查询教务通知, 页码:${page}, 数量:${pageSize}, VPN模式:${EASAccount.useVpn}`);

            // 获取已保存的Cookie - 根据VPN模式选择不同的Cookie
            let cookies;
            if (EASAccount.useVpn) {
                // 在VPN模式下，使用智慧济大的VPN Cookie
                const ipassAccount = IPassAccount.getInstance();
                cookies = await ipassAccount.vpnCookieJar.getCookies();
                console.log("使用VPN模式查询通知，Cookie数量:", cookies.length);
            } else {
                // 在普通模式下，使用教务系统的Cookie
                cookies = await this.cookieJar.getCookies();
                console.log("使用普通模式查询通知，Cookie数量:", cookies.length);
            }

            // 构建URL - getFullUrl方法会自动处理VPN加密
            const noticeUrl = this.getFullUrl(UJNAPI.EA_SYSTEM_NOTICE);
            console.log("查询通知URL:", noticeUrl);

            const response = await (EASAccount.useVpn ? ipc.ipassPost : ipc.easPost)(
                noticeUrl,
                {
                    'queryModel.showCount': pageSize.toString(),
                    'queryModel.currentPage': page.toString(),
                    'queryModel.sortName': 'cjsj',
                    'queryModel.sortOrder': 'desc'
                },
                {
                    cookies: cookies,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Referer': this.getFullUrl(''),
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                }
            );

            if (!response.success) {
                throw new Error(response.error || '查询通知失败');
            }

            const data = JSON.parse(response.data);
            const notices = [];

            if (data && data.items) {
                for (const item of data.items) {
                    notices.push({
                        id: item.id || '',
                        title: item.bt || '教务通知',
                        time: item.cjsj || '',
                        content: item.xxnr || '',
                        source: '教务处'
                    });
                }
            }

            console.log(`成功获取 ${notices.length} 条通知`);
            return notices;
        } catch (error) {
            console.error('查询通知失败', error);
            return [];
        }
    }

    /**
     * 查询考试
     * @param {string} xnm 学年代码 20xx
     * @param {string} xqm 学期代码 12 | 3
     * @returns {Promise<Array>} 考试列表
     */
    async queryExam(xnm, xqm) {
        try {
            console.log(`查询考试, 学年:${xnm}, 学期:${xqm}, VPN模式:${EASAccount.useVpn}`);

            // 获取已保存的Cookie - 根据VPN模式选择不同的Cookie
            let cookies;
            if (EASAccount.useVpn) {
                // 在VPN模式下，使用智慧济大的VPN Cookie
                const ipassAccount = IPassAccount.getInstance();
                cookies = await ipassAccount.vpnCookieJar.getCookies();
                console.log("使用VPN模式查询考试，Cookie数量:", cookies.length);
            } else {
                // 在普通模式下，使用教务系统的Cookie
                cookies = await this.cookieJar.getCookies();
                console.log("使用普通模式查询考试，Cookie数量:", cookies.length);
            }

            // 构建URL - getFullUrl方法会自动处理VPN加密
            const examUrl = this.getFullUrl(UJNAPI.GET_EXAM);
            console.log("查询考试URL:", examUrl);

            const response = await (EASAccount.useVpn ? ipc.ipassPost : ipc.easPost)(
                examUrl,
                {
                    xnm: xnm,
                    xqm: xqm,
                    'queryModel.showCount': '999'
                },
                {
                    cookies: cookies,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Referer': this.getFullUrl(''),
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                }
            );

            if (!response.success) {
                throw new Error(response.error || '查询考试失败');
            }

            const data = JSON.parse(response.data);
            const exams = [];

            if (data && data.items) {
                for (const item of data.items) {
                    exams.push({
                        name: item.kcmc || '',
                        place: item.cdmc || '',
                        time: item.kssj || '',
                        date: item.kssj ? item.kssj.split(' ')[0] : '',
                        location: item.cdmc || '待定'
                    });
                }
            }

            console.log(`成功获取 ${exams.length} 条考试信息`);
            return exams;
        } catch (error) {
            console.error('查询考试失败', error);
            return [];
        }
    }

    /**
     * 清除Cookie
     */
    clearCookies() {
        this.cookieJar.clearCookies();
    }

    /**
     * 获取账号
     * @returns {Promise<string>} 账号
     */
    async getAccount() {
        return await store.getString(this.accountName, '');
    }

    /**
     * 获取Cookie
     * @returns {Array} Cookie列表
     */
    getCookie() {
        return this.cookieJar.cookiesList;
    }

    /**
     * 登出
     */
    logout() {
        this.clearCookies();
        this.isLogin = false;
    }
}

export default EASAccount;