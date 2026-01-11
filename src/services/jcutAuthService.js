// src/services/jcutAuthService.js

/**
 * 荆楚理工学院认证服务
 * 
 * 登录流程：
 * 1. 访问WebVPN门户，建立会话
 * 2. 获取CAS登录页面
 * 3. 获取验证码
 * 4. 用户输入验证码
 * 5. RSA加密密码
 * 6. POST到 /lyuapServer/v1/tickets 获取TGT
 * 7. 用TGT换取ST访问各服务
 */

import JcutVpnUtils from '@/utils/jcutVpnUtils';
import CookieJar from '@/models/CookieJar';
import ipc from '@/utils/ipc';

class JcutAuthService {
    constructor() {
        // Cookie管理器
        this.cookieJar = new CookieJar('https', 'sec.jcut.edu.cn', 'jcut_vpn_cookies');
        
        // TGT票据
        this.tgt = null;
        
        // RSA公钥
        this.rsaPublicKey = null;
        
        // 是否已初始化
        this.initialized = false;
    }
    
    /**
     * 初始化服务
     */
    async init() {
        if (this.initialized) return;
        
        try {
            console.log('[JcutAuth] 初始化认证服务...');
            
            // 清空Cookie
            this.cookieJar.clearCookies();
            
            // 访问WebVPN门户建立会话
            const portalUrl = 'https://sec.jcut.edu.cn/webvpn/';
            const portalResult = await ipc.ipassGet(portalUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                }
            });
            
            if (portalResult.cookies && portalResult.cookies.length > 0) {
                console.log(`[JcutAuth] 获取到 ${portalResult.cookies.length} 个Cookie`);
                await this.cookieJar.saveCookies(portalResult.cookies);
            }
            
            this.initialized = true;
            console.log('[JcutAuth] 初始化完成');
        } catch (error) {
            console.error('[JcutAuth] 初始化失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取验证码
     * @returns {Promise<{uuid: string, imageBase64: string}>}
     */
    async getCaptcha() {
        try {
            const timestamp = Date.now();
            const kaptchaUrl = JcutVpnUtils.addVpnParam(
                `https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjE5Ni4xNTAuMTY5LjE0NC4xNTUuMjAwLjE2NS4yMTUuOTUuMjAzLjE1Ny4xNzAuMTQ1LjE5OC4xNjI=/lyuapServer/kaptcha?_t=${timestamp}&uid=`,
                'cas.jcut.edu.cn'
            );
            
            console.log('[JcutAuth] 获取验证码:', kaptchaUrl);
            
            const cookies = await this.cookieJar.getCookies();
            const result = await ipc.ipassGet(kaptchaUrl, {
                cookies: cookies,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                    'Referer': 'https://sec.jcut.edu.cn/webvpn/',
                }
            });
            
            if (result.success && result.data) {
                // 保存新Cookie
                if (result.cookies && result.cookies.length > 0) {
                    await this.cookieJar.saveCookies(result.cookies);
                }
                
                const data = JSON.parse(result.data);
                console.log('[JcutAuth] 验证码UUID:', data.uuid);
                
                return {
                    uuid: data.uuid,
                    imageBase64: data.content  // data:image/png;base64,...
                };
            }
            
            throw new Error('获取验证码失败');
        } catch (error) {
            console.error('[JcutAuth] 获取验证码失败:', error);
            throw error;
        }
    }
    
    /**
     * 登录
     * @param {string} username 用户名
     * @param {string} password 密码
     * @param {string} captchaUuid 验证码UUID
     * @param {string} captchaCode 验证码
     * @param {string} service 服务URL
     * @returns {Promise<boolean>}
     */
    async login(username, password, captchaUuid, captchaCode, service = 'http://my.jcut.edu.cn/') {
        try {
            console.log('[JcutAuth] 开始登录...');
            console.log('[JcutAuth] 用户名:', username);
            console.log('[JcutAuth] 验证码UUID:', captchaUuid);
            
            // 初始化CAS会话
            await this._initCasSession(service);
            
            // 加密密码
            const encryptedPassword = await this._encryptPassword(password);
            
            // 构建登录请求
            const ticketUrl = JcutVpnUtils.addVpnParam(
                'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjE5Ni4xNTAuMTY5LjE0NC4xNTUuMjAwLjE2NS4yMTUuOTUuMjAzLjE1Ny4xNzAuMTQ1LjE5OC4xNjI=/lyuapServer/v1/tickets',
                'cas.jcut.edu.cn'
            );
            
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', encryptedPassword);
            formData.append('code', captchaCode);
            formData.append('uuid', captchaUuid);
            formData.append('service', service);
            
            console.log('[JcutAuth] 提交登录请求...');
            
            const cookies = await this.cookieJar.getCookies();
            const loginResult = await ipc.ipassPost(ticketUrl, formData.toString(), {
                cookies: cookies,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'Origin': 'https://sec.jcut.edu.cn',
                    'Referer': 'https://sec.jcut.edu.cn/webvpn/',
                }
            });
            
            // 保存Cookie
            if (loginResult.cookies && loginResult.cookies.length > 0) {
                await this.cookieJar.saveCookies(loginResult.cookies);
            }
            
            if (loginResult.success && loginResult.data) {
                try {
                    const data = JSON.parse(loginResult.data);
                    
                    if (data.code === 200 || data.tgt) {
                        // 登录成功
                        this.tgt = data.tgt;
                        console.log('[JcutAuth] 登录成功，TGT:', this.tgt);
                        
                        // 如果有ST票据，访问服务
                        if (data.st) {
                            await this._accessService(service, data.st);
                        }
                        
                        return true;
                    } else {
                        console.error('[JcutAuth] 登录失败:', data.message || data.msg);
                        throw new Error(data.message || data.msg || '登录失败');
                    }
                } catch (e) {
                    if (e.message.includes('登录失败')) throw e;
                    console.error('[JcutAuth] 解析登录响应失败:', e);
                    throw new Error('登录响应解析失败');
                }
            }
            
            throw new Error('登录请求失败');
        } catch (error) {
            console.error('[JcutAuth] 登录失败:', error);
            throw error;
        }
    }
    
    /**
     * 初始化CAS会话
     * @private
     */
    async _initCasSession(service) {
        try {
            const encodedService = encodeURIComponent(service);
            const casLoginUrl = JcutVpnUtils.addVpnParam(
                `https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjE5Ni4xNTAuMTY5LjE0NC4xNTUuMjAwLjE2NS4yMTUuOTUuMjAzLjE1Ny4xNzAuMTQ1LjE5OC4xNjI=/lyuapServer/login?service=${encodedService}`,
                'cas.jcut.edu.cn'
            );
            
            console.log('[JcutAuth] 初始化CAS会话...');
            
            const cookies = await this.cookieJar.getCookies();
            const result = await ipc.ipassGet(casLoginUrl, {
                cookies: cookies,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                }
            });
            
            if (result.cookies && result.cookies.length > 0) {
                await this.cookieJar.saveCookies(result.cookies);
            }
            
            // 尝试提取RSA公钥
            if (result.data && result.data.includes('rsa_n')) {
                const match = result.data.match(/var\s+rsa_n\s*=\s*['"]([^'"]+)['"]/);
                if (match) {
                    this.rsaPublicKey = match[1];
                    console.log('[JcutAuth] 获取到RSA公钥');
                }
            }
            
            console.log('[JcutAuth] CAS会话初始化完成');
        } catch (error) {
            console.error('[JcutAuth] 初始化CAS会话失败:', error);
            throw error;
        }
    }
    
    /**
     * 加密密码
     * @private
     */
    async _encryptPassword(password) {
        // 如果没有RSA公钥，返回明文密码
        if (!this.rsaPublicKey) {
            console.log('[JcutAuth] 没有RSA公钥，使用明文密码');
            return password;
        }
        
        try {
            // 使用JSEncrypt进行RSA加密
            // 注意：需要在项目中安装jsencrypt库
            const { JSEncrypt } = await import('jsencrypt');
            const encrypt = new JSEncrypt();
            encrypt.setPublicKey(this.rsaPublicKey);
            const encrypted = encrypt.encrypt(password);
            
            if (encrypted) {
                console.log('[JcutAuth] 密码RSA加密成功');
                return encrypted;
            }
        } catch (e) {
            console.warn('[JcutAuth] RSA加密失败，使用明文密码:', e);
        }
        
        return password;
    }
    
    /**
     * 使用ST票据访问服务
     * @private
     */
    async _accessService(service, ticket) {
        try {
            const serviceUrl = `${service}${service.includes('?') ? '&' : '?'}ticket=${ticket}`;
            const vpnServiceUrl = JcutVpnUtils.urlToWebvpn(serviceUrl);
            
            console.log('[JcutAuth] 访问服务:', vpnServiceUrl);
            
            const cookies = await this.cookieJar.getCookies();
            const result = await ipc.ipassGet(vpnServiceUrl, {
                cookies: cookies,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                }
            });
            
            if (result.cookies && result.cookies.length > 0) {
                await this.cookieJar.saveCookies(result.cookies);
            }
            
            console.log('[JcutAuth] 服务访问完成');
        } catch (error) {
            console.error('[JcutAuth] 访问服务失败:', error);
        }
    }
    
    /**
     * 获取服务票据
     * @param {string} service 服务URL
     * @returns {Promise<string>} ST票据
     */
    async getServiceTicket(service) {
        if (!this.tgt) {
            throw new Error('未登录，无法获取服务票据');
        }
        
        try {
            const stUrl = JcutVpnUtils.addVpnParam(
                `https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjE5Ni4xNTAuMTY5LjE0NC4xNTUuMjAwLjE2NS4yMTUuOTUuMjAzLjE1Ny4xNzAuMTQ1LjE5OC4xNjI=/lyuapServer/v1/tickets/${this.tgt}`,
                'cas.jcut.edu.cn'
            );
            
            const formData = new URLSearchParams();
            formData.append('service', service);
            
            const cookies = await this.cookieJar.getCookies();
            const result = await ipc.ipassPost(stUrl, formData.toString(), {
                cookies: cookies,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            });
            
            if (result.success && result.data) {
                const data = JSON.parse(result.data);
                if (data.st) {
                    return data.st;
                }
            }
            
            throw new Error('获取服务票据失败');
        } catch (error) {
            console.error('[JcutAuth] 获取服务票据失败:', error);
            throw error;
        }
    }
    
    /**
     * 访问教务系统
     * @returns {Promise<boolean>}
     */
    async accessEas() {
        try {
            console.log('[JcutAuth] 访问教务系统...');
            
            // 获取教务系统的ST
            const easService = 'https://jwglxt.jcut.edu.cn/sso/driotlogin';
            const st = await this.getServiceTicket(easService);
            
            // 使用ST访问教务系统
            await this._accessService(easService, st);
            
            // 验证登录状态
            const easHomeUrl = JcutVpnUtils.urlToWebvpn('https://jwglxt.jcut.edu.cn/xtgl/index_initMenu.html');
            const cookies = await this.cookieJar.getCookies();
            
            const verifyResult = await ipc.ipassGet(easHomeUrl, {
                cookies: cookies,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                }
            });
            
            // 保存Cookie
            if (verifyResult.cookies && verifyResult.cookies.length > 0) {
                await this.cookieJar.saveCookies(verifyResult.cookies);
            }
            
            // 检查是否登录成功
            const isLoggedIn = verifyResult.success && 
                !verifyResult.data.includes('id="yhm"') &&
                !verifyResult.data.includes('name="yhm"');
            
            console.log('[JcutAuth] 教务系统登录状态:', isLoggedIn ? '成功' : '失败');
            
            return isLoggedIn;
        } catch (error) {
            console.error('[JcutAuth] 访问教务系统失败:', error);
            return false;
        }
    }
    
    /**
     * 获取Cookie
     * @returns {Promise<string[]>}
     */
    async getCookies() {
        return await this.cookieJar.getCookies();
    }
    
    /**
     * 登出
     */
    logout() {
        this.tgt = null;
        this.rsaPublicKey = null;
        this.cookieJar.clearCookies();
        this.initialized = false;
        console.log('[JcutAuth] 已登出');
    }
}

export default JcutAuthService;
