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
            defaultPathPrefix: 'jwglxt/',
            hosts: [
                { host: 'jwgl.ujn.edu.cn', https: true },
                { host: 'jwgl2.ujn.edu.cn', https: false },
                { host: 'jwgl3.ujn.edu.cn', https: false },
                { host: 'jwgl4.ujn.edu.cn', https: false },
                { host: 'jwgl5.ujn.edu.cn', https: false },
                { host: 'jwgl6.ujn.edu.cn', https: false },
                { host: 'jwgl7.ujn.edu.cn', https: false },
                { host: 'jwgl8.ujn.edu.cn', https: false },
                { host: 'jwgl9.ujn.edu.cn', https: false }
            ],
            apis: {
                login: 'xtgl/login_slogin.html',
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
                emptyRoomPage: 'cdjy/cdjy_cxKxcdlb.html?gnmkdm=N2155',
                buildingList: 'cdjy/cdjy_cxXqjc.html?gnmkdm=N2155',
                studentInfo: 'xsxxxggl/xsxxwh_cxCkDgxsxx.html?gnmkdm=N100801',
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
            defaultPathPrefix: 'jwglxt/',
            hosts: ['bkjws.sdu.edu.cn'],
            useHttps: true,
            apis: {
                login: 'xtgl/login_slogin.html',
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
                emptyRoomPage: 'cdjy/cdjy_cxKxcdlb.html?gnmkdm=N2155',
                buildingList: 'cdjy/cdjy_cxXqjc.html?gnmkdm=N2155',
                studentInfo: 'xsxxxggl/xsxxwh_cxCkDgxsxx.html?gnmkdm=N100801',
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
    // 统一认证：lyuapServer CAS系统（需要验证码）
    // WebVPN：使用自定义加密算法
    // 地址：湖北荆门市象山大道33号
    jcut: {
        id: 'jcut',
        name: '荆楚理工学院',
        shortName: '荆楚理工',
        vpn: {
            enabled: true,
            type: 'jcut',  // 使用JCUT专用加密
            host: 'sec.jcut.edu.cn',
            basePath: '/webvpn',
            loginUrl: 'https://sec.jcut.edu.cn/webvpn/',
            // JCUT使用自定义加密算法，KEY为18位十六进制字符串
            encryptKey: 'a56b1e0c1f95cc40f0',
            encryptType: 'jcut_custom',
        },
        sso: {
            type: 'lyuap',  // lyuapServer CAS系统
            host: 'cas.jcut.edu.cn',
            loginUrl: 'https://cas.jcut.edu.cn/lyuapServer/login',
            portalUrl: 'https://my.jcut.edu.cn/',
            // CAS特性
            requireCaptcha: true,  // 需要验证码
            passwordEncrypt: 'rsa',  // 密码RSA加密
        },
        eas: {
            type: 'zhengfang_new',
            hosts: ['jwglxt.jcut.edu.cn'],
            useHttps: true,
            defaultPathPrefix: '',  // 荆楚理工没有路径前缀
            apis: {
                login: 'xtgl/login_slogin.html',
                logout: 'xtgl/login_logoutAccount.html',
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
                emptyRoomPage: 'cdjy/cdjy_cxKxcdlb.html?gnmkdm=N2155',
                buildingList: 'cdjy/cdjy_cxXqjc.html?gnmkdm=N2155',
                studentInfo: 'xsxxxggl/xsxxwh_cxCkDgxsxx.html?gnmkdm=N100801',
            },
            loginFeatures: {
                logoutBeforeLogin: true,
                plaintextPassword: 'auto',
                requireYdType: true,
                keepFullCsrfToken: true,
            }
        },
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

    // ==================== VPN配置 ====================

    get VPN_HOST() {
        return this._config.vpn?.host || '';
    }

    get VPN_LOGIN() {
        return this._config.vpn?.loginUrl || '';
    }

    get VPN_ENCRYPT_KEY() {
        return this._config.vpn?.encryptKey || 'wrdvpnisthebest!';
    }

    get VPN_ENABLED() {
        return this._config.vpn?.enabled !== false;
    }

    get VPN_TYPE() {
        return this._config.vpn?.type || 'standard';
    }

    get VPN_ENCRYPT_TYPE() {
        return this._config.vpn?.encryptType || 'des';
    }

    // ==================== SSO配置 ====================

    get IPASS_HOST() {
        return this._config.sso?.host || '';
    }

    get IPASS_LOGIN() {
        return this._config.sso?.loginUrl || '';
    }

    get SSO_TYPE() {
        return this._config.sso?.type || 'tpass';
    }

    get REQUIRE_CAPTCHA() {
        return this._config.sso?.requireCaptcha === true;
    }

    get PORTAL_URL() {
        return this._config.sso?.portalUrl || '';
    }

    // ==================== 教务系统配置 ====================

    get EA_HOSTS() {
        const hosts = this._config.eas?.hosts || [];
        return hosts.map(h => typeof h === 'string' ? h : h.host);
    }

    get EA_DEFAULT_HOST() {
        const hosts = this.EA_HOSTS;
        return hosts.length > 0 ? hosts[0] : '';
    }

    getHostHttps(hostIndex = 0) {
        const hosts = this._config.eas?.hosts || [];
        if (hosts.length === 0) return false;

        const index = Math.min(hostIndex, hosts.length - 1);
        const host = hosts[index];

        if (typeof host === 'object' && host !== null) {
            return host.https === true;
        }
        return this._config.eas?.useHttps === true;
    }

    get EA_USE_HTTPS() {
        const hosts = this._config.eas?.hosts || [];
        if (hosts.length > 0 && typeof hosts[0] === 'object') {
            return hosts[0].https === true;
        }
        return this._config.eas?.useHttps === true;
    }

    get DEFAULT_PATH_PREFIX() {
        const prefix = this._config.eas?.defaultPathPrefix;
        return prefix !== undefined ? prefix : null;
    }

    // ==================== 教务系统API ====================

    get EA_LOGIN() {
        return this._config.eas?.apis?.login || 'xtgl/login_slogin.html';
    }

    get EA_LOGOUT() {
        return this._config.eas?.apis?.logout || null;
    }

    get EA_PUBLIC_KEY() {
        return this._config.eas?.apis?.publicKey || 'xtgl/login_getPublicKey.html';
    }

    // 别名：兼容EASAccount.js中使用的EA_LOGIN_PUBLIC_KEY
    get EA_LOGIN_PUBLIC_KEY() {
        return this.EA_PUBLIC_KEY;
    }

    get SYSTEM_NOTICE() {
        return this._config.eas?.apis?.systemNotice || 'xtgl/index_cxDbsy.html?doType=query';
    }

    // 别名：兼容EASAccount.js中使用的EA_SYSTEM_NOTICE
    get EA_SYSTEM_NOTICE() {
        return this.SYSTEM_NOTICE;
    }

    get GET_YEAR_DATA() {
        return this._config.eas?.apis?.yearData || 'xtgl/index_cxAreaFive.html?localeKey=zh_CN&gnmkdm=index';
    }

    // 别名：兼容EASAccount.js中使用的EA_YEAR_DATA
    get EA_YEAR_DATA() {
        return this.GET_YEAR_DATA;
    }

    get GET_LESSON_TABLE() {
        return this._config.eas?.apis?.lessonTable || 'kbcx/xskbcx_cxXsgrkb.html';
    }

    get GET_CLASS_LESSON_TABLE() {
        return this._config.eas?.apis?.classLessonTable || 'kbdy/bjkbdy_cxBjKb.html';
    }

    get GET_LESSON_TABLE_PRINT() {
        return this._config.eas?.apis?.lessonTablePrint || 'kbdy/bjkbdy_cxBjkbdyIndex.html?gnmkdm=0&layout=default';
    }

    get GET_MARKS() {
        return this._config.eas?.apis?.marks || 'cjcx/cjcx_cxDgXscj.html?doType=query';
    }

    // 别名：兼容EASAccount.js中使用的GET_MARK（单数）
    get GET_MARK() {
        return this.GET_MARKS;
    }

    get GET_MARK_DETAIL() {
        return this._config.eas?.apis?.markDetail || 'cjcx/cjcx_cxXsKccjList.html';
    }

    get GET_EXAM() {
        return this._config.eas?.apis?.exam || 'kwgl/kscx_cxXsksxxIndex.html?doType=query';
    }

    get GET_ACADEMIC_PAGE() {
        return this._config.eas?.apis?.academicPage || 'xsxy/xsxyqk_cxXsxyqkIndex.html?gnmkdm=N105515&layout=default';
    }

    get GET_ACADEMIC_INFO() {
        return this._config.eas?.apis?.academicInfo || 'xsxy/xsxyqk_cxJxzxjhxfyqFKcxx.html';
    }

    get GET_EMPTY_ROOM() {
        return this._config.eas?.apis?.emptyRoom || 'cdjy/cdjy_cxKxcdlb.html?doType=query';
    }

    get GET_EMPTY_ROOM_PAGE() {
        return this._config.eas?.apis?.emptyRoomPage || 'cdjy/cdjy_cxKxcdlb.html?gnmkdm=N2155';
    }

    get GET_BUILDING_LIST() {
        return this._config.eas?.apis?.buildingList || 'cdjy/cdjy_cxXqjc.html?gnmkdm=N2155';
    }

    get STUDENT_INFO() {
        return this._config.eas?.apis?.studentInfo || 'xsxxxggl/xsxxwh_cxCkDgxsxx.html?gnmkdm=N100801';
    }

    // ==================== 登录特性 ====================

    get LOGIN_FEATURES() {
        return this._config.eas?.loginFeatures || {};
    }

    get LOGOUT_BEFORE_LOGIN() {
        return this._config.eas?.loginFeatures?.logoutBeforeLogin === true;
    }

    get PLAINTEXT_PASSWORD() {
        const value = this._config.eas?.loginFeatures?.plaintextPassword;
        if (value === true || value === false) {
            return value;
        }
        return 'auto';
    }

    get REQUIRE_YD_TYPE() {
        return this._config.eas?.loginFeatures?.requireYdType === true;
    }

    get KEEP_FULL_CSRF_TOKEN() {
        return this._config.eas?.loginFeatures?.keepFullCsrfToken === true;
    }

    // ==================== 学校基本信息 ====================

    get SCHOOL_ID() {
        return this._config.id || 'ujn';
    }

    get SCHOOL_NAME() {
        return this._config.name || '济南大学';
    }

    get SCHOOL_SHORT_NAME() {
        return this._config.shortName || '济大';
    }

    get CAMPUSES() {
        return this._config.campuses || [];
    }

    get FEATURES() {
        return this._config.features || {};
    }

    // ==================== 工具方法 ====================

    getEasUrl(hostIndex = 0, apiPath = '', useHttps = null) {
        const hosts = this.EA_HOSTS;
        if (!hosts || hosts.length === 0) {
            console.error('教务系统主机列表为空');
            return '';
        }

        const index = Math.min(hostIndex, hosts.length - 1);
        const host = hosts[index];
        const shouldUseHttps = useHttps !== null ? useHttps : this.getHostHttps(index);
        const scheme = shouldUseHttps ? 'https' : 'http';

        return `${scheme}://${host}/${apiPath}`;
    }

    getVpnUrl(path = '') {
        const host = this.VPN_HOST;
        if (!host) return '';
        return `https://${host}/${path}`;
    }

    getSsoUrl(path = '', useHttps = false) {
        const host = this.IPASS_HOST;
        if (!host) return '';
        const scheme = useHttps ? 'https' : 'http';
        return `${scheme}://${host}/${path}`;
    }

    refresh() {
        console.log(`[API] 当前学校: ${this.SCHOOL_NAME} (${this.SCHOOL_ID})`);
    }
}

// 创建动态API配置实例
const API = new DynamicAPIConfig();

// ==================== 导出 ====================

export const UJNAPI = API;
export default API;
export { PresetSchools };