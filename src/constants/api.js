// src/constants/api.js

/**
 * API常量配置
 * 动态读取当前选中学校的配置，实现多学校支持
 * 
 * 重要：直接从localStorage读取学校配置，不依赖schoolService初始化
 * 这样可以确保在authService初始化时就能获取正确的学校配置
 */

// 存储键名前缀
const STORAGE_PREFIX = 'ujn_assistant_';
const STORAGE_KEYS = {
    CURRENT_SCHOOL: 'current_school_id',
    CUSTOM_SCHOOLS: 'custom_schools',
};

/**
 * 预置学校配置（与schoolConfig.js保持同步）
 */
const PresetSchools = {
    ujn: {
        id: 'ujn',
        name: '济南大学',
        shortName: '济大',
        vpn: {
            enabled: true,
            host: 'webvpn.ujn.edu.cn',
            loginUrl: 'https://webvpn.ujn.edu.cn/',
            encryptKey: 'wrdvpnisthebest!',
        },
        sso: {
            type: 'tpass',
            host: 'sso.ujn.edu.cn',
            loginUrl: 'http://sso.ujn.edu.cn/tpass/login/',
            portalUrl: 'http://one.ujn.edu.cn/',
        },
        eas: {
            type: 'zhengfang_new',
            hosts: [
                'jwgl.ujn.edu.cn',
                'jwgl2.ujn.edu.cn',
                'jwgl3.ujn.edu.cn',
                'jwgl4.ujn.edu.cn',
                'jwgl5.ujn.edu.cn',
                'jwgl6.ujn.edu.cn',
                'jwgl7.ujn.edu.cn',
                'jwgl8.ujn.edu.cn',
                'jwgl9.ujn.edu.cn'
            ],
            apis: {
                login: 'jwglxt/xtgl/login_slogin.html',
                publicKey: 'jwglxt/xtgl/login_getPublicKey.html',
                systemNotice: 'jwglxt/xtgl/index_cxDbsy.html?doType=query',
                yearData: 'jwglxt/xtgl/index_cxAreaFive.html?localeKey=zh_CN&gnmkdm=index',
                lessonTable: 'jwglxt/kbcx/xskbcx_cxXsgrkb.html',
                classLessonTable: 'jwglxt/kbdy/bjkbdy_cxBjKb.html',
                lessonTablePrint: 'jwglxt/kbdy/bjkbdy_cxBjkbdyIndex.html?gnmkdm=0&layout=default',
                marks: 'jwglxt/cjcx/cjcx_cxDgXscj.html?doType=query',
                markDetail: 'jwglxt/cjcx/cjcx_cxXsKccjList.html',
                exam: 'jwglxt/kwgl/kscx_cxXsksxxIndex.html?doType=query',
                academicPage: 'jwglxt/xsxy/xsxyqk_cxXsxyqkIndex.html?gnmkdm=N105515&layout=default',
                academicInfo: 'jwglxt/xsxy/xsxyqk_cxJxzxjhxfyqFKcxx.html',
                emptyRoom: 'jwglxt/cdjy/cdjy_cxKxcdlb.html?doType=query',
                studentInfo: 'jwglxt/xsxxxggl/xsxxwh_cxCkDgxsxx.html?gnmkdm=N100801',
            }
        },
        campuses: [
            { value: '1', label: '主校区' },
            { value: '3', label: '明水校区' },
            { value: '2', label: '舜耕校区' }
        ],
        features: {
            calendar: true,
            emptyRoom: true,
            librarySearch: false,
            cardBalance: false,
        },
    },
    sdu: {
        id: 'sdu',
        name: '山东大学',
        shortName: '山大',
        vpn: {
            enabled: true,
            host: 'webvpn.sdu.edu.cn',
            loginUrl: 'https://webvpn.sdu.edu.cn/',
            encryptKey: 'wrdvpnisthebest!',
        },
        sso: {
            type: 'cas',
            host: 'pass.sdu.edu.cn',
            loginUrl: 'https://pass.sdu.edu.cn/cas/login',
            portalUrl: 'https://www.sdu.edu.cn/',
        },
        eas: {
            type: 'zhengfang_new',
            hosts: ['jwxt.sdu.edu.cn'],
            apis: {
                login: 'jwglxt/xtgl/login_slogin.html',
                publicKey: 'jwglxt/xtgl/login_getPublicKey.html',
                systemNotice: 'jwglxt/xtgl/index_cxDbsy.html?doType=query',
                yearData: 'jwglxt/xtgl/index_cxAreaFive.html?localeKey=zh_CN&gnmkdm=index',
                lessonTable: 'jwglxt/kbcx/xskbcx_cxXsgrkb.html',
                classLessonTable: 'jwglxt/kbdy/bjkbdy_cxBjKb.html',
                lessonTablePrint: 'jwglxt/kbdy/bjkbdy_cxBjkbdyIndex.html?gnmkdm=0&layout=default',
                marks: 'jwglxt/cjcx/cjcx_cxDgXscj.html?doType=query',
                markDetail: 'jwglxt/cjcx/cjcx_cxXsKccjList.html',
                exam: 'jwglxt/kwgl/kscx_cxXsksxxIndex.html?doType=query',
                academicPage: 'jwglxt/xsxy/xsxyqk_cxXsxyqkIndex.html?gnmkdm=N105515&layout=default',
                academicInfo: 'jwglxt/xsxy/xsxyqk_cxJxzxjhxfyqFKcxx.html',
                emptyRoom: 'jwglxt/cdjy/cdjy_cxKxcdlb.html?doType=query',
                studentInfo: 'jwglxt/xsxxxggl/xsxxwh_cxCkDgxsxx.html?gnmkdm=N100801',
            }
        },
        campuses: [
            { value: '1', label: '中心校区' },
            { value: '2', label: '洪家楼校区' },
            { value: '3', label: '趵突泉校区' },
            { value: '4', label: '千佛山校区' },
            { value: '5', label: '软件园校区' },
            { value: '6', label: '兴隆山校区' },
            { value: '7', label: '威海校区' },
            { value: '8', label: '青岛校区' }
        ],
        features: {
            calendar: true,
            emptyRoom: true,
            librarySearch: false,
            cardBalance: false,
        },
    },
    
    // 荆楚理工学院 - Jingchu University of Technology
    // 教务系统：正方软件 V-9.0 (HTTPS)
    // 统一认证：rump_frontend 系统
    // 地址：湖北荆门市象山大道33号
    // 注意：荆楚理工学院的API路径不包含jwglxt前缀
    jcut: {
        id: 'jcut',
        name: '荆楚理工学院',
        shortName: '荆楚理工',
        vpn: {
            enabled: true,
            host: 'sec.jcut.edu.cn',
            loginUrl: 'https://sec.jcut.edu.cn/rump_frontend/login/',
            // 注：rump系统可能使用不同的加密方式，需要实际测试确认
            encryptKey: null,
        },
        sso: {
            type: 'rump',  // rump_frontend 系统
            host: 'sec.jcut.edu.cn',
            loginUrl: 'https://sec.jcut.edu.cn/rump_frontend/login/',
            portalUrl: 'https://www.jcut.edu.cn/',
        },
        eas: {
            type: 'zhengfang_new',
            // 荆楚理工使用HTTPS，单节点
            hosts: ['jwglxt.jcut.edu.cn'],
            useHttps: true,  // 标记使用HTTPS
            // 注意：荆楚理工学院的API路径不包含jwglxt前缀！
            apis: {
                login: 'xtgl/login_slogin.html',
                logout: 'xtgl/login_logoutAccount.html',  // 新增：登录前需要先调用登出接口
                publicKey: 'xtgl/login_getPublicKey.html',
                systemNotice: 'xtgl/index_cxDbsy.html?doType=query',
                yearData: 'xtgl/index_cxAreaFive.html?localeKey=zh_CN&gnmkdm=index',
                lessonTable: 'kbcx/xskbcx_cxXsgrkb.html',
                classLessonTable: 'kbdy/bjkbdy_cxBjKb.html',
                lessonTablePrint: 'kbdy/bjkbdy_cxBjkbdyIndex.html?gnmkdm=0&layout=default',
                marks: 'cjcx/cjcx_cxDgXscj.html?doType=query',
                markDetail: 'cjcx/cjcx_cxXsKccjList.html',
                exam: 'kwgl/kscx_cxXsksxxIndex.html?doType=query',
                academicPage: 'xsxy/xsxyqk_cxXsxyqkIndex.html?gnmkdm=N105515&layout=default',
                academicInfo: 'xsxy/xsxyqk_cxJxzxjhxfyqFKcxx.html',
                emptyRoom: 'cdjy/cdjy_cxKxcdlb.html?doType=query',
                // 额外的空教室相关API
                emptyRoomPage: 'cdjy/cdjy_cxKxcdlb.html?gnmkdm=N2155',
                buildingList: 'cdjy/cdjy_cxXqjc.html?gnmkdm=N2155',
                // 学生信息
                studentInfo: 'xsxxxggl/xsxxwh_cxCkDgxsxx.html?gnmkdm=N100801',
            },
            // 登录特性配置
            loginFeatures: {
                // 是否需要登录前先登出（某些系统需要）
                logoutBeforeLogin: true,
                // 密码是否明文传输（通过页面mmsfjm参数判断，0=明文，1=加密）
                // 这里设置为auto表示自动检测，也可以设为true强制明文
                plaintextPassword: 'auto',
                // 是否需要ydType参数
                requireYdType: true,
                // CSRF Token是否保留完整值（包含逗号分隔的多个值）
                keepFullCsrfToken: true,
            }
        },
        // 校区配置 - 根据抓包数据
        campuses: [
            { value: '00002', label: '荆楚理工学院(主校区)' },
            { value: '00005', label: '实习医院' }
        ],
        features: {
            calendar: true,
            emptyRoom: true,
            librarySearch: false,
            cardBalance: false,
        },
    }
};

/**
 * 从localStorage同步读取当前学校ID
 */
function getCurrentSchoolId() {
    try {
        const key = STORAGE_PREFIX + STORAGE_KEYS.CURRENT_SCHOOL;
        return localStorage.getItem(key) || 'ujn';
    } catch (e) {
        console.warn('读取当前学校ID失败，使用默认值', e);
        return 'ujn';
    }
}

/**
 * 从localStorage同步读取自定义学校配置
 */
function getCustomSchools() {
    try {
        const key = STORAGE_PREFIX + STORAGE_KEYS.CUSTOM_SCHOOLS;
        const data = localStorage.getItem(key);
        if (data) {
            return JSON.parse(data);
        }
    } catch (e) {
        console.warn('读取自定义学校配置失败', e);
    }
    return {};
}

/**
 * 获取当前学校配置
 * 优先从预置学校查找，然后从自定义学校查找
 */
function getCurrentSchoolConfig() {
    const schoolId = getCurrentSchoolId();
    
    // 先从预置学校查找
    if (PresetSchools[schoolId]) {
        return PresetSchools[schoolId];
    }
    
    // 再从自定义学校查找
    const customSchools = getCustomSchools();
    if (customSchools[schoolId]) {
        return customSchools[schoolId];
    }
    
    // 都没找到，返回默认（济南大学）
    console.warn(`未找到学校配置: ${schoolId}，使用默认配置`);
    return PresetSchools.ujn;
}

/**
 * 动态API配置代理
 * 每次访问属性时都重新读取配置，确保获取最新值
 */
class DynamicAPIConfig {
    /**
     * 获取当前配置
     */
    get _config() {
        return getCurrentSchoolConfig();
    }
    
    /**
     * 获取VPN主机地址
     */
    get VPN_HOST() {
        return this._config.vpn?.host || '';
    }
    
    /**
     * 获取VPN登录URL
     */
    get VPN_LOGIN() {
        return this._config.vpn?.loginUrl || '';
    }
    
    /**
     * 获取统一身份认证主机地址
     */
    get IPASS_HOST() {
        return this._config.sso?.host || '';
    }
    
    /**
     * 获取统一身份认证登录URL
     */
    get IPASS_LOGIN() {
        return this._config.sso?.loginUrl || '';
    }
    
    /**
     * 获取教务系统主机列表
     */
    get EA_HOSTS() {
        return this._config.eas?.hosts || [];
    }
    
    /**
     * 获取教务登录API
     */
    get EA_LOGIN() {
        return this._config.eas?.apis?.login || 'jwglxt/xtgl/login_slogin.html';
    }
    
    /**
     * 获取RSA公钥API
     */
    get EA_LOGIN_PUBLIC_KEY() {
        return this._config.eas?.apis?.publicKey || 'jwglxt/xtgl/login_getPublicKey.html';
    }
    
    /**
     * 获取系统通知API
     */
    get EA_SYSTEM_NOTICE() {
        return this._config.eas?.apis?.systemNotice || 'jwglxt/xtgl/index_cxDbsy.html?doType=query';
    }
    
    /**
     * 获取学年数据API
     */
    get EA_YEAR_DATA() {
        return this._config.eas?.apis?.yearData || 'jwglxt/xtgl/index_cxAreaFive.html?localeKey=zh_CN&gnmkdm=index';
    }
    
    /**
     * 获取学生课表API
     */
    get GET_LESSON_TABLE() {
        return this._config.eas?.apis?.lessonTable || 'jwglxt/kbcx/xskbcx_cxXsgrkb.html';
    }
    
    /**
     * 获取班级课表API
     */
    get GET_CLASS_LESSON_TABLE() {
        return this._config.eas?.apis?.classLessonTable || 'jwglxt/kbdy/bjkbdy_cxBjKb.html';
    }
    
    /**
     * 获取课表打印页面API
     */
    get RECOMMENDED_LESSON_TABLE_PRINTING() {
        return this._config.eas?.apis?.lessonTablePrint || 'jwglxt/kbdy/bjkbdy_cxBjkbdyIndex.html?gnmkdm=0&layout=default';
    }
    
    /**
     * 获取成绩查询API
     */
    get GET_MARK() {
        return this._config.eas?.apis?.marks || 'jwglxt/cjcx/cjcx_cxDgXscj.html?doType=query';
    }
    
    /**
     * 获取成绩明细API
     */
    get GET_MARK_DETAIL() {
        return this._config.eas?.apis?.markDetail || 'jwglxt/cjcx/cjcx_cxXsKccjList.html';
    }
    
    /**
     * 获取考试查询API
     */
    get GET_EXAM() {
        return this._config.eas?.apis?.exam || 'jwglxt/kwgl/kscx_cxXsksxxIndex.html?doType=query';
    }
    
    /**
     * 获取学业情况页面API
     */
    get ACADEMIC_PAGE() {
        return this._config.eas?.apis?.academicPage || 'jwglxt/xsxy/xsxyqk_cxXsxyqkIndex.html?gnmkdm=N105515&layout=default';
    }
    
    /**
     * 获取学业情况信息API
     */
    get ACADEMIC_INFO() {
        return this._config.eas?.apis?.academicInfo || 'jwglxt/xsxy/xsxyqk_cxJxzxjhxfyqFKcxx.html';
    }
    
    /**
     * 获取空教室查询API
     */
    get GET_EMPTY_ROOM() {
        return this._config.eas?.apis?.emptyRoom || 'jwglxt/cdjy/cdjy_cxKxcdlb.html?doType=query';
    }
    
    /**
     * 获取学生信息API
     */
    get STUDENT_INFO() {
        return this._config.eas?.apis?.studentInfo || 'jwglxt/xsxxxggl/xsxxwh_cxCkDgxsxx.html?gnmkdm=N100801';
    }
    
    // ==================== 扩展属性 ====================
    
    /**
     * 获取当前学校ID
     */
    get SCHOOL_ID() {
        return this._config.id || 'ujn';
    }
    
    /**
     * 获取当前学校名称
     */
    get SCHOOL_NAME() {
        return this._config.name || '济南大学';
    }
    
    /**
     * 获取当前学校简称
     */
    get SCHOOL_SHORT_NAME() {
        return this._config.shortName || '济大';
    }
    
    /**
     * 获取校区列表
     */
    get CAMPUSES() {
        return this._config.campuses || [];
    }
    
    /**
     * 获取功能特性开关
     */
    get FEATURES() {
        return this._config.features || {};
    }
    
    /**
     * 获取VPN加密密钥
     */
    get VPN_ENCRYPT_KEY() {
        return this._config.vpn?.encryptKey || 'wrdvpnisthebest!';
    }
    
    /**
     * 检查VPN是否启用
     */
    get VPN_ENABLED() {
        return this._config.vpn?.enabled !== false;
    }
    
    /**
     * 获取门户URL
     */
    get PORTAL_URL() {
        return this._config.sso?.portalUrl || '';
    }
    
    /**
     * 检查教务系统是否使用HTTPS
     */
    get EA_USE_HTTPS() {
        return this._config.eas?.useHttps === true;
    }
    
    /**
     * 获取登出API（某些系统登录前需要先登出）
     */
    get EA_LOGOUT() {
        return this._config.eas?.apis?.logout || null;
    }
    
    /**
     * 获取登录特性配置
     */
    get LOGIN_FEATURES() {
        return this._config.eas?.loginFeatures || {};
    }
    
    /**
     * 检查是否需要登录前先登出
     */
    get LOGOUT_BEFORE_LOGIN() {
        return this._config.eas?.loginFeatures?.logoutBeforeLogin === true;
    }
    
    /**
     * 检查密码是否明文传输
     * 返回值：true=强制明文, false=强制加密, 'auto'=自动检测
     */
    get PLAINTEXT_PASSWORD() {
        const value = this._config.eas?.loginFeatures?.plaintextPassword;
        if (value === true || value === false) {
            return value;
        }
        return 'auto';  // 默认自动检测
    }
    
    /**
     * 检查是否需要ydType参数
     */
    get REQUIRE_YD_TYPE() {
        return this._config.eas?.loginFeatures?.requireYdType === true;
    }
    
    /**
     * 检查是否保留完整CSRF Token
     */
    get KEEP_FULL_CSRF_TOKEN() {
        return this._config.eas?.loginFeatures?.keepFullCsrfToken === true;
    }
    
    /**
     * 获取SSO类型
     */
    get SSO_TYPE() {
        return this._config.sso?.type || 'cas';
    }
    
    // ==================== 工具方法 ====================
    
    /**
     * 获取完整的教务系统URL
     * @param {number} hostIndex 主机索引
     * @param {string} apiPath API路径
     * @param {boolean} useHttps 是否使用HTTPS（如果未指定则读取学校配置）
     * @returns {string}
     */
    getEasUrl(hostIndex = 0, apiPath = '', useHttps = null) {
        const hosts = this.EA_HOSTS;
        if (!hosts || hosts.length === 0) {
            console.error('教务系统主机列表为空');
            return '';
        }
        
        const index = Math.min(hostIndex, hosts.length - 1);
        const host = hosts[index];
        
        // 如果未指定useHttps，则读取学校配置
        const shouldUseHttps = useHttps !== null ? useHttps : (this._config.eas?.useHttps === true);
        const scheme = shouldUseHttps ? 'https' : 'http';
        
        return `${scheme}://${host}/${apiPath}`;
    }
    
    /**
     * 获取完整的VPN URL
     * @param {string} path 路径
     * @returns {string}
     */
    getVpnUrl(path = '') {
        const host = this.VPN_HOST;
        if (!host) return '';
        return `https://${host}/${path}`;
    }
    
    /**
     * 获取完整的SSO URL
     * @param {string} path 路径
     * @param {boolean} useHttps 是否使用HTTPS
     * @returns {string}
     */
    getSsoUrl(path = '', useHttps = false) {
        const host = this.IPASS_HOST;
        if (!host) return '';
        const scheme = useHttps ? 'https' : 'http';
        return `${scheme}://${host}/${path}`;
    }
    
    /**
     * 刷新配置（切换学校后调用）
     * 由于使用getter动态读取，实际上不需要手动刷新
     * 保留此方法用于兼容
     */
    refresh() {
        console.log(`[API] 当前学校: ${this.SCHOOL_NAME} (${this.SCHOOL_ID})`);
    }
}

// 创建动态API配置实例
const API = new DynamicAPIConfig();

// ==================== 向后兼容导出 ====================

/**
 * UJNAPI 兼容导出
 * 保持与原有代码的兼容性
 */
export const UJNAPI = API;

/**
 * 默认导出动态API配置
 */
export default API;

/**
 * 导出预置学校配置（供schoolService使用）
 */
export { PresetSchools };
