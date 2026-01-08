// src/utils/vpnEncodeUtils.js
// 修改版 - 支持从学校配置动态获取VPN加密密钥

import API from '../constants/api';
import CryptoJS from 'crypto-js';

/**
 * WebVPN URL编解码工具类
 * 用于处理WebVPN的URL加解密和登录凭据加密
 * 
 * 修改说明：支持动态获取学校VPN配置
 */
class VpnEncodeUtils {
    /**
     * 十六进制字符表
     */
    static HEX_DIGITS = '0123456789abcdef';

    /**
     * DES 加密表 1 - 循环左移位数
     */
    static TABLE = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

    /**
     * DES 加密表 2 - 密钥压缩置换表
     */
    static TABLE2 = [
        14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
        41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32
    ];

    /**
     * DES 初始置换表
     */
    static TABLE3 = [
        58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
        57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7
    ];

    /**
     * DES 逆初始置换表
     */
    static TABLE4 = [
        40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31, 38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
        36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27, 34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25
    ];

    /**
     * DES 扩展置换表
     */
    static TABLE_E = [
        32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17, 16, 17, 18, 19, 20, 21, 20, 21,
        22, 23, 24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1
    ];

    /**
     * DES P 置换表
     */
    static TABLE_P = [
        16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
        2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25
    ];

    /**
     * DES S 盒
     */
    static S_BOX = [
        [
            [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7],
            [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8],
            [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0],
            [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13]
        ],
        [
            [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10],
            [3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5],
            [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15],
            [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9]
        ],
        [
            [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8],
            [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1],
            [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7],
            [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12]
        ],
        [
            [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15],
            [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9],
            [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4],
            [3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14]
        ],
        [
            [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9],
            [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6],
            [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14],
            [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3]
        ],
        [
            [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11],
            [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8],
            [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6],
            [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13]
        ],
        [
            [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1],
            [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6],
            [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2],
            [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12]
        ],
        [
            [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7],
            [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2],
            [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8],
            [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11]
        ]
    ];

    /**
     * 获取当前学校的VPN加密密钥
     * 动态从学校配置获取，支持多学校
     */
    static get KEY_BYTES() {
        return API.VPN_ENCRYPT_KEY || 'wrdvpnisthebest!';
    }

    /**
     * IV十六进制字符串（动态计算）
     */
    static get IV_HEX() {
        const keyBytes = this.stringToUtf8ByteArray(this.KEY_BYTES);
        return this.byteToHexString(keyBytes);
    }

    /**
     * 获取WebVPN基础URL
     * 动态从学校配置获取
     */
    static get VPN_BASE() {
        const vpnLogin = API.VPN_LOGIN;
        if (!vpnLogin) return '';
        return vpnLogin.endsWith('/') ? vpnLogin.slice(0, -1) : vpnLogin;
    }

    /**
     * 将字符串转换为字节数组（用于DES加密）
     * @param {string} string - 输入字符串
     * @returns {Uint8Array} - 字节数组
     */
    static str2bytes(string) {
        const length = string.length * 2;
        const paddingLength = (8 - length % 8) % 8;
        const bts = new Uint8Array(length + paddingLength);
        let index = 0;

        for (let i = 0; i < string.length; i++) {
            const charCode = string.charCodeAt(i);
            bts[index++] = (charCode >> 8) & 0xFF;
            bts[index++] = charCode & 0xFF;
        }

        return bts;
    }

    /**
     * 将字节数组转换为十六进制字符串
     * @param {Uint8Array} byteArray - 字节数组
     * @returns {string} - 十六进制字符串
     */
    static byteToHexString(byteArray) {
        const hexChars = [];
        for (let i = 0; i < byteArray.length; i++) {
            const value = byteArray[i] & 0xFF;
            hexChars.push(this.HEX_DIGITS[value >>> 4]);
            hexChars.push(this.HEX_DIGITS[value & 0x0F]);
        }
        return hexChars.join('');
    }

    /**
     * 将十六进制字符串转换为字节数组
     * @param {string} hexString - 十六进制字符串
     * @returns {Uint8Array} - 字节数组
     */
    static hexStringToByteArray(hexString) {
        if (!hexString || hexString.length % 2 !== 0) {
            return new Uint8Array(0);
        }

        const byteArray = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < hexString.length; i += 2) {
            byteArray[i/2] = parseInt(hexString.substr(i, 2), 16);
        }
        return byteArray;
    }

    /**
     * 将字符串转换为UTF8字节数组
     * @param {string} str - 输入字符串
     * @returns {Uint8Array} - UTF8字节数组
     */
    static stringToUtf8ByteArray(str) {
        if (typeof TextEncoder !== 'undefined') {
            return new TextEncoder().encode(str);
        }

        // 兼容旧版浏览器
        const utf8 = [];
        for (let i = 0; i < str.length; i++) {
            let charCode = str.charCodeAt(i);
            if (charCode < 0x80) {
                utf8.push(charCode);
            } else if (charCode < 0x800) {
                utf8.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
            } else if (charCode < 0xd800 || charCode >= 0xe000) {
                utf8.push(0xe0 | (charCode >> 12), 0x80 | ((charCode >> 6) & 0x3f), 0x80 | (charCode & 0x3f));
            } else {
                i++;
                charCode = 0x10000 + (((charCode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
                utf8.push(
                    0xf0 | (charCode >> 18),
                    0x80 | ((charCode >> 12) & 0x3f),
                    0x80 | ((charCode >> 6) & 0x3f),
                    0x80 | (charCode & 0x3f)
                );
            }
        }
        return new Uint8Array(utf8);
    }

    // ==================== DES 加密相关方法 ====================

    /**
     * 将字节数组转换为长整数
     * @param {Uint8Array} bytes - 字节数组
     * @returns {BigInt} - 长整数值
     */
    static byte2long(bytes) {
        let result = BigInt(0);
        for (let i = 0; i < bytes.length; i++) {
            result = (result << BigInt(8)) | BigInt(bytes[i] & 0xFF);
        }
        return result;
    }

    /**
     * 将长整数转换为字节数组
     * @param {BigInt} value - 长整数值
     * @returns {Uint8Array} - 字节数组
     */
    static long2byte(value) {
        const result = new Uint8Array(8);
        for (let i = 0; i < 8; i++) {
            result[i] = Number((value >> BigInt((7 - i) * 8)) & BigInt(0xFF));
        }
        return result;
    }

    /**
     * 将56位密钥转换为DES格式
     * @param {BigInt} k - 56位密钥
     * @returns {BigInt} - DES格式密钥
     */
    static KeyTo56(k) {
        const keyByte = new Array(64).fill(0);
        for (let x = 63; x >= 0; x--) {
            keyByte[63 - x] = Number((k >> BigInt(x)) & BigInt(1));
        }

        const key = new Array(56).fill(0);
        for (let i = 0; i <= 6; i++) {
            for (let j = 0; j <= 7; j++) {
                const kIndex = 7 - j;
                key[i * 8 + j] = keyByte[8 * kIndex + i];
            }
        }

        let keyInt = BigInt(0);
        for (const b of key) {
            keyInt = (keyInt << BigInt(1)) | BigInt(b);
        }

        return keyInt;
    }

    /**
     * DES F函数
     * @param {BigInt} r - 右半部分数据
     * @param {BigInt} k - 子密钥
     * @returns {BigInt} - F函数结果
     */
    static F(r, k) {
        // 扩展置换
        let r2 = BigInt(0);
        for (let i = 0; i <= 47; i++) {
            const bitPos = 32 - this.TABLE_E[i];
            const bit = (r >> BigInt(bitPos)) & BigInt(1);
            r2 |= bit << BigInt(47 - i);
        }

        // 与子密钥异或
        const r3 = r2 ^ k;

        // S盒变换
        let r4 = BigInt(0);
        for (let i = 0; i <= 7; i++) {
            const s = Number((r3 >> BigInt((7 - i) * 6)) & BigInt(0x3F));
            const x = ((s & 0x20) >> 4) | (s & 0x01);
            const y = (s >> 1) & 0x0F;

            const sBoxValue = this.S_BOX[i][x][y];
            r4 |= BigInt(sBoxValue) << BigInt((7 - i) * 4);
        }

        // P置换
        let r5 = BigInt(0);
        for (let i = 0; i <= 31; i++) {
            const bitPos = 32 - this.TABLE_P[i];
            const bit = (r4 >> BigInt(bitPos)) & BigInt(1);
            r5 |= bit << BigInt(31 - i);
        }

        return r5;
    }

    /**
     * DES加密单个块
     * @param {Uint8Array} msg - 消息
     * @param {Uint8Array} key - 密钥
     * @returns {Uint8Array} - 加密结果
     */
    static enc(msg, key) {
        const keyLong = this.KeyTo56(this.byte2long(key));
        let c = keyLong >> BigInt(28);
        let d = keyLong & BigInt(0xFFFFFFF);

        const kList = Array(16).fill(BigInt(0));

        // 生成子密钥
        for (let i = 0; i <= 15; i++) {
            // 循环左移
            const shift = this.TABLE[i];
            c = ((c << BigInt(shift)) | (c >> BigInt(28 - shift))) & BigInt(0xFFFFFFF);
            d = ((d << BigInt(shift)) | (d >> BigInt(28 - shift))) & BigInt(0xFFFFFFF);

            const t = (c << BigInt(28)) | d;

            // 密钥压缩置换
            for (let j = 0; j <= 47; j++) {
                const bitPos = 56 - this.TABLE2[j];
                const bit = (t >> BigInt(bitPos)) & BigInt(1);
                kList[i] |= bit << BigInt(47 - j);
            }
        }

        // 初始置换
        const msgBig = this.byte2long(msg);
        let n = BigInt(0);

        for (let i = 0; i <= 63; i++) {
            const bitPos = 64 - this.TABLE3[i];
            const bit = (msgBig >> BigInt(bitPos)) & BigInt(1);
            n |= bit << BigInt(63 - i);
        }

        // 分割左右两部分
        let l = n >> BigInt(32);
        let r = n & BigInt(0xFFFFFFFF);

        // 16轮Feistel网络
        for (let j = 0; j <= 15; j++) {
            const tmp = l ^ this.F(r, kList[j]);
            l = r;
            r = tmp;
        }

        // 合并
        const tmp = (r << BigInt(32)) | l;
        let res = BigInt(0);

        // 逆初始置换
        for (let i = 0; i <= 63; i++) {
            const bitPos = 64 - this.TABLE4[i];
            const bit = (tmp >> BigInt(bitPos)) & BigInt(1);
            res |= bit << BigInt(63 - i);
        }

        return this.long2byte(res);
    }

    /**
     * 三重DES加密
     * @param {string} msg - 消息
     * @param {string} key1 - 密钥1
     * @param {string} key2 - 密钥2
     * @param {string} key3 - 密钥3
     * @returns {string} - 加密结果的十六进制字符串
     */
    static Encrypt(msg, key1, key2, key3) {
        const msgByte = this.str2bytes(msg);
        const key1Byte = this.str2bytes(key1);
        const key2Byte = this.str2bytes(key2);
        const key3Byte = this.str2bytes(key3);

        const sb = [];
        let m = 0;

        while (m < msgByte.length) {
            let tmpMsg = new Uint8Array(8);
            for (let i = 0; i < Math.min(8, msgByte.length - m); i++) {
                tmpMsg[i] = msgByte[m + i];
            }

            // 使用密钥1加密
            let k = 0;
            while (k < key1Byte.length) {
                const tmpKey = new Uint8Array(8);
                for (let i = 0; i < Math.min(8, key1Byte.length - k); i++) {
                    tmpKey[i] = key1Byte[k + i];
                }
                tmpMsg = this.enc(tmpMsg, tmpKey);
                k += 8;
            }

            // 使用密钥2加密
            k = 0;
            while (k < key2Byte.length) {
                const tmpKey = new Uint8Array(8);
                for (let i = 0; i < Math.min(8, key2Byte.length - k); i++) {
                    tmpKey[i] = key2Byte[k + i];
                }
                tmpMsg = this.enc(tmpMsg, tmpKey);
                k += 8;
            }

            // 使用密钥3加密
            k = 0;
            while (k < key3Byte.length) {
                const tmpKey = new Uint8Array(8);
                for (let i = 0; i < Math.min(8, key3Byte.length - k); i++) {
                    tmpKey[i] = key3Byte[k + i];
                }
                tmpMsg = this.enc(tmpMsg, tmpKey);
                k += 8;
            }

            // 转换为十六进制字符串
            for (let i = 0; i < tmpMsg.length; i++) {
                const hex = tmpMsg[i].toString(16).toUpperCase();
                sb.push(hex.length === 1 ? '0' + hex : hex);
            }

            m += 8;
        }

        return sb.join('');
    }

    /**
     * 加密登录凭据（用户名+密码+lt）
     * @param {string} userName - 用户名
     * @param {string} password - 密码
     * @param {string} lt - LT参数
     * @returns {string} - 加密后的字符串
     */
    static encode(userName, password, lt) {
        return this.Encrypt(userName + password + lt, "1", "2", "3");
    }

    // ==================== AES 加密相关方法（URL加密） ====================

    /**
     * AES加密（用于URL主机名加密）
     * @param {string} text - 待加密文本
     * @returns {string} - 加密后的十六进制字符串
     */
    static encrypt(text) {
        try {
            const key = CryptoJS.enc.Utf8.parse(this.KEY_BYTES);
            const iv = CryptoJS.enc.Utf8.parse(this.KEY_BYTES);
            
            const encrypted = CryptoJS.AES.encrypt(text, key, {
                iv: iv,
                mode: CryptoJS.mode.CFB,
                padding: CryptoJS.pad.NoPadding
            });
            
            // 返回IV + 密文的十六进制字符串
            return this.IV_HEX + encrypted.ciphertext.toString();
        } catch (error) {
            console.error('VPN URL加密失败:', error);
            return '';
        }
    }

    /**
     * 加密URL
     * @param {string} url - 原始URL
     * @returns {string} - VPN加密后的完整URL
     */
    static encryptUrl(url) {
        try {
            // 解析URL
            const urlObj = new URL(url);
            const protocol = urlObj.protocol.replace(':', '');
            const host = urlObj.host;
            const port = urlObj.port || (protocol === 'https' ? '443' : '80');
            const path = urlObj.pathname + urlObj.search + urlObj.hash;

            // 加密主机部分
            const encryptedHost = this.encrypt(host);
            
            // 构建VPN URL
            let vpnPath = `/${protocol}`;
            
            // 非标准端口需要添加端口信息
            if ((protocol === 'http' && port !== '80') || 
                (protocol === 'https' && port !== '443')) {
                vpnPath += `-${port}`;
            }
            
            vpnPath += `/${encryptedHost}${path}`;
            
            return `${this.VPN_BASE}${vpnPath}`;
        } catch (error) {
            console.error('加密URL失败:', error);
            return url;
        }
    }

    /**
     * 解密URL（从VPN URL还原原始URL）
     * @param {string} vpnUrl - VPN加密的URL
     * @returns {string} - 原始URL
     */
    static decryptUrl(vpnUrl) {
        try {
            // 解析VPN URL结构
            const urlObj = new URL(vpnUrl);
            const pathParts = urlObj.pathname.split('/').filter(p => p);
            
            if (pathParts.length < 2) {
                return vpnUrl;
            }

            // 解析协议和端口
            const protocolPart = pathParts[0];
            const [protocol, port] = protocolPart.includes('-') 
                ? protocolPart.split('-') 
                : [protocolPart, protocolPart === 'https' ? '443' : '80'];

            // 获取加密的主机部分
            const encryptedHost = pathParts[1];
            
            // 解密主机
            const host = this.decrypt(encryptedHost);
            if (!host) {
                return vpnUrl;
            }

            // 重建原始URL
            const remainingPath = '/' + pathParts.slice(2).join('/');
            const originalUrl = `${protocol}://${host}${port !== '80' && port !== '443' ? ':' + port : ''}${remainingPath}${urlObj.search}${urlObj.hash}`;
            
            return originalUrl;
        } catch (error) {
            console.error('解密URL失败:', error);
            return vpnUrl;
        }
    }

    /**
     * AES解密
     * @param {string} encryptedHex - 加密的十六进制字符串（包含IV）
     * @returns {string} - 解密后的文本
     */
    static decrypt(encryptedHex) {
        try {
            // 分离IV和密文
            const ivHex = encryptedHex.substring(0, 32);
            const ciphertextHex = encryptedHex.substring(32);
            
            const key = CryptoJS.enc.Utf8.parse(this.KEY_BYTES);
            const iv = CryptoJS.enc.Hex.parse(ivHex);
            const ciphertext = CryptoJS.enc.Hex.parse(ciphertextHex);
            
            const decrypted = CryptoJS.AES.decrypt(
                { ciphertext: ciphertext },
                key,
                {
                    iv: iv,
                    mode: CryptoJS.mode.CFB,
                    padding: CryptoJS.pad.NoPadding
                }
            );
            
            return decrypted.toString(CryptoJS.enc.Utf8);
        } catch (error) {
            console.error('VPN URL解密失败:', error);
            return '';
        }
    }

    /**
     * 检查URL是否为VPN加密URL
     * @param {string} url - URL字符串
     * @returns {boolean}
     */
    static isVpnUrl(url) {
        try {
            const vpnHost = API.VPN_HOST;
            return url.startsWith(this.VPN_BASE) || (vpnHost && url.includes(vpnHost));
        } catch {
            return false;
        }
    }
}

export default VpnEncodeUtils;
