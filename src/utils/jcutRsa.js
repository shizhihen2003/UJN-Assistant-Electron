/**
 * Barrett RSA 加密工具
 * 用于JCUT WebVPN登录加密
 * 放置位置: src/utils/jcutRsa.js
 */

// BigInteger 简化实现
const biRadixBits = 16
const bitsPerDigit = biRadixBits
const biRadix = 1 << 16
const biHalfRadix = biRadix >>> 1
const biRadixSquared = biRadix * biRadix
const maxDigitVal = biRadix - 1

const maxDigits = 131
const ZERO_ARRAY = []
for (let i = 0; i < maxDigits; i++) {
  ZERO_ARRAY[i] = 0
}

function BigInt(flag) {
  if (typeof flag === 'boolean' && flag === true) {
    this.digits = null
  } else {
    this.digits = ZERO_ARRAY.slice(0)
  }
  this.isNeg = false
}

function biFromHex(s) {
  const result = new BigInt()
  const sl = s.length
  let j = 0
  for (let i = sl - 1; i >= 0; i -= 4) {
    const start = Math.max(i - 3, 0)
    result.digits[j++] = parseInt(s.substring(start, i + 1), 16)
  }
  return result
}

function biToHex(x) {
  let result = ''
  for (let i = biHighIndex(x); i > -1; --i) {
    result += digitToHex(x.digits[i])
  }
  return result
}

function digitToHex(n) {
  const hexToChar = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f']
  let result = ''
  for (let i = 0; i < 4; ++i) {
    result = hexToChar[n & 0xf] + result
    n >>>= 4
  }
  return result
}

function biHighIndex(x) {
  let result = x.digits.length - 1
  while (result > 0 && x.digits[result] === 0) --result
  return result
}

function biNumBits(x) {
  const n = biHighIndex(x)
  let d = x.digits[n]
  const m = (n + 1) * bitsPerDigit
  let result
  for (result = m; result > m - bitsPerDigit; --result) {
    if ((d & 0x8000) !== 0) break
    d <<= 1
  }
  return result
}

function biCompare(x, y) {
  if (x.isNeg !== y.isNeg) {
    return 1 - 2 * Number(x.isNeg)
  }
  for (let i = x.digits.length - 1; i >= 0; --i) {
    if (x.digits[i] !== y.digits[i]) {
      if (x.isNeg) {
        return 1 - 2 * Number(x.digits[i] > y.digits[i])
      } else {
        return 1 - 2 * Number(x.digits[i] < y.digits[i])
      }
    }
  }
  return 0
}

function biCopy(bi) {
  const result = new BigInt(true)
  result.digits = bi.digits.slice(0)
  result.isNeg = bi.isNeg
  return result
}

function biAdd(x, y) {
  let result
  if (x.isNeg !== y.isNeg) {
    y.isNeg = !y.isNeg
    result = biSubtract(x, y)
    y.isNeg = !y.isNeg
  } else {
    result = new BigInt()
    let c = 0
    let n
    for (let i = 0; i < x.digits.length; ++i) {
      n = x.digits[i] + y.digits[i] + c
      result.digits[i] = n & 0xffff
      c = Number(n >= biRadix)
    }
    result.isNeg = x.isNeg
  }
  return result
}

function biSubtract(x, y) {
  let result
  if (x.isNeg !== y.isNeg) {
    y.isNeg = !y.isNeg
    result = biAdd(x, y)
    y.isNeg = !y.isNeg
  } else {
    result = new BigInt()
    let n, c
    c = 0
    for (let i = 0; i < x.digits.length; ++i) {
      n = x.digits[i] - y.digits[i] + c
      result.digits[i] = n & 0xffff
      if (result.digits[i] < 0) result.digits[i] += biRadix
      c = 0 - Number(n < 0)
    }
    if (c === -1) {
      c = 0
      for (let i = 0; i < x.digits.length; ++i) {
        n = 0 - result.digits[i] + c
        result.digits[i] = n & 0xffff
        if (result.digits[i] < 0) result.digits[i] += biRadix
        c = 0 - Number(n < 0)
      }
      result.isNeg = !x.isNeg
    } else {
      result.isNeg = x.isNeg
    }
  }
  return result
}

function biMultiply(x, y) {
  const result = new BigInt()
  let c
  const n = biHighIndex(x)
  const t = biHighIndex(y)
  let uv, k
  for (let i = 0; i <= t; ++i) {
    c = 0
    k = i
    for (let j = 0; j <= n; ++j, ++k) {
      uv = result.digits[k] + x.digits[j] * y.digits[i] + c
      result.digits[k] = uv & maxDigitVal
      c = uv >>> biRadixBits
    }
    result.digits[i + n + 1] = c
  }
  result.isNeg = x.isNeg !== y.isNeg
  return result
}

function biMultiplyByRadixPower(x, n) {
  const result = new BigInt()
  arrayCopy(x.digits, 0, result.digits, n, result.digits.length - n)
  return result
}

function biDivideByRadixPower(x, n) {
  const result = new BigInt()
  arrayCopy(x.digits, n, result.digits, 0, result.digits.length - n)
  return result
}

function biModuloByRadixPower(x, n) {
  const result = new BigInt()
  arrayCopy(x.digits, 0, result.digits, 0, n)
  return result
}

function arrayCopy(src, srcStart, dest, destStart, n) {
  const m = Math.min(srcStart + n, src.length)
  for (let i = srcStart, j = destStart; i < m; ++i, ++j) {
    dest[j] = src[i]
  }
}

function biShiftLeft(x, n) {
  const digitCount = Math.floor(n / bitsPerDigit)
  const result = new BigInt()
  arrayCopy(x.digits, 0, result.digits, digitCount, result.digits.length - digitCount)
  const bits = n % bitsPerDigit
  const rightBits = bitsPerDigit - bits
  for (let i = result.digits.length - 1, i1 = i - 1; i > 0; --i, --i1) {
    result.digits[i] = ((result.digits[i] << bits) & maxDigitVal) | ((result.digits[i1] & ((maxDigitVal >> rightBits) << rightBits)) >>> rightBits)
  }
  result.digits[0] = ((result.digits[0] << bits) & maxDigitVal)
  result.isNeg = x.isNeg
  return result
}

function biShiftRight(x, n) {
  const digitCount = Math.floor(n / bitsPerDigit)
  const result = new BigInt()
  arrayCopy(x.digits, digitCount, result.digits, 0, x.digits.length - digitCount)
  const bits = n % bitsPerDigit
  const leftBits = bitsPerDigit - bits
  for (let i = 0, i1 = i + 1; i < result.digits.length - 1; ++i, ++i1) {
    result.digits[i] = (result.digits[i] >>> bits) | ((result.digits[i1] & ((1 << bits) - 1)) << leftBits)
  }
  result.digits[result.digits.length - 1] >>>= bits
  result.isNeg = x.isNeg
  return result
}

function biMultiplyDigit(x, y) {
  let n, c, uv
  const result = new BigInt()
  n = biHighIndex(x)
  c = 0
  for (let j = 0; j <= n; ++j) {
    uv = result.digits[j] + x.digits[j] * y + c
    result.digits[j] = uv & maxDigitVal
    c = uv >>> biRadixBits
  }
  result.digits[1 + n] = c
  return result
}

// Barrett modular reduction
function BarrettMu(m) {
  this.modulus = biCopy(m)
  this.k = biHighIndex(this.modulus) + 1
  const b2k = new BigInt()
  b2k.digits[2 * this.k] = 1
  this.mu = biDivide(b2k, this.modulus)
  this.bkplus1 = new BigInt()
  this.bkplus1.digits[this.k + 1] = 1
  this.modulo = BarrettMu_modulo
  this.multiplyMod = BarrettMu_multiplyMod
  this.powMod = BarrettMu_powMod
}

function BarrettMu_modulo(x) {
  const q1 = biDivideByRadixPower(x, this.k - 1)
  const q2 = biMultiply(q1, this.mu)
  const q3 = biDivideByRadixPower(q2, this.k + 1)
  const r1 = biModuloByRadixPower(x, this.k + 1)
  const r2term = biMultiply(q3, this.modulus)
  const r2 = biModuloByRadixPower(r2term, this.k + 1)
  let r = biSubtract(r1, r2)
  if (r.isNeg) {
    r = biAdd(r, this.bkplus1)
  }
  let rgtem = biCompare(r, this.modulus) >= 0
  while (rgtem) {
    r = biSubtract(r, this.modulus)
    rgtem = biCompare(r, this.modulus) >= 0
  }
  return r
}

function BarrettMu_multiplyMod(x, y) {
  const xy = biMultiply(x, y)
  return this.modulo(xy)
}

function BarrettMu_powMod(x, y) {
  let result = new BigInt()
  result.digits[0] = 1
  let a = x
  let k = y
  while (true) {
    if ((k.digits[0] & 1) !== 0) result = this.multiplyMod(result, a)
    k = biShiftRight(k, 1)
    if (k.digits[0] === 0 && biHighIndex(k) === 0) break
    a = this.multiplyMod(a, a)
  }
  return result
}

function biDivide(x, y) {
  return biDivideModulo(x, y)[0]
}

const bigOne = new BigInt()
bigOne.digits[0] = 1

function biDivideModulo(x, y) {
  const nb = biNumBits(x)
  const tb = biNumBits(y)
  const origYIsNeg = y.isNeg
  let q, r
  if (nb < tb) {
    if (x.isNeg) {
      q = biCopy(bigOne)
      q.isNeg = !y.isNeg
      x.isNeg = false
      y.isNeg = false
      r = biSubtract(y, x)
      x.isNeg = true
      y.isNeg = origYIsNeg
    } else {
      q = new BigInt()
      r = biCopy(x)
    }
    return [q, r]
  }
  q = new BigInt()
  r = x
  let t = Math.ceil(tb / bitsPerDigit) - 1
  let lambda = 0
  while (y.digits[t] < biHalfRadix) {
    y = biShiftLeft(y, 1)
    ++lambda
    ++tb
    t = Math.ceil(tb / bitsPerDigit) - 1
  }
  r = biShiftLeft(r, lambda)
  const newNb = nb + lambda
  const n = Math.ceil(newNb / bitsPerDigit) - 1
  const b = biMultiplyByRadixPower(y, n - t)
  while (biCompare(r, b) !== -1) {
    ++q.digits[n - t]
    r = biSubtract(r, b)
  }
  for (let i = n; i > t; --i) {
    const ri = (i >= r.digits.length) ? 0 : r.digits[i]
    const ri1 = (i - 1 >= r.digits.length) ? 0 : r.digits[i - 1]
    const ri2 = (i - 2 >= r.digits.length) ? 0 : r.digits[i - 2]
    const yt = (t >= y.digits.length) ? 0 : y.digits[t]
    const yt1 = (t - 1 >= y.digits.length) ? 0 : y.digits[t - 1]
    if (ri === yt) {
      q.digits[i - t - 1] = maxDigitVal
    } else {
      q.digits[i - t - 1] = Math.floor((ri * biRadix + ri1) / yt)
    }
    let c1 = q.digits[i - t - 1] * ((yt * biRadix) + yt1)
    let c2 = (ri * biRadixSquared) + ((ri1 * biRadix) + ri2)
    while (c1 > c2) {
      --q.digits[i - t - 1]
      c1 = q.digits[i - t - 1] * ((yt * biRadix) | yt1)
      c2 = (ri * biRadix * biRadix) + ((ri1 * biRadix) + ri2)
    }
    const b2 = biMultiplyByRadixPower(y, i - t - 1)
    r = biSubtract(r, biMultiplyDigit(b2, q.digits[i - t - 1]))
    if (r.isNeg) {
      r = biAdd(r, b2)
      --q.digits[i - t - 1]
    }
  }
  r = biShiftRight(r, lambda)
  q.isNeg = x.isNeg !== origYIsNeg
  if (x.isNeg) {
    if (origYIsNeg) {
      q = biAdd(q, bigOne)
    } else {
      q = biSubtract(q, bigOne)
    }
    y = biShiftRight(y, lambda)
    r = biSubtract(y, r)
  }
  if (r.digits[0] === 0 && biHighIndex(r) === 0) r.isNeg = false
  return [q, r]
}

// RSA Key
function RSAKeyPair(encryptionExponent, decryptionExponent, modulus) {
  this.e = biFromHex(encryptionExponent)
  this.d = biFromHex(decryptionExponent)
  this.m = biFromHex(modulus)
  this.chunkSize = 2 * biHighIndex(this.m)
  this.radix = 16
  this.barrett = new BarrettMu(this.m)
}

function encryptedString(key, s) {
  const a = []
  const sl = s.length
  let i = 0
  while (i < sl) {
    a[i] = s.charCodeAt(i)
    i++
  }
  while (a.length % key.chunkSize !== 0) {
    a[i++] = 0
  }
  const al = a.length
  let result = ''
  let j, k, block
  for (i = 0; i < al; i += key.chunkSize) {
    block = new BigInt()
    j = 0
    for (k = i; k < i + key.chunkSize; ++j) {
      block.digits[j] = a[k++]
      block.digits[j] += a[k++] << 8
    }
    const crypt = key.barrett.powMod(block, key.e)
    const text = key.radix === 16 ? biToHex(crypt) : String(crypt)
    result += text  // 不加空格分隔
  }
  return result
}

// JCUT RSA 配置
const JCUT_RSA_EXPONENT = '010001'
const JCUT_RSA_MODULUS = '00b5eeb166e069920e80bebd1fea4829d3d1f3216f2aabe79b6c47a3c18dcee5fd22c2e7ac519cab59198ece036dcf289ea8201e2a0b9ded307f8fb704136eaeb670286f5ad44e691005ba9ea5af04ada5367cd724b5a26fdb5120cc95b6431604bd219c6b7d83a6f8f24b43918ea988a76f93c333aa5a20991493d4eb1117e7b1'

/**
 * JCUT RSA 加密函数
 * @param {string} text - 要加密的文本
 * @param {string} exponent - 公钥指数 (hex)
 * @param {string} modulus - 公钥模数 (hex)
 * @returns {string} 加密后的字符串
 */
export function rsaEncrypt(text, exponent, modulus) {
  const key = new RSAKeyPair(exponent, '', modulus)
  return encryptedString(key, text)
}

/**
 * JCUT 密码加密
 * 注意：需要先反转密码字符串再加密（学校CAS系统要求）
 * @param {string} password - 原始密码
 * @returns {string} RSA加密后的密码
 */
export function encryptPassword(password) {
  // 联奕系统直接加密，不需要反转
  return rsaEncrypt(password, JCUT_RSA_EXPONENT, JCUT_RSA_MODULUS)
}

/**
 * JCUT loginusertoken 加密
 * 格式: RSA("lyasp" + timestamp)
 * @returns {string} 加密后的token
 */
export function encryptLoginUserToken() {
  const timestamp = Date.now().toString()
  const text = 'lyasp' + timestamp
  return rsaEncrypt(text, JCUT_RSA_EXPONENT, JCUT_RSA_MODULUS)
}

export default {
  rsaEncrypt,
  encryptPassword,
  encryptLoginUserToken
}