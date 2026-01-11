// src/services/calendarService.js
import ipc from '@/utils/ipc';
import store from '@/utils/store';
import authService from '@/services/authService';
import VpnEncodeUtils from '../utils/vpnEncodeUtils';
import API from '../constants/api';

/**
 * 校历服务类
 * 提供校历数据获取、解析和缓存功能
 * 支持多学校：济南大学（HTML表格）、荆楚理工（PDF链接）
 */
class CalendarService {
    constructor() {
        this.cacheKey = 'SCHOOL_CALENDAR_DATA';
        this.cacheExpireKey = 'SCHOOL_CALENDAR_EXPIRE';
        this.cacheExpireDays = 7; // 缓存7天
        this.sessionId = null;
        this.vpnTicket = null;
        this.debug = true; // 启用调试日志

        // ========== 新增：荆楚理工相关配置 ==========
        this.jcutConfig = {
            portal: {
                host: 'my.jcut.edu.cn',
                apis: {
                    tryLoginUserInfo: '/tryLoginUserInfo',
                    selectAppByCardId: '/api/uppcard/serviceTypeShow/selectAppByCardId',
                },
                cardIds: {
                    appSubscription: '4855d22336b84fa981c6d05e9bc674b0',
                }
            },
            calendar: {
                appId: '1da7ab7e2b824b1aa45691f1a81debb5',
                appName: '校历查询',
                altNames: ['校历', '学校校历'],
            },
            vpnUrls: {
                PORTAL_API: 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjIwNi4xNzQuMTAwLjIwNC4xNDguMjE4LjE2NC4xNDUuMTUwLjIwMi4xNzQuOTkuMTk4LjIwOQ==',
                PORTAL: 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjIwNi4xNzQuMTAwLjIwNC4xNDguMjE4LjE2NC4xNDUuMTUwLjIwMi4xNzQuOTkuMTk4LjIwOQ==/',
            }
        };
    }

    /**
     * 日志输出方法
     */
    log(...args) {
        if (this.debug) {
            console.log('[校历服务]', ...args);
        }
    }

    /**
     * 错误日志输出方法
     */
    error(...args) {
        console.error('[校历服务] 错误:', ...args);
    }

    // ========== 新增：获取当前学校ID ==========
    /**
     * 获取当前学校ID
     * @returns {Promise<string>} 学校ID
     */
    async getCurrentSchoolId() {
        try {
            // 方式1：从 CURRENT_SCHOOL 获取（对象格式）
            const savedSchool = await store.getString('CURRENT_SCHOOL', '');
            this.log('CURRENT_SCHOOL 原始值:', savedSchool);

            if (savedSchool) {
                try {
                    const school = JSON.parse(savedSchool);
                    if (school.id) {
                        this.log('从CURRENT_SCHOOL获取学校ID:', school.id);
                        return school.id;
                    }
                } catch (e) {
                    // 可能直接是字符串ID
                    this.log('CURRENT_SCHOOL 可能是字符串:', savedSchool);
                    return savedSchool;
                }
            }

            // 方式2：从 SCHOOL_ID 获取（字符串格式）
            const schoolId = await store.getString('SCHOOL_ID', '');
            if (schoolId) {
                this.log('从SCHOOL_ID获取学校ID:', schoolId);
                return schoolId;
            }

            // 方式3：从 authService 获取
            if (authService.currentSchool) {
                const id = authService.currentSchool.id || authService.currentSchool;
                this.log('从authService获取学校ID:', id);
                return id;
            }

            // 方式4：检查是否有荆楚理工的Cookie（作为后备判断）
            const jcutCookies = await store.getString('JCUT_VPN_COOKIES', '');
            if (jcutCookies) {
                this.log('检测到JCUT_VPN_COOKIES，判断为荆楚理工');
                return 'jcut';
            }

            this.log('未能获取学校ID，返回空');
            return '';
        } catch (e) {
            this.error('获取学校ID失败:', e);
            return '';
        }
    }

    /**
     * 获取校历数据（根据学校类型自动选择获取方式）
     * @param {boolean} forceRefresh 是否强制刷新
     * @returns {Promise<Object>} 校历数据
     */
    async getCalendarData(forceRefresh = false) {
        try {
            this.log(`开始获取校历数据, 强制刷新=${forceRefresh}`);

            // 获取当前学校ID
            const schoolId = await this.getCurrentSchoolId();
            this.log('当前学校ID:', schoolId, '类型:', typeof schoolId);
            this.log('是否为荆楚理工:', schoolId === 'jcut');

            // 如果不是强制刷新，尝试从缓存获取
            if (!forceRefresh) {
                const cachedData = await this.getCalendarFromCache();
                if (cachedData) {
                    this.log('从缓存获取校历数据成功');
                    return cachedData;
                }
            }

            // 根据学校类型选择不同的获取方式
            this.log('从缓存没有找到数据或强制刷新，准备从服务器获取');

            if (schoolId === 'jcut') {
                this.log('>>> 使用荆楚理工方式获取校历（PDF链接）');
                return await this.fetchJcutCalendar();
            } else {
                this.log('>>> 使用济南大学方式获取校历（HTML表格）');
                return await this.fetchCalendarFromServer();
            }
        } catch (error) {
            this.error('获取校历数据失败:', error);
            throw error;
        }
    }

    // ========== 新增：荆楚理工校历获取方法 ==========

    /**
     * 获取荆楚理工的Cookie
     * @returns {Promise<Array>} Cookie数组
     */
    async getJcutCookies() {
        try {
            // 从存储中加载cookies
            const savedCookies = await store.getString('JCUT_VPN_COOKIES', '');
            if (savedCookies) {
                return JSON.parse(savedCookies);
            }

            // 从authService获取
            if (authService.jcutVpnCookies && authService.jcutVpnCookies.length > 0) {
                return authService.jcutVpnCookies;
            }

            return [];
        } catch (e) {
            this.error('获取荆楚理工Cookie失败:', e);
            return [];
        }
    }

    /**
     * 获取荆楚理工的用户信息
     * @returns {Promise<{userId: string, userName: string}>}
     */
    async getJcutUserInfo() {
        try {
            const savedAccount = await store.getString('JCUT_ACCOUNT', '');
            if (savedAccount) {
                const account = JSON.parse(savedAccount);
                return {
                    userId: account.username || '',
                    userName: account.username || ''
                };
            }
        } catch (e) {
            this.error('获取荆楚理工用户信息失败:', e);
        }
        return { userId: '', userName: '' };
    }

    /**
     * 构建荆楚理工门户API请求头
     * @param {string} userId 用户ID
     * @param {string} userName 用户名
     * @param {string} cookieStr Cookie字符串
     * @returns {Object} 请求头
     */
    buildJcutHeaders(userId, userName, cookieStr) {
        const timestamp = Date.now();
        const csrfToken = Array.from({ length: 32 }, () =>
            Math.floor(Math.random() * 16).toString(16)
        ).join('');

        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://sec.jcut.edu.cn',
            'Referer': this.jcutConfig.vpnUrls.PORTAL,
            'Cookie': cookieStr,
            'csrftoken': csrfToken,
            'csrftimestamp': String(timestamp),
            'loginuserid': userId,
            'loginusername': userName,
            'authorization': 'undefined',
        };
    }

    /**
     * 构建荆楚理工门户API URL
     * @param {string} apiPath API路径
     * @param {Object} params 查询参数
     * @returns {string} 完整URL
     */
    buildJcutApiUrl(apiPath, params = {}) {
        const baseUrl = this.jcutConfig.vpnUrls.PORTAL_API;
        let url = `${baseUrl}${apiPath}?vpn-12-my.jcut.edu.cn`;

        params._t = params._t || Date.now();

        Object.keys(params).forEach(key => {
            url += `&${key}=${encodeURIComponent(params[key])}`;
        });

        return url;
    }

    /**
     * 获取荆楚理工应用列表
     * @returns {Promise<{success: boolean, apps: Array}>}
     */
    async getJcutAppList() {
        try {
            const cookies = await this.getJcutCookies();
            const userInfo = await this.getJcutUserInfo();
            const cookieStr = cookies.join('; ');

            const url = this.buildJcutApiUrl(
                this.jcutConfig.portal.apis.selectAppByCardId,
                { cardId: this.jcutConfig.portal.cardIds.appSubscription }
            );

            this.log('[JCUT] 获取应用列表:', url);

            const result = await ipc.ipassGet(url, {
                headers: this.buildJcutHeaders(userInfo.userId, userInfo.userName, cookieStr)
            });

            if (result.success && result.data) {
                let data = result.data;
                if (typeof data === 'string') {
                    data = JSON.parse(data);
                }

                if (data.meta && data.meta.success === true && data.data) {
                    const apps = data.data.appList || [];
                    this.log('[JCUT] 获取到应用数:', apps.length);
                    return { success: true, apps: apps };
                }

                // 检查是否未登录
                if (data.meta && data.meta.statusCode === 302) {
                    this.log('[JCUT] 未登录或会话过期');
                    const loginError = new Error('NOT_LOGGED_IN:未登录或会话已过期，请先登录门户系统');
                    loginError.isLoginError = true;
                    throw loginError;
                }
            }

            return { success: false, apps: [] };
        } catch (error) {
            if (error.isLoginError) throw error;
            this.error('[JCUT] 获取应用列表失败:', error);
            return { success: false, apps: [] };
        }
    }

    /**
     * 从荆楚理工门户获取校历（PDF链接）
     * @returns {Promise<Object>} 校历数据
     */
    async fetchJcutCalendar() {
        try {
            this.log('[JCUT] 开始从门户API获取校历信息...');

            // 获取应用列表
            const appListResult = await this.getJcutAppList();
            if (!appListResult.success) {
                const loginError = new Error('NOT_LOGGED_IN:获取应用列表失败，请先登录门户系统');
                loginError.isLoginError = true;
                throw loginError;
            }

            // 查找校历应用
            const calendarConfig = this.jcutConfig.calendar;
            const calendarApp = appListResult.apps.find(app => {
                // 通过appId匹配
                if (calendarConfig.appId && app.appId === calendarConfig.appId) {
                    return true;
                }
                // 通过appName匹配
                if (app.appName === calendarConfig.appName) {
                    return true;
                }
                // 通过备用名称匹配
                if (calendarConfig.altNames && calendarConfig.altNames.includes(app.appName)) {
                    return true;
                }
                return false;
            });

            if (!calendarApp || !calendarApp.appLink) {
                this.error('[JCUT] 未找到校历应用');
                throw new Error('未找到校历应用');
            }

            this.log('[JCUT] 找到校历应用:', calendarApp.appName);
            this.log('[JCUT] 校历PDF地址:', calendarApp.appLink);

            // 组装返回数据
            const result = {
                title: calendarApp.appName || '校历查询',
                updateTime: new Date().toISOString(),
                // 荆楚理工特有：PDF链接
                pdfUrl: calendarApp.appLink,
                // 应用信息
                appInfo: calendarApp,
                // 标记为PDF类型
                type: 'pdf',
                // 兼容字段
                htmlContent: null,
                semesterInfo: null,
                weeks: [],
                importantDates: []
            };

            // 保存到缓存
            await this.saveCalendarToCache(result);

            this.log('[JCUT] 校历数据获取成功');
            return result;
        } catch (error) {
            this.error('[JCUT] 获取校历失败:', error);
            throw error;
        }
    }

    // ========== 以下是原有方法，保持不变 ==========

    /**
     * 从缓存获取校历数据
     * @returns {Promise<Object|null>} 校历数据或null
     */
    async getCalendarFromCache() {
        try {
            // 检查缓存是否过期
            const expireTime = await store.getInt(this.cacheExpireKey, 0);
            this.log(`缓存过期时间: ${new Date(expireTime).toLocaleString()}, 当前时间: ${new Date().toLocaleString()}`);

            if (expireTime < Date.now()) {
                this.log('校历缓存已过期');
                return null;
            }

            // 获取缓存数据
            const cachedData = await store.getObject(this.cacheKey, null);
            if (!cachedData) {
                this.log('校历缓存为空');
                return null;
            }

            this.log('成功从缓存获取校历数据');
            return cachedData;
        } catch (error) {
            this.error('获取校历缓存失败:', error);
            return null;
        }
    }

    /**
     * 保存校历数据到缓存
     * @param {Object} data 校历数据
     */
    async saveCalendarToCache(data) {
        try {
            if (!data) {
                this.log('保存的校历数据无效');
                return;
            }

            // 设置过期时间
            const expireTime = Date.now() + this.cacheExpireDays * 24 * 60 * 60 * 1000;
            this.log(`设置缓存过期时间: ${new Date(expireTime).toLocaleString()}`);
            await store.putInt(this.cacheExpireKey, expireTime);

            // 保存数据
            await store.putObject(this.cacheKey, data);
            this.log('校历数据已保存到缓存');
        } catch (error) {
            this.error('保存校历数据到缓存失败:', error);
        }
    }

    /**
     * 获取存储的智慧济大Cookie
     * @returns {Promise<Array<string>>} Cookie数组
     */
    async getStoredCookies() {
        try {
            this.log('开始获取存储的智慧济大Cookie');

            // 检查VPN模式
            const useVpn = authService.useVpn;
            this.log(`VPN模式: ${useVpn ? '启用' : '禁用'}`);

            // 先检查是否已登录智慧济大
            if (authService.ipassLoginStatus.value) {
                this.log('智慧济大已登录，从authService获取Cookie');

                // 获取Cookie - 根据VPN模式选择不同的Cookie
                let cookies;
                if (useVpn) {
                    // VPN模式下，尝试获取VPN的Cookie
                    if (authService.ipassAccount.vpnCookieJar) {
                        cookies = await authService.ipassAccount.vpnCookieJar.getCookies();
                        this.log('从vpnCookieJar获取的Cookie:', cookies);
                        if (cookies && cookies.length > 0) {
                            return cookies;
                        }
                    }
                } else {
                    // 普通模式下获取常规Cookie
                    cookies = authService.ipassAccount.getCookie();
                    this.log('从authService获取的Cookie原始数据:', cookies);

                    // 处理Cookie：如果是对象数组，转换为字符串数组
                    if (cookies && cookies.length > 0) {
                        if (typeof cookies[0] === 'object') {
                            this.log('Cookie是对象数组格式，转换为字符串数组');

                            const cookieStrings = cookies.map(cookie => {
                                if (cookie.name && cookie.value) {
                                    return `${cookie.name}=${cookie.value}`;
                                }
                                return null;
                            }).filter(Boolean);

                            this.log('转换后的Cookie字符串数组:', cookieStrings);
                            return cookieStrings;
                        } else {
                            this.log('Cookie已经是字符串数组格式');
                            return cookies;
                        }
                    }
                }
            } else {
                this.log('智慧济大未登录，尝试其他方式获取Cookie');
            }

            // 从CookieJar获取
            if (authService.ipassAccount) {
                if (useVpn && authService.ipassAccount.vpnCookieJar) {
                    this.log('尝试从vpnCookieJar获取Cookie');
                    const cookies = await authService.ipassAccount.vpnCookieJar.getCookies();
                    this.log('从vpnCookieJar获取的Cookie:', cookies);
                    if (cookies && cookies.length > 0) {
                        return cookies;
                    }
                } else if (!useVpn && authService.ipassAccount.cookieJar) {
                    this.log('尝试从普通cookieJar获取Cookie');
                    const cookies = await authService.ipassAccount.cookieJar.getCookies();
                    this.log('从cookieJar获取的Cookie:', cookies);
                    if (cookies && cookies.length > 0) {
                        return cookies;
                    }
                }
            }

            // 从localStorage获取
            try {
                const storageKey = useVpn ? 'vpnCookies' : 'ipassCookies';
                this.log(`尝试从localStorage获取Cookie(${storageKey})`);

                const savedCookies = localStorage.getItem(storageKey);
                if (savedCookies) {
                    const cookies = JSON.parse(savedCookies);
                    this.log(`从localStorage获取的Cookie(${storageKey}):`, cookies);
                    return cookies;
                } else {
                    this.log(`localStorage中没有存储Cookie(${storageKey})`);
                }
            } catch (e) {
                this.error('从localStorage获取Cookie失败:', e);
            }

            // 根据VPN模式，返回已有的会话ID
            if (useVpn && this.vpnTicket) {
                this.log('使用已有vpnTicket创建Cookie');
                return [`wengine_vpn_ticketwebvpn_ujn_edu_cn=${this.vpnTicket}`];
            } else if (!useVpn && this.sessionId) {
                this.log('使用已有sessionId创建Cookie');
                return [`JSESSIONID=${this.sessionId}`];
            }

            this.log('未找到存储的智慧济大Cookie，返回空数组');
            return [];
        } catch (error) {
            this.error('获取存储的Cookie失败:', error);
            return [];
        }
    }

    /**
     * 从服务器获取校历数据（济南大学等）
     * @returns {Promise<Object>} 校历数据
     */
    async fetchCalendarFromServer() {
        try {
            this.log('开始从服务器获取校历数据');

            // 检查VPN模式
            const useVpn = authService.useVpn;
            this.log(`VPN模式: ${useVpn ? '启用' : '禁用'}`);

            // 先获取存储的Cookie
            const storedCookies = await this.getStoredCookies();
            this.log(`获取到${storedCookies.length}个Cookie:`, storedCookies);

            // 步骤1: 获取或使用现有的认证凭据
            if (useVpn) {
                if (!this.vpnTicket) {
                    this.log('没有现有的VPN Ticket，尝试提取');

                    if (storedCookies.length > 0) {
                        for (const cookie of storedCookies) {
                            if (typeof cookie === 'string' && cookie.includes('wengine_vpn_ticketwebvpn_ujn_edu_cn=')) {
                                this.vpnTicket = cookie.split('=')[1].split(';')[0];
                                this.log('从存储Cookie中获取VPN Ticket:', this.vpnTicket);
                                break;
                            }
                        }
                    }

                    if (!this.vpnTicket) {
                        this.log('Cookie中未找到VPN Ticket，初始化会话');
                        await this.initSession(storedCookies);
                    }
                } else {
                    this.log('使用现有的VPN Ticket:', this.vpnTicket);
                }
            } else {
                if (!this.sessionId) {
                    this.log('没有现有的JSESSIONID，尝试提取');

                    if (storedCookies.length > 0) {
                        for (const cookie of storedCookies) {
                            if (typeof cookie === 'string' && cookie.includes('JSESSIONID=')) {
                                this.sessionId = cookie.split('=')[1].split(';')[0];
                                this.log('从存储Cookie中获取JSESSIONID:', this.sessionId);
                                break;
                            }
                        }

                        if (!this.sessionId) {
                            this.log('Cookie中未找到JSESSIONID，初始化会话');
                            await this.initSession(storedCookies);
                        }
                    } else {
                        this.log('没有存储的Cookie，初始化会话');
                        await this.initSession([]);
                    }
                } else {
                    this.log('使用现有的JSESSIONID:', this.sessionId);
                }
            }

            try {
                // 步骤2: 获取应用列表以查找校历
                this.log('步骤2: 获取应用列表以查找校历');
                const appsList = await this.getBusinessAppsList(storedCookies);
                this.log(`获取到${appsList.length}个应用`);

                // 步骤3: 从应用列表中找到校历应用ID
                this.log('步骤3: 从应用列表中找到校历应用');
                const calendarApp = this.findCalendarApp(appsList);
                if (!calendarApp) {
                    if (appsList.length === 0) {
                        const loginError = new Error('NOT_LOGGED_IN:未登录或会话已过期，请先登录智慧济大');
                        loginError.isLoginError = true;
                        throw loginError;
                    } else {
                        throw new Error('找不到校历应用');
                    }
                }
                this.log('找到校历应用:', calendarApp);

                // 步骤4: 解析URL获取资源ID
                this.log('步骤4: 解析URL获取资源ID');
                const resourceId = this.extractResourceIdFromUrl(calendarApp.URL);
                if (!resourceId) {
                    throw new Error('无法获取校历资源ID');
                }
                this.log('解析到资源ID:', resourceId);

                // 步骤5: 获取校历详细信息
                this.log('步骤5: 获取校历详细信息');
                const calendarDetail = await this.getCalendarDetail(resourceId, storedCookies);
                if (!calendarDetail || !calendarDetail.length) {
                    throw new Error('获取校历详细信息失败');
                }
                this.log('获取到校历详情:', calendarDetail);

                // 步骤6: 获取校历内容
                this.log('步骤6: 获取校历内容');
                const contentUrl = calendarDetail[0].CONTENT_URL;
                if (!contentUrl) {
                    throw new Error('无法获取校历内容地址');
                }
                this.log('获取到内容URL:', contentUrl);

                // 步骤7: 获取校历数据并解析
                this.log('步骤7: 获取校历内容并解析');
                const calendarContent = await this.getCalendarContent(contentUrl, storedCookies);
                if (!calendarContent) {
                    throw new Error('获取校历内容失败');
                }
                this.log('获取到校历内容，长度:', calendarContent.length);

                // 提取HTML内容
                const htmlContent = this.extractHtmlContent(calendarContent);
                if (!htmlContent) {
                    throw new Error('提取HTML内容失败');
                }
                this.log('提取HTML内容完成，长度:', htmlContent.length);

                // 组装返回数据
                this.log('开始组装返回数据');
                const result = {
                    title: calendarDetail[0].PIM_TITLE || '校历',
                    updateTime: new Date(calendarDetail[0].MODIFY_TIME || Date.now()).toISOString(),
                    htmlContent: htmlContent,
                    semesterInfo: this.extractSemesterInfo(calendarDetail[0].PIM_TITLE || '', calendarContent),
                    weeks: this.extractWeeks(calendarContent),
                    importantDates: this.extractImportantDates(calendarContent),
                    // 标记为HTML类型
                    type: 'html'
                };
                this.log('数据组装完成');

                // 保存到缓存
                this.log('保存数据到缓存');
                await this.saveCalendarToCache(result);

                this.log('校历数据获取成功');
                return result;
            } catch (error) {
                if (error.isLoginError) {
                    throw error;
                }
                throw error;
            }
        } catch (error) {
            this.error('从服务器获取校历数据失败:', error);
            throw error;
        }
    }

    /**
     * 初始化会话
     * @param {Array<string>} existingCookies 已存在的Cookie
     */
    async initSession(existingCookies = []) {
        try {
            this.log('初始化会话，使用已有Cookie数量:', existingCookies.length);

            const useVpn = authService.useVpn;
            this.log(`VPN模式: ${useVpn ? '启用' : '禁用'}`);

            let url;
            const portalUrl = API.PORTAL_URL || 'http://one.ujn.edu.cn/';
            const portalViewUrl = portalUrl + 'up/view?m=up';
            if (useVpn) {
                url = VpnEncodeUtils.encryptUrl(portalViewUrl);
            } else {
                url = portalViewUrl;
            }

            const options = {
                maxRedirects: 5,
                timeout: 30000,
                cookies: existingCookies
            };

            options.headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };

            if (useVpn) {
                options.headers['Host'] = API.VPN_HOST || 'webvpn.ujn.edu.cn';
                options.headers['Referer'] = API.VPN_LOGIN || 'https://webvpn.ujn.edu.cn/';
            } else {
                options.headers['Referer'] = API.PORTAL_URL || 'http://one.ujn.edu.cn/';
            }

            this.log('发送请求获取会话，URL:', url);

            const response = await ipc.ipassGet(url, options);

            this.log('收到响应, 状态:', response.success ? '成功' : '失败');

            if (response.status === 302) {
                const location = response.headers?.location || '';
                this.log('重定向地址:', location);

                if (location.includes('tpass/login') || location.includes(API.IPASS_HOST || 'sso.ujn.edu.cn')) {
                    this.log('检测到重定向到登录页面，用户未登录');
                    const loginError = new Error('NOT_LOGGED_IN:未登录或会话已过期，请先登录智慧济大');
                    loginError.isLoginError = true;
                    throw loginError;
                }
            }

            if (response.cookies && response.cookies.length > 0) {
                this.log('获取新的Cookie:', response.cookies);

                const newCookies = [...existingCookies];
                for (const cookie of response.cookies) {
                    const cookieName = cookie.split('=')[0];

                    const existingIndex = newCookies.findIndex(c =>
                        typeof c === 'string' && c.startsWith(`${cookieName}=`)
                    );
                    if (existingIndex >= 0) {
                        newCookies[existingIndex] = cookie;
                    } else {
                        newCookies.push(cookie);
                    }
                }

                try {
                    const storageKey = useVpn ? 'vpnCookies' : 'ipassCookies';
                    localStorage.setItem(storageKey, JSON.stringify(newCookies));
                } catch (e) {
                    this.error('保存Cookie到localStorage失败:', e);
                }

                for (const cookie of response.cookies) {
                    if (useVpn) {
                        if (typeof cookie === 'string' && cookie.includes('wengine_vpn_ticketwebvpn_ujn_edu_cn=')) {
                            this.vpnTicket = cookie.split('=')[1].split(';')[0];
                            this.log('成功获取VPN Ticket:', this.vpnTicket);
                            return;
                        }
                    } else {
                        if (typeof cookie === 'string' && cookie.includes('JSESSIONID=')) {
                            this.sessionId = cookie.split('=')[1].split(';')[0];
                            this.log('成功获取JSESSIONID:', this.sessionId);
                            return;
                        }
                    }
                }
            }

            if ((useVpn && !this.vpnTicket) || (!useVpn && !this.sessionId)) {
                const setCookieHeader = response.headers && response.headers['set-cookie'];
                if (setCookieHeader) {
                    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

                    for (const cookie of cookies) {
                        if (useVpn) {
                            if (typeof cookie === 'string' && cookie.includes('wengine_vpn_ticketwebvpn_ujn_edu_cn=')) {
                                this.vpnTicket = cookie.split('=')[1].split(';')[0];
                                return;
                            }
                        } else {
                            if (typeof cookie === 'string' && cookie.includes('JSESSIONID=')) {
                                this.sessionId = cookie.split('=')[1].split(';')[0];
                                return;
                            }
                        }
                    }
                }

                if (!useVpn) {
                    const content = response.data;
                    if (content && content.includes('jsessionid=')) {
                        const match = content.match(/jsessionid=([^"&;]+)/i);
                        if (match && match[1]) {
                            this.sessionId = match[1];
                            return;
                        }
                    }
                }

                if (response.data && typeof response.data === 'string') {
                    const ssoHost = API.IPASS_HOST || 'sso.ujn.edu.cn';
                    const isHtml = response.data.includes('<html') || response.data.includes('<!DOCTYPE');
                    const hasLoginRedirect = response.data.includes(ssoHost) || response.data.includes('tpass/login');

                    if (isHtml && hasLoginRedirect) {
                        const loginError = new Error('NOT_LOGGED_IN:未登录或会话已过期，请先登录智慧济大');
                        loginError.isLoginError = true;
                        throw loginError;
                    }
                }

                throw new Error('NOT_LOGGED_IN:未登录或会话已过期，请先登录智慧济大');
            }
        } catch (error) {
            this.error('初始化会话失败:', error);

            if (error.isLoginError) {
                throw error;
            }

            const loginError = new Error('NOT_LOGGED_IN:未登录或会话已过期，请先登录智慧济大');
            loginError.isLoginError = true;
            throw loginError;
        }
    }

    /**
     * 获取智慧济大应用列表
     */
    async getBusinessAppsList(cookies = []) {
        try {
            this.log('开始获取智慧济大应用列表');

            const useVpn = authService.useVpn;

            let url;
            const portalUrl = API.PORTAL_URL || 'http://one.ujn.edu.cn/';
            const appsListUrl = portalUrl + 'up/up/appstore/applist/getBusinessAppsList';
            if (useVpn) {
                url = VpnEncodeUtils.encryptUrl(appsListUrl);
            } else {
                url = appsListUrl;
            }

            const data = {
                mapping: 'getBusinessAppsList',
                TYPE: '12',
                categorys: ''
            };

            const headers = {
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            };

            if (useVpn) {
                headers['Referer'] = VpnEncodeUtils.encryptUrl((API.PORTAL_URL || 'http://one.ujn.edu.cn/') + 'up/view?m=up');
                headers['Host'] = API.VPN_HOST || 'webvpn.ujn.edu.cn';
            } else {
                headers['Referer'] = (API.PORTAL_URL || 'http://one.ujn.edu.cn/') + 'up/view?m=up';
            }

            if (useVpn && this.vpnTicket) {
                headers['Cookie'] = `wengine_vpn_ticketwebvpn_ujn_edu_cn=${this.vpnTicket}`;
            } else if (!useVpn && this.sessionId) {
                headers['Cookie'] = `JSESSIONID=${this.sessionId}`;
            }

            const response = await ipc.ipassPost(url, data, {
                headers: headers,
                cookies: cookies
            });

            if (!response.success) {
                throw new Error('获取应用列表失败，请求不成功');
            }

            let appsList;
            try {
                appsList = JSON.parse(response.data);

                if (!Array.isArray(appsList)) {
                    if (appsList && (appsList.success === false || appsList.needLogin || appsList.url === '/login')) {
                        const loginError = new Error('NOT_LOGGED_IN:' + (appsList.message || '未登录或会话已过期'));
                        loginError.isLoginError = true;
                        throw loginError;
                    }
                    throw new Error('响应格式错误');
                }

                if (appsList.length === 0) {
                    const loginError = new Error('NOT_LOGGED_IN:未登录或会话已过期');
                    loginError.isLoginError = true;
                    throw loginError;
                }
            } catch (e) {
                if (e.isLoginError) throw e;

                if (response.data && typeof response.data === 'string') {
                    const ssoHost = API.IPASS_HOST || 'sso.ujn.edu.cn';
                    const isHtml = response.data.includes('<html') || response.data.includes('<!DOCTYPE');
                    const hasLoginRedirect = response.data.includes(ssoHost) || response.data.includes('tpass/login');

                    if (isHtml || hasLoginRedirect) {
                        const loginError = new Error('NOT_LOGGED_IN:未登录或会话已过期');
                        loginError.isLoginError = true;
                        throw loginError;
                    }
                }
                throw new Error('解析应用列表失败: ' + e.message);
            }

            return appsList;
        } catch (error) {
            if (error.isLoginError) throw error;
            throw error;
        }
    }

    /**
     * 从应用列表中找到校历应用
     */
    findCalendarApp(appsList) {
        if (!Array.isArray(appsList) || appsList.length === 0) {
            return null;
        }

        let calendarApp = appsList.find(app => app.APP_NAME === '校历');
        if (calendarApp) return calendarApp;

        calendarApp = appsList.find(app => app.URL && app.URL.includes('pim/showpim'));
        return calendarApp || null;
    }

    /**
     * 从URL中提取资源ID
     */
    extractResourceIdFromUrl(url) {
        if (!url) return null;
        const decodedUrl = url.replace(/&amp;/g, '&');
        const match = decodedUrl.match(/id=([^&]+)/);
        return match ? match[1] : null;
    }

    /**
     * 获取校历详细信息
     */
    async getCalendarDetail(resourceId, cookies = []) {
        try {
            const useVpn = authService.useVpn;

            let url;
            const portalUrl = API.PORTAL_URL || 'http://one.ujn.edu.cn/';
            const detailUrl = portalUrl + 'up/up/pim/showpim/getPimDetailInfoById';
            if (useVpn) {
                url = VpnEncodeUtils.encryptUrl(detailUrl);
            } else {
                url = detailUrl;
            }

            const data = { RESOURCE_ID: resourceId };

            const headers = {
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            };

            if (useVpn) {
                headers['Referer'] = VpnEncodeUtils.encryptUrl((API.PORTAL_URL || 'http://one.ujn.edu.cn/') + 'up/view?m=up');
                headers['Host'] = API.VPN_HOST || 'webvpn.ujn.edu.cn';
            } else {
                headers['Referer'] = (API.PORTAL_URL || 'http://one.ujn.edu.cn/') + 'up/view?m=up';
            }

            if (useVpn && this.vpnTicket) {
                headers['Cookie'] = `wengine_vpn_ticketwebvpn_ujn_edu_cn=${this.vpnTicket}`;
            } else if (!useVpn && this.sessionId) {
                headers['Cookie'] = `JSESSIONID=${this.sessionId}`;
            }

            const response = await ipc.ipassPost(url, data, {
                headers: headers,
                cookies: cookies
            });

            if (!response.success) {
                throw new Error('获取校历详情失败');
            }

            return JSON.parse(response.data);
        } catch (error) {
            this.error('获取校历详细信息失败:', error);
            throw error;
        }
    }

    /**
     * 获取校历内容
     */
    async getCalendarContent(contentUrl, cookies = []) {
        try {
            const useVpn = authService.useVpn;

            if (!contentUrl || (!contentUrl.startsWith('uploadfiles/') && !contentUrl.includes('/'))) {
                throw new Error('无效的内容URL');
            }

            let fullUrl;
            const portalUrl = API.PORTAL_URL || 'http://one.ujn.edu.cn/';
            const contentFullUrl = `${portalUrl}up/${contentUrl}`;
            if (useVpn) {
                fullUrl = VpnEncodeUtils.encryptUrl(contentFullUrl);
            } else {
                fullUrl = contentFullUrl;
            }

            const callbackName = `jsonp_${Date.now()}`;
            fullUrl = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}callback=${callbackName}`;

            const headers = {
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            };

            if (useVpn) {
                headers['Referer'] = VpnEncodeUtils.encryptUrl((API.PORTAL_URL || 'http://one.ujn.edu.cn/') + 'up/view?m=up');
                headers['Host'] = API.VPN_HOST || 'webvpn.ujn.edu.cn';
            } else {
                headers['Referer'] = (API.PORTAL_URL || 'http://one.ujn.edu.cn/') + 'up/view?m=up';
            }

            if (useVpn && this.vpnTicket) {
                headers['Cookie'] = `wengine_vpn_ticketwebvpn_ujn_edu_cn=${this.vpnTicket}`;
            } else if (!useVpn && this.sessionId) {
                headers['Cookie'] = `JSESSIONID=${this.sessionId}`;
            }

            const response = await ipc.ipassGet(fullUrl, {
                headers: headers,
                cookies: cookies
            });

            if (!response.success || !response.data) {
                throw new Error('获取校历内容失败');
            }

            return response.data;
        } catch (error) {
            this.error('获取校历内容失败:', error);
            throw error;
        }
    }

    /**
     * 提取HTML内容
     */
    extractHtmlContent(jsonpContent) {
        if (!jsonpContent) return '';

        try {
            // 尝试从JSONP中提取JSON
            const jsonMatch = jsonpContent.match(/\((\{[\s\S]*\})\)/);
            if (jsonMatch && jsonMatch[1]) {
                try {
                    const jsonData = JSON.parse(jsonMatch[1]);
                    if (jsonData.CONTENT) {
                        return jsonData.CONTENT;
                    }
                } catch (e) {
                    // JSON解析失败，继续其他方法
                }
            }

            // 直接查找HTML表格
            const tableMatch = jsonpContent.match(/<table[\s\S]*?<\/table>/i);
            if (tableMatch) {
                return tableMatch[0];
            }

            // 查找CONTENT字段
            const contentMatch = jsonpContent.match(/"CONTENT"\s*:\s*"([\s\S]*?)(?<!\\)"/);
            if (contentMatch && contentMatch[1]) {
                return contentMatch[1]
                    .replace(/\\n/g, '\n')
                    .replace(/\\r/g, '\r')
                    .replace(/\\t/g, '\t')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\');
            }

            return '';
        } catch (error) {
            this.error('提取HTML内容失败:', error);
            return '';
        }
    }

    /**
     * 提取学期信息
     */
    extractSemesterInfo(title, content) {
        try {
            const yearMatch = title.match(/(\d{4})[—-](\d{4})/);
            const semesterMatch = title.match(/第([一二])学期/);

            return {
                year: yearMatch ? `${yearMatch[1]}-${yearMatch[2]}` : '',
                semester: semesterMatch ? (semesterMatch[1] === '一' ? '第一学期' : '第二学期') : ''
            };
        } catch (error) {
            return { year: '', semester: '' };
        }
    }

    /**
     * 提取周次信息
     */
    extractWeeks(jsonpContent) {
        try {
            const weeks = [];
            const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
                '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];

            for (let i = 0; i < chineseNumbers.length; i++) {
                const weekPattern = new RegExp(`第?${chineseNumbers[i]}周?`, 'g');
                if (jsonpContent.match(weekPattern)) {
                    weeks.push({
                        weekNumber: i + 1,
                        weekName: `第${chineseNumbers[i]}周`
                    });
                }
            }

            return weeks;
        } catch (error) {
            return [];
        }
    }

    /**
     * 提取重要日期
     */
    extractImportantDates(jsonpContent) {
        try {
            const htmlContent = this.extractHtmlContent(jsonpContent);
            if (!htmlContent) return [];

            const importantDates = [];

            // 提取注释部分的日期
            const notesMatch = htmlContent.match(/注：([\s\S]*?)<\/p>/i);
            if (notesMatch && notesMatch[1]) {
                const notesText = notesMatch[1].replace(/<[^>]+>/g, '');

                const classMatch = notesText.match(/(\d+)月(\d+)日[^，。]*?上课/);
                if (classMatch) {
                    importantDates.push({
                        name: '上课',
                        type: 'event',
                        timeString: `${classMatch[1]}月${classMatch[2]}日`
                    });
                }

                const reportMatch = notesText.match(/(\d+)月(\d+)日[^，。]*?报到/);
                if (reportMatch) {
                    importantDates.push({
                        name: '报到',
                        type: 'event',
                        timeString: `${reportMatch[1]}月${reportMatch[2]}日`
                    });
                }
            }

            // 基于表格结构提取节假日
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            const tableRows = doc.querySelectorAll('table tr');

            let currentMonth = '';
            let examStartDate = null;
            let examEndDate = null;
            let examStartMonth = '';
            let examEndMonth = '';

            tableRows.forEach(row => {
                const cells = row.querySelectorAll('td');
                let cellIndex = 0;

                const firstCell = cells[0];
                if (firstCell) {
                    const monthText = firstCell.textContent;
                    const monthMatch = monthText.match(/(\d+)\s*月/);
                    if (monthMatch) {
                        currentMonth = monthMatch[1];
                        cellIndex = 1;
                    }
                }

                let weekText = '';
                if (cells[cellIndex]) {
                    weekText = cells[cellIndex].textContent.trim();
                }

                if (weekText.includes('十八')) {
                    for (let i = cellIndex + 1; i < cells.length; i++) {
                        const cellContent = cells[i].textContent.trim();
                        const dateMatch = cellContent.match(/\d+/);
                        if (dateMatch) {
                            examStartDate = parseInt(dateMatch[0]);
                            examStartMonth = currentMonth;
                            break;
                        }
                    }
                } else if (weekText.includes('十九')) {
                    for (let i = cells.length - 1; i > cellIndex; i--) {
                        const cellContent = cells[i].textContent.trim();
                        const dateMatch = cellContent.match(/\d+/);
                        if (dateMatch) {
                            examEndDate = parseInt(dateMatch[0]);
                            examEndMonth = currentMonth;
                            break;
                        }
                    }
                }

                // 检查节假日（红色文本）
                for (let i = cellIndex; i < cells.length; i++) {
                    const cell = cells[i];
                    const redSpans = cell.querySelectorAll('span[style*="color:red"], span[style*="color: red"]');

                    let dayNumber = '';
                    let holidayName = '';

                    redSpans.forEach(span => {
                        const text = span.textContent.trim();
                        if (/^\d+$/.test(text)) {
                            dayNumber = text;
                        } else if (text && !['校训', '校风', '弘毅', '博学', '求真', '至善', '勤奋', '严谨', '团结', '创新'].includes(text)) {
                            holidayName = text;
                        }
                    });

                    if (currentMonth && dayNumber && holidayName) {
                        importantDates.push({
                            name: holidayName,
                            type: 'holiday',
                            timeString: `${currentMonth}月${dayNumber}日`
                        });
                    }
                }
            });

            // 添加考试周日期
            if (examStartDate && examEndDate && examStartMonth && examEndMonth) {
                importantDates.push({
                    name: '考试周',
                    type: 'exam',
                    timeString: `${examStartMonth}月${examStartDate}日-${examEndMonth}月${examEndDate}日`
                });
            }

            // 按时间顺序排序
            importantDates.sort((a, b) => {
                const aMatch = a.timeString.match(/(\d+)月(\d+)日/);
                const bMatch = b.timeString.match(/(\d+)月(\d+)日/);

                if (aMatch && bMatch) {
                    const aMonth = parseInt(aMatch[1]);
                    const aDay = parseInt(aMatch[2]);
                    const bMonth = parseInt(bMatch[1]);
                    const bDay = parseInt(bMatch[2]);

                    if (aMonth !== bMonth) return aMonth - bMonth;
                    return aDay - bDay;
                }
                return 0;
            });

            return importantDates;
        } catch (error) {
            this.error('提取重要日期失败:', error);
            return [];
        }
    }

    /**
     * 清除校历缓存
     */
    async clearCache() {
        try {
            this.log('开始清除校历缓存');
            await store.remove(this.cacheKey);
            await store.remove(this.cacheExpireKey);
            this.log('校历缓存已清除');
        } catch (error) {
            this.error('清除校历缓存失败:', error);
        }
    }
}

// 创建单例实例
const calendarService = new CalendarService();

export default calendarService;