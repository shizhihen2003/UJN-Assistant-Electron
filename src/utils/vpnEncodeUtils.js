/**
 * VpnEncodeUtils类
 * 提供VPN地址加密和账号密码加密等功能
 */
import { UJNAPI } from '../constants/api';

export class VpnEncodeUtils {
    /**
     * LT 参数匹配正则表达式
     */
    static LT_PATTERN = /name="lt" value="(LT-\d+-[a-zA-Z\d]+-tpass)"/;

    /**
     * 十六进制字符
     */
    static HEX_DIGITS = "0123456789ABCDEF".split('');

    /**
     * DES 加密表 1
     */
    static TABLE = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

    /**
     * DES 加密表 2
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

    // AES加密密钥
    static KEY_BYTES = 'wrdvpnisthebest!';
    static IV_HEX = null;
    static cipher = null;

    /**
     * WebVPN基础URL
     */
    static VPN_BASE = UJNAPI.VPN_LOGIN.endsWith('/')
        ? UJNAPI.VPN_LOGIN.slice(0, -1)
        : UJNAPI.VPN_LOGIN;

    /**
     * 初始化
     */
    static initialize() {
        try {
            const keyBytes = this.stringToUtf8ByteArray(this.KEY_BYTES);
            this.IV_HEX = this.byteToHexString(keyBytes);
        } catch (e) {
            console.error("初始化失败", e);
        }
    }

    /**
     * 将字符串转换为字节数组
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

        // 降级实现
        const utf8 = [];
        for (let i = 0; i < str.length; i++) {
            let charcode = str.charCodeAt(i);

            if (charcode < 0x80) {
                utf8.push(charcode);
            } else if (charcode < 0x800) {
                utf8.push(
                    0xC0 | (charcode >> 6),
                    0x80 | (charcode & 0x3F)
                );
            } else if (charcode < 0xD800 || charcode >= 0xE000) {
                utf8.push(
                    0xE0 | (charcode >> 12),
                    0x80 | ((charcode >> 6) & 0x3F),
                    0x80 | (charcode & 0x3F)
                );
            } else {
                // 处理UTF-16代理对
                i++;
                charcode = 0x10000 + (((charcode & 0x3FF) << 10) | (str.charCodeAt(i) & 0x3FF));
                utf8.push(
                    0xF0 | (charcode >> 18),
                    0x80 | ((charcode >> 12) & 0x3F),
                    0x80 | ((charcode >> 6) & 0x3F),
                    0x80 | (charcode & 0x3F)
                );
            }
        }

        return new Uint8Array(utf8);
    }

    /**
     * 将UTF8字节数组转换为字符串
     * @param {Uint8Array} utf8ByteArray - UTF8字节数组
     * @returns {string} - 字符串
     */
    static utf8ByteArrayToString(utf8ByteArray) {
        if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder().decode(utf8ByteArray);
        }

        // 降级实现
        let str = '';
        let i = 0;

        while (i < utf8ByteArray.length) {
            let c = utf8ByteArray[i++];

            if (c < 128) {
                str += String.fromCharCode(c);
            } else if (c > 191 && c < 224) {
                const c2 = utf8ByteArray[i++];
                str += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
            } else if (c > 239 && c < 365) {
                // 四字节字符
                const c2 = utf8ByteArray[i++];
                const c3 = utf8ByteArray[i++];
                const c4 = utf8ByteArray[i++];
                const u = ((c & 7) << 18) | ((c2 & 63) << 12) | ((c3 & 63) << 6) | (c4 & 63);
                str += String.fromCharCode(0xD800 + (u >> 10), 0xDC00 + (u & 1023));
            } else {
                const c2 = utf8ByteArray[i++];
                const c3 = utf8ByteArray[i++];
                str += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
            }
        }

        return str;
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
            // 使用自定义arraycopy方法而不是System.arraycopy
            for (let i = 0; i < Math.min(8, msgByte.length - m); i++) {
                tmpMsg[i] = msgByte[m + i];
            }

            // 使用密钥1加密
            let k = 0;
            while (k < key1Byte.length) {
                const tmpKey = new Uint8Array(8);
                // 同样使用自定义方法
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

            // 将结果转换为十六进制字符串
            const hexChars = new Array(16);
            for (let i = 0; i <= 7; i++) {
                const value = tmpMsg[i] & 0xFF;
                hexChars[i * 2] = this.HEX_DIGITS[value >>> 4];
                hexChars[i * 2 + 1] = this.HEX_DIGITS[value & 0x0F];
            }
            sb.push(hexChars.join(''));
            m += 8;
        }

        return sb.join('');
    }

    /**
     * AES-CFB加密
     * @param {Uint8Array} data - 要加密的数据
     * @param {Uint8Array} key - 密钥
     * @param {Uint8Array} iv - 初始化向量
     * @returns {Uint8Array} - 加密结果
     */
    static aesCfbEncrypt(data, key, iv) {
        const blockSize = 16;
        const encrypted = new Uint8Array(data.length);
        let feedbackBlock = new Uint8Array(iv);

        for (let i = 0; i < data.length; i += blockSize) {
            // AES加密反馈块
            const encryptedBlock = this.aesEncryptBlock(feedbackBlock, key);

            // 计算这个块的大小
            const currentBlockSize = Math.min(blockSize, data.length - i);

            // 与明文XOR
            for (let j = 0; j < currentBlockSize; j++) {
                encrypted[i + j] = data[i + j] ^ encryptedBlock[j];
            }

            // 更新反馈块
            if (currentBlockSize === blockSize) {
                feedbackBlock = encrypted.slice(i, i + blockSize);
            } else {
                const newBlock = new Uint8Array(blockSize);
                newBlock.set(encrypted.slice(i, i + currentBlockSize));
                feedbackBlock = newBlock;
            }
        }

        return encrypted;
    }

    /**
     * AES块加密
     * @param {Uint8Array} block - 16字节数据块
     * @param {Uint8Array} key - 密钥
     * @returns {Uint8Array} - 加密结果
     */
    static aesEncryptBlock(block, key) {
        // JavaScript中没有内置的AES块加密实现
        // 这里实现一个与Python的cryptography库兼容的AES加密

        // 根据AES规范，我们需要实现:
        // 1. SubBytes: 使用S-box替换
        // 2. ShiftRows: 行位移
        // 3. MixColumns: 列混合
        // 4. AddRoundKey: 轮密钥加

        // 完整实现一个AES算法超出本文件的范围
        // 下面是一个与Python cryptography库兼容的简化实现

        // 在生产环境中，应使用Web Crypto API或其他标准库
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            try {
                // 注意：这是异步API，实际使用时需要处理Promise
                // 这里我们提供一个同步兼容的实现
                return this._aesEncryptBlockCompat(block, key);
            } catch (e) {
                return this._aesEncryptBlockCompat(block, key);
            }
        } else {
            return this._aesEncryptBlockCompat(block, key);
        }
    }

    /**
     * 兼容实现的AES块加密
     * @param {Uint8Array} block - 16字节数据块
     * @param {Uint8Array} key - 密钥
     * @returns {Uint8Array} - 加密结果
     */
    static _aesEncryptBlockCompat(block, key) {
        // 兼容Python的cryptography库的AES实现
        // 这是一个模拟实现，但与原始库生成兼容的结果

        // S-box
        const SBOX = [
            0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
            0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
            0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
            0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
            0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
            0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
            0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
            0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
            0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
            0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
            0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
            0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
            0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
            0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
            0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
            0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
        ];

        // 由于JavaScript没有像Python的cryptography库那样的标准AES实现
        // 我们这里实现一个与Python的cryptography库兼容的简化版本
        // 这个简化版本足以生成与Python代码兼容的结果

        const result = new Uint8Array(16);

        // 初始状态
        for (let i = 0; i < 16; i++) {
            result[i] = block[i];
        }

        // 密钥扩展
        const expandedKey = new Uint8Array(176); // 11 * 16
        if (key.length === 16) { // 128位密钥
            for (let i = 0; i < 16; i++) {
                expandedKey[i] = key[i];
            }

            // 生成扩展密钥
            for (let i = 1; i < 11; i++) {
                let temp = expandedKey.slice((i - 1) * 16 + 12, (i - 1) * 16 + 16);

                // 字循环
                const t = temp[0];
                temp[0] = temp[1];
                temp[1] = temp[2];
                temp[2] = temp[3];
                temp[3] = t;

                // S盒替换
                for (let j = 0; j < 4; j++) {
                    temp[j] = SBOX[temp[j]];
                }

                // 与轮常量XOR
                const rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1B, 0x36];
                temp[0] ^= rcon[i - 1];

                // 生成密钥
                for (let j = 0; j < 4; j++) {
                    for (let k = 0; k < 4; k++) {
                        expandedKey[i * 16 + j * 4 + k] = expandedKey[(i - 1) * 16 + j * 4 + k] ^
                            (j === 0 ? temp[k] : expandedKey[i * 16 + (j - 1) * 4 + k]);
                    }
                }
            }
        } else {
            // 对于不是16字节的密钥，使用简化的方法
            // 在实际场景中，应该使用标准密钥扩展算法
            for (let i = 0; i < 176; i++) {
                expandedKey[i] = key[i % key.length];
            }
        }

        // 轮密钥加
        for (let i = 0; i < 16; i++) {
            result[i] ^= expandedKey[i];
        }

        // 主循环
        for (let round = 1; round < 10; round++) {
            // 字节替换
            for (let i = 0; i < 16; i++) {
                result[i] = SBOX[result[i]];
            }

            // 行位移
            const temp = result.slice();
            result[1] = temp[5];
            result[5] = temp[9];
            result[9] = temp[13];
            result[13] = temp[1];

            result[2] = temp[10];
            result[6] = temp[14];
            result[10] = temp[2];
            result[14] = temp[6];

            result[3] = temp[15];
            result[7] = temp[3];
            result[11] = temp[7];
            result[15] = temp[11];

            // 列混合
            for (let i = 0; i < 4; i++) {
                const a = result[i * 4];
                const b = result[i * 4 + 1];
                const c = result[i * 4 + 2];
                const d = result[i * 4 + 3];

                // GF(2^8)乘法
                function gmul(a, b) {
                    let p = 0;
                    for (let i = 0; i < 8; i++) {
                        if ((b & 1) !== 0) {
                            p ^= a;
                        }
                        const hiBit = a & 0x80;
                        a <<= 1;
                        if (hiBit !== 0) {
                            a ^= 0x1B; // 用于GF(2^8)的多项式
                        }
                        b >>= 1;
                    }
                    return p & 0xFF;
                }

                result[i * 4] = gmul(a, 2) ^ gmul(b, 3) ^ c ^ d;
                result[i * 4 + 1] = a ^ gmul(b, 2) ^ gmul(c, 3) ^ d;
                result[i * 4 + 2] = a ^ b ^ gmul(c, 2) ^ gmul(d, 3);
                result[i * 4 + 3] = gmul(a, 3) ^ b ^ c ^ gmul(d, 2);
            }

            // 轮密钥加
            for (let i = 0; i < 16; i++) {
                result[i] ^= expandedKey[round * 16 + i];
            }
        }

        // 最后一轮
        // 字节替换
        for (let i = 0; i < 16; i++) {
            result[i] = SBOX[result[i]];
        }

        // 行位移
        const temp = result.slice();
        result[1] = temp[5];
        result[5] = temp[9];
        result[9] = temp[13];
        result[13] = temp[1];

        result[2] = temp[10];
        result[6] = temp[14];
        result[10] = temp[2];
        result[14] = temp[6];

        result[3] = temp[15];
        result[7] = temp[3];
        result[11] = temp[7];
        result[15] = temp[11];

        // 轮密钥加
        for (let i = 0; i < 16; i++) {
            result[i] ^= expandedKey[10 * 16 + i];
        }

        return result;
    }

    /**
     * 兼容Python的System.arraycopy
     * 这个实现更简单，直接使用循环复制
     * @param {Uint8Array} src - 源数组
     * @param {number} srcPos - 源数组起始位置
     * @param {Uint8Array} dest - 目标数组
     * @param {number} destPos - 目标数组起始位置
     * @param {number} length - 复制长度
     */
    static arraycopy(src, srcPos, dest, destPos, length) {
        for (let i = 0; i < length; i++) {
            if (srcPos + i < src.length) {
                dest[destPos + i] = src[srcPos + i];
            }
        }
    }

    /**
     * 使用AES-CFB加密主机名并添加IV
     * @param {string} text - 待加密的主机名
     * @returns {string} - 加密结果（IV + 加密后的数据）
     */
    static encrypt(text) {
        if (!this.IV_HEX) this.initialize();

        try {
            const textBytes = this.stringToUtf8ByteArray(text);
            const keyBytes = this.stringToUtf8ByteArray(this.KEY_BYTES);

            // 使用AES-CFB模式加密
            const encrypted = this.aesCfbEncrypt(textBytes, keyBytes, keyBytes);

            // 返回 IV + 加密后的数据
            return this.IV_HEX + this.byteToHexString(encrypted);
        } catch (e) {
            console.error("加密失败", e);
            return this.IV_HEX;
        }
    }

    /**
     * 将普通URL转换为WebVPN URL
     * @param {string} originUrl - 原始URL
     * @returns {string} - WebVPN URL
     */
    static encryptUrl(originUrl) {
        let url = originUrl;
        let protocol;

        // 解析协议
        if (url.startsWith("http://")) {
            url = url.substring(7);
            protocol = "http";
        } else if (url.startsWith("https://")) {
            url = url.substring(8);
            protocol = "https";
        } else {
            throw new Error("Not a valid URL");
        }

        // 处理IPv6地址
        let host = null;
        const ipv6Pattern = /\[[0-9a-fA-F:]+?\]/;
        const ipv6Match = url.match(ipv6Pattern);

        if (ipv6Match) {
            host = ipv6Match[0];
            url = url.substring(ipv6Match.index + ipv6Match[0].length);
        }

        // 提取端口号
        let port = null;
        const parts = url.split("?")[0].split(":");

        if (parts.length > 1) {
            const portAndPath = parts[1].split("/");
            port = portAndPath[0];
            url = parts[0] + url.substring(parts[0].length + port.length + 1);
        }

        // 分离主机名和路径
        const pathIndex = url.indexOf("/");
        let path = "/";

        if (pathIndex === -1) {
            if (host === null) host = url;
        } else {
            if (host === null) host = url.substring(0, pathIndex);
            path = url.substring(pathIndex);
        }

        // 根据是否有端口号调用不同的方法
        return port === null
            ? this.encryptUrlParts(protocol, host, path)
            : this.encryptUrlWithPort(protocol, host, path, port);
    }

    /**
     * 加密URL各部分并组合
     * @param {string} protocol - 协议
     * @param {string} host - 主机名
     * @param {string} url - URL路径
     * @returns {string} - 加密后的URL
     */
    static encryptUrlParts(protocol, host, url) {
        return this.VPN_BASE + "/" + protocol + "/" + this.encrypt(host) + (url.startsWith("/") ? url : "/" + url);
    }

    /**
     * 加密带端口的URL各部分并组合
     * @param {string} protocol - 协议
     * @param {string} host - 主机名
     * @param {string} url - URL路径
     * @param {string} port - 端口号
     * @returns {string} - 加密后的URL
     */
    static encryptUrlWithPort(protocol, host, url, port) {
        return this.VPN_BASE + "/" + protocol + "-" + port + "/" + this.encrypt(host) + (url.startsWith("/") ? url : "/" + url);
    }

    /**
     * 加密登录凭据
     * @param {string} userName - 用户名
     * @param {string} password - 密码
     * @param {string} lt - LT参数
     * @returns {string} - 加密后的字符串
     */
    static encode(userName, password, lt) {
        return this.Encrypt(userName + password + lt, "1", "2", "3");
    }
}

// 初始化
VpnEncodeUtils.initialize();

export default VpnEncodeUtils;