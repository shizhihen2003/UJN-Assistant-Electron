// src/services/classroomService.js
import ipc from '../utils/ipc';
import authService from './authService';

/**
 * 空教室查询服务
 * 提供与教务系统通信的API接口
 */
class ClassroomService {
    constructor() {
        // 基础URL - 初始为空，会在查询时动态获取
        this.baseUrl = '';
    }

    /**
     * 获取当前教务系统URL
     * @returns {Promise<string>} 教务系统基础URL
     * @private
     */
    async _getBaseUrl() {
        try {
            // 如果已有缓存的baseUrl，直接返回
            if (this.baseUrl) {
                return this.baseUrl;
            }

            // 从EASAccount获取当前使用的host
            if (authService.easAccount) {
                const host = authService.easAccount.host;
                if (host) {
                    const scheme = authService.easAccount.scheme || 'http';
                    this.baseUrl = `${scheme}://${host}/jwglxt`;
                    console.log(`使用当前登录的教务地址: ${this.baseUrl}`);
                    return this.baseUrl;
                }
            }

            // 如果无法获取，使用默认值
            console.warn('无法获取当前教务系统地址，使用默认值');
            this.baseUrl = 'http://jwgl.ujn.edu.cn/jwglxt';
            return this.baseUrl;
        } catch (error) {
            console.error('获取教务系统地址失败:', error);
            // 出错时使用默认值
            this.baseUrl = 'http://jwgl.ujn.edu.cn/jwglxt';
            return this.baseUrl;
        }
    }

    /**
     * 查询空闲教室
     * @param {Object} params 查询参数
     * @returns {Promise<Object>} 查询结果
     */
    async queryEmptyClassrooms(params) {
        try {
            console.log('开始查询空闲教室，参数:', params);

            // 首先检查登录状态
            if (!authService.easLoginStatus.value) {
                try {
                    const isLoggedIn = await authService.checkEasLogin();
                    if (!isLoggedIn) {
                        console.warn('教务系统未登录，无法查询空闲教室');
                        return {
                            success: false,
                            error: '用户未登录或会话已过期，请重新登录',
                            needLogin: true
                        };
                    }
                } catch (error) {
                    console.error('检查登录状态失败:', error);
                    return {
                        success: false,
                        error: '验证登录状态失败，请重新登录',
                        needLogin: true
                    };
                }
            }

            // 获取Cookie
            let cookies = [];
            if (authService.easAccount && authService.easAccount.cookieJar) {
                try {
                    cookies = await authService.easAccount.cookieJar.getCookies();
                } catch (error) {
                    console.error('从cookieJar获取Cookie失败:', error);
                    if (typeof authService.easAccount.getCookie === 'function') {
                        const cookieResult = authService.easAccount.getCookie();
                        if (Array.isArray(cookieResult) && cookieResult.length > 0) {
                            cookies = cookieResult;
                        }
                    }
                }
            }

            if (!cookies || cookies.length === 0) {
                console.error('没有可用的Cookie，可能需要重新登录');
                return {
                    success: false,
                    error: '登录会话已失效，请重新登录教务系统',
                    needLogin: true
                };
            }

            // 获取当前教务系统URL
            const baseUrl = await this._getBaseUrl();

            // 构造请求URL
            const requestUrl = `${baseUrl}/cdjy/cdjy_cxKxcdlb.html?doType=query&gnmkdm=N2155`;

            console.log('请求URL:', requestUrl);
            console.log('请求参数:', params);
            console.log('Cookie数量:', cookies.length);

            // 发送请求到教务系统
            const response = await ipc.easPost(requestUrl, params, {
                cookies: cookies,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': `${baseUrl}/xtgl/index_initMenu.html`
                }
            });

            console.log('响应状态:', response.status);
            console.log('响应成功:', response.success);

            // 处理响应
            if (response.success) {
                // 先检查返回内容是否包含常见的HTML标签
                const isHtml = typeof response.data === 'string' &&
                    (response.data.includes('<!DOCTYPE') ||
                        response.data.includes('<html') ||
                        response.data.includes('<body'));

                // 检查是否是登录页面
                const isLoginPage = isHtml &&
                    (response.data.includes('id="loginForm"') ||
                        response.data.includes('name="loginForm"') ||
                        response.data.includes('用户登录'));

                if (isLoginPage) {
                    console.error('服务器返回了登录页面，会话已过期');
                    return {
                        success: false,
                        error: '会话已过期，请重新登录教务系统',
                        needLogin: true
                    };
                }

                if (isHtml) {
                    console.error('服务器返回了HTML而不是JSON', response.data.substring(0, 200));
                    return {
                        success: false,
                        error: '服务器返回了无效数据格式，请重新登录后再试',
                        needLogin: true
                    };
                }

                try {
                    // 尝试解析JSON响应
                    const data = JSON.parse(response.data);
                    return {
                        success: true,
                        items: data.items || [],
                        totalCount: data.totalCount || 0,
                        pageNum: data.pageNum || 1,
                        pageSize: data.pageSize || 15
                    };
                } catch (parseError) {
                    console.error('解析响应数据失败:', parseError);
                    console.error('原始响应内容(前200字符):', typeof response.data === 'string' ? response.data.substring(0, 200) : response.data);

                    return {
                        success: false,
                        error: '解析响应数据失败，响应格式无效',
                        rawData: response.data ? response.data.substring(0, 200) : null
                    };
                }
            } else {
                console.error('请求失败:', response.error);

                if (response.status === 401 || response.status === 403) {
                    return {
                        success: false,
                        error: '权限不足或未登录，请重新登录教务系统',
                        needLogin: true,
                        status: response.status
                    };
                }

                return {
                    success: false,
                    error: response.error || '请求失败',
                    status: response.status
                };
            }
        } catch (error) {
            console.error('查询空闲教室时发生错误:', error);
            return {
                success: false,
                error: error.message || '未知错误'
            };
        }
    }

    /**
     * 获取HTML页面数据
     * @returns {Promise<string>} HTML内容
     * @private
     */
    async _getPageHtml() {
        try {
            // 检查登录状态
            if (!authService.easLoginStatus.value) {
                try {
                    const isLoggedIn = await authService.checkEasLogin();
                    if (!isLoggedIn) {
                        console.warn('教务系统未登录，无法获取页面HTML');
                        throw new Error('用户未登录或会话已过期');
                    }
                } catch (error) {
                    console.error('检查登录状态失败:', error);
                    throw error;
                }
            }

            // 获取Cookie
            let cookies = [];
            if (authService.easAccount && authService.easAccount.cookieJar) {
                try {
                    cookies = await authService.easAccount.cookieJar.getCookies();
                } catch (error) {
                    console.error('从cookieJar获取Cookie失败:', error);
                    if (typeof authService.easAccount.getCookie === 'function') {
                        const cookieResult = authService.easAccount.getCookie();
                        if (Array.isArray(cookieResult) && cookieResult.length > 0) {
                            cookies = cookieResult;
                        }
                    }
                }
            }

            if (!cookies || cookies.length === 0) {
                console.error('没有可用的Cookie，可能需要重新登录');
                throw new Error('登录会话已失效，请重新登录教务系统');
            }

            // 获取当前教务系统URL
            const baseUrl = await this._getBaseUrl();

            // 构造请求URL
            const requestUrl = `${baseUrl}/cdjy/cdjy_cxKxcdlb.html?gnmkdm=N2155`;

            // 发送请求获取HTML页面
            const response = await ipc.easGet(requestUrl, {
                cookies: cookies,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (response.success) {
                return response.data;
            } else {
                console.error('获取HTML页面失败:', response.error);
                throw new Error(response.error || '获取HTML页面失败');
            }
        } catch (error) {
            console.error('获取HTML页面数据失败:', error);
            throw error;
        }
    }

    /**
     * 从HTML中提取下拉选项
     * @param {string} html HTML内容
     * @param {string} selectId 下拉框ID
     * @returns {Array} 下拉选项数组
     * @private
     */
    _extractSelectOptions(html, selectId) {
        try {
            // 创建一个临时元素来解析HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // 查找下拉选择框
            const selectElement = doc.getElementById(selectId) || doc.querySelector(`select[name="${selectId}"]`);

            if (!selectElement) {
                console.warn(`未找到ID为 ${selectId} 的下拉框`);
                return [];
            }

            // 提取选项
            const options = [];
            const optionElements = selectElement.querySelectorAll('option');

            for (const option of optionElements) {
                const value = option.getAttribute('value');
                const label = option.textContent.trim();
                const selected = option.hasAttribute('selected');

                if (value !== null && label) {
                    options.push({
                        value: value,
                        label: label,
                        selected: selected
                    });
                }
            }

            return options;
        } catch (error) {
            console.error('从HTML中提取下拉选项失败:', error);
            return [];
        }
    }

    /**
     * 获取学年学期列表
     * @returns {Promise<Object>} 学年学期列表
     */
    async getTermOptions() {
        try {
            // 尝试获取HTML页面
            const html = await this._getPageHtml();

            // 从HTML中提取学年学期选项
            const options = this._extractSelectOptions(html, 'dm_cx');

            if (options.length > 0) {
                console.log(`成功从HTML中提取 ${options.length} 个学年学期选项`);
                return {
                    success: true,
                    data: options.map(opt => ({
                        value: opt.value,
                        label: opt.label
                    }))
                };
            } else {
                console.warn('未从HTML中找到学年学期选项，使用默认值');
                return {
                    success: true,
                    data: this._getDefaultTermOptions()
                };
            }
        } catch (error) {
            console.error('获取学年学期列表失败:', error);
            // 出错时返回默认值
            return {
                success: true,
                data: this._getDefaultTermOptions()
            };
        }
    }

    /**
     * 获取校区列表
     * @returns {Promise<Object>} 校区列表
     */
    async getCampusOptions() {
        try {
            // 尝试获取HTML页面
            const html = await this._getPageHtml();

            // 从HTML中提取校区选项
            const options = this._extractSelectOptions(html, 'xqh_id');

            if (options.length > 0) {
                console.log(`成功从HTML中提取 ${options.length} 个校区选项`);
                return {
                    success: true,
                    data: options.map(opt => ({
                        value: opt.value,
                        label: opt.label
                    }))
                };
            } else {
                // 如果未找到选项，返回默认值
                console.warn('未从HTML中找到校区选项，使用默认值');
                return {
                    success: true,
                    data: [
                        { value: '1', label: '主校区' },
                        { value: '3', label: '明水校区' },
                        { value: '2', label: '舜耕校区' }
                    ]
                };
            }
        } catch (error) {
            console.error('获取校区列表失败:', error);
            // 出错时返回默认值
            return {
                success: true,
                data: [
                    { value: '1', label: '主校区' },
                    { value: '3', label: '明水校区' },
                    { value: '2', label: '舜耕校区' }
                ]
            };
        }
    }

    /**
     * 获取教学楼列表
     * @param {string} campusId 校区ID
     * @returns {Promise<Object>} 教学楼列表
     */
    async getBuildingOptions(campusId) {
        try {
            // 检查登录状态
            if (!authService.easLoginStatus.value) {
                try {
                    const isLoggedIn = await authService.checkEasLogin();
                    if (!isLoggedIn) {
                        console.warn('教务系统未登录，无法获取教学楼数据');
                        return {
                            success: false,
                            error: '用户未登录或会话已过期，请重新登录',
                            needLogin: true,
                            data: []
                        };
                    }
                } catch (error) {
                    console.error('检查登录状态失败:', error);
                    return {
                        success: false,
                        error: '验证登录状态失败，请重新登录',
                        needLogin: true,
                        data: []
                    };
                }
            }

            // 获取Cookie
            let cookies = [];
            if (authService.easAccount && authService.easAccount.cookieJar) {
                try {
                    cookies = await authService.easAccount.cookieJar.getCookies();
                } catch (error) {
                    console.error('从cookieJar获取Cookie失败:', error);
                    if (typeof authService.easAccount.getCookie === 'function') {
                        const cookieResult = authService.easAccount.getCookie();
                        if (Array.isArray(cookieResult) && cookieResult.length > 0) {
                            cookies = cookieResult;
                        }
                    }
                }
            }

            if (!cookies || cookies.length === 0) {
                console.error('没有可用的Cookie，可能需要重新登录');
                return {
                    success: false,
                    error: '登录会话已失效，请重新登录教务系统',
                    needLogin: true,
                    data: []
                };
            }

            // 获取当前教务系统URL
            const baseUrl = await this._getBaseUrl();

            // 构造请求URL - 修正为正确的接口
            const requestUrl = `${baseUrl}/cdjy/cdjy_cxXqjc.html?gnmkdm=N2155`;

            // 构造请求参数
            const params = {
                xqh_id: campusId
            };

            console.log(`请求校区 ${campusId} 的教学楼数据, URL:`, requestUrl);

            // 发送请求获取教学楼数据
            const response = await ipc.easPost(requestUrl, params, {
                cookies: cookies,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': `${baseUrl}/cdjy/cdjy_cxKxcdlb.html?gnmkdm=N2155`
                }
            });

            if (response.success) {
                try {
                    // 尝试解析JSON响应
                    const data = JSON.parse(response.data);

                    // 检查数据格式 - 修正为正确的字段名
                    if (data && data.lhList && Array.isArray(data.lhList)) {
                        // 将数据转换为所需格式 - 使用正确的字段名
                        const options = data.lhList.map(item => ({
                            value: item.JXLDM,
                            label: item.JXLMC
                        }));

                        // 添加"全部"选项
                        options.unshift({ value: '', label: '全部' });

                        console.log(`成功获取 ${options.length-1} 个教学楼数据`);
                        return {
                            success: true,
                            data: options
                        };
                    } else {
                        console.warn('教学楼数据格式不符合预期:', data);
                        return {
                            success: true,
                            data: this._getDefaultBuildingOptions(campusId)
                        };
                    }
                } catch (parseError) {
                    console.error('解析教学楼数据失败:', parseError);
                    console.error('原始响应内容(前200字符):', typeof response.data === 'string' ? response.data.substring(0, 200) : response.data);

                    // 尝试从HTML页面中提取作为后备方案
                    return {
                        success: true,
                        data: await this._extractBuildingsFromHtml(campusId)
                    };
                }
            } else {
                console.error('获取教学楼数据请求失败:', response.error);

                // 如果请求失败，尝试从HTML中提取
                return {
                    success: true,
                    data: await this._extractBuildingsFromHtml(campusId)
                };
            }
        } catch (error) {
            console.error('获取教学楼列表失败:', error);

            // 出错时返回默认值
            return {
                success: true,
                data: this._getDefaultBuildingOptions(campusId)
            };
        }
    }

    /**
     * 从HTML页面中提取教学楼列表作为后备方案
     * @param {string} campusId 校区ID
     * @returns {Promise<Array>} 教学楼列表
     * @private
     */
    async _extractBuildingsFromHtml(campusId) {
        try {
            // 获取HTML页面
            const html = await this._getPageHtml();

            // 从HTML中提取教学楼选项
            const allOptions = this._extractSelectOptions(html, 'lh');

            if (allOptions.length > 0) {
                console.log(`从HTML中提取到 ${allOptions.length} 个教学楼选项`);
                return allOptions.map(opt => ({
                    value: opt.value,
                    label: opt.label
                }));
            } else {
                console.warn('未从HTML中找到教学楼选项，使用默认值');
                return this._getDefaultBuildingOptions(campusId);
            }
        } catch (error) {
            console.error('从HTML提取教学楼失败:', error);
            return this._getDefaultBuildingOptions(campusId);
        }
    }

    /**
     * 获取场地类别列表
     * @returns {Promise<Object>} 场地类别列表
     */
    async getRoomTypeOptions() {
        try {
            // 检查登录状态
            if (!authService.easLoginStatus.value) {
                try {
                    const isLoggedIn = await authService.checkEasLogin();
                    if (!isLoggedIn) {
                        console.warn('教务系统未登录，无法获取场地类别数据');
                        return {
                            success: false,
                            error: '用户未登录或会话已过期，请重新登录',
                            needLogin: true,
                            data: []
                        };
                    }
                } catch (error) {
                    console.error('检查登录状态失败:', error);
                    return {
                        success: false,
                        error: '验证登录状态失败，请重新登录',
                        needLogin: true,
                        data: []
                    };
                }
            }

            // 获取Cookie
            let cookies = [];
            if (authService.easAccount && authService.easAccount.cookieJar) {
                try {
                    cookies = await authService.easAccount.cookieJar.getCookies();
                } catch (error) {
                    console.error('从cookieJar获取Cookie失败:', error);
                    if (typeof authService.easAccount.getCookie === 'function') {
                        const cookieResult = authService.easAccount.getCookie();
                        if (Array.isArray(cookieResult) && cookieResult.length > 0) {
                            cookies = cookieResult;
                        }
                    }
                }
            }

            if (!cookies || cookies.length === 0) {
                console.error('没有可用的Cookie，可能需要重新登录');
                return {
                    success: false,
                    error: '登录会话已失效，请重新登录教务系统',
                    needLogin: true,
                    data: []
                };
            }

            // 尝试从HTML中获取场地类别数据
            const html = await this._getPageHtml();

            // 从HTML中提取场地类别选项
            const options = this._extractSelectOptions(html, 'cdlb_id');

            if (options.length > 0) {
                console.log(`成功从HTML中提取 ${options.length} 个场地类别选项`);
                return {
                    success: true,
                    data: options.map(opt => ({
                        value: opt.value,
                        label: opt.label
                    }))
                };
            } else {
                // 如果未找到选项，返回默认值
                console.warn('未从HTML中找到场地类别选项，使用默认值');
                return {
                    success: true,
                    data: this._getDefaultRoomTypeOptions()
                };
            }
        } catch (error) {
            console.error('获取场地类别列表失败:', error);
            // 出错时返回默认值
            return {
                success: true,
                data: this._getDefaultRoomTypeOptions()
            };
        }
    }

    /**
     * 获取默认学年学期列表
     * @private
     * @returns {Array} 默认学年学期列表
     */
    _getDefaultTermOptions() {
        // 获取当前日期
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        // 计算当前可能的学年学期
        let recentYears = [];

        // 确定学年范围 (往前3年，往后1年)
        const startYear = currentYear - 3;
        const endYear = currentYear + 1;

        for (let year = startYear; year <= endYear; year++) {
            // 添加第一学期 (3表示第一学期)
            recentYears.push({
                value: `${year}-3`,
                label: `${year}-${year+1}-1`
            });

            // 添加第二学期 (12表示第二学期)
            recentYears.push({
                value: `${year}-12`,
                label: `${year}-${year+1}-2`
            });
        }

        // 按年份降序排序
        recentYears.sort((a, b) => {
            const yearA = parseInt(a.value.split('-')[0]);
            const termA = parseInt(a.value.split('-')[1]);
            const yearB = parseInt(b.value.split('-')[0]);
            const termB = parseInt(b.value.split('-')[1]);

            // 优先比较年份
            if (yearA !== yearB) {
                return yearB - yearA; // 降序排列
            }

            // 相同年份，按学期降序排列
            return termB - termA;
        });

        return recentYears;
    }

    /**
     * 获取默认教学楼列表
     * @param {string} campusId 校区ID
     * @private
     * @returns {Array} 默认教学楼列表
     */
    _getDefaultBuildingOptions(campusId) {
        // 根据校区ID获取对应的教学楼列表
        switch(campusId) {
            case '1': // 主校区
                return [
                    { value: '', label: '全部' },
                    { value: '0004', label: '第一教学楼' },
                    { value: '0002', label: '第四教学楼' },
                    { value: '0003', label: '第三教学楼' },
                    { value: '0007', label: '第二教学楼' },
                    { value: '0016', label: '第五教学楼' },
                    { value: '0006', label: '第十教学楼' },
                    { value: '0011', label: '第八教学楼' }
                ];
            case '2': // 舜耕校区
                return [
                    { value: '', label: '全部' },
                    { value: '0010', label: '第七教学楼' },
                    { value: '0023', label: '第九教学楼' }
                ];
            case '3': // 明水校区
                return [
                    { value: '', label: '全部' },
                    { value: '0008', label: '第十一教学楼' }
                ];
            default:
                return [
                    { value: '', label: '全部' },
                    { value: '0004', label: '第一教学楼' },
                    { value: '0002', label: '第四教学楼' },
                    { value: '0003', label: '第三教学楼' },
                    { value: '0007', label: '第二教学楼' },
                    { value: '0016', label: '第五教学楼' },
                    { value: '0006', label: '第十教学楼' },
                    { value: '0011', label: '第八教学楼' },
                    { value: '0008', label: '第十一教学楼' },
                    { value: '0010', label: '第七教学楼' },
                    { value: '0023', label: '第九教学楼' }
                ];
        }
    }

    /**
     * 获取默认场地类别列表
     * @private
     * @returns {Array} 默认场地类别列表
     */
    _getDefaultRoomTypeOptions() {
        return [
            { value: '', label: '全部' },
            { value: '008', label: '多媒体教室' },
            { value: '003', label: '普通教室' },
            { value: '011', label: '机房' },
            { value: '014', label: '实验室' },
            { value: 'CED9C1E9C6AF41DEE0530AFDA8C0A999', label: '智慧教室' }
        ];
    }
}

// 创建单例实例
const classroomService = new ClassroomService();

export default classroomService;