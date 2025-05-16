// src/services/authService.js (增强版)
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
            this.easAccount.useVpn = !!value;
        }
    }

    async loginEasViaVpn(username, password) {
        try {
            console.log(`开始通过VPN登录教务系统，用户名: ${username}`);

            // 确保已经登录智慧济大
            if (!this.ipassLoginStatus.value) {
                console.error('未登录智慧济大，无法通过VPN登录教务系统');
                return false;
            }

            // 确保智慧济大已经通过VPN登录
            if (!this.useVpn) {
                console.error('未使用VPN登录智慧济大，无法通过VPN登录教务系统');
                return false;
            }

            // 设置教务系统使用VPN
            this.useEasVpn = true;
            // 同步设置到静态属性
            EASAccount.useVpn = true;

            // 第一步：访问VPN登录教务的入口URL
            const driotLoginUrl = 'https://webvpn.ujn.edu.cn/http/77726476706e69737468656265737421fae046906925625e300d8db9d6562d/sso/driotlogin';

            console.log(`访问教务系统VPN登录入口: ${driotLoginUrl}`);

            // 获取智慧济大VPN的Cookies
            const vpnCookies = await this.ipassAccount.vpnCookieJar.getCookies();

            if (!vpnCookies || vpnCookies.length === 0) {
                console.error('未获取到VPN Cookie，无法进行VPN登录');
                return false;
            }

            // 记录Cookie信息
            console.log(`VPN Cookie数量: ${vpnCookies.length}`);
            console.log(`Cookie摘要:`, vpnCookies.map(c => c.split('=')[0]).join(', '));

            // 访问教务系统VPN登录入口
            const step1Result = await ipc.ipassGet(driotLoginUrl, {
                cookies: vpnCookies,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://webvpn.ujn.edu.cn/http/77726476706e69737468656265737421fff944d2323a661e7b0c9ce29b5b/up/view?m=up'
                }
            });

            if (!step1Result.success) {
                console.error('教务系统VPN登录入口访问失败:', step1Result.error);
                return false;
            }

            // 如果有重定向，继续访问
            if (step1Result.location) {
                console.log(`第一步重定向到: ${step1Result.location}`);

                // 获取最新的Cookie
                if (step1Result.cookies && step1Result.cookies.length > 0) {
                    console.log(`保存第一步Cookie: ${step1Result.cookies.length}个`);
                    await this.ipassAccount.vpnCookieJar.saveCookies(step1Result.cookies);
                }

                // 第二步：访问重定向URL
                const step2Result = await ipc.ipassGet(step1Result.location, {
                    cookies: await this.ipassAccount.vpnCookieJar.getCookies(),
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': driotLoginUrl
                    }
                });

                if (!step2Result.success) {
                    console.error('第二步重定向访问失败:', step2Result.error);
                    return false;
                }

                // 获取最新的Cookie
                if (step2Result.cookies && step2Result.cookies.length > 0) {
                    console.log(`保存第二步Cookie: ${step2Result.cookies.length}个`);
                    await this.ipassAccount.vpnCookieJar.saveCookies(step2Result.cookies);
                }

                // 如果有包含ticket的重定向，继续处理
                if (step2Result.location && step2Result.location.includes('ticket=')) {
                    console.log(`第二步重定向到包含ticket的URL: ${step2Result.location}`);

                    // 提取ticket参数
                    const ticketMatch = step2Result.location.match(/ticket=([^&]+)/);
                    if (ticketMatch) {
                        console.log(`提取到ticket: ${ticketMatch[1]}`);
                    }

                    // 第三步：访问带有ticket的URL
                    const step3Result = await ipc.ipassGet(step2Result.location, {
                        cookies: await this.ipassAccount.vpnCookieJar.getCookies(),
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Referer': step1Result.location
                        }
                    });

                    if (!step3Result.success) {
                        console.error('第三步访问失败:', step3Result.error);
                        return false;
                    }

                    // 获取最新的Cookie
                    if (step3Result.cookies && step3Result.cookies.length > 0) {
                        console.log(`保存第三步Cookie: ${step3Result.cookies.length}个`);
                        await this.ipassAccount.vpnCookieJar.saveCookies(step3Result.cookies);
                    }

                    // 继续处理后续重定向
                    let currentRedirect = step3Result.location;
                    let currentReferer = step2Result.location;

                    // 跟随最多5次重定向
                    for (let i = 0; i < 5 && currentRedirect; i++) {
                        console.log(`额外重定向 #${i+1}: ${currentRedirect}`);

                        const redirectResult = await ipc.ipassGet(currentRedirect, {
                            cookies: await this.ipassAccount.vpnCookieJar.getCookies(),
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Referer': currentReferer
                            }
                        });

                        // 保存Cookie
                        if (redirectResult.cookies && redirectResult.cookies.length > 0) {
                            console.log(`保存重定向 #${i+1} Cookie: ${redirectResult.cookies.length}个`);
                            await this.ipassAccount.vpnCookieJar.saveCookies(redirectResult.cookies);
                        }

                        // 更新重定向信息
                        currentReferer = currentRedirect;
                        currentRedirect = redirectResult.location;

                        // 如果是教务系统的首页或没有进一步重定向，退出循环
                        if (!currentRedirect || currentRedirect.includes('jwglxt/xtgl/index_initMenu.html')) {
                            console.log('到达教务系统首页或完成重定向');
                            break;
                        }
                    }
                }
            }

            // 最后一步：验证是否登录成功
            console.log('检查教务系统登录状态');

            // 从EASAccount中获取教务系统VPN的首页URL
            const vpnEasHomeUrl = 'https://webvpn.ujn.edu.cn/http/77726476706e69737468656265737421fae046906925625e300d8db9d6562d/jwglxt/xtgl/index_initMenu.html';

            // 访问教务系统首页验证登录状态
            const verifyResult = await ipc.ipassGet(vpnEasHomeUrl, {
                cookies: await this.ipassAccount.vpnCookieJar.getCookies(),
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://webvpn.ujn.edu.cn'
                }
            });

            // 判断登录是否成功
            const isLoggedIn = verifyResult.success &&
                verifyResult.status === 200 &&
                !verifyResult.data.includes('id="yhm"') &&
                !verifyResult.data.includes('name="yhm"');

            if (isLoggedIn) {
                console.log('教务系统已成功登录（VPN模式）');

                // 重要：设置教务系统登录状态
                this.easLoginStatus.value = true;

                // 确保同步VPN模式到教务系统账号
                this.easAccount.useVpn = true;
                EASAccount.useVpn = true;

                // 保存教务系统VPN设置
                await store.putBoolean('EA_USE_EAS_VPN', true);

                // 同步必要的Cookie - 从智慧济大VPN Cookie到教务系统Cookie
                try {
                    // 复制关键Cookie到教务系统的Cookie jar
                    const vpnCookies = await this.ipassAccount.vpnCookieJar.getCookies();
                    if (vpnCookies && vpnCookies.length > 0) {
                        console.log(`同步 ${vpnCookies.length} 个VPN Cookie到教务系统`);
                        await this.easAccount.cookieJar.saveCookies(vpnCookies);
                    }
                } catch (cookieError) {
                    console.warn('同步Cookie失败，但不影响登录状态', cookieError);
                }

                // 尝试加载学生信息
                try {
                    // 确保在调用fetchStudentInfo之前，教务系统账号已正确设置为VPN模式
                    console.log('准备获取学生信息，VPN模式:', EASAccount.useVpn);

                    const studentInfoResult = await this.easAccount.fetchStudentInfo(username);
                    if (studentInfoResult) {
                        console.log('学生信息获取成功');
                    } else {
                        console.warn('学生信息获取失败，但不影响登录状态');
                    }
                } catch (error) {
                    console.warn('加载学生信息失败，但不影响登录状态', error);
                }

                // 入学年份处理
                if (username && username.length >= 4) {
                    const yearPrefix = username.substring(0, 4);
                    const year = parseInt(yearPrefix, 10);

                    if (!isNaN(year) && year >= 1990 && year <= new Date().getFullYear()) {
                        this.easAccount.entranceTime = year;
                        this.userInfo.entranceYear = year;
                        console.log(`设置入学年份: ${year}`);
                    }
                }

                return true;
            } else {
                console.error('教务系统登录验证失败');
                if (verifyResult.data) {
                    console.debug('验证响应内容片段:', verifyResult.data.substring(0, 200));
                    if (verifyResult.data.includes('id="yhm"') || verifyResult.data.includes('name="yhm"')) {
                        console.error('检测到登录表单，说明未成功登录');
                    }
                }
                return false;
            }
        } catch (error) {
            console.error('通过VPN登录教务系统失败', error);
            return false;
        }
    }

    /**
     * 初始化服务
     * 检查现有登录状态
     */
    async init() {
        try {
            // 加载VPN设置
            try {
                const savedUseVpn = await store.getBoolean('EA_USE_VPN', false)
                this._useVpn = !!savedUseVpn // 使用双感叹号确保是布尔值
                console.log(`从存储加载VPN设置: ${this._useVpn}`)

                // 加载教务系统VPN设置
                const savedUseEasVpn = await store.getBoolean('EA_USE_EAS_VPN', false)
                this._useEasVpn = !!savedUseEasVpn // 使用双感叹号确保是布尔值
                console.log(`从存储加载教务系统VPN设置: ${this._useEasVpn}`)

                // 将VPN设置同步到各账号实例
                this.ipassAccount.useVpn = this._useVpn

                // 同步教务系统VPN设置
                if (this.easAccount) {
                    this.easAccount.useVpn = this._useEasVpn
                }

                // 如果智慧济大不使用VPN，确保教务系统也不使用VPN
                if (!this._useVpn) {
                    this._useEasVpn = false
                    if (this.easAccount) {
                        this.easAccount.useVpn = false
                    }
                    await store.putBoolean('EA_USE_EAS_VPN', false)
                }

            } catch (error) {
                console.error('加载VPN设置失败', error)
                this._useVpn = false
                this._useEasVpn = false

                // 确保账号实例的VPN设置也为false
                this.ipassAccount.useVpn = false
                if (this.easAccount) {
                    this.easAccount.useVpn = false
                }
            }

            // 加载入学年份
            const entranceYear = await store.getInt('ENTRANCE_TIME', 0)
            if (entranceYear > 0) {
                console.log(`初始化: 从存储加载入学年份 ${entranceYear}`)
                this.easAccount.entranceTime = entranceYear
                this.userInfo.entranceYear = entranceYear
            }

            // 检查教务系统登录状态
            const easAccount = await store.getString('EAS_ACCOUNT')
            const easPassword = await store.getString('EAS_PASSWORD')

            if (easAccount && easPassword) {
                this.checkEasLogin()
            }

            // 检查智慧济大登录状态
            const ipassAccount = await store.getString('IPASS_ACCOUNT')
            const ipassPassword = await store.getString('IPASS_PASSWORD')

            if (ipassAccount && ipassPassword) {
                this.checkIpassLogin()
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
            // 从存储加载用户信息
            const savedUserInfo = await store.getObject('userInfo')
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
            // 获取当前存储的用户信息
            const storedUserInfo = await store.getObject('userInfo', {});

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
            await store.putObject('userInfo', simpleUserInfo)

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
            // 从存储中获取用户信息
            const storedInfo = await store.getObject('userInfo', null);
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