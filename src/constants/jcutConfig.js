// src/constants/jcutConfig.js

/**
 * 荆楚理工学院配置常量
 * 包含学校配置和预计算的WebVPN URL
 */

import JcutVpnUtils from '@/utils/jcutVpnUtils';

/**
 * 学校配置
 */
export const JcutSchoolConfig = {
    id: 'jcut',
    name: '荆楚理工学院',
    shortName: '荆楚理工',

    // WebVPN配置
    vpn: {
        enabled: true,
        type: 'jcut',
        host: 'sec.jcut.edu.cn',
        basePath: '/webvpn',
        loginUrl: 'https://sec.jcut.edu.cn/webvpn/',
        encryptKey: 'a56b1e0c1f95cc40f0',
        encryptType: 'jcut_custom',
    },

    // 统一认证配置 (lyuapServer)
    sso: {
        type: 'lyuap',
        host: 'cas.jcut.edu.cn',
        loginUrl: 'https://cas.jcut.edu.cn/lyuapServer/login',
        portalUrl: 'https://my.jcut.edu.cn/',
        requireCaptcha: true,
        passwordEncrypt: 'rsa',
        apis: {
            kaptcha: '/lyuapServer/kaptcha',
            tickets: '/lyuapServer/v1/tickets',
            serviceTicket: '/lyuapServer/v1/tickets/{tgt}',
        }
    },

    // 教务系统配置
    eas: {
        type: 'zhengfang_new',
        hosts: ['jwglxt.jcut.edu.cn'],
        useHttps: true,
        defaultPathPrefix: '',
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

    // ========== 新增：门户系统配置 ==========
    portal: {
        host: 'my.jcut.edu.cn',
        apis: {
            // 验证登录状态
            tryLoginUserInfo: '/tryLoginUserInfo',
            // 获取登录信息
            getLoginInfo: '/api/upp/userControl/getLoginInfo',
            // 服务类型应用列表
            selectAppByCardId: '/api/uppcard/serviceTypeShow/selectAppByCardId',
            // 课表查询
            queryAWeekSchedule: '/api/uppcard/kbsz/queryAWeekSchedule',
        },
        // 应用卡片ID
        cardIds: {
            // 应用订阅卡片
            appSubscription: '4855d22336b84fa981c6d05e9bc674b0',
            // 课表卡片
            schedule: 'f949bf41737b4fa58d7edc9ff9d4e2e8',
        }
    },

    // ========== 新增：校历配置（从门户API动态获取） ==========
    calendar: {
        // 校历应用ID（用于匹配）
        appId: '1da7ab7e2b824b1aa45691f1a81debb5',
        // 校历应用名称（用于匹配）
        appName: '校历查询',
        // 备用名称匹配
        altNames: ['校历', '学校校历'],
    },

    // 校区配置
    campuses: [
        { value: '00002', label: '荆楚理工学院(主校区)' },
        { value: '00005', label: '实习医院' }
    ],

    // 功能开关
    features: {
        calendar: true,
        emptyRoom: true,
        librarySearch: false,
        cardBalance: false,
        portalApps: true,  // 新增：门户应用功能
    },
};

/**
 * 预计算的WebVPN URL
 * 避免每次使用时重新计算
 */
export const JcutVpnUrls = {
    // WebVPN门户
    VPN_PORTAL: 'https://sec.jcut.edu.cn/webvpn/',

    // CAS登录
    CAS_LOGIN: 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjE5Ni4xNTAuMTY5LjE0NC4xNTUuMjAwLjE2NS4yMTUuOTUuMjAzLjE1Ny4xNzAuMTQ1LjE5OC4xNjI=/lyuapServer/login',

    // 验证码
    KAPTCHA: 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjE5Ni4xNTAuMTY5LjE0NC4xNTUuMjAwLjE2NS4yMTUuOTUuMjAzLjE1Ny4xNzAuMTQ1LjE5OC4xNjI=/lyuapServer/kaptcha',

    // 票据
    TICKETS: 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjE5Ni4xNTAuMTY5LjE0NC4xNTUuMjAwLjE2NS4yMTUuOTUuMjAzLjE1Ny4xNzAuMTQ1LjE5OC4xNjI=/lyuapServer/v1/tickets',

    // 门户
    PORTAL: 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjIwNi4xNzQuMTAwLjIwNC4xNDguMjE4LjE2NC4xNDUuMTUwLjIwMi4xNzQuOTkuMTk4LjIwOQ==/',

    // ========== 新增：门户API基础URL ==========
    PORTAL_API: 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjIwNi4xNzQuMTAwLjIwNC4xNDguMjE4LjE2NC4xNDUuMTUwLjIwMi4xNzQuOTkuMTk4LjIwOQ==',

    // 教务系统
    EAS_HOME: 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjIwMy4xNzIuMTU3LjIwNi4xNjkuMjE3Ljk0LjIwNS4xNDguMjE5LjE3My45OS4yMDAuMTk5LjE2OS45NC4yMDEuMTU4/',

    EAS_LOGIN: 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjIwMy4xNzIuMTU3LjIwNi4xNjkuMjE3Ljk0LjIwNS4xNDguMjE5LjE3My45OS4yMDAuMTk5LjE2OS45NC4yMDEuMTU4/xtgl/login_slogin.html',

    EAS_SSO_LOGIN: 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjIwMy4xNzIuMTU3LjIwNi4xNjkuMjE3Ljk0LjIwNS4xNDguMjE5LjE3My45OS4yMDAuMTk5LjE2OS45NC4yMDEuMTU4/sso/driotlogin',
};

/**
 * URL加密映射表
 * 用于快速查找已加密的URL
 */
export const JcutEncryptedHosts = {
    'cas.jcut.edu.cn': 'LjE5Ni4xNTAuMTY5LjE0NC4xNTUuMjAwLjE2NS4yMTUuOTUuMjAzLjE1Ny4xNzAuMTQ1LjE5OC4xNjI=',
    'my.jcut.edu.cn': 'LjIwNi4xNzQuMTAwLjIwNC4xNDguMjE4LjE2NC4xNDUuMTUwLjIwMi4xNzQuOTkuMTk4LjIwOQ==',
    'jwglxt.jcut.edu.cn': 'LjIwMy4xNzIuMTU3LjIwNi4xNjkuMjE3Ljk0LjIwNS4xNDguMjE5LjE3My45OS4yMDAuMTk5LjE2OS45NC4yMDEuMTU4',
    'www.jcut.edu.cn': 'LjIxNC4xNzQuMjE0LjE0NC4yMDMuMjE4LjE2NC4xNDUuMTUwLjIwMi4xNzQuOTkuMTk4LjIwOQ==',
};

/**
 * 协议加密映射
 */
export const JcutEncryptedProtocols = {
    'https': 'LjIwMS4xNjkuMTcwLjIxMC4xNjQ=',
    'http': 'LjIwMS4xNjkuMTcwLjIxMA==',
};

/**
 * 获取加密后的主机名
 * @param {string} host 主机名
 * @returns {string} 加密后的主机名
 */
export function getEncryptedHost(host) {
    if (JcutEncryptedHosts[host]) {
        return JcutEncryptedHosts[host];
    }
    return JcutVpnUtils.encrypt(host);
}

/**
 * 获取加密后的协议
 * @param {string} protocol 协议 (http/https)
 * @returns {string} 加密后的协议
 */
export function getEncryptedProtocol(protocol) {
    const p = protocol.replace(':', '');
    if (JcutEncryptedProtocols[p]) {
        return JcutEncryptedProtocols[p];
    }
    return JcutVpnUtils.encrypt(p);
}

/**
 * 快速构建WebVPN URL
 * @param {string} host 主机名
 * @param {string} path 路径
 * @param {boolean} useHttps 是否使用HTTPS
 * @returns {string} WebVPN URL
 */
export function buildVpnUrl(host, path = '', useHttps = true) {
    const protocol = useHttps ? 'https' : 'http';
    const encProtocol = getEncryptedProtocol(protocol);
    const encHost = getEncryptedHost(host);

    let url = `https://sec.jcut.edu.cn/webvpn/${encProtocol}/${encHost}/`;
    if (path) {
        url += path.startsWith('/') ? path.substring(1) : path;
    }

    return url;
}

/**
 * 构建门户API URL
 * @param {string} apiPath API路径
 * @param {object} params 查询参数
 * @returns {string} 完整的API URL
 */
export function buildPortalApiUrl(apiPath, params = {}) {
    const baseUrl = JcutVpnUrls.PORTAL_API;
    let url = `${baseUrl}${apiPath}?vpn-12-my.jcut.edu.cn`;

    // 添加时间戳
    params._t = params._t || Date.now();

    // 添加其他参数
    Object.keys(params).forEach(key => {
        url += `&${key}=${encodeURIComponent(params[key])}`;
    });

    return url;
}

export default {
    JcutSchoolConfig,
    JcutVpnUrls,
    JcutEncryptedHosts,
    JcutEncryptedProtocols,
    getEncryptedHost,
    getEncryptedProtocol,
    buildVpnUrl,
    buildPortalApiUrl,
};