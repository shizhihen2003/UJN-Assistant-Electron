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
     * 获取当前学校ID（用于区分不同学校的存储）
     * 优先使用 UJNAPI.SCHOOL_ID（最可靠），其次使用 localStorage
     * @returns {string} 学校ID，默认为 'ujn'
     */
    static getCurrentSchoolId() {
        try {
            // 优先从 UJNAPI 获取（最新的配置）
            if (UJNAPI.SCHOOL_ID) {
                return UJNAPI.SCHOOL_ID;
            }
            // 备用：从 localStorage 获取
            return localStorage.getItem('ujn_assistant_current_school_id') || 'ujn';
        } catch (e) {
            return 'ujn';
        }
    }

    /**
     * 获取路径前缀的存储键（按学校区分）
     * @returns {string} 存储键
     */
    static getPathPrefixKey() {
        const schoolId = EASAccount.getCurrentSchoolId();
        return `ujn_assistant_EA_PATH_PREFIX_${schoolId}`;
    }

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

        // 根据节点配置决定使用HTTP还是HTTPS
        // 使用 getHostHttps 获取特定节点的协议配置
        const useHttps = UJNAPI.getHostHttps(hostIndex);
        const scheme = useHttps ? 'https' : 'http';
        console.log(`初始化 EASAccount: 使用主机 ${host}, 节点索引: ${hostIndex}, 协议: ${scheme}`);

        super(
            host,
            'EAS_ACCOUNT',
            'EAS_PASSWORD',
            scheme,
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

        // 路径前缀（如 jwglxt/），通过探测自动获取
        this._pathPrefix = null;
        this._pathPrefixInitialized = false;  // 标记是否已完成初始化
        this._pathPrefixPending = null;  // 正在进行的初始化Promise（用于处理并发调用）
        this._lastSchoolId = EASAccount.getCurrentSchoolId();  // 记录当前学校ID，用于检测切换

        // 自动清理旧的全局存储key（迁移到按学校区分的key）
        try {
            const oldKey = 'ujn_assistant_EA_PATH_PREFIX';
            if (localStorage.getItem(oldKey) !== null) {
                console.log('清除旧的全局路径前缀存储键');
                localStorage.removeItem(oldKey);
            }
        } catch (e) {}

        // 尝试从localStorage加载已保存的路径前缀（按学校区分）
        try {
            const pathPrefixKey = EASAccount.getPathPrefixKey();
            const savedPrefix = localStorage.getItem(pathPrefixKey);
            if (savedPrefix !== null) {
                this._pathPrefix = savedPrefix;
                this._pathPrefixInitialized = true;
                console.log(`从localStorage加载路径前缀: "${this._pathPrefix}" (key: ${pathPrefixKey})`);
            } else {
                console.log(`localStorage中没有保存的路径前缀，需要探测 (key: ${pathPrefixKey})`);
            }
        } catch (e) {
            console.error("加载路径前缀失败", e);
        }

        // 验证ipc模块是否可用
        if (!ipc) {
            console.error("错误: ipc模块未正确加载!");
        } else {
            console.log("ipc模块加载成功");
            // 验证关键方法是否存在
            if (!ipc.easGet || !ipc.easPost) {
                console.error("错误: ipc.easGet 或 ipc.easPost 方法未定义!");
                console.log("ipc方法列表:", Object.keys(ipc).join(", "));
            }
        }
    }

    /**
     * 单例实例
     */
    static instance = null;
    static lastSchoolId = null;  // 记录上次创建实例时的学校ID

    /**
     * 获取单例实例
     * @returns {EASAccount} 实例
     */
    static getInstance() {
        const currentSchoolId = EASAccount.getCurrentSchoolId();

        // 检查学校ID变化（不检查主机变化，因为用户可能手动选择了其他节点）
        if (EASAccount.instance) {
            const schoolChanged = EASAccount.lastSchoolId && EASAccount.lastSchoolId !== currentSchoolId;

            if (schoolChanged) {
                console.log(`getInstance: 检测到学校变化:`);
                console.log(`  学校ID: ${EASAccount.lastSchoolId} -> ${currentSchoolId}`);
                // 学校变化，重新加载主机配置和路径前缀
                EASAccount.instance._reloadHostConfig();
                EASAccount.instance.resetPathPrefix();
                EASAccount.lastSchoolId = currentSchoolId;
            }
        }

        if (EASAccount.useVpn) {
            // 在实际应用中实现 VpnEASAccount
            console.log('VPN模式启用');

            if (!EASAccount.instance) {
                EASAccount.instance = new EASAccount();
                EASAccount.lastSchoolId = currentSchoolId;
            }

            return EASAccount.instance;
        }

        if (!EASAccount.instance) {
            EASAccount.instance = new EASAccount();
            EASAccount.lastSchoolId = currentSchoolId;
        }

        return EASAccount.instance;
    }

    /**
     * 重置单例实例（学校切换时调用）
     * 这将强制下次 getInstance 时创建新实例
     */
    static resetInstance() {
        if (EASAccount.instance) {
            console.log('重置 EASAccount 单例实例');
            EASAccount.instance.clearCookies();
            EASAccount.instance = null;
        }
        // 清除路径前缀缓存，以便新学校重新探测（按学校区分）
        try {
            const pathPrefixKey = EASAccount.getPathPrefixKey();
            localStorage.removeItem(pathPrefixKey);
            console.log(`已清除路径前缀缓存 (key: ${pathPrefixKey})`);
        } catch (e) {
            console.error('清除路径前缀缓存失败', e);
        }
    }

    /**
     * 切换教务节点
     * @param {number} index 节点索引
     */
    changeHost(index) {
        if (index >= UJNAPI.EA_HOSTS.length) return;

        this.isLogin = false;
        this.cookieJar.clearCookies();
        this.host = UJNAPI.EA_HOSTS[index];

        // 同时更新协议 - 修复：不同节点可能使用不同协议
        const useHttps = UJNAPI.getHostHttps(index);
        this.scheme = useHttps ? 'https' : 'http';

        // 更新当前节点索引
        this._currentHostIndex = index;

        // 重新创建CookieJar以使用新的scheme和host
        this.cookieJar = new CookieJar(this.scheme, this.host, this.cookieName);

        store.edit(editor => editor.putInt('EA_HOST', index));

        console.log(`节点切换完成: host=${this.host}, scheme=${this.scheme}, index=${index}`);
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

    /**
     * 是否使用VPN - 静态变量，只定义一次
     */
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
        // 检测学校是否变化，如果变化则重置路径前缀
        this._checkSchoolChange();

        if (!this.host) {
            console.error("错误: 主机为undefined");
            throw new Error("主机未定义，无法构建URL");
        }

        // 如果有路径前缀且路径不为空，自动添加前缀
        let fullPath = path || '';
        if (this._pathPrefix && fullPath && !fullPath.startsWith(this._pathPrefix)) {
            // 检查路径是否已经是完整路径（包含前缀）
            // 如果路径以 xtgl/、kbcx/、cjcx/ 等模块名开头，说明需要添加前缀
            const needsPrefix = /^(xtgl|kbcx|kbdy|cjcx|kwgl|xsxy|cdjy|xsxxxggl)\//.test(fullPath);
            if (needsPrefix) {
                fullPath = this._pathPrefix + fullPath;
                console.log(`自动添加路径前缀: ${path} -> ${fullPath}`);
            }
        }

        // 构建原始URL
        // VPN模式下强制使用HTTP，因为VPN代理的内网地址通常是HTTP
        const urlScheme = EASAccount.useVpn ? 'http' : this.scheme;
        const originalUrl = `${urlScheme}://${this.host}/${fullPath}`;

        // 如果使用VPN，通过VPN加密URL
        if (EASAccount.useVpn) {
            try {
                console.log(`构建VPN URL，原始URL: ${originalUrl}`);
                console.log(`VPN模式使用HTTP协议（内网地址）`);

                // 使用VpnEncodeUtils加密URL（适用于所有学校）
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
     * 从URL中提取路径前缀
     * 例如: https://jwgl.ujn.edu.cn/jwglxt/xtgl/login_slogin.html -> jwglxt/
     * 例如: https://jwglxt.jcut.edu.cn/xtgl/login_slogin.html -> (空字符串)
     * 例如: https://jwgl.ujn.edu.cn/jwglxt -> jwglxt/（meta refresh重定向）
     * @param {string} url 完整URL或路径
     * @returns {string} 路径前缀
     */
    extractPathPrefix(url) {
        try {
            let pathname;

            // 处理完整URL或路径
            if (url.startsWith('http')) {
                const urlObj = new URL(url);
                pathname = urlObj.pathname;
            } else if (url.startsWith('/')) {
                pathname = url;
            } else {
                pathname = '/' + url;
            }

            console.log(`解析路径: ${pathname}`);

            // 方法1: 查找 /xtgl/ 的位置
            const xtglIndex = pathname.indexOf('/xtgl/');
            if (xtglIndex > 0) {
                // 提取 /xtgl/ 之前的部分作为前缀
                const prefix = pathname.substring(1, xtglIndex + 1); // 去掉开头的 /
                console.log(`从URL提取路径前缀(xtgl): "${prefix}" (URL: ${url})`);
                return prefix;
            } else if (xtglIndex === 0) {
                // xtgl 就在根路径，没有前缀
                console.log(`URL没有路径前缀(xtgl在根路径): ${url}`);
                return '';
            }

            // 方法2: 尝试其他模块路径
            const modulePatterns = ['/kbcx/', '/cjcx/', '/kwgl/', '/cdjy/', '/xsxy/', '/xsxxxggl/'];
            for (const pattern of modulePatterns) {
                const index = pathname.indexOf(pattern);
                if (index > 0) {
                    const prefix = pathname.substring(1, index + 1);
                    console.log(`从URL提取路径前缀(模块${pattern}): "${prefix}"`);
                    return prefix;
                } else if (index === 0) {
                    return '';
                }
            }

            // 方法3: 处理 /jwglxt 这种简单重定向路径
            // 如果路径是 /xxx 格式（单一路径段），说明 xxx 可能就是前缀
            const simplePathMatch = pathname.match(/^\/([a-zA-Z0-9_-]+)\/?$/);
            if (simplePathMatch) {
                const prefix = simplePathMatch[1] + '/';
                console.log(`从简单路径提取前缀: "${prefix}" (路径: ${pathname})`);
                return prefix;
            }

            console.log(`无法从URL提取路径前缀: ${url}`);
            return null;
        } catch (error) {
            console.error(`解析URL失败: ${error.message}`);
            return null;
        }
    }

    /**
     * 探测并设置路径前缀
     * 通过访问教务系统首页，获取重定向后的URL来确定路径前缀
     * @returns {Promise<string|null>} 路径前缀，失败返回null
     */
    async detectPathPrefix() {
        // 检测学校是否变化
        this._checkSchoolChange();

        try {
            console.log('开始探测教务系统路径前缀...');
            console.log(`当前学校ID: ${EASAccount.getCurrentSchoolId()}`);

            // 构建基础URL（不带路径前缀）
            // VPN模式下强制使用HTTP，因为VPN代理的内网地址通常是HTTP
            const urlScheme = EASAccount.useVpn ? 'http' : this.scheme;
            const baseUrl = `${urlScheme}://${this.host}/`;
            console.log(`探测URL: ${baseUrl}`);
            console.log(`当前协议: ${this.scheme}, 主机: ${this.host}, VPN协议: ${urlScheme}`);
            console.log(`UJNAPI.EA_USE_HTTPS: ${UJNAPI.EA_USE_HTTPS}`);
            console.log(`UJNAPI.DEFAULT_PATH_PREFIX: ${UJNAPI.DEFAULT_PATH_PREFIX}`);

            const getMethod = EASAccount.useVpn ? ipc.ipassGet : ipc.easGet;

            // 发送请求，允许重定向
            const response = await getMethod(baseUrl, {
                followRedirect: true,
                maxRedirects: 5
            });

            console.log(`探测响应: success=${response.success}, hasData=${!!response.data}, hasHeaders=${!!response.headers}`);

            // 放宽检查条件：只要有响应数据或头信息就尝试解析
            if (response.success || response.data || response.headers) {
                // 尝试从响应的最终URL或响应内容中提取前缀
                let detectedPrefix = null;

                // 方法1: 从响应的最终URL提取
                if (response.finalUrl) {
                    console.log(`尝试方法1: finalUrl = ${response.finalUrl}`);
                    detectedPrefix = this.extractPathPrefix(response.finalUrl);
                    if (detectedPrefix !== null) {
                        console.log(`方法1成功: 从finalUrl提取前缀 "${detectedPrefix}"`);
                    }
                }

                // 方法2: 从响应内容中的重定向脚本提取
                if (detectedPrefix === null && response.data) {
                    // 处理不同类型的响应数据
                    let content = '';
                    if (typeof response.data === 'string') {
                        content = response.data;
                    } else if (typeof response.data === 'object') {
                        // 可能是序列化的Buffer对象 {type: 'Buffer', data: [...]}
                        if (response.data.type === 'Buffer' && Array.isArray(response.data.data)) {
                            try {
                                content = String.fromCharCode.apply(null, response.data.data);
                            } catch (e) {
                                content = JSON.stringify(response.data);
                            }
                        } else {
                            content = JSON.stringify(response.data);
                        }
                    }

                    console.log(`响应内容长度: ${content.length}, 内容: ${content.substring(0, 300)}`);
                    console.log(`响应数据类型: ${typeof response.data}`);

                    // 多种匹配模式（按优先级排序）
                    const patterns = [
                        // 最简单直接的 url= 匹配（meta refresh）
                        /url=([^\s"'>]+)/i,
                        // window.location 变体
                        /window\.location\s*=\s*["']([^"']+)["']/,
                        /window\.location\.href\s*=\s*["']([^"']+)["']/,
                        /location\.href\s*=\s*["']([^"']+)["']/,
                        /location\s*=\s*["']([^"']+)["']/,
                        // href/action 属性
                        /href\s*=\s*["'](\/[^"']*\/xtgl\/[^"']+)["']/,
                        /action\s*=\s*["'](\/[^"']*\/xtgl\/[^"']+)["']/
                    ];

                    for (const pattern of patterns) {
                        const match = content.match(pattern);
                        if (match) {
                            let redirectPath = match[1];
                            console.log(`从页面内容中发现重定向路径: ${redirectPath}`);

                            // 确保路径以/开头
                            if (!redirectPath.startsWith('/') && !redirectPath.startsWith('http')) {
                                redirectPath = '/' + redirectPath;
                            }

                            // 构建完整URL来提取前缀
                            const fullRedirectUrl = redirectPath.startsWith('http')
                                ? redirectPath
                                : `${this.scheme}://${this.host}${redirectPath}`;
                            detectedPrefix = this.extractPathPrefix(fullRedirectUrl);

                            if (detectedPrefix !== null) {
                                console.log(`方法2成功: 从页面脚本提取前缀 "${detectedPrefix}"`);
                                break;
                            }
                        }
                    }
                }

                // 方法3: 从Location响应头提取
                if (detectedPrefix === null && response.headers) {
                    const location = response.headers['location'] || response.headers['Location'];
                    if (location) {
                        const fullLocation = location.startsWith('http') ? location : `${this.scheme}://${this.host}${location}`;
                        detectedPrefix = this.extractPathPrefix(fullLocation);
                        if (detectedPrefix !== null) {
                            console.log(`方法3成功: 从Location头提取前缀 "${detectedPrefix}"`);
                        }
                    }
                }

                if (detectedPrefix !== null) {
                    this._pathPrefix = detectedPrefix;
                    // 保存到localStorage（按学校区分）
                    const pathPrefixKey = EASAccount.getPathPrefixKey();
                    localStorage.setItem(pathPrefixKey, detectedPrefix);
                    console.log(`路径前缀探测成功: "${detectedPrefix}" (key: ${pathPrefixKey})`);
                    return detectedPrefix;
                }
            }

            // 探测失败，尝试使用配置文件中的默认前缀
            console.warn('自动探测失败，尝试使用配置文件中的默认前缀');
            const defaultPrefix = UJNAPI.DEFAULT_PATH_PREFIX;
            console.log(`默认前缀值: "${defaultPrefix}", 类型: ${typeof defaultPrefix}`);
            if (defaultPrefix !== undefined && defaultPrefix !== null) {
                this._pathPrefix = defaultPrefix;
                const pathPrefixKey = EASAccount.getPathPrefixKey();
                localStorage.setItem(pathPrefixKey, defaultPrefix);
                console.log(`成功设置默认路径前缀: "${defaultPrefix}" (key: ${pathPrefixKey})`);
                return defaultPrefix;
            }

            console.warn('无法探测路径前缀，且配置文件中没有默认值');
            // 最后兜底：设置为空字符串而不是null
            this._pathPrefix = '';
            return '';
        } catch (error) {
            console.error(`探测路径前缀失败: ${error.message}`);

            // 出错时也尝试使用默认前缀
            const defaultPrefix = UJNAPI.DEFAULT_PATH_PREFIX;
            if (defaultPrefix !== undefined && defaultPrefix !== null) {
                this._pathPrefix = defaultPrefix;
                const pathPrefixKey = EASAccount.getPathPrefixKey();
                localStorage.setItem(pathPrefixKey, defaultPrefix);
                console.log(`探测出错，使用配置的默认路径前缀: "${defaultPrefix}" (key: ${pathPrefixKey})`);
                return defaultPrefix;
            }

            return null;
        }
    }

    /**
     * 确保路径前缀已初始化（异步方法）
     * 优先级：localStorage缓存 > 自动探测 > 配置默认值 > 空字符串
     * @returns {Promise<string>} 路径前缀
     */
    async ensurePathPrefix() {
        // 检测学校是否变化，如果变化则重置路径前缀
        this._checkSchoolChange();

        // 如果已经初始化过，直接返回
        if (this._pathPrefixInitialized && this._pathPrefix !== null) {
            return this._pathPrefix;
        }

        // 如果有正在进行的初始化，等待它完成
        if (this._pathPrefixPending) {
            console.log("ensurePathPrefix: 等待正在进行的初始化...");
            return await this._pathPrefixPending;
        }

        // 创建初始化Promise并保存引用（防止并发调用）
        this._pathPrefixPending = this._doEnsurePathPrefix();

        try {
            const result = await this._pathPrefixPending;
            return result;
        } finally {
            // 初始化完成后清除pending状态
            this._pathPrefixPending = null;
        }
    }

    /**
     * 实际执行路径前缀初始化的内部方法
     * @private
     */
    async _doEnsurePathPrefix() {
        console.log("开始初始化路径前缀...");

        // 再次检查 localStorage（可能在其他地方被设置）（按学校区分）
        try {
            const pathPrefixKey = EASAccount.getPathPrefixKey();
            const savedPrefix = localStorage.getItem(pathPrefixKey);
            if (savedPrefix !== null) {
                this._pathPrefix = savedPrefix;
                this._pathPrefixInitialized = true;
                console.log(`ensurePathPrefix: 从localStorage加载 "${this._pathPrefix}" (key: ${pathPrefixKey})`);
                return this._pathPrefix;
            }
        } catch (e) {
            console.error("读取localStorage失败", e);
        }

        // 尝试探测
        console.log("ensurePathPrefix: 开始探测路径前缀...");
        const detected = await this.detectPathPrefix();
        if (detected !== null) {
            this._pathPrefixInitialized = true;
            console.log(`ensurePathPrefix: 探测成功 "${detected}"`);
            return detected;
        }

        // 探测失败，使用配置的默认前缀（如果有）
        const defaultPrefix = UJNAPI.DEFAULT_PATH_PREFIX;
        if (defaultPrefix !== null && defaultPrefix !== undefined) {
            this._pathPrefix = defaultPrefix;
            const pathPrefixKey = EASAccount.getPathPrefixKey();
            localStorage.setItem(pathPrefixKey, defaultPrefix);
            console.log(`ensurePathPrefix: 使用默认前缀 "${defaultPrefix}" (key: ${pathPrefixKey})`);
        } else {
            // 没有默认前缀（如自定义学校），使用空字符串
            this._pathPrefix = '';
            console.log("ensurePathPrefix: 无默认前缀，使用空字符串");
        }

        this._pathPrefixInitialized = true;
        return this._pathPrefix;
    }

    /**
     * 设置路径前缀（手动设置或从配置加载）
     * @param {string} prefix 路径前缀
     */
    setPathPrefix(prefix) {
        this._pathPrefix = prefix || '';
        const pathPrefixKey = EASAccount.getPathPrefixKey();
        localStorage.setItem(pathPrefixKey, this._pathPrefix);
        console.log(`手动设置路径前缀: "${this._pathPrefix}" (key: ${pathPrefixKey})`);
    }

    /**
     * 获取当前路径前缀
     * @returns {string|null} 路径前缀
     */
    getPathPrefix() {
        return this._pathPrefix;
    }

    /**
     * 重置路径前缀状态（切换学校时调用）
     * 这会清除内存中的前缀并删除存储的前缀，强制重新探测
     */
    resetPathPrefix() {
        console.log('重置路径前缀状态...');
        this._pathPrefix = null;
        this._pathPrefixInitialized = false;
        this._pathPrefixPending = null;

        // 更新记录的学校ID
        this._lastSchoolId = EASAccount.getCurrentSchoolId();

        // 删除存储的路径前缀，强制重新探测（因为切换学校后旧前缀不适用）
        try {
            const pathPrefixKey = EASAccount.getPathPrefixKey();
            console.log(`清除存储的路径前缀 (key: ${pathPrefixKey})`);
            localStorage.removeItem(pathPrefixKey);
        } catch (e) {
            console.error('清除路径前缀存储失败', e);
        }

        console.log('路径前缀已重置，需要重新探测');
    }

    /**
     * 检测学校是否变化，如果变化则自动重置路径前缀和主机配置
     * @private
     */
    _checkSchoolChange() {
        const currentSchoolId = EASAccount.getCurrentSchoolId();

        // 只检测学校ID变化（不检查主机变化，因为用户可能手动选择了其他节点）
        const schoolChanged = this._lastSchoolId && this._lastSchoolId !== currentSchoolId;

        if (schoolChanged) {
            console.log(`检测到学校变化:`);
            console.log(`  学校ID: ${this._lastSchoolId} -> ${currentSchoolId}`);

            // 重新加载主机配置
            this._reloadHostConfig();

            // 重置路径前缀
            this.resetPathPrefix();
        }
    }

    /**
     * 重新加载主机配置（切换学校时调用）
     * @private
     */
    _reloadHostConfig() {
        console.log('重新加载主机配置...');
        console.log('当前 UJNAPI.EA_HOSTS:', UJNAPI.EA_HOSTS);
        console.log('当前 UJNAPI.SCHOOL_ID:', UJNAPI.SCHOOL_ID);

        // 更新学校ID记录
        this._lastSchoolId = EASAccount.getCurrentSchoolId();

        // 获取新学校的主机索引（优先使用默认索引0）
        let hostIndex = 0;
        try {
            // 清除旧学校的主机索引缓存
            localStorage.removeItem('ujn_assistant_LAST_SUCCESSFUL_HOST');
            localStorage.removeItem('ujn_assistant_EA_HOST');
        } catch (e) {
            console.error('清除主机索引缓存失败', e);
        }

        // 获取新学校的主机地址
        const newHost = UJNAPI.EA_HOSTS[hostIndex];
        if (newHost) {
            this.host = newHost;

            // 更新协议
            const useHttps = UJNAPI.getHostHttps(hostIndex);
            this.scheme = useHttps ? 'https' : 'http';

            console.log(`主机配置已更新: host=${this.host}, scheme=${this.scheme}, schoolId=${this._lastSchoolId}`);

            // 重新创建CookieJar（使用新的域名）
            // 这会清空旧Cookie，因为切换学校后旧Cookie无效
            console.log(`重新创建CookieJar，新域名: ${this.host}`);
            this.cookieJar = new CookieJar(this.scheme, this.host, this.cookieName);
        } else {
            console.error('无法获取新学校的主机地址！UJNAPI.EA_HOSTS:', UJNAPI.EA_HOSTS);
        }
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

            // 确保路径前缀已初始化（会自动探测或使用默认值）
            await this.ensurePathPrefix();
            console.log(`当前路径前缀: "${this._pathPrefix}"`);

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
            const personalInfoUrl = this.getFullUrl(UJNAPI.STUDENT_INFO);
            console.log("检查登录状态URL:", personalInfoUrl);

            // 准备请求头
            const headers = {
                'Host': EASAccount.useVpn ? UJNAPI.VPN_HOST : this.host,
                'Proxy-Connection': 'keep-alive',
                'Cache-Control': 'max-age=0',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Encoding': 'gzip, deflate',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Referer': this.getFullUrl('')
            };

            // 确保ipc对象存在
            if (!ipc) {
                console.error("错误: ipc对象未定义!");
                return false;
            }

            // 确保必要的方法存在
            if (EASAccount.useVpn && !ipc.ipassGet) {
                console.error("错误: ipc.ipassGet方法未定义!");
                return false;
            } else if (!EASAccount.useVpn && !ipc.easGet) {
                console.error("错误: ipc.easGet方法未定义!");
                return false;
            }

            // 尝试访问个人信息页面验证登录状态
            // 使用try-catch包裹，确保即使方法调用失败也不会导致程序崩溃
            let result;
            try {
                const requestMethod = EASAccount.useVpn ? ipc.ipassGet : ipc.easGet;
                result = await requestMethod(
                    personalInfoUrl,
                    {
                        cookies: cookies,
                        headers: headers
                    }
                );
            } catch (requestError) {
                console.error("请求个人信息页面失败:", requestError);
                return false;
            }

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
                            // ========== 修复：使用按学校区分的存储键 ==========
                            const userInfoKey = `userInfo_${EASAccount.getCurrentSchoolId()}`;
                            const userInfo = await store.getObject(userInfoKey, {});

                            // 更新姓名并保存
                            userInfo.name = studentName;
                            await store.putObject(userInfoKey, userInfo);
                            console.log('登录状态检查时更新了用户姓名:', studentName, '存储键:', userInfoKey);
                            // ========== 修复结束 ==========
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
            console.log(`VPN模式: ${EASAccount.useVpn}`);

            // 确保ipc对象存在
            if (!ipc) {
                console.error("错误: ipc对象未定义!");
                return false;
            }

            // 确保必要的方法存在
            if (EASAccount.useVpn && (!ipc.ipassGet || !ipc.ipassPost)) {
                console.error("错误: VPN模式下必要的ipc方法未定义!");
                return false;
            } else if (!EASAccount.useVpn && (!ipc.easGet || !ipc.easPost)) {
                console.error("错误: 普通模式下必要的ipc方法未定义!");
                return false;
            }

            // VPN模式下的登录 - 使用driotlogin入口自动完成
            if (EASAccount.useVpn) {
                console.log("使用VPN模式登录教务系统");

                // 获取IPassAccount实例
                const ipassAccount = IPassAccount.getInstance();

                // 检查VPN是否已登录
                const vpnCookies = await ipassAccount.vpnCookieJar.getCookies();
                if (!vpnCookies || vpnCookies.length === 0) {
                    console.error("VPN模式下未找到有效Cookie，请先登录统一认证");
                    return false;
                }

                console.log(`当前VPN Cookie数量: ${vpnCookies.length}`);

                // 使用driotlogin入口登录教务系统
                const loginSuccess = await this._loginEasViaDriotlogin(vpnCookies);

                if (loginSuccess) {
                    console.log("VPN模式教务登录成功");
                    this.isLogin = true;
                    return true;
                } else {
                    console.log("VPN模式driotlogin失败，尝试普通登录流程");
                    // 继续执行下面的普通登录流程
                }
            }

            // 步骤0: 确保路径前缀已初始化
            console.log('\n[步骤0] 初始化路径前缀');
            await this.ensurePathPrefix();
            console.log(`当前路径前缀: "${this._pathPrefix}"`);

            // 步骤1: 获取登录页面获取CSRF令牌
            const timestamp = new Date().getTime();
            console.log(`\n[步骤1] 获取登录页面和CSRF令牌 (${timestamp})`);

            const loginPageUrl = this.getFullUrl(`${UJNAPI.EA_LOGIN}?time=${timestamp}`);
            console.log(`请求登录页面: ${loginPageUrl}`);

            // 选择合适的请求方法
            const getMethod = EASAccount.useVpn ? ipc.ipassGet : ipc.easGet;
            const postMethod = EASAccount.useVpn ? ipc.ipassPost : ipc.easPost;

            let loginPageResult;
            try {
                loginPageResult = await getMethod(loginPageUrl);
                if (!loginPageResult.success) {
                    console.error("获取登录页面失败:", loginPageResult.error || '未知错误');
                    return false;
                }
            } catch (requestError) {
                console.error("获取登录页面请求失败:", requestError);
                return false;
            }

            // 保存初始 cookie
            if (loginPageResult.cookies && loginPageResult.cookies.length > 0) {
                console.log("保存初始 Cookie:", loginPageResult.cookies);
                if (EASAccount.useVpn) {
                    // VPN模式下，保存Cookie到IPassAccount
                    const ipassAccount = IPassAccount.getInstance();
                    await ipassAccount.vpnCookieJar.saveCookies(loginPageResult.cookies);
                } else {
                    // 普通模式下，保存到本地CookieJar
                    await this.cookieJar.saveCookies(loginPageResult.cookies);
                }
            }

            const loginPageHtml = loginPageResult.data;

            // 检测是否需要密码加密（从页面隐藏字段mmsfjm获取，0=不加密，非0=加密）
            let passwordNeedsEncryption = true;  // 默认需要加密
            const mmsfjmMatch = loginPageHtml.match(/<input[^>]+name="mmsfjm"[^>]+value=\s*(\d+)/i);
            if (mmsfjmMatch) {
                const mmsfjmValue = parseInt(mmsfjmMatch[1], 10);
                passwordNeedsEncryption = mmsfjmValue !== 0;
                console.log(`检测到mmsfjm参数: ${mmsfjmValue}, 密码${passwordNeedsEncryption ? '需要' : '不需要'}加密`);
            } else {
                // 也检查配置中的设置
                if (UJNAPI.PLAINTEXT_PASSWORD === true) {
                    passwordNeedsEncryption = false;
                    console.log("配置强制使用明文密码");
                } else if (UJNAPI.PLAINTEXT_PASSWORD === false) {
                    passwordNeedsEncryption = true;
                    console.log("配置强制使用加密密码");
                } else {
                    console.log("未检测到mmsfjm参数，默认使用RSA加密");
                }
            }

            // 提取CSRF令牌
            const csrfTokenRegex = /<input[^>]+name="csrftoken"[^>]+value="([^"]+)"/i;
            const csrfTokenMatch = loginPageHtml.match(csrfTokenRegex);

            if (!csrfTokenMatch) {
                console.error("无法获取CSRF令牌");
                console.log("登录页面内容片段:", loginPageHtml.substring(0, 500));
                return false;
            }

            // 处理CSRF令牌 - 某些系统需要完整值，某些只需要第一部分
            let csrfToken = csrfTokenMatch[1];
            if (csrfToken.includes(',')) {
                if (UJNAPI.KEEP_FULL_CSRF_TOKEN) {
                    console.log("保留完整CSRF令牌（包含逗号分隔的多个值）");
                    // 保持完整值，但逗号需要URL编码
                    console.log("完整CSRF令牌:", csrfToken);
                } else {
                    console.log("CSRF令牌包含多个值，原始值:", csrfToken);
                    csrfToken = csrfToken.split(',')[0].trim();
                    console.log("使用第一个值:", csrfToken);
                }
            }
            console.log("成功获取CSRF令牌:", csrfToken);

            // 步骤1.5: 如果配置要求，登录前先调用登出接口
            if (UJNAPI.LOGOUT_BEFORE_LOGIN && UJNAPI.EA_LOGOUT) {
                console.log(`\n[步骤1.5] 登录前调用登出接口`);
                const logoutUrl = this.getFullUrl(UJNAPI.EA_LOGOUT);
                console.log(`登出URL: ${logoutUrl}`);

                try {
                    // 获取当前Cookie
                    let logoutCookies = await (EASAccount.useVpn ?
                        IPassAccount.getInstance().vpnCookieJar.getCookies() :
                        this.cookieJar.getCookies());

                    const logoutHeaders = {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Referer': loginPageUrl,
                        'Origin': EASAccount.useVpn ? 'https://' + UJNAPI.VPN_HOST : this.getFullUrl('')
                    };

                    const logoutResult = await postMethod(
                        logoutUrl,
                        '',  // 空body
                        {
                            headers: logoutHeaders,
                            cookies: logoutCookies
                        }
                    );
                    console.log(`登出接口响应状态: ${logoutResult.status}`);
                } catch (logoutError) {
                    console.warn("登出接口调用失败（可能不影响登录）:", logoutError);
                }
            }

            // 步骤2: 获取RSA公钥（如果需要加密）
            let rsaPassword = password;  // 默认使用明文密码

            if (passwordNeedsEncryption) {
                console.log(`\n[步骤2] 获取RSA公钥`);

                const publicKeyUrl = this.getFullUrl(UJNAPI.EA_LOGIN_PUBLIC_KEY);
                console.log(`请求公钥URL: ${publicKeyUrl}`);

                const publicKeyParams = { time: timestamp, _: timestamp };
                const publicKeyHeaders = {
                    'Referer': loginPageUrl
                };

                // 获取当前Cookie
                let currentCookies;
                if (EASAccount.useVpn) {
                    const ipassAccount = IPassAccount.getInstance();
                    currentCookies = await ipassAccount.vpnCookieJar.getCookies();
                } else {
                    currentCookies = await this.cookieJar.getCookies();
                }

                let publicKeyResult;
                try {
                    publicKeyResult = await getMethod(
                        publicKeyUrl,
                        {
                            params: publicKeyParams,
                            headers: publicKeyHeaders,
                            cookies: currentCookies
                        }
                    );

                    if (!publicKeyResult.success) {
                        console.error("获取公钥失败:", publicKeyResult.error || '未知错误');
                        return false;
                    }
                } catch (requestError) {
                    console.error("获取公钥请求失败:", requestError);
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
                rsaPassword = getenPassword(password, publicKeyData.modulus, publicKeyData.exponent);
                if (!rsaPassword) {
                    console.error("密码加密失败");
                    return false;
                }

                console.log("密码加密成功");
            } else {
                console.log(`\n[步骤2&3] 跳过公钥获取和加密（使用明文密码）`);
                rsaPassword = password;
            }

            // 步骤4: 提交登录请求
            console.log(`\n[步骤4] 提交登录请求`);

            // 构造登录表单数据 - 使用字符串格式，参照iOS实现
            // iOS版本发送两个相同的mm参数，这可能是正方教务系统的特殊要求
            const urlEncodeComponent = (str) => {
                // 自定义URL编码，确保特殊字符被正确编码
                return encodeURIComponent(str);
            };

            // 按照抓包数据的顺序构建表单：csrftoken, language, ydType, yhm, mm, mm
            const loginDataParts = [
                `csrftoken=${urlEncodeComponent(csrfToken)}`
            ];

            // 添加language参数
            loginDataParts.push(`language=zh_CN`);

            // 如果配置要求，添加ydType参数
            if (UJNAPI.REQUIRE_YD_TYPE) {
                loginDataParts.push(`ydType=`);  // 空值
            }

            // 添加用户名
            loginDataParts.push(`yhm=${urlEncodeComponent(account)}`);

            // 添加密码（发送两次）
            loginDataParts.push(`mm=${urlEncodeComponent(rsaPassword)}`);
            loginDataParts.push(`mm=${urlEncodeComponent(rsaPassword)}`);  // 重复mm参数，与抓包一致

            const loginData = loginDataParts.join('&');

            console.log("登录表单数据 (字符串格式):");
            console.log("- csrftoken:", csrfToken.substring(0, 50) + (csrfToken.length > 50 ? '...' : ''));
            console.log("- language: zh_CN");
            if (UJNAPI.REQUIRE_YD_TYPE) {
                console.log("- ydType: (空)");
            }
            console.log("- yhm:", account);
            console.log(`- mm: ${passwordNeedsEncryption ? '[已加密]' : '[明文]'} (发送两次)`);
            console.log("表单字符串:", loginData.substring(0, 100) + "...");

            const loginUrl = this.getFullUrl(UJNAPI.EA_LOGIN);
            console.log("登录请求URL:", loginUrl);

            const loginHeaders = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': loginPageUrl,
                'Origin': EASAccount.useVpn ? 'https://' + UJNAPI.VPN_HOST : this.getFullUrl(''),
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };

            console.log("发送登录请求...");
            // 获取当前Cookie
            let cookies = await (EASAccount.useVpn ?
                IPassAccount.getInstance().vpnCookieJar.getCookies() :
                this.cookieJar.getCookies());

            let loginResult;
            try {
                loginResult = await postMethod(
                    loginUrl,
                    loginData,
                    {
                        headers: loginHeaders,
                        cookies: cookies
                    }
                );
            } catch (requestError) {
                console.error("登录请求失败:", requestError);
                return false;
            }

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
                    if (EASAccount.useVpn) {
                        const ipassAccount = IPassAccount.getInstance();
                        ipassAccount.vpnCookieJar.clearCookies();
                        await ipassAccount.vpnCookieJar.saveCookies([jsessionidCookie]);
                    } else {
                        this.cookieJar.clearCookies();
                        await this.cookieJar.saveCookies([jsessionidCookie]);
                    }
                    console.log("已保存 JSESSIONID Cookie");
                } else {
                    console.log("未找到 JSESSIONID Cookie");
                    // 保存所有返回的 cookie
                    if (EASAccount.useVpn) {
                        const ipassAccount = IPassAccount.getInstance();
                        await ipassAccount.vpnCookieJar.saveCookies(loginResult.cookies);
                    } else {
                        await this.cookieJar.saveCookies(loginResult.cookies);
                    }
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

            // 备用验证: 访问学年数据页面（使用配置的API路径）
            console.log("\n尝试备用验证方式");
            // 使用配置的学年数据API进行验证，而不是硬编码的路径
            const verifyApiPath = UJNAPI.EA_YEAR_DATA || 'xtgl/index_cxAreaFive.html?localeKey=zh_CN&gnmkdm=index';
            const personalInfoUrl = this.getFullUrl(verifyApiPath);
            console.log("请求验证页面:", personalInfoUrl);

            // 使用当前保存的Cookie和合适的请求头
            const savedCookies = await (EASAccount.useVpn ?
                IPassAccount.getInstance().vpnCookieJar.getCookies() :
                this.cookieJar.getCookies());
            console.log("使用已保存的Cookie进行验证:", savedCookies);

            const personalInfoHeaders = {
                'Referer': EASAccount.useVpn ? 'https://' + UJNAPI.VPN_HOST : this.getFullUrl(''),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };

            let personalInfoResult;
            try {
                personalInfoResult = await getMethod(
                    personalInfoUrl,
                    {
                        cookies: savedCookies,
                        headers: personalInfoHeaders
                    }
                );
            } catch (requestError) {
                console.error("备用验证请求失败:", requestError);
                return false;
            }

            // 使用统一方法检查响应是否有效
            let hasStudentInfo = false;

            // 首先检查是否是JSON格式的有效响应
            if (personalInfoResult.data) {
                try {
                    const jsonData = JSON.parse(personalInfoResult.data);
                    // 如果成功解析JSON并且有数据，说明已登录
                    if (jsonData && (jsonData.xnm || jsonData.xqm || jsonData.xh || Array.isArray(jsonData))) {
                        hasStudentInfo = true;
                        console.log("JSON响应包含有效数据，验证通过");
                    }
                } catch (e) {
                    // 不是JSON，使用HTML检查方式
                    hasStudentInfo = this.isValidLoggedInPage(personalInfoResult.data);
                }
            }

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
     * 通过driotlogin入口登录教务系统（VPN模式）
     * @param {Array} vpnCookies VPN Cookie数组
     * @returns {Promise<boolean>} 登录是否成功
     * @private
     */
    async _loginEasViaDriotlogin(vpnCookies) {
        try {
            console.log('===== 开始通过driotlogin登录教务系统 =====');

            // 构建driotlogin入口URL - 使用当前选择的节点（this.host）
            const easHost = this.host; // 使用用户选择的节点，而不是默认节点
            // VPN模式下原始URL使用http（跟其他地方的逻辑一致）
            const easScheme = EASAccount.useVpn ? 'http' : this.scheme;
            const driotLoginPath = 'sso/driotlogin';

            // 构建原始URL
            const originalUrl = `${easScheme}://${easHost}/${driotLoginPath}`;
            // 加密为VPN URL
            const vpnDriotLoginUrl = VpnEncodeUtils.encryptUrl(originalUrl);

            console.log(`当前节点: ${easHost}`);
            console.log(`当前协议: ${easScheme} (VPN模式: ${EASAccount.useVpn})`);
            console.log(`原始driotlogin URL: ${originalUrl}`);
            console.log(`加密后的VPN URL: ${vpnDriotLoginUrl}`);

            // 获取IPassAccount实例
            const ipassAccount = IPassAccount.getInstance();

            // 步骤1: 访问driotlogin入口并跟随重定向
            let currentUrl = vpnDriotLoginUrl;
            let maxRedirects = 10;
            let redirectCount = 0;
            let loginSuccess = false;

            // 复制Cookie数组
            let currentCookies = [...vpnCookies];

            while (redirectCount < maxRedirects) {
                console.log(`[重定向 ${redirectCount}] 访问: ${currentUrl}`);

                const result = await ipc.ipassGet(currentUrl, {
                    cookies: currentCookies,
                    followRedirect: false
                });

                console.log(`响应状态: ${result.status}`);

                // 保存新Cookie
                if (result.cookies && result.cookies.length > 0) {
                    console.log(`收到 ${result.cookies.length} 个新Cookie`);
                    await ipassAccount.vpnCookieJar.saveCookies(result.cookies);

                    // 更新currentCookies
                    for (const cookie of result.cookies) {
                        const cookieParts = cookie.split(';')[0].split('=');
                        const cookieName = cookieParts[0];

                        const existingIndex = currentCookies.findIndex(c => {
                            const parts = c.split(';')[0].split('=');
                            return parts[0] === cookieName;
                        });

                        if (existingIndex >= 0) {
                            currentCookies[existingIndex] = cookie;
                        } else {
                            currentCookies.push(cookie);
                        }
                    }
                }

                // 检查是否到达教务系统主页
                if (result.data) {
                    if (result.data.includes('index_initMenu') ||
                        result.data.includes('xtgl/index_initMenu')) {
                        console.log('已到达教务系统主页，登录成功');
                        loginSuccess = true;
                        break;
                    }

                    // 检查是否包含学生信息（且不是登录页）
                    if (result.data.includes('xh') && result.data.includes('xm') &&
                        !result.data.includes('login_slogin') &&
                        !result.data.includes('id="yhm"')) {
                        console.log('检测到学生信息，登录成功');
                        loginSuccess = true;
                        break;
                    }
                }

                // 处理重定向
                if (result.status === 302 || result.status === 301) {
                    let location = result.headers?.location || result.location || '';
                    if (!location) {
                        console.log('重定向但没有location头');
                        break;
                    }

                    console.log(`重定向到: ${location}`);

                    // 处理相对URL
                    const vpnHost = UJNAPI.VPN_HOST || 'webvpn.ujn.edu.cn';
                    if (location.startsWith('/')) {
                        location = `https://${vpnHost}${location}`;
                    } else if (!location.startsWith('http')) {
                        const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
                        location = baseUrl + location;
                    }

                    currentUrl = location;
                    redirectCount++;
                } else if (result.status === 200) {
                    // 检查是否包含登录表单
                    if (result.data && (
                        result.data.includes('id="yhm"') ||
                        result.data.includes('name="yhm"') ||
                        result.data.includes('login_slogin')
                    )) {
                        console.log('到达登录页面，VPN教务登录失败');
                        loginSuccess = false;
                        break;
                    }

                    // 检查meta refresh重定向
                    const metaRefreshMatch = result.data?.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["']\d+;\s*url=([^"']+)["']/i);
                    if (metaRefreshMatch) {
                        let refreshUrl = metaRefreshMatch[1];
                        console.log(`检测到meta refresh: ${refreshUrl}`);

                        const vpnHost = UJNAPI.VPN_HOST || 'webvpn.ujn.edu.cn';
                        if (refreshUrl.startsWith('/')) {
                            refreshUrl = `https://${vpnHost}${refreshUrl}`;
                        } else if (!refreshUrl.startsWith('http')) {
                            const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
                            refreshUrl = baseUrl + refreshUrl;
                        }

                        currentUrl = refreshUrl;
                        redirectCount++;
                        continue;
                    }

                    // 尝试验证登录状态
                    if (result.data && !result.data.includes('login')) {
                        console.log('页面不包含登录表单，验证登录状态...');
                        const verifySuccess = await this._verifyVpnLoginStatus(currentCookies);
                        if (verifySuccess) {
                            loginSuccess = true;
                        }
                        break;
                    }
                    break;
                } else {
                    console.log(`未预期的状态码: ${result.status}`);
                    break;
                }
            }

            console.log(`===== driotlogin登录${loginSuccess ? '成功' : '失败'} =====`);
            return loginSuccess;

        } catch (error) {
            console.error('driotlogin登录失败:', error);
            return false;
        }
    }

    /**
     * 验证VPN模式下的登录状态
     * @param {Array} cookies Cookie数组
     * @returns {Promise<boolean>} 是否已登录
     * @private
     */
    async _verifyVpnLoginStatus(cookies) {
        try {
            console.log('验证VPN登录状态...');

            const verifyPath = UJNAPI.EA_YEAR_DATA || 'xtgl/index_cxAreaFive.html?localeKey=zh_CN&gnmkdm=index';
            const verifyUrl = this.getFullUrl(verifyPath);

            console.log(`验证URL: ${verifyUrl}`);

            const result = await ipc.ipassGet(verifyUrl, {
                cookies: cookies
            });

            if (result.success && result.data) {
                try {
                    const jsonData = JSON.parse(result.data);
                    if (jsonData && (jsonData.xnm || jsonData.xqm || Array.isArray(jsonData))) {
                        console.log('验证成功：收到有效JSON数据');
                        return true;
                    }
                } catch (e) {
                    if (!result.data.includes('login_slogin') &&
                        !result.data.includes('id="yhm"')) {
                        console.log('验证成功：页面不包含登录表单');
                        return true;
                    }
                }
            }

            console.log('验证失败');
            return false;
        } catch (error) {
            console.error('验证登录状态失败:', error);
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

            // 构建请求URL - 使用动态配置的API路径
            const personalInfoUrl = this.getFullUrl(UJNAPI.STUDENT_INFO);
            console.log("获取学生信息URL:", personalInfoUrl);

            // 准备请求头
            const headers = {
                'Host': EASAccount.useVpn ? UJNAPI.VPN_HOST : this.host,
                'Referer': EASAccount.useVpn ? 'https://' + UJNAPI.VPN_HOST : this.getFullUrl(''),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
            };

            // 确保ipc对象存在
            if (!ipc) {
                console.error("错误: ipc对象未定义!");
                return false;
            }

            // 确保必要的方法存在
            const requestMethod = EASAccount.useVpn ? ipc.ipassGet : ipc.easGet;
            if (!requestMethod) {
                console.error(`错误: ${EASAccount.useVpn ? 'ipc.ipassGet' : 'ipc.easGet'}方法未定义!`);
                return false;
            }

            // 获取学生信息
            let response;
            try {
                response = await requestMethod(
                    personalInfoUrl,
                    {
                        cookies: cookies,
                        headers: headers
                    }
                );
            } catch (requestError) {
                console.error("获取学生信息请求失败:", requestError);
                return false;
            }

            if (!response.success || response.status !== 200) {
                console.error("获取学生信息请求失败", response);
                return false;
            }

            // 添加调试信息
            console.log("响应状态:", response.status);
            console.log("响应数据前200字符:", response.data ? response.data.substring(0, 200) : "无数据");

            // 使用统一方法检查响应是否有效
            if (!this.isValidLoggedInPage(response.data)) {
                console.error("获取学生信息失败：无权限或未登录");
                return false;
            }

            // 提取学生姓名
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
                        // ========== 修复：使用按学校区分的存储键 ==========
                        const userInfoKey = `userInfo_${EASAccount.getCurrentSchoolId()}`;
                        const userInfo = await store.getObject(userInfoKey, {});

                        // 更新姓名并保存
                        userInfo.name = studentName;
                        await store.putObject(userInfoKey, userInfo);
                        console.log('获取学生信息时更新了用户姓名:', studentName, '存储键:', userInfoKey);
                        // ========== 修复结束 ==========
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

            // 准备请求头
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': EASAccount.useVpn ? 'https://' + UJNAPI.VPN_HOST : this.getFullUrl(''),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };

            // 确保ipc对象存在
            if (!ipc) {
                console.error("错误: ipc对象未定义!");
                throw new Error("ipc对象未定义!");
            }

            // 确保必要的方法存在
            const postMethod = EASAccount.useVpn ? ipc.ipassPost : ipc.easPost;
            if (!postMethod) {
                console.error(`错误: ${EASAccount.useVpn ? 'ipc.ipassPost' : 'ipc.easPost'}方法未定义!`);
                throw new Error(`${EASAccount.useVpn ? 'ipc.ipassPost' : 'ipc.easPost'}方法未定义!`);
            }

            // 查询成绩列表 - 根据VPN模式选择不同的请求方法
            let markResponse;
            try {
                markResponse = await postMethod(
                    markUrl,
                    {
                        xnm: xnm,
                        xqm: xqm,
                        'queryModel.showCount': '999'
                    },
                    {
                        cookies: cookies,
                        headers: headers
                    }
                );
            } catch (requestError) {
                console.error("查询成绩请求失败:", requestError);
                throw new Error("查询成绩请求失败: " + requestError.message);
            }

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

                let markDetailResponse;
                try {
                    markDetailResponse = await postMethod(
                        markDetailUrl,
                        {
                            xnm: xnm,
                            xqm: xqm,
                            'queryModel.showCount': '999'
                        },
                        {
                            cookies: cookies,
                            headers: headers
                        }
                    );
                } catch (requestError) {
                    console.error("查询成绩详情请求失败:", requestError);
                    throw requestError;
                }

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

            // 准备请求头
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': EASAccount.useVpn ? 'https://' + UJNAPI.VPN_HOST : this.getFullUrl(''),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };

            // 确保ipc对象存在
            if (!ipc) {
                console.error("错误: ipc对象未定义!");
                throw new Error("ipc对象未定义!");
            }

            // 确保必要的方法存在
            const postMethod = EASAccount.useVpn ? ipc.ipassPost : ipc.easPost;
            if (!postMethod) {
                console.error(`错误: ${EASAccount.useVpn ? 'ipc.ipassPost' : 'ipc.easPost'}方法未定义!`);
                throw new Error(`${EASAccount.useVpn ? 'ipc.ipassPost' : 'ipc.easPost'}方法未定义!`);
            }

            let response;
            try {
                response = await postMethod(
                    noticeUrl,
                    {
                        'queryModel.showCount': pageSize.toString(),
                        'queryModel.currentPage': page.toString(),
                        'queryModel.sortName': 'cjsj',
                        'queryModel.sortOrder': 'desc'
                    },
                    {
                        cookies: cookies,
                        headers: headers
                    }
                );
            } catch (requestError) {
                console.error("查询通知请求失败:", requestError);
                throw new Error("查询通知请求失败: " + requestError.message);
            }

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

            // 准备请求头
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': EASAccount.useVpn ? 'https://' + UJNAPI.VPN_HOST : this.getFullUrl(''),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };

            // 确保ipc对象存在
            if (!ipc) {
                console.error("错误: ipc对象未定义!");
                throw new Error("ipc对象未定义!");
            }

            // 确保必要的方法存在
            const postMethod = EASAccount.useVpn ? ipc.ipassPost : ipc.easPost;
            if (!postMethod) {
                console.error(`错误: ${EASAccount.useVpn ? 'ipc.ipassPost' : 'ipc.easPost'}方法未定义!`);
                throw new Error(`${EASAccount.useVpn ? 'ipc.ipassPost' : 'ipc.easPost'}方法未定义!`);
            }

            let response;
            try {
                response = await postMethod(
                    examUrl,
                    {
                        xnm: xnm,
                        xqm: xqm,
                        'queryModel.showCount': '999'
                    },
                    {
                        cookies: cookies,
                        headers: headers
                    }
                );
            } catch (requestError) {
                console.error("查询考试请求失败:", requestError);
                throw new Error("查询考试请求失败: " + requestError.message);
            }

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
        if (EASAccount.useVpn) {
            const ipassAccount = IPassAccount.getInstance();
            ipassAccount.vpnCookieJar.clearCookies();
        } else {
            this.cookieJar.clearCookies();
        }
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
        if (EASAccount.useVpn) {
            const ipassAccount = IPassAccount.getInstance();
            return ipassAccount.vpnCookieJar.cookiesList || [];
        } else {
            return this.cookieJar.cookiesList;
        }
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