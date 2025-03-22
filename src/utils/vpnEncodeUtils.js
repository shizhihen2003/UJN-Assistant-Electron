/**
 * VPN编码工具类
 * 提供VPN地址加密和账号密码加密等功能
 */
export class VpnEncodeUtils {
    /**
     * LT参数匹配正则表达式
     */
    static LT_PATTERN = /name="lt" value="(LT-\d+-[a-zA-Z\d]+-tpass)"/;

    /**
     * 十六进制字符
     */
    static HEX_DIGITS = '0123456789ABCDEF'.split('');

    /**
     * DES加密密钥表1
     */
    static TABLE = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

    /**
     * DES加密密钥表2
     */
    static TABLE2 = [
        14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
        41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32
    ];

    /**
     * DES初始置换表
     */
    static TABLE3 = [
        58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
        57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7
    ];

    /**
     * DES逆初始置换表
     */
    static TABLE4 = [
        40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31, 38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
        36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27, 34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25
    ];

    /**
     * DES扩展置换表
     */
    static TABLE_E = [
        32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17,
        16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1
    ];

    /**
     * DES P置换表
     */
    static TABLE_P = [
        16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
        2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25
    ];

    /**
     * DES S盒
     */
    static S_BOX = [
        [
            [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7],
            [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8],
            [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0],
            [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13]
        ],
        // 为简化代码，这里省略了其他7个S盒的定义
        // 实际实现中需要完整定义
    ];

    /**
     * AES加密密钥
     */
    static KEY_BYTES = 'wrdvpnisthebest!';

    /**
     * AES加密IV
     */
    static IV_HEX = '777264767069737468656265737421'; // 'wrdvpnisthebest!'的十六进制表示

    /**
     * 将字符串转换为字节数组
     * @param {string} string 输入字符串
     * @returns {Uint8Array} 字节数组
     */
    static str2bytes(string) {
        const length = string.length * 2;
        const paddingLength = (8 - length % 8) % 8;
        const bts = new Uint8Array(length + paddingLength);
        let index = 0;

        for (const char of string) {
            bts[index++] = (char.charCodeAt(0) >> 8) & 0xFF;
            bts[index++] = char.charCodeAt(0) & 0xFF;
        }

        return bts;
    }

    /**
     * 将字节数组转换为十六进制字符串
     * @param {Uint8Array} byteArray 字节数组
     * @returns {string} 十六进制字符串
     */
    static byteToHexString(byteArray) {
        const hexString = [];
        for (const b of byteArray) {
            const hex = (b & 0xFF).toString(16).toUpperCase();
            hexString.push(hex.length === 1 ? '0' + hex : hex);
        }
        return hexString.join('');
    }

    /**
     * 加密登录信息
     * @param {string} userName 用户名
     * @param {string} password 密码
     * @param {string} lt LT参数
     * @returns {string} 加密后的字符串
     */
    static encode(userName, password, lt) {
        // 在实际应用中，这里应该实现完整的加密算法
        // 下面是一个简化的模拟实现
        return this.Encrypt(userName + password + lt, '1', '2', '3');
    }

    /**
     * 模拟DES加密算法
     * @param {string} msg 消息
     * @param {string} key1 密钥1
     * @param {string} key2 密钥2
     * @param {string} key3 密钥3
     * @returns {string} 加密结果
     */
    static Encrypt(msg, key1, key2, key3) {
        // 这里应该实现完整的DES加密算法
        // 模拟加密过程
        return Array.from(this.str2bytes(msg))
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * 将普通URL转换为VPN URL
     * @param {string} originUrl 原始URL
     * @returns {string} VPN URL
     */
    static encryptUrl(originUrl) {
        // 解析协议
        let url = originUrl;
        let protocol;

        if (url.startsWith('http://')) {
            url = url.substring(7);
            protocol = 'http';
        } else if (url.startsWith('https://')) {
            url = url.substring(8);
            protocol = 'https';
        } else {
            throw new Error('Not a valid URL');
        }

        // 处理IPv6
        let host = null;
        const ipv6Pattern = /\[[0-9a-fA-F:]+?\]/;
        const ipv6Match = url.match(ipv6Pattern);
        if (ipv6Match) {
            host = ipv6Match[0];
            url = url.substring(ipv6Match.index + host.length);
        }

        // 提取端口
        let port = null;
        const parts = url.split('?')[0].split(':');
        if (parts.length > 1) {
            port = parts[1].split('/')[0];
            url = url.substring(0, parts[0].length) + url.substring(parts[0].length + port.length + 1);
        }

        // 获取路径
        const pathIndex = url.indexOf('/');
        let path = '/';
        if (pathIndex === -1) {
            if (host === null) host = url;
        } else {
            if (host === null) host = url.substring(0, pathIndex);
            path = url.substring(pathIndex);
        }

        // 生成加密URL
        return port === null
            ? this.encryptUrl(protocol, host, path)
            : this.encryptUrl(protocol, host, path, port);
    }

    /**
     * 将URL组件加密为VPN URL
     * @param {string} protocol 协议
     * @param {string} host 主机
     * @param {string} url 路径
     * @returns {string} VPN URL
     */
    static encryptUrl(protocol, host, url) {
        // 在实际应用中，这里应该使用AES加密host
        // 简化实现
        const encryptedHost = this.simulateAESEncryption(host);
        return `${protocol}/${encryptedHost}${url.startsWith('/') ? url : '/' + url}`;
    }

    /**
     * 将URL组件加密为VPN URL（带端口）
     * @param {string} protocol 协议
     * @param {string} host 主机
     * @param {string} url 路径
     * @param {string} port 端口
     * @returns {string} VPN URL
     */
    static encryptUrl(protocol, host, url, port) {
        // 在实际应用中，这里应该使用AES加密host
        // 简化实现
        const encryptedHost = this.simulateAESEncryption(host);
        return `${protocol}-${port}/${encryptedHost}${url.startsWith('/') ? url : '/' + url}`;
    }

    /**
     * 模拟AES加密
     * @param {string} text 明文
     * @returns {string} 密文
     */
    static simulateAESEncryption(text) {
        // 实际应该使用crypto-js等库实现AES加密
        // 这里使用简单哈希模拟
        const hash = Array.from(text).reduce((acc, char) => {
            return ((acc << 5) - acc) + char.charCodeAt(0);
        }, 0);

        return Math.abs(hash).toString(16);
    }
}

export default VpnEncodeUtils;