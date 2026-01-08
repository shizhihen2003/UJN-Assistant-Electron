// src/constants/schoolConfig.js

/**
 * 学校配置类型定义和验证函数
 */

/**
 * 教务系统类型枚举
 */
export const EASystemType = {
    ZHENGFANG: 'zhengfang',           // 正方教务系统
    ZHENGFANG_NEW: 'zhengfang_new',   // 新正方教务系统
    KINGOSOFT: 'kingosoft',            // 金智教务系统
    URPCLASS: 'urpclass',              // URP教务系统
    CUSTOM: 'custom'                   // 自定义系统
};

/**
 * 统一身份认证类型枚举
 */
export const SSOType = {
    CAS: 'cas',                        // CAS认证
    OAUTH: 'oauth',                    // OAuth认证
    TPASS: 'tpass',                    // 天翼认证
    RUMP: 'rump',                      // rump_frontend认证（如荆楚理工）
    CUSTOM: 'custom'                   // 自定义认证
};

/**
 * 获取空白学校配置模板
 * @returns {Object} 空白配置模板
 */
export function getBlankTemplate() {
    return {
        id: '',
        name: '',
        shortName: '',
        logo: '',

        vpn: {
            enabled: true,
            host: '',
            loginUrl: '',
            encryptKey: 'wrdvpnisthebest',
        },

        sso: {
            type: SSOType.CAS,
            host: '',
            loginUrl: '',
            portalUrl: '',
        },

        eas: {
            type: EASystemType.ZHENGFANG_NEW,
            hosts: [''],
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
                emptyRoom: '',
            }
        },

        campuses: [],

        features: {
            calendar: false,
            emptyRoom: false,
            librarySearch: false,
            cardBalance: false,
        },

        custom: {}
    };
}

/**
 * 验证学校配置是否完整有效
 * @param {Object} config 学校配置对象
 * @returns {{valid: boolean, errors: string[]}} 验证结果
 */
export function validateSchoolConfig(config) {
    const errors = [];

    // 基本信息验证
    if (!config.id || config.id.trim() === '') {
        errors.push('学校ID不能为空');
    }
    if (!config.name || config.name.trim() === '') {
        errors.push('学校名称不能为空');
    }

    // VPN配置验证
    if (config.vpn?.enabled) {
        if (!config.vpn.host) {
            errors.push('启用VPN时，VPN主机地址不能为空');
        }
        if (!config.vpn.loginUrl) {
            errors.push('启用VPN时，VPN登录URL不能为空');
        }
    }

    // SSO配置验证
    if (!config.sso?.host) {
        errors.push('统一身份认证主机地址不能为空');
    }
    if (!config.sso?.loginUrl) {
        errors.push('统一身份认证登录URL不能为空');
    }

    // 教务系统配置验证
    if (!config.eas?.hosts || config.eas.hosts.length === 0) {
        errors.push('教务系统主机列表不能为空');
    } else if (config.eas.hosts.some(h => !h || h.trim() === '')) {
        errors.push('教务系统主机地址不能为空');
    }

    if (!config.eas?.apis?.login) {
        errors.push('教务系统登录API路径不能为空');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

export default {
    EASystemType,
    SSOType,
    getBlankTemplate,
    validateSchoolConfig
};