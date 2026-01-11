// src/services/authService.js (修复版 - 按学校区分 userInfo 存储)
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import EASAccount from '../models/EASAccount'
import IPassAccount from '../models/IPassAccount'
import store from '../utils/store'
import ipc from '../utils/ipc'

/**
 * 认证服务
 * 管理用户登录状态和账户信息
 */
class AuthService {
    // ========== 新增：按学校区分的存储键 ==========
    /**
     * 获取当前学校ID用于存储键
     * @returns {string} 学校ID
     */
    static getCurrentSchoolId() {
        try {
            // 从 localStorage 获取当前学校ID（schoolService 会在切换学校时保存）
            const schoolId = localStorage.getItem('ujn_assistant_current_school_id');
            if (schoolId) {
                return schoolId;
            }
            return 'ujn';
        } catch (e) {
            return 'ujn';
        }
    }

    /**
     * 获取带学校前缀的 userInfo 存储键
     * @returns {string} 存储键，如 'userInfo_ujn' 或 'userInfo_jcut'
     */
    static getUserInfoKey() {
        const schoolId = AuthService.getCurrentSchoolId();
        return `userInfo_${schoolId}`;
    }
    // ========== 新增结束 ==========

    constructor() {
        // 登录状态
        this.easLoginStatus = ref(false)
        this.ipassLoginStatus = ref(false)

        // 账户信息
        this.userInfo = reactive({
            studentId: '',
            name: '',
            entranceYear: 0,
            college: '',
            major: '',
            class: ''
        })

        // 账户实例
        this.easAccount = EASAccount.getInstance()
        this.ipassAccount = IPassAccount.getInstance()

        // VPN设置属性
        this._useVpn = false

        // 教务系统VPN设置属性
        this._useEasVpn = false;

        // 初始化
        this.init()
    }

    /**
     * 获取VPN使用状态
     * @returns {boolean} 是否使用VPN
     */
    get useVpn() {
        return this._useVpn
    }

    /**
     * 设置VPN使用状态
     * @param {boolean} value 是否使用VPN
     */
    set useVpn(value) {
        this._useVpn = !!value // 强制转换为布尔值
        console.log(`authService VPN设置已更新为: ${this._useVpn}`)
    }

    /**
     * 获取教务系统VPN使用状态
     * @returns {boolean} 是否使用VPN
     */
    get useEasVpn() {
        return this._useEasVpn;
    }

    /**
     * 设置教务系统VPN使用状态
     * @param {boolean} value 是否使用VPN
     */
    set useEasVpn(value) {
        this._useEasVpn = !!value; // 强制转换为布尔值
        console.log(`authService 教务系统VPN设置已更新为: ${this._useEasVpn}`);

        // 同步设置到教务系统账号
        if (this.easAccount) {
            this.easAccount.useVpn = this._useEasVpn;
        }
    }

    /**
     * 初始化
     */
    async init() {
        try {
            // 从存储加载VPN设置
            const useVpn = await store.getBoolean('EA_USE_VPN', false)
            this._useVpn = useVpn
            console.log(`从存储加载VPN设置: ${useVpn}`)

            // 从存储加载教务系统VPN设置
            const useEasVpn = await store.getBoolean('EA_USE_EAS_VPN', false)
            this._useEasVpn = useEasVpn
            console.log(`从存储加载教务系统VPN设置: ${useEasVpn}`)

            // 同步VPN设置到账户实例
            if (this.ipassAccount) {
                this.ipassAccount.useVpn = useVpn
            }
            if (this.easAccount) {
                this.easAccount.useVpn = useEasVpn
            }

            // 加载用户信息
            await this.loadUserInfo()
        } catch (error) {
            console.error('认证服务初始化失败', error)
        }
    }

    /**
     * 检查教务系统登录状态
     */
    async checkEasLogin() {
        try {
            const isLogin = await this.easAccount.absCheckLogin()
            this.easLoginStatus.value = isLogin
            return isLogin
        } catch (error) {
            console.error('检查教务系统登录状态失败', error)
            this.easLoginStatus.value = false
            return false
        }
    }

    /**
     * 检查智慧济大登录状态
     */
    async checkIpassLogin() {
        try {
            const isLogin = await this.ipassAccount.absCheckLogin()
            this.ipassLoginStatus.value = isLogin
            return isLogin
        } catch (error) {
            console.error('检查智慧济大登录状态失败', error)
            this.ipassLoginStatus.value = false
            return false
        }
    }

    /**
     * 加载用户信息
     */
    async loadUserInfo() {
        try {
            // ========== 修改：使用按学校区分的存储键 ==========
            const userInfoKey = AuthService.getUserInfoKey();
            let savedUserInfo = await store.getObject(userInfoKey)

            // 向后兼容：如果按学校区分的键没有数据，尝试从旧的 userInfo 键读取
            if (!savedUserInfo) {
                const legacyUserInfo = await store.getObject('userInfo');
                if (legacyUserInfo) {
                    console.log('[authService] 从旧的 userInfo 键迁移数据');
                    savedUserInfo = legacyUserInfo;
                    // 迁移数据到新的键
                    await store.putObject(userInfoKey, savedUserInfo);
                }
            }
            // ========== 修改结束 ==========

            if (savedUserInfo) {
                Object.assign(this.userInfo, savedUserInfo)
            }

            // 从存储加载入学年份
            if (!this.userInfo.entranceYear) {
                const entranceYear = await store.getInt('ENTRANCE_TIME', 0)
                if (entranceYear > 0) {
                    this.userInfo.entranceYear = entranceYear
                }
            }

            // 加载学号
            if (!this.userInfo.studentId) {
                const easAccount = await store.getString('EAS_ACCOUNT', '')
                if (easAccount) {
                    this.userInfo.studentId = easAccount
                }
            }
        } catch (error) {
            console.error('加载用户信息失败', error)
        }
    }

    /**
     * 保存用户信息
     */
    async saveUserInfo() {
        try {
            // ========== 修改：使用按学校区分的存储键 ==========
            const userInfoKey = AuthService.getUserInfoKey();
            const storedUserInfo = await store.getObject(userInfoKey, {});
            // ========== 修改结束 ==========

            // 创建一个简单的对象，避免无法克隆的问题
            const simpleUserInfo = {
                studentId: this.userInfo.studentId,
                // 如果当前内存中有姓名，使用内存中的姓名；否则保留存储中的姓名
                name: this.userInfo.name || storedUserInfo.name || '',
                entranceYear: this.userInfo.entranceYear || storedUserInfo.entranceYear || 0,
                college: this.userInfo.college || storedUserInfo.college || '',
                major: this.userInfo.major || storedUserInfo.major || '',
                class: this.userInfo.class || storedUserInfo.class || ''
            }

            console.log('即将保存的用户信息:', simpleUserInfo);
            // ========== 修改：使用按学校区分的存储键 ==========
            await store.putObject(userInfoKey, simpleUserInfo)
            // ========== 修改结束 ==========

            // 额外保存入学年份到专门的键值中
            await store.putInt('ENTRANCE_TIME', this.userInfo.entranceYear || 0)
            console.log(`已保存入学年份: ${this.userInfo.entranceYear}`)
        } catch (error) {
            console.error('保存用户信息失败', error)
            // 出错时也不要阻止登录流程继续
        }
    }

    /**
     * 教务系统登录
     * @param {string} username 用户名
     * @param {string} password 密码
     * @param {number} entranceYear 入学年份
     * @param {number} nodeIndex 节点索引
     * @returns {Promise<boolean>} 登录是否成功
     */
    async loginEas(username, password, entranceYear, nodeIndex) {
        try {
            if (nodeIndex !== undefined) {
                this.easAccount.changeHost(nodeIndex)
            }

            // 先设置入学年份到 EAS 账号和用户信息
            this.easAccount.entranceTime = entranceYear
            this.userInfo.entranceYear = entranceYear

            // 确保入学年份立即保存到存储
            await store.putInt('ENTRANCE_TIME', entranceYear)
            console.log(`登录前：入学年份 ${entranceYear} 已保存到存储`)

            // 执行登录
            const result = await this.easAccount.login(username, password, true)

            if (result) {
                // 更新用户信息
                this.userInfo.studentId = username
                this.userInfo.entranceYear = entranceYear

                // 保存用户信息
                try {
                    await this.saveUserInfo()
                } catch (error) {
                    console.error('保存用户信息失败，但登录已成功', error)
                }

                // 更新登录状态
                this.easLoginStatus.value = true

                return true
            } else {
                // 登录失败
                this.easLoginStatus.value = false
                return false
            }
        } catch (error) {
            console.error('教务系统登录失败', error)
            this.easLoginStatus.value = false
            ElMessage.error(`登录失败: ${error.message || '网络错误'}`)
            return false
        }
    }

    /**
     * 智慧济大登录
     * @param {string} username 用户名
     * @param {string} password 密码
     * @returns {Promise<boolean>} 登录是否成功
     */
    async loginIpass(username, password) {
        try {
            // 确保VPN设置同步到IPassAccount
            this.ipassAccount.useVpn = this.useVpn

            const result = await this.ipassAccount.login(username, password, true)

            if (result) {
                // 更新用户信息
                this.userInfo.studentId = username

                // 保存用户信息
                try {
                    await this.saveUserInfo()
                } catch (error) {
                    console.error('保存用户信息失败，但登录已成功', error)
                }

                // 更新登录状态
                this.ipassLoginStatus.value = true

                return true
            } else {
                // 登录失败
                this.ipassLoginStatus.value = false
                return false
            }
        } catch (error) {
            console.error('智慧济大登录失败', error)
            this.ipassLoginStatus.value = false
            ElMessage.error(`登录失败: ${error.message || '网络错误'}`)
            return false
        }
    }

    /**
     * 教务系统登出
     */
    async logoutEas() {
        try {
            this.easAccount.logout()
            this.easLoginStatus.value = false
        } catch (error) {
            console.error('教务系统登出失败', error)
        }
    }

    /**
     * 智慧济大登出
     */
    async logoutIpass() {
        try {
            this.ipassAccount.logout()
            this.ipassLoginStatus.value = false
        } catch (error) {
            console.error('智慧济大登出失败', error)
        }
    }

    /**
     * 全部登出
     */
    async logoutAll() {
        await this.logoutEas()
        await this.logoutIpass()

        // 注意：登出时不清除入学年份，以便下次登录使用

        // 清空其他用户信息
        Object.assign(this.userInfo, {
            studentId: '',
            name: '',
            // 保留入学年份: this.userInfo.entranceYear,
            college: '',
            major: '',
            class: ''
        })

        // 保存用户信息
        await this.saveUserInfo()
    }

    /**
     * 获取当前登录状态
     * @returns {Object} 登录状态
     */
    getLoginStatus() {
        return {
            eas: this.easLoginStatus.value,
            ipass: this.ipassLoginStatus.value,
            isLoggedIn: this.easLoginStatus.value || this.ipassLoginStatus.value
        }
    }

    /**
     * 获取用户信息
     * @returns {Object} 用户信息
     */
    getUserInfo() {
        return this.userInfo
    }

    /**
     * 获取保存的账户信息
     * @param {string} type 账户类型：'eas'或'ipass'
     * @returns {Promise<Object|null>} 账户信息
     */
    async getSavedAccount(type) {
        try {
            if (type === 'eas') {
                const username = await store.getString('EAS_ACCOUNT', '')
                const password = await store.getString('EAS_PASSWORD', '')
                const entranceYear = await store.getInt('ENTRANCE_TIME', new Date().getFullYear() - 4)
                const nodeIndex = await store.getInt('EA_HOST', 0)
                const autoLogin = await store.getBoolean('EAS_AUTO_LOGIN', false)

                return {
                    username,
                    password,
                    entranceYear,
                    nodeIndex,
                    autoLogin
                }
            } else if (type === 'ipass') {
                const username = await store.getString('IPASS_ACCOUNT', '')
                const password = await store.getString('IPASS_PASSWORD', '')
                const autoLogin = await store.getBoolean('IPASS_AUTO_LOGIN', false)

                return {
                    username,
                    password,
                    autoLogin
                }
            }

            return null
        } catch (error) {
            console.error('获取保存的账户信息失败', error)
            return null
        }
    }

    /**
     * 保存账户自动登录设置
     * @param {string} type 账户类型：'eas'或'ipass'
     * @param {boolean} autoLogin 是否自动登录
     */
    async saveAutoLogin(type, autoLogin) {
        try {
            if (type === 'eas') {
                await store.putBoolean('EAS_AUTO_LOGIN', autoLogin)
            } else if (type === 'ipass') {
                await store.putBoolean('IPASS_AUTO_LOGIN', autoLogin)
            }
        } catch (error) {
            console.error('保存自动登录设置失败', error)
        }
    }

    /**
     * 获取本地存储的用户信息
     * 这个方法直接从存储中获取，不会触发网络请求
     * @returns {Promise<Object>} 用户信息对象
     */
    async getLocalUserInfo() {
        try {
            // ========== 修改：使用按学校区分的存储键 ==========
            const userInfoKey = AuthService.getUserInfoKey();
            let storedInfo = await store.getObject(userInfoKey, null);

            // 向后兼容：尝试从旧键读取
            if (!storedInfo) {
                storedInfo = await store.getObject('userInfo', null);
            }
            // ========== 修改结束 ==========

            if (storedInfo) {
                return storedInfo;
            }

            // 如果没有找到存储的信息，尝试构建基本信息
            const studentId = await store.getString('EAS_ACCOUNT', '');
            const entranceYear = await store.getInt('ENTRANCE_TIME', 0);

            return {
                studentId,
                entranceYear,
                name: ''  // 如果存储中没有姓名信息，则返回空字符串
            };
        } catch (error) {
            console.error('获取本地用户信息失败:', error);
            return {
                studentId: '',
                name: '',
                entranceYear: 0
            };
        }
    }
}

// 创建单例实例
const authService = new AuthService()

export default authService