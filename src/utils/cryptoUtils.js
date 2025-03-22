// src/utils/cryptoUtils.js
import JSEncrypt from 'jsencrypt'
import CryptoJS from 'crypto-js'

/**
 * 加密工具类
 */
export default {
    /**
     * RSA加密
     * @param {string} text 明文
     * @param {string} publicKey 公钥
     * @returns {string} 加密结果
     */
    rsaEncrypt(text, publicKey) {
        try {
            const encryptor = new JSEncrypt()
            encryptor.setPublicKey(publicKey)
            return encryptor.encrypt(text)
        } catch (error) {
            console.error('RSA加密失败:', error)
            return null
        }
    },

    /**
     * 教务系统密码加密
     * @param {string} password 密码
     * @param {string} modulus 模数
     * @param {string} exponent 指数（默认为65537）
     * @returns {string} 加密结果
     */
    encryptPassword(password, modulus, exponent = "10001") {
        try {
            console.log('开始RSA加密，使用动态获取的公钥')

            if (!modulus) {
                throw new Error('公钥模数为空')
            }

            // 从Base64解码modulus
            const modulusData = this.base64ToArrayBuffer(modulus)

            // 将解码后的数据转换为十六进制字符串
            let hexModulus = ''
            for (let i = 0; i < modulusData.length; i++) {
                const hex = (modulusData[i] & 0xFF).toString(16)
                hexModulus += hex.length === 1 ? '0' + hex : hex
            }

            // 创建RSA密钥对象
            const key = new window.BigInteger(hexModulus, 16)
            const exp = new window.BigInteger(exponent, 16)

            // 由于JSEncrypt不直接支持使用模数和指数，我们需要扩展它
            const encrypt = new JSEncrypt()
            const rsa = encrypt.getKey()

            // 设置公钥模数和指数
            rsa.setPublic(key.toString(16), exp.toString(16))

            // 加密
            const encrypted = rsa.encrypt(password)

            console.log('RSA加密成功')
            return encrypted
        } catch (error) {
            console.error('教务系统密码加密失败:', error, {
                modulusLength: modulus?.length,
                exponent
            })
            return null
        }
    },

    /**
     * Base64解码为ArrayBuffer
     * @param {string} base64 Base64字符串
     * @returns {Uint8Array} 字节数组
     */
    base64ToArrayBuffer(base64) {
        try {
            const binary_string = window.atob(base64)
            const len = binary_string.length
            const bytes = new Uint8Array(len)
            for (let i = 0; i < len; i++) {
                bytes[i] = binary_string.charCodeAt(i)
            }
            return bytes
        } catch (error) {
            console.error('Base64解码失败:', error)
            throw error
        }
    },

    /**
     * AES加密
     * @param {string} text 明文
     * @param {string} key 密钥
     * @param {string} iv 初始向量
     * @returns {string} 加密结果（十六进制字符串）
     */
    aesEncrypt(text, key, iv) {
        try {
            // 将密钥和初始向量转换为字节数组
            const keyBytes = CryptoJS.enc.Utf8.parse(key)
            const ivBytes = CryptoJS.enc.Utf8.parse(iv || key)

            // 加密
            const encrypted = CryptoJS.AES.encrypt(text, keyBytes, {
                iv: ivBytes,
                mode: CryptoJS.mode.CFB,
                padding: CryptoJS.pad.NoPadding
            })

            return encrypted.ciphertext.toString(CryptoJS.enc.Hex)
        } catch (error) {
            console.error('AES加密失败:', error)
            return null
        }
    },

    /**
     * 字节数组转十六进制字符串
     * @param {Uint8Array} byteArray 字节数组
     * @returns {string} 十六进制字符串
     */
    byteToHexString(byteArray) {
        return Array.from(byteArray)
            .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
            .join('')
    },

    /**
     * 十六进制字符串转字节数组
     * @param {string} hexString 十六进制字符串
     * @returns {Uint8Array} 字节数组
     */
    hexStringToByte(hexString) {
        // 确保长度为偶数
        const validHexString = hexString.length % 2 ? '0' + hexString : hexString

        const bytes = new Uint8Array(validHexString.length / 2)
        for (let i = 0; i < validHexString.length; i += 2) {
            bytes[i / 2] = parseInt(validHexString.substr(i, 2), 16)
        }

        return bytes
    }
}