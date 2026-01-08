// src/services/schoolService.js

/**
 * 学校配置管理服务
 * 负责管理当前选中的学校、切换学校、保存用户自定义学校配置
 */

import { ref, reactive, computed } from 'vue';
import store from '../utils/store';
import { PresetSchools } from '../constants/api';
import { getBlankTemplate, validateSchoolConfig, EASystemType, SSOType } from '../constants/schoolConfig';

// 存储键名
const STORAGE_KEYS = {
    CURRENT_SCHOOL: 'current_school_id',
    CUSTOM_SCHOOLS: 'custom_schools',
};

/**
 * 学校配置管理服务类
 */
class SchoolService {
    constructor() {
        // 当前选中的学校ID
        this._currentSchoolId = ref('ujn'); // 默认济南大学
        
        // 当前学校配置（响应式）
        this._currentConfig = reactive({});
        
        // 用户自定义学校列表
        this._customSchools = reactive({});
        
        // 所有可用学校列表（预置 + 自定义）
        this._availableSchools = computed(() => {
            const schools = [];
            
            // 添加预置学校
            Object.keys(PresetSchools).forEach(key => {
                schools.push({
                    id: PresetSchools[key].id,
                    name: PresetSchools[key].name,
                    shortName: PresetSchools[key].shortName,
                    isPreset: true
                });
            });
            
            // 添加用户自定义学校
            Object.keys(this._customSchools).forEach(key => {
                schools.push({
                    id: this._customSchools[key].id,
                    name: this._customSchools[key].name,
                    shortName: this._customSchools[key].shortName,
                    isPreset: false
                });
            });
            
            return schools;
        });
        
        // 初始化标志
        this._initialized = false;
    }
    
    /**
     * 初始化服务
     * 从存储中加载当前学校和自定义学校配置
     */
    async init() {
        if (this._initialized) return;
        
        try {
            // 加载用户自定义学校
            const customSchools = await store.getObject(STORAGE_KEYS.CUSTOM_SCHOOLS);
            if (customSchools) {
                Object.assign(this._customSchools, customSchools);
            }
            
            // 加载当前选中的学校
            const savedSchoolId = await store.getString(STORAGE_KEYS.CURRENT_SCHOOL, 'ujn');
            await this.switchSchool(savedSchoolId, false); // 不保存，因为是加载
            
            this._initialized = true;
            console.log(`[SchoolService] 初始化完成，当前学校: ${this._currentConfig.name}`);
        } catch (error) {
            console.error('[SchoolService] 初始化失败，使用默认配置:', error);
            // 使用默认配置
            await this.switchSchool('ujn', false);
            this._initialized = true;
        }
    }
    
    /**
     * 获取当前学校ID
     * @returns {string}
     */
    get currentSchoolId() {
        return this._currentSchoolId.value;
    }
    
    /**
     * 获取当前学校配置
     * @returns {Object}
     */
    get currentConfig() {
        return this._currentConfig;
    }
    
    /**
     * 获取所有可用学校列表
     * @returns {Array}
     */
    get availableSchools() {
        return this._availableSchools.value;
    }
    
    /**
     * 切换学校
     * @param {string} schoolId 学校ID
     * @param {boolean} save 是否保存到存储
     * @returns {Promise<boolean>} 是否切换成功
     */
    async switchSchool(schoolId, save = true) {
        try {
            let config = null;
            
            // 先从预置学校查找
            if (PresetSchools[schoolId]) {
                config = JSON.parse(JSON.stringify(PresetSchools[schoolId]));
            }
            // 再从自定义学校查找
            else if (this._customSchools[schoolId]) {
                config = JSON.parse(JSON.stringify(this._customSchools[schoolId]));
            }
            
            if (!config) {
                console.error(`[SchoolService] 未找到学校配置: ${schoolId}`);
                return false;
            }
            
            // 更新当前配置
            this._currentSchoolId.value = schoolId;
            Object.keys(this._currentConfig).forEach(key => delete this._currentConfig[key]);
            Object.assign(this._currentConfig, config);
            
            // 保存到存储
            if (save) {
                await store.putString(STORAGE_KEYS.CURRENT_SCHOOL, schoolId);
                // 同时保存到localStorage，供api.js同步读取（Electron环境下store使用electron-store）
                localStorage.setItem('ujn_assistant_' + STORAGE_KEYS.CURRENT_SCHOOL, schoolId);
            }
            
            console.log(`[SchoolService] 已切换到学校: ${config.name}`);
            return true;
        } catch (error) {
            console.error('[SchoolService] 切换学校失败:', error);
            return false;
        }
    }
    
    /**
     * 添加自定义学校配置
     * @param {Object} config 学校配置对象
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async addCustomSchool(config) {
        try {
            // 验证配置
            const validation = validateSchoolConfig(config);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.errors.join('; ')
                };
            }
            
            // 检查ID是否已存在
            if (PresetSchools[config.id] || this._customSchools[config.id]) {
                return {
                    success: false,
                    error: `学校ID "${config.id}" 已存在`
                };
            }
            
            // 添加到自定义学校
            this._customSchools[config.id] = JSON.parse(JSON.stringify(config));
            
            // 保存到存储
            await store.putObject(STORAGE_KEYS.CUSTOM_SCHOOLS, { ...this._customSchools });
            // 同时保存到localStorage，供api.js同步读取
            localStorage.setItem('ujn_assistant_' + STORAGE_KEYS.CUSTOM_SCHOOLS, JSON.stringify(this._customSchools));
            
            console.log(`[SchoolService] 已添加自定义学校: ${config.name}`);
            return { success: true };
        } catch (error) {
            console.error('[SchoolService] 添加自定义学校失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 更新自定义学校配置
     * @param {string} schoolId 学校ID
     * @param {Object} config 新的配置对象
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async updateCustomSchool(schoolId, config) {
        try {
            // 不能修改预置学校
            if (PresetSchools[schoolId]) {
                return {
                    success: false,
                    error: '不能修改预置学校配置'
                };
            }
            
            // 检查学校是否存在
            if (!this._customSchools[schoolId]) {
                return {
                    success: false,
                    error: `未找到自定义学校: ${schoolId}`
                };
            }
            
            // 验证配置
            const validation = validateSchoolConfig(config);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.errors.join('; ')
                };
            }
            
            // 更新配置
            this._customSchools[schoolId] = JSON.parse(JSON.stringify(config));
            
            // 保存到存储
            await store.putObject(STORAGE_KEYS.CUSTOM_SCHOOLS, { ...this._customSchools });
            // 同时保存到localStorage，供api.js同步读取
            localStorage.setItem('ujn_assistant_' + STORAGE_KEYS.CUSTOM_SCHOOLS, JSON.stringify(this._customSchools));
            
            // 如果更新的是当前学校，刷新当前配置
            if (this._currentSchoolId.value === schoolId) {
                Object.keys(this._currentConfig).forEach(key => delete this._currentConfig[key]);
                Object.assign(this._currentConfig, this._customSchools[schoolId]);
            }
            
            console.log(`[SchoolService] 已更新自定义学校: ${config.name}`);
            return { success: true };
        } catch (error) {
            console.error('[SchoolService] 更新自定义学校失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 删除自定义学校
     * @param {string} schoolId 学校ID
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async removeCustomSchool(schoolId) {
        try {
            // 不能删除预置学校
            if (PresetSchools[schoolId]) {
                return {
                    success: false,
                    error: '不能删除预置学校'
                };
            }
            
            // 检查学校是否存在
            if (!this._customSchools[schoolId]) {
                return {
                    success: false,
                    error: `未找到自定义学校: ${schoolId}`
                };
            }
            
            // 如果删除的是当前学校，先切换到默认学校
            if (this._currentSchoolId.value === schoolId) {
                await this.switchSchool('ujn');
            }
            
            // 删除配置
            delete this._customSchools[schoolId];
            
            // 保存到存储
            await store.putObject(STORAGE_KEYS.CUSTOM_SCHOOLS, { ...this._customSchools });
            // 同时保存到localStorage，供api.js同步读取
            localStorage.setItem('ujn_assistant_' + STORAGE_KEYS.CUSTOM_SCHOOLS, JSON.stringify(this._customSchools));
            
            console.log(`[SchoolService] 已删除自定义学校: ${schoolId}`);
            return { success: true };
        } catch (error) {
            console.error('[SchoolService] 删除自定义学校失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 获取学校配置
     * @param {string} schoolId 学校ID
     * @returns {Object|null}
     */
    getSchoolConfig(schoolId) {
        if (PresetSchools[schoolId]) {
            return JSON.parse(JSON.stringify(PresetSchools[schoolId]));
        }
        if (this._customSchools[schoolId]) {
            return JSON.parse(JSON.stringify(this._customSchools[schoolId]));
        }
        return null;
    }
    
    /**
     * 获取空白配置模板
     * @returns {Object}
     */
    getBlankTemplate() {
        return getBlankTemplate();
    }
    
    /**
     * 导出学校配置为JSON
     * @param {string} schoolId 学校ID
     * @returns {string|null}
     */
    exportConfig(schoolId) {
        const config = this.getSchoolConfig(schoolId);
        if (!config) return null;
        return JSON.stringify(config, null, 2);
    }
    
    /**
     * 从JSON导入学校配置
     * @param {string} jsonString JSON字符串
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async importConfig(jsonString) {
        try {
            const config = JSON.parse(jsonString);
            return await this.addCustomSchool(config);
        } catch (error) {
            return {
                success: false,
                error: '无效的JSON格式'
            };
        }
    }
    
    // ==================== 便捷访问方法 ====================
    
    /**
     * 获取VPN配置
     */
    get vpnConfig() {
        return this._currentConfig.vpn || {};
    }
    
    /**
     * 获取SSO配置
     */
    get ssoConfig() {
        return this._currentConfig.sso || {};
    }
    
    /**
     * 获取教务系统配置
     */
    get easConfig() {
        return this._currentConfig.eas || {};
    }
    
    /**
     * 获取校区列表
     */
    get campuses() {
        return this._currentConfig.campuses || [];
    }
    
    /**
     * 获取特性开关
     */
    get features() {
        return this._currentConfig.features || {};
    }
    
    /**
     * 获取VPN主机地址
     */
    get vpnHost() {
        return this._currentConfig.vpn?.host || '';
    }
    
    /**
     * 获取VPN登录URL
     */
    get vpnLoginUrl() {
        return this._currentConfig.vpn?.loginUrl || '';
    }
    
    /**
     * 获取SSO主机地址
     */
    get ssoHost() {
        return this._currentConfig.sso?.host || '';
    }
    
    /**
     * 获取SSO登录URL
     */
    get ssoLoginUrl() {
        return this._currentConfig.sso?.loginUrl || '';
    }
    
    /**
     * 获取教务系统主机列表
     */
    get easHosts() {
        return this._currentConfig.eas?.hosts || [];
    }
    
    /**
     * 获取教务系统API配置
     */
    get easApis() {
        return this._currentConfig.eas?.apis || {};
    }
    
    /**
     * 获取学校名称
     */
    get schoolName() {
        return this._currentConfig.name || '';
    }
    
    /**
     * 获取学校简称
     */
    get schoolShortName() {
        return this._currentConfig.shortName || '';
    }
}

// 创建单例实例
const schoolService = new SchoolService();

export default schoolService;

// 导出类型枚举供外部使用
export { EASystemType, SSOType };
