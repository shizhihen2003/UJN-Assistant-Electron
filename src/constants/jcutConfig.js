// src/constants/jcutConfig.js

/**
 * 荆楚理工学院配置常量
 * 包含学校配置、RSA参数和预计算的WebVPN URL
 */

/**
 * RSA加密配置（用于登录密码加密）
 * 这些参数从学校CAS系统获取
 */
export const JCUT_RSA = {
    PUBLIC_EXPONENT: '010001',
    MODULUS: '00b5eeb166e069920e80bebd1fea4829d3d1f3216f2aabe79b6c47a3c18dcee5fd22c2e7ac519cab59198ece036dcf289ea8201e2a0b9ded307f8fb704136eaeb670286f5ad44e691005ba9ea5af04ada5367cd724b5a26fdb5120cc95b6431604bd219c6b7d83a6f8f24b43918ea988a76f93c333aa5a20991493d4eb1117e7b1',
    TAG: 'lyasp',
    MAX_DIGITS: 131
}

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
        rsa: JCUT_RSA, // RSA配置引用
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
    },
}

/**
 * 预计算的WebVPN URL
 * 避免每次使用时重新计算
 */
export const JcutVpnUrls = {
    // WebVPN门户
    VPN_PORTAL: 'https://sec.jcut.edu.cn/webvpn/',

    // CAS登录页面
    CAS_LOGIN: 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjE5Ni4xNTAuMTY5LjE0NC4xNTUuMjAwLjE2NS4yMTUuOTUuMjAzLjE1Ny4xNzAuMTQ1LjE5OC4xNjI=/lyuapServer/login',

    // 验证码API
    KAPTCHA: 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjE5Ni4xNTAuMTY5LjE0NC4xNTUuMjAwLjE2NS4yMTUuOTUuMjAzLjE1Ny4xNzAuMTQ1LjE5OC4xNjI=/lyuapServer/kaptcha',

    // 票据API (登录提交)
    TICKETS: 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjE5Ni4xNTAuMTY5LjE0NC4xNTUuMjAwLjE2NS4yMTUuOTUuMjAzLjE1Ny4xNzAuMTQ1LjE5OC4xNjI=/lyuapServer/v1/tickets',

    // 门户首页
    PORTAL: 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjIwNi4xNzQuMTAwLjIwNC4xNDguMjE4LjE2NC4xNDUuMTUwLjIwMi4xNzQuOTkuMTk4LjIwOQ==/',

    // 教务系统
    EAS_HOME: 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjIwMy4xNzIuMTU3LjIwNi4xNjkuMjE3Ljk0LjIwNS4xNDguMjE5LjE3My45OS4yMDAuMTk5LjE2OS45NC4yMDMuMjA5/',
}

/**
 * 辅助函数：获取加密后的主机名
 * @param {string} host - 原始主机名
 * @returns {string} WebVPN加密后的路径
 */
export function getEncryptedHost(host) {
    // 预定义的主机映射
    const hostMap = {
        'cas.jcut.edu.cn': 'LjIwMS4xNjkuMTcwLjIxMC4xNjQ=',
        'my.jcut.edu.cn': 'LjIwNi4xNzQuMTAwLjIwNC4xNDguMjE4LjE2NC4xNDUuMTUwLjIwMi4xNzQuOTkuMTk4LjIwOQ==',
        'jwglxt.jcut.edu.cn': 'LjIwMy4xNzIuMTU3LjIwNi4xNjkuMjE3Ljk0LjIwNS4xNDguMjE5LjE3My45OS4yMDAuMTk5LjE2OS45NC4yMDMuMjA5',
    }
    return hostMap[host] || null
}

/**
 * 辅助函数：获取加密后的协议
 * @param {string} protocol - 原始协议 (http/https)
 * @returns {string} WebVPN加密后的协议路径
 */
export function getEncryptedProtocol(protocol) {
    const protocolMap = {
        'https': 'LjE5Ni4xNTAuMTY5LjE0NC4xNTUuMjAwLjE2NS4yMTUuOTUuMjAzLjE1Ny4xNzAuMTQ1LjE5OC4xNjI=',
        'http': 'LjE5OC4xNTEuMTY5LjE0NS4xNTYuMjAwLjE2NS4yMTYuOTYuMjAz',
    }
    return protocolMap[protocol] || null
}

/**
 * 辅助函数：构建WebVPN URL
 * @param {string} originalUrl - 原始URL
 * @returns {string} WebVPN格式的URL
 */
export function buildVpnUrl(originalUrl) {
    try {
        const url = new URL(originalUrl)
        const host = url.host
        const protocol = url.protocol.replace(':', '')
        const path = url.pathname + url.search

        const encHost = getEncryptedHost(host)
        const encProtocol = getEncryptedProtocol(protocol)

        if (encHost && encProtocol) {
            return `https://sec.jcut.edu.cn/webvpn/${encHost}/${encProtocol}${path}`
        }
        return null
    } catch (e) {
        console.error('构建VPN URL失败:', e)
        return null
    }
}

export default {
    JCUT_RSA,
    JcutSchoolConfig,
    JcutVpnUrls,
    getEncryptedHost,
    getEncryptedProtocol,
    buildVpnUrl,
}