// src/utils/jcutVpnUtils.js

/**
 * 荆楚理工学院 WebVPN URL加密工具
 * 
 * 加密算法：
 * 1. 将明文每个字符的ASCII码与KEY对应位置字符的ASCII码相加
 * 2. 将结果用点号连接，开头加点号
 * 3. 将整个字符串进行Base64编码
 * 
 * KEY: "a56b1e0c1f95cc40f0" (18位十六进制字符串，循环使用)
 */

class JcutVpnUtils {
    // 加密密钥
    static KEY = 'a56b1e0c1f95cc40f0';
    
    // WebVPN基础URL
    static WEBVPN_BASE = 'https://sec.jcut.edu.cn/webvpn';
    
    /**
     * 加密明文
     * @param {string} plaintext 明文
     * @returns {string} Base64编码后的密文
     */
    static encrypt(plaintext) {
        if (!plaintext) return '';
        
        const result = [];
        for (let i = 0; i < plaintext.length; i++) {
            const charCode = plaintext.charCodeAt(i);
            const keyChar = this.KEY[i % this.KEY.length];
            const keyCode = keyChar.charCodeAt(0);
            result.push(charCode + keyCode);
        }
        
        // 用点号连接，开头加点号
        const encoded = '.' + result.join('.');
        
        // Base64编码
        return btoa(encoded);
    }
    
    /**
     * 解密Base64编码的密文
     * @param {string} encodedB64 Base64编码的密文
     * @returns {string} 明文
     */
    static decrypt(encodedB64) {
        if (!encodedB64) return '';
        
        try {
            // 补齐Base64填充
            let padded = encodedB64;
            const padding = 4 - (padded.length % 4);
            if (padding !== 4) {
                padded += '='.repeat(padding);
            }
            
            // Base64解码
            const decoded = atob(padded);
            
            // 解析点号分隔的数字
            const nums = decoded.replace(/^\./, '').split('.').map(Number);
            
            // 还原明文
            let result = '';
            for (let i = 0; i < nums.length; i++) {
                const keyChar = this.KEY[i % this.KEY.length];
                const keyCode = keyChar.charCodeAt(0);
                result += String.fromCharCode(nums[i] - keyCode);
            }
            
            return result;
        } catch (e) {
            console.error('解密失败:', e);
            return '';
        }
    }
    
    /**
     * 将原始URL转换为WebVPN URL
     * @param {string} originalUrl 原始URL
     * @returns {string} WebVPN URL
     */
    static urlToWebvpn(originalUrl) {
        if (!originalUrl) return '';
        
        try {
            const url = new URL(originalUrl);
            
            // 加密协议（http/https）
            const encryptedProtocol = this.encrypt(url.protocol.replace(':', ''));
            
            // 加密主机名
            const encryptedHost = this.encrypt(url.host);
            
            // 路径部分不加密
            let path = url.pathname;
            if (path.startsWith('/')) {
                path = path.substring(1);
            }
            
            // 添加查询参数和hash
            if (url.search) {
                path += url.search;
            }
            if (url.hash) {
                path += url.hash;
            }
            
            // 组装WebVPN URL
            return `${this.WEBVPN_BASE}/${encryptedProtocol}/${encryptedHost}/${path}`;
        } catch (e) {
            console.error('URL转换失败:', e);
            return originalUrl;
        }
    }
    
    /**
     * 将WebVPN URL还原为原始URL
     * @param {string} webvpnUrl WebVPN URL
     * @returns {string} 原始URL
     */
    static webvpnToUrl(webvpnUrl) {
        if (!webvpnUrl) return '';
        
        try {
            // 移除WebVPN基础URL
            let path = webvpnUrl.replace(this.WEBVPN_BASE + '/', '');
            
            // 分割路径
            const parts = path.split('/');
            if (parts.length < 2) {
                return webvpnUrl;
            }
            
            // 解密协议和主机
            const protocol = this.decrypt(parts[0]);
            const host = this.decrypt(parts[1]);
            
            // 剩余部分是路径
            const remainingPath = parts.slice(2).join('/');
            
            return `${protocol}://${host}/${remainingPath}`;
        } catch (e) {
            console.error('URL还原失败:', e);
            return webvpnUrl;
        }
    }
    
    /**
     * 获取CAS登录页面URL
     * @param {string} service 服务URL（可选）
     * @returns {string} CAS登录URL
     */
    static getCasLoginUrl(service) {
        const casBaseUrl = 'https://cas.jcut.edu.cn/lyuapServer/login';
        const webvpnCasUrl = this.urlToWebvpn(casBaseUrl);
        
        if (service) {
            const encodedService = encodeURIComponent(service);
            return `${webvpnCasUrl}?service=${encodedService}`;
        }
        
        return webvpnCasUrl;
    }
    
    /**
     * 获取验证码URL
     * @returns {string} 验证码URL
     */
    static getKaptchaUrl() {
        const timestamp = Date.now();
        const kaptchaUrl = `https://cas.jcut.edu.cn/lyuapServer/kaptcha?_t=${timestamp}&uid=`;
        return this.urlToWebvpn(kaptchaUrl);
    }
    
    /**
     * 获取票据API URL
     * @returns {string} 票据URL
     */
    static getTicketUrl() {
        const ticketUrl = 'https://cas.jcut.edu.cn/lyuapServer/v1/tickets';
        return this.urlToWebvpn(ticketUrl);
    }
    
    /**
     * 为URL添加VPN参数
     * @param {string} url URL
     * @param {string} originalHost 原始主机名
     * @returns {string} 添加参数后的URL
     */
    static addVpnParam(url, originalHost) {
        if (!url || !originalHost) return url;
        
        // 将主机名中的点替换为连字符
        const vpnHost = originalHost.replace(/\./g, '-');
        const vpnParam = `vpn-12-${vpnHost}`;
        
        // 检查URL是否已有参数
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}wrdrecordvisit=${vpnParam}`;
    }
    
    /**
     * 预计算的常用URL
     */
    static get URLS() {
        return {
            // CAS登录
            CAS_LOGIN: this.urlToWebvpn('https://cas.jcut.edu.cn/lyuapServer/login'),
            
            // 门户
            PORTAL: this.urlToWebvpn('https://my.jcut.edu.cn/'),
            
            // 教务系统
            EAS_HOME: this.urlToWebvpn('https://jwglxt.jcut.edu.cn/'),
            EAS_LOGIN: this.urlToWebvpn('https://jwglxt.jcut.edu.cn/xtgl/login_slogin.html'),
            
            // 验证码
            KAPTCHA: this.getKaptchaUrl(),
            
            // 票据
            TICKETS: this.getTicketUrl(),
        };
    }
}

export default JcutVpnUtils;
