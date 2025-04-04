// src/services/calendarService.js
import ipc from '@/utils/ipc';
import store from '@/utils/store';
import authService from '@/services/authService';

/**
 * 校历服务类
 * 提供校历数据获取、解析和缓存功能
 */
class CalendarService {
    constructor() {
        this.cacheKey = 'SCHOOL_CALENDAR_DATA';
        this.cacheExpireKey = 'SCHOOL_CALENDAR_EXPIRE';
        this.cacheExpireDays = 7; // 缓存7天
        this.sessionId = null;
        this.debug = true; // 启用调试日志
    }

    /**
     * 日志输出方法，便于集中控制日志输出
     * @param {...any} args 日志参数
     */
    log(...args) {
        if (this.debug) {
            console.log('[校历服务]', ...args);
        }
    }

    /**
     * 错误日志输出方法
     * @param {...any} args 日志参数
     */
    error(...args) {
        console.error('[校历服务] 错误:', ...args);
    }

    /**
     * 获取校历数据
     * @param {boolean} forceRefresh 是否强制刷新
     * @returns {Promise<Object>} 校历数据
     */
    async getCalendarData(forceRefresh = false) {
        try {
            this.log(`开始获取校历数据, 强制刷新=${forceRefresh}`);

            // 如果不是强制刷新，尝试从缓存获取
            if (!forceRefresh) {
                const cachedData = await this.getCalendarFromCache();
                if (cachedData) {
                    this.log('从缓存获取校历数据成功');
                    return cachedData;
                }
            }

            // 从服务器获取数据
            this.log('从缓存没有找到数据或强制刷新，准备从服务器获取');
            return await this.fetchCalendarFromServer();
        } catch (error) {
            this.error('获取校历数据失败:', error);
            throw error;
        }
    }

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

            // 先检查是否已登录智慧济大
            if (authService.ipassLoginStatus.value) {
                this.log('智慧济大已登录，从authService获取Cookie');

                // 获取Cookie
                const cookies = authService.ipassAccount.getCookie();
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
                        }).filter(Boolean); // 过滤掉null值

                        this.log('转换后的Cookie字符串数组:', cookieStrings);
                        return cookieStrings;
                    } else {
                        this.log('Cookie已经是字符串数组格式');
                    }
                }

                return cookies || [];
            } else {
                this.log('智慧济大未登录，尝试其他方式获取Cookie');
            }

            // 如果authService未登录，尝试从CookieJar获取
            if (authService.ipassAccount && authService.ipassAccount.cookieJar) {
                this.log('尝试从cookieJar获取Cookie');
                const cookies = await authService.ipassAccount.cookieJar.getCookies();
                this.log('从cookieJar获取的Cookie:', cookies);
                return cookies || [];
            } else {
                this.log('cookieJar不可用');
            }

            // 如果以上方法都失败，尝试从localStorage获取
            try {
                this.log('尝试从localStorage获取Cookie');
                const savedCookies = localStorage.getItem('ipassCookies');
                if (savedCookies) {
                    const cookies = JSON.parse(savedCookies);
                    this.log('从localStorage获取的Cookie:', cookies);
                    return cookies;
                } else {
                    this.log('localStorage中没有存储Cookie');
                }
            } catch (e) {
                this.error('从localStorage获取Cookie失败:', e);
            }

            this.log('未找到存储的智慧济大Cookie，返回空数组');
            return [];
        } catch (error) {
            this.error('获取存储的Cookie失败:', error);
            return [];
        }
    }

    /**
     * 从服务器获取校历数据
     * @returns {Promise<Object>} 校历数据
     */
    async fetchCalendarFromServer() {
        try {
            this.log('开始从服务器获取校历数据');

            // 先获取存储的Cookie
            const storedCookies = await this.getStoredCookies();
            this.log(`获取到${storedCookies.length}个Cookie:`, storedCookies);

            // 步骤1: 获取或使用现有的JSESSIONID
            if (!this.sessionId) {
                this.log('没有现有的JSESSIONID，尝试提取');

                if (storedCookies.length > 0) {
                    // 从存储的Cookie中查找JSESSIONID
                    this.log('从存储的Cookie中查找JSESSIONID');

                    for (const cookie of storedCookies) {
                        this.log(`检查Cookie: ${typeof cookie} - ${cookie}`);

                        if (typeof cookie === 'string' && cookie.includes('JSESSIONID=')) {
                            this.sessionId = cookie.split('=')[1].split(';')[0];
                            this.log('从存储Cookie中获取JSESSIONID:', this.sessionId);
                            break;
                        }
                    }

                    // 如果没有找到JSESSIONID，初始化会话
                    if (!this.sessionId) {
                        this.log('Cookie中未找到JSESSIONID，初始化会话');
                        await this.initSession(storedCookies);
                    }
                } else {
                    // 没有存储的Cookie，初始化会话
                    this.log('没有存储的Cookie，初始化会话');
                    await this.initSession([]);
                }
            } else {
                this.log('使用现有的JSESSIONID:', this.sessionId);
            }

            // 步骤2: 获取应用列表以查找校历
            this.log('步骤2: 获取应用列表以查找校历');
            const appsList = await this.getBusinessAppsList(storedCookies);
            this.log(`获取到${appsList.length}个应用`);

            // 步骤3: 从应用列表中找到校历应用ID
            this.log('步骤3: 从应用列表中找到校历应用');
            const calendarApp = this.findCalendarApp(appsList);
            if (!calendarApp) {
                throw new Error('找不到校历应用');
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
            this.log('获取到校历内容，长度:', calendarContent.length);

            // 提取HTML内容
            const htmlContent = this.extractHtmlContent(calendarContent);
            this.log('提取HTML内容完成，长度:', htmlContent.length);

            // 组装返回数据
            this.log('开始组装返回数据');
            const result = {
                title: calendarDetail[0].PIM_TITLE || '校历',
                updateTime: new Date(calendarDetail[0].MODIFY_TIME || Date.now()).toISOString(),
                htmlContent: htmlContent,
                semesterInfo: this.extractSemesterInfo(calendarDetail[0].PIM_TITLE || '', calendarContent),
                weeks: this.extractWeeks(calendarContent),
                importantDates: this.extractImportantDates(calendarContent)
            };
            this.log('数据组装完成');

            // 保存到缓存
            this.log('保存数据到缓存');
            await this.saveCalendarToCache(result);

            this.log('校历数据获取成功');
            return result;
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

            const url = 'http://one.ujn.edu.cn/up/view?m=up';
            const options = {
                maxRedirects: 5,
                timeout: 30000,  // 增加超时时间
                cookies: existingCookies
            };

            this.log('发送请求获取会话，URL:', url, '选项:', options);

            // 访问智慧济大门户以获取JSESSIONID
            const response = await ipc.ipassGet(url, options);

            this.log('收到响应, 状态:', response.success ? '成功' : '失败');
            if (response.status) {
                this.log('状态码:', response.status);
            }
            if (response.error) {
                this.error('响应错误:', response.error);
            }
            if (response.headers) {
                this.log('响应头:', response.headers);
            }

            // 打印响应体的前100个字符作为预览
            if (response.data) {
                const previewLength = Math.min(100, response.data.length);
                this.log(`响应内容预览(前${previewLength}个字符):`, response.data.substring(0, previewLength));
            }

            if (!response.success) {
                this.error('访问门户失败', response.error || '未知错误');
                throw new Error('访问门户失败: ' + (response.error || '未知错误'));
            }

            // 保存新的Cookie
            if (response.cookies && response.cookies.length > 0) {
                this.log('获取新的Cookie:', response.cookies);

                // 合并Cookie
                const newCookies = [...existingCookies];
                for (const cookie of response.cookies) {
                    // 处理cookie字符串
                    const cookieName = cookie.split('=')[0];
                    this.log(`处理新Cookie: ${cookie}, 名称: ${cookieName}`);

                    // 替换同名Cookie或添加新Cookie
                    const existingIndex = newCookies.findIndex(c =>
                        typeof c === 'string' && c.startsWith(`${cookieName}=`)
                    );
                    if (existingIndex >= 0) {
                        this.log(`替换现有Cookie在位置${existingIndex}`);
                        newCookies[existingIndex] = cookie;
                    } else {
                        this.log('添加新Cookie');
                        newCookies.push(cookie);
                    }
                }

                this.log('合并后的Cookie:', newCookies);

                // 保存到localStorage以备后用
                try {
                    localStorage.setItem('ipassCookies', JSON.stringify(newCookies));
                    this.log('Cookie已保存到localStorage');
                } catch (e) {
                    this.error('保存Cookie到localStorage失败:', e);
                }

                // 从Cookie中提取JSESSIONID
                this.log('从Cookie中提取JSESSIONID');
                for (const cookie of response.cookies) {
                    if (typeof cookie === 'string' && cookie.includes('JSESSIONID=')) {
                        this.sessionId = cookie.split('=')[1].split(';')[0];
                        this.log('成功获取JSESSIONID:', this.sessionId);
                        return;
                    }
                }
                this.log('Cookie中未找到JSESSIONID');
            } else {
                this.log('响应没有Cookie');
            }

            if (!this.sessionId) {
                // 尝试从响应头中获取
                this.log('尝试从响应头中获取JSESSIONID');
                const setCookieHeader = response.headers && response.headers['set-cookie'];
                if (setCookieHeader) {
                    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
                    this.log('从响应头找到Cookie:', cookies);

                    for (const cookie of cookies) {
                        if (typeof cookie === 'string' && cookie.includes('JSESSIONID=')) {
                            this.sessionId = cookie.split('=')[1].split(';')[0];
                            this.log('成功从响应头获取JSESSIONID:', this.sessionId);
                            return;
                        }
                    }
                    this.log('响应头中没有JSESSIONID Cookie');
                } else {
                    this.log('响应头中没有set-cookie字段');
                }

                // 如果没有Cookie，尝试从页面内容中提取
                this.log('尝试从页面内容中提取JSESSIONID');
                const content = response.data;
                if (content && content.includes('jsessionid=')) {
                    const match = content.match(/jsessionid=([^"&;]+)/i);
                    if (match && match[1]) {
                        this.sessionId = match[1];
                        this.log('成功从页面内容获取JSESSIONID:', this.sessionId);
                        return;
                    }
                    this.log('页面内容中未找到jsessionid');
                } else {
                    this.log('页面内容中不包含jsessionid');
                }

                this.error('无法获取JSESSIONID');
                throw new Error('获取JSESSIONID失败');
            }
        } catch (error) {
            this.error('初始化会话失败:', error, error.stack);
            throw error;
        }
    }

    /**
     * 获取智慧济大应用列表
     * @param {Array<string>} cookies Cookie列表
     * @returns {Promise<Array>} 应用列表
     */
    async getBusinessAppsList(cookies = []) {
        try {
            this.log('开始获取智慧济大应用列表');

            const url = 'http://one.ujn.edu.cn/up/up/appstore/applist/getBusinessAppsList';
            const data = {
                mapping: 'getBusinessAppsList',
                TYPE: '12',
                categorys: ''
            };

            this.log('请求URL:', url);
            this.log('请求数据:', data);

            // 设置请求头
            const headers = {
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'http://one.ujn.edu.cn/up/view?m=up'
            };

            // 添加JSESSIONID Cookie（如果有）
            if (this.sessionId) {
                headers['Cookie'] = `JSESSIONID=${this.sessionId}`;
                this.log('添加JSESSIONID到请求头:', this.sessionId);
            }

            this.log('请求头:', headers);
            this.log('使用Cookie数量:', cookies.length);

            const response = await ipc.ipassPost(url, data, {
                headers: headers,
                cookies: cookies
            });

            this.log('收到响应, 状态:', response.success ? '成功' : '失败');
            if (response.status) {
                this.log('状态码:', response.status);
            }
            if (response.error) {
                this.error('响应错误:', response.error);
            }

            // 打印响应体的前100个字符作为预览
            if (response.data) {
                const previewLength = Math.min(100, response.data.length);
                this.log(`响应内容预览(前${previewLength}个字符):`, response.data.substring(0, previewLength));
            }

            if (!response.success) {
                throw new Error('获取应用列表失败: ' + (response.error || '未知错误'));
            }

            let appsList;
            try {
                appsList = JSON.parse(response.data);
                this.log(`解析成功，获取到${appsList.length}个应用`);
            } catch (e) {
                this.error('解析应用列表失败:', e);
                throw new Error('解析应用列表失败: ' + e.message);
            }

            return appsList;
        } catch (error) {
            this.error('获取智慧济大应用列表失败:', error);
            throw error;
        }
    }

    /**
     * 从应用列表中找到校历应用
     * @param {Array} appsList 应用列表
     * @returns {Object|null} 校历应用对象
     */
    findCalendarApp(appsList) {
        this.log('开始从应用列表中查找校历应用');

        if (!Array.isArray(appsList)) {
            this.log('应用列表不是数组');
            return null;
        }

        this.log(`应用列表包含${appsList.length}个应用`);

        // 先查找名称为"校历"的应用
        let calendarApp = appsList.find(app => app.APP_NAME === '校历');
        if (calendarApp) {
            this.log('找到名为"校历"的应用:', calendarApp);
            return calendarApp;
        }

        // 如果没找到，查找URL包含"pim/showpim"的应用
        calendarApp = appsList.find(app => app.URL && app.URL.includes('pim/showpim'));
        if (calendarApp) {
            this.log('找到URL包含"pim/showpim"的应用:', calendarApp);
            return calendarApp;
        }

        // 如果还没找到，打印所有应用的名称和URL，以帮助调试
        this.log('未找到校历应用，打印所有应用:');
        appsList.forEach((app, index) => {
            this.log(`应用${index + 1}: 名称="${app.APP_NAME}", URL="${app.URL}"`);
        });

        return null;
    }

    /**
     * 从URL中提取资源ID
     * @param {string} url URL
     * @returns {string|null} 资源ID
     */
    extractResourceIdFromUrl(url) {
        this.log('从URL中提取资源ID:', url);

        if (!url) {
            this.log('URL为空');
            return null;
        }

        // 解码URL中的HTML实体
        const decodedUrl = url.replace(/&amp;/g, '&');
        this.log('解码后的URL:', decodedUrl);

        // 提取id参数
        const match = decodedUrl.match(/id=([^&]+)/);
        if (match && match[1]) {
            this.log('提取到资源ID:', match[1]);
            return match[1];
        }

        this.log('未找到资源ID');
        return null;
    }

    /**
     * 获取校历详细信息
     * @param {string} resourceId 资源ID
     * @param {Array<string>} cookies Cookie列表
     * @returns {Promise<Object>} 校历详细信息
     */
    async getCalendarDetail(resourceId, cookies = []) {
        try {
            this.log('获取校历详细信息, 资源ID:', resourceId);

            const url = 'http://one.ujn.edu.cn/up/up/pim/showpim/getPimDetailInfoById';
            const data = {
                RESOURCE_ID: resourceId
            };

            this.log('请求URL:', url);
            this.log('请求数据:', data);

            // 设置请求头
            const headers = {
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'http://one.ujn.edu.cn/up/view?m=up'
            };

            // 添加JSESSIONID Cookie（如果有）
            if (this.sessionId) {
                headers['Cookie'] = `JSESSIONID=${this.sessionId}`;
                this.log('添加JSESSIONID到请求头:', this.sessionId);
            }

            this.log('请求头:', headers);
            this.log('使用Cookie数量:', cookies.length);

            const response = await ipc.ipassPost(url, data, {
                headers: headers,
                cookies: cookies
            });

            this.log('收到响应, 状态:', response.success ? '成功' : '失败');
            if (response.status) {
                this.log('状态码:', response.status);
            }
            if (response.error) {
                this.error('响应错误:', response.error);
            }

            // 打印响应体的前100个字符作为预览
            if (response.data) {
                const previewLength = Math.min(100, response.data.length);
                this.log(`响应内容预览(前${previewLength}个字符):`, response.data.substring(0, previewLength));
            }

            if (!response.success) {
                throw new Error('获取校历详情失败: ' + (response.error || '未知错误'));
            }

            let calendarDetail;
            try {
                calendarDetail = JSON.parse(response.data);
                this.log('解析校历详情成功:', calendarDetail);
            } catch (e) {
                this.error('解析校历详情失败:', e);
                throw new Error('解析校历详情失败: ' + e.message);
            }

            return calendarDetail;
        } catch (error) {
            this.error('获取校历详细信息失败:', error);
            throw error;
        }
    }

    /**
     * 获取校历内容
     * @param {string} contentUrl 内容URL
     * @param {Array<string>} cookies Cookie列表
     * @returns {Promise<string>} 校历内容
     */
    async getCalendarContent(contentUrl, cookies = []) {
        try {
            this.log('获取校历内容, URL:', contentUrl);

            // 确保contentUrl是正确的路径
            if (!contentUrl || !contentUrl.startsWith('uploadfiles/')) {
                this.error('无效的内容URL:', contentUrl);
                throw new Error('无效的内容URL');
            }

            const url = `http://one.ujn.edu.cn/up/${contentUrl}`;
            // 生成一个唯一的回调名称
            const callbackName = `jsonp_${Date.now()}`;
            const fullUrl = `${url}?callback=${callbackName}`;

            this.log('完整请求URL:', fullUrl);

            // 设置请求头
            const headers = {
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'http://one.ujn.edu.cn/up/view?m=up'
            };

            // 添加JSESSIONID Cookie（如果有）
            if (this.sessionId) {
                headers['Cookie'] = `JSESSIONID=${this.sessionId}`;
                this.log('添加JSESSIONID到请求头:', this.sessionId);
            }

            this.log('请求头:', headers);
            this.log('使用Cookie数量:', cookies.length);

            const response = await ipc.ipassGet(fullUrl, {
                headers: headers,
                cookies: cookies
            });

            this.log('收到响应, 状态:', response.success ? '成功' : '失败');
            if (response.status) {
                this.log('状态码:', response.status);
            }
            if (response.error) {
                this.error('响应错误:', response.error);
            }

            // 打印响应体的前100个字符作为预览
            if (response.data) {
                const previewLength = Math.min(100, response.data.length);
                this.log(`响应内容预览(前${previewLength}个字符):`, response.data.substring(0, previewLength));
            }

            if (!response.success) {
                throw new Error('获取校历内容失败: ' + (response.error || '未知错误'));
            }

            // 检查响应是否是预期的JSONP格式
            if (!response.data || !response.data.includes(callbackName)) {
                this.log(`响应内容不是预期的JSONP格式，完整内容:`, response.data);
            } else {
                this.log('成功获取校历JSONP内容，长度:', response.data.length);
            }

            // 返回原始的JSONP数据
            return response.data;
        } catch (error) {
            this.error('获取校历内容失败:', error);
            throw error;
        }
    }

    /**
     * 从JSONP响应中提取HTML内容
     * @param {string} jsonpData JSONP数据
     * @returns {string} HTML内容
     */
    extractHtmlContent(jsonpData) {
        try {
            this.log('开始从JSONP响应中提取HTML内容');

            // 从JSONP响应中提取JSON部分
            const jsonMatch = jsonpData.match(/\(({.*})\)/);
            if (!jsonMatch || jsonMatch.length < 2) {
                this.log('无法从JSONP响应中提取JSON部分');
                return '';
            }

            const jsonStr = jsonMatch[1];
            this.log('提取到的JSON字符串长度:', jsonStr.length);

            let data;
            try {
                data = JSON.parse(jsonStr);
                this.log('成功解析JSON数据');
            } catch (e) {
                this.error('解析JSON数据失败:', e);
                return '';
            }

            // 从JSON中提取HTML内容 - 修复后的代码，同时检查result和content字段
            if (data && data.content) {
                this.log('成功从content字段提取HTML内容，长度:', data.content.length);
                return data.content;
            } else if (data && data.result) {
                // 新增对result字段的处理
                this.log('成功从result字段提取HTML内容，长度:', data.result.length);
                return data.result;
            } else {
                this.log('JSON数据中没有content或result字段');
                // 额外检查是否有其他可能包含HTML的字段
                const potentialHtmlFields = Object.keys(data).filter(key =>
                    typeof data[key] === 'string' &&
                    data[key].includes('<div') || data[key].includes('<table')
                );

                if (potentialHtmlFields.length > 0) {
                    const firstField = potentialHtmlFields[0];
                    this.log(`找到可能包含HTML的字段: ${firstField}, 长度:`, data[firstField].length);
                    return data[firstField];
                }

                return '';
            }
        } catch (error) {
            this.error('提取HTML内容失败:', error);
            return '';
        }
    }

    /**
     * 提取学期信息
     * @param {string} title 标题
     * @param {string} jsonpContent JSONP内容
     * @returns {Object} 学期信息
     */
    extractSemesterInfo(title, jsonpContent) {
        try {
            this.log('开始提取学期信息, 标题:', title);

            // 从标题中提取学年和学期信息
            const yearMatch = title.match(/(\d{4})-(\d{4})/);
            const semesterMatch = title.match(/(春季|秋季|夏季)（(第一|第二|第三)）学期/);

            const year = yearMatch ? `${yearMatch[1]}-${yearMatch[2]}` : '';
            const semester = semesterMatch ? `${semesterMatch[1]}${semesterMatch[2]}学期` : '';

            this.log(`提取到学年: ${year}, 学期: ${semester}`);

            // 提取HTML内容
            const htmlContent = this.extractHtmlContent(jsonpContent);

            // 从HTML中查找更多学期信息（如果需要）
            // 这里可以根据实际校历HTML结构添加更多提取逻辑

            const result = {
                year,
                semester,
                title
            };

            this.log('学期信息提取完成:', result);
            return result;
        } catch (error) {
            this.error('提取学期信息失败:', error);
            return { year: '', semester: '', title };
        }
    }

    /**
     * 提取周次信息
     * @param {string} jsonpContent JSONP内容
     * @returns {Array} 周次信息
     */
    extractWeeks(jsonpContent) {
        try {
            this.log('开始提取周次信息');

            // 提取HTML内容
            const htmlContent = this.extractHtmlContent(jsonpContent);
            if (!htmlContent) {
                this.log('HTML内容为空，无法提取周次');
                return [];
            }

            // 使用正则表达式匹配周次
            const weeks = [];

            // 寻找包含"一"至"二十"等中文数字的行
            const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
                '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];

            this.log('查找周次标识');
            chineseNumbers.forEach((weekNum, idx) => {
                // 创建一个正则表达式来查找周次标识
                const regex = new RegExp(`<b><span[^>]*>${weekNum}<\\/span><\\/b>`, 'i');
                if (htmlContent.match(regex)) {
                    weeks.push({
                        id: idx + 1,
                        name: `第${weekNum}周`,
                        number: idx + 1
                    });
                    this.log(`找到第${weekNum}周`);
                }
            });

            this.log(`总共找到${weeks.length}个周次`);
            return weeks;
        } catch (error) {
            this.error('提取周次信息失败:', error);
            return [];
        }
    }

    /**
     * 提取重要日期
     * @param {string} jsonpContent JSONP内容
     * @returns {Array} 重要日期
     */
    extractImportantDates(jsonpContent) {
        try {
            this.log('开始提取重要日期');

            // 提取HTML内容
            const htmlContent = this.extractHtmlContent(jsonpContent);
            if (!htmlContent) {
                this.log('HTML内容为空，无法提取重要日期');
                return [];
            }

            const importantDates = [];

            // 查找红色标记的日期（节假日）
            this.log('查找红色标记的节假日');
            const holidayRegex = /<b><span[^>]*color:red[^>]*>(\d+)<\/span><\/b>[\s\S]*?<b><span[^>]*color:red[^>]*>([^<]+)<\/span><\/b>/gi;
            let holidayMatch;

            while ((holidayMatch = holidayRegex.exec(htmlContent)) !== null) {
                if (holidayMatch.length >= 3) {
                    // 从周围文本中提取月份
                    const monthSearch = htmlContent.substring(Math.max(0, holidayMatch.index - 200), holidayMatch.index);
                    const monthMatch = monthSearch.match(/<b><span[^>]*>(\d+)<\/span><\/b><b><span[^>]*>月<\/span><\/b>/i);

                    const month = monthMatch ? monthMatch[1] : '';
                    const day = holidayMatch[1];
                    const name = holidayMatch[2].trim();

                    if (month && day && name) {
                        importantDates.push({
                            name,
                            month,
                            day,
                            type: 'holiday'
                        });
                        this.log(`找到节假日: ${month}月${day}日 ${name}`);
                    }
                }
            }

            // 从注释部分提取重要日期信息
            this.log('从注释部分提取重要日期');
            const notesMatch = htmlContent.match(/<p[^>]*>注：([\s\S]*?)<\/p>/i);
            if (notesMatch && notesMatch[1]) {
                const notesText = notesMatch[1];
                this.log('找到注释部分:', notesText);

                // 提取报到日期
                const reportRegex = /(\d+)月(\d+)日[^，。]*报到/g;
                let reportMatch;
                while ((reportMatch = reportRegex.exec(notesText)) !== null) {
                    if (reportMatch.length >= 3) {
                        importantDates.push({
                            name: '报到',
                            month: reportMatch[1],
                            day: reportMatch[2],
                            type: 'event'
                        });
                        this.log(`找到报到日期: ${reportMatch[1]}月${reportMatch[2]}日`);
                    }
                }

                // 提取上课日期
                const classRegex = /(\d+)月(\d+)日[^，。]*上课/g;
                let classMatch;
                while ((classMatch = classRegex.exec(notesText)) !== null) {
                    if (classMatch.length >= 3) {
                        importantDates.push({
                            name: '上课',
                            month: classMatch[1],
                            day: classMatch[2],
                            type: 'event'
                        });
                        this.log(`找到上课日期: ${classMatch[1]}月${classMatch[2]}日`);
                    }
                }

                // 提取考试周信息
                const examRegex = /(\d+)[—-](\d+)周为(?:集中)?考试周/g;
                let examMatch;
                while ((examMatch = examRegex.exec(notesText)) !== null) {
                    if (examMatch.length >= 3) {
                        importantDates.push({
                            name: '考试周',
                            startWeek: examMatch[1],
                            endWeek: examMatch[2],
                            type: 'exam'
                        });
                        this.log(`找到考试周: 第${examMatch[1]}-${examMatch[2]}周`);
                    }
                }
            } else {
                this.log('未找到注释部分');
            }

            this.log(`总共找到${importantDates.length}个重要日期`);
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