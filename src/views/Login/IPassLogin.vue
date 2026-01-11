<!-- src/views/Login/IPassLogin.vue 支持多学校版本 -->
<template>
  <div class="login-container" :class="{ 'dark-mode': isDarkMode }">
    <!-- 背景动画装饰 -->
    <div class="bg-decoration">
      <div class="bg-particles" v-for="n in 8" :key="n"></div>
      <div class="bg-gradient"></div>
    </div>

    <!-- 顶部操作栏 -->
    <div class="top-actions">
      <div class="theme-toggle" @click="toggleTheme">
        <el-icon v-if="isDarkMode"><Sunny /></el-icon>
        <el-icon v-else><Moon /></el-icon>
      </div>
    </div>
    <h1 class="page-title">{{ pageTitle }}</h1>

    <!-- 登录表单 -->
    <el-card class="login-card" v-loading="loading">
      <el-form
          :model="loginForm"
          :rules="rules"
          ref="loginFormRef"
          label-width="80px"
          @submit.prevent="handleLogin"
      >
        <el-form-item label="学号" prop="username">
          <el-input v-model="loginForm.username" placeholder="请输入学号" autocomplete="off">
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
              v-model="loginForm.password"
              type="password"
              placeholder="请输入密码"
              autocomplete="off"
              show-password
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <!-- 验证码（如果需要） -->
        <el-form-item label="验证码" prop="captcha" v-if="requireCaptcha">
          <div class="captcha-row">
            <el-input
                v-model="loginForm.captcha"
                placeholder="请输入验证码"
                style="flex: 1"
            >
              <template #prefix>
                <el-icon><Picture /></el-icon>
              </template>
            </el-input>
            <div class="captcha-image" @click="refreshCaptcha">
              <img v-if="captchaImage" :src="captchaImage" alt="验证码" />
              <div v-else-if="captchaLoading" class="captcha-loading">
                <el-icon class="is-loading" :size="20"><Loading /></el-icon>
              </div>
              <span v-else class="captcha-placeholder">点击获取</span>
            </div>
          </div>
          <div class="captcha-hint">
            <span>点击图片刷新验证码</span>
            <span v-if="captchaHint" class="hint-text">{{ captchaHint }}</span>
          </div>
        </el-form-item>

        <el-form-item>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-button type="primary" @click="handleLogin" :loading="loading" style="width: 100%">
                <el-icon><Connection /></el-icon> 登录
              </el-button>
            </el-col>
            <el-col :span="12">
              <el-button @click="resetForm" style="width: 100%">
                <el-icon><RefreshLeft /></el-icon> 重置
              </el-button>
            </el-col>
          </el-row>
        </el-form-item>

        <div class="login-options">
          <el-checkbox v-model="loginForm.savePassword">记住密码</el-checkbox>
          <el-checkbox v-model="loginForm.autoLogin">自动登录</el-checkbox>
          <el-checkbox v-model="loginForm.useVpn" v-if="vpnEnabled && !isVpnOnlySchool">使用VPN登录</el-checkbox>
        </div>

        <!-- 教务系统VPN登录选项 -->
        <div class="login-options" v-if="loginForm.useVpn && vpnEnabled && !isVpnOnlySchool">
          <el-checkbox v-model="loginForm.useEasVpn" :disabled="!loginForm.useVpn">
            <el-tooltip content="登录后自动使用VPN登录教务系统" placement="top">
              同步使用VPN登录教务系统
            </el-tooltip>
          </el-checkbox>
        </div>

        <div class="login-status" v-if="loginStatus">
          <span :class="{'status-success': loginStatus.success, 'status-error': !loginStatus.success}">
            {{ loginStatus.message }}
          </span>
        </div>

        <div class="login-tips">
          <p><el-icon><InfoFilled /></el-icon> {{ loginTip }}</p>
          <p v-if="isVpnOnlySchool">
            <el-icon><Warning /></el-icon> {{ schoolName }}仅支持WebVPN方式登录
          </p>
          <p v-else-if="loginForm.useVpn">
            <el-icon><Warning /></el-icon> 当前使用VPN模式登录，适用于校外网络
          </p>
          <p v-if="loginForm.useVpn && loginForm.useEasVpn && !isVpnOnlySchool">
            <el-icon><InfoFilled /></el-icon> 登录成功后将自动使用VPN登录教务系统
          </p>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock, Connection, RefreshLeft, InfoFilled, Warning, Picture, Loading, Moon, Sunny } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import authService from '@/services/authService'
import { UJNAPI } from '@/constants/api'
import ipc from '@/utils/ipc'
import store from '@/utils/store'
// ========== 新增：导入RSA加密工具 ==========
import { encryptPassword, encryptLoginUserToken } from '@/utils/jcutRsa'

const router = useRouter()

// 主题切换
const isDarkMode = ref(false)

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value
  document.documentElement.classList.toggle('dark-theme', isDarkMode.value)
  localStorage.setItem('ujn_dark_mode', isDarkMode.value ? '1' : '0')
}

// 初始化状态
const loginFormRef = ref(null)
const loading = ref(false)
const loginStatus = ref(null)
const networkStatus = ref('checking')

// 验证码相关
const captchaImage = ref('')
const captchaUuid = ref('')
const captchaHint = ref('')
const captchaLoading = ref(false)

// WebVPN会话Cookie - 使用普通数组而不是响应式
let vpnCookies = []
let vpnSessionReady = false

// 动态获取当前学校信息
const schoolId = computed(() => UJNAPI.SCHOOL_ID || 'ujn')
const schoolName = computed(() => UJNAPI.SCHOOL_NAME || '济南大学')
const ssoType = computed(() => UJNAPI.SSO_TYPE || 'tpass')

// 页面标题 - 根据学校动态生成
const pageTitle = computed(() => {
  const name = schoolName.value
  return `${name}统一认证登录`
})

// 登录提示 - 根据学校动态生成
const loginTip = computed(() => {
  return `${schoolName.value}账号通常与教务系统账号相同`
})

// 是否需要验证码（荆楚理工需要）
const requireCaptcha = computed(() => {
  return UJNAPI.REQUIRE_CAPTCHA || ssoType.value === 'lyuap' || schoolId.value === 'jcut'
})

// 是否是仅VPN登录的学校（荆楚理工只有WebVPN）
const isVpnOnlySchool = computed(() => {
  return schoolId.value === 'jcut'
})

// VPN是否启用
const vpnEnabled = computed(() => {
  return UJNAPI.VPN_ENABLED
})

// 登录表单
const loginForm = reactive({
  username: '',
  password: '',
  captcha: '',
  savePassword: true,
  autoLogin: false,
  useVpn: false,
  useEasVpn: false
})

// 表单校验规则
const rules = computed(() => {
  const baseRules = {
    username: [
      { required: true, message: '请输入学号', trigger: 'blur' },
      { pattern: /^\d+$/, message: '学号应为数字', trigger: 'blur' }
    ],
    password: [
      { required: true, message: '请输入密码', trigger: 'blur' }
    ]
  }

  // 如果需要验证码，添加验证码规则
  if (requireCaptcha.value) {
    baseRules.captcha = [
      { required: true, message: '请输入验证码', trigger: 'blur' }
    ]
  }

  return baseRules
})

/**
 * 解析Cookie，提取name=value部分
 * 输入可能是字符串或对象
 */
const parseCookie = (cookie) => {
  if (!cookie) return null

  // 如果是对象，直接返回name=value
  if (typeof cookie === 'object' && cookie.name && cookie.value) {
    return `${cookie.name}=${cookie.value}`
  }

  // 如果是字符串，提取第一部分（name=value）
  if (typeof cookie === 'string') {
    // 格式可能是: "name=value; Path=/; Domain=xxx"
    const parts = cookie.split(';')
    if (parts.length > 0) {
      return parts[0].trim()
    }
    return cookie.trim()
  }

  return null
}

/**
 * 将Cookie数组转为请求头字符串
 * 只保留 name=value 部分
 */
const cookiesToString = () => {
  const parsed = vpnCookies
      .map(c => parseCookie(c))
      .filter(c => c !== null)

  return parsed.join('; ')
}

/**
 * 添加Cookie到列表（去重，过滤空值）
 */
const addCookies = (newCookies) => {
  if (!newCookies || !Array.isArray(newCookies)) return

  newCookies.forEach(cookie => {
    const parsed = parseCookie(cookie)
    if (!parsed) return

    const parts = parsed.split('=')
    const name = parts[0]
    const value = parts.slice(1).join('=') // 处理值中包含=的情况

    // 过滤掉空值cookie（如 redirectTo=""）
    if (!value || value === '""' || value === "''") {
      console.log('[IPassLogin] 跳过空值cookie:', name)
      // 如果已存在该cookie，删除它
      const existingIndex = vpnCookies.findIndex(c => {
        const existingParsed = parseCookie(c)
        return existingParsed && existingParsed.split('=')[0] === name
      })
      if (existingIndex >= 0) {
        vpnCookies.splice(existingIndex, 1)
      }
      return
    }

    // 检查是否已存在同名Cookie，如果存在则替换
    const existingIndex = vpnCookies.findIndex(c => {
      const existingParsed = parseCookie(c)
      return existingParsed && existingParsed.split('=')[0] === name
    })

    if (existingIndex >= 0) {
      vpnCookies[existingIndex] = parsed
    } else {
      vpnCookies.push(parsed)
    }
  })

  console.log('[IPassLogin] 当前Cookie列表:', vpnCookies)
}

/**
 * 初始化WebVPN会话
 * 需要多次请求来获取完整的Cookie
 */
const initVpnSession = async () => {
  if (schoolId.value !== 'jcut') return true

  try {
    console.log('[IPassLogin] 初始化WebVPN会话...')
    vpnCookies = []

    // 第一步：访问WebVPN门户
    const portalUrl = 'https://sec.jcut.edu.cn/webvpn/'
    const result1 = await ipc.ipassGet(portalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    })

    console.log('[IPassLogin] 门户响应:', result1.success, '状态码:', result1.status || result1.statusCode)

    // 保存Cookie
    if (result1.cookies && result1.cookies.length > 0) {
      addCookies(result1.cookies)
    }

    // 第二步：如果被重定向，跟随重定向
    if (result1.headers && result1.headers.location) {
      const redirectUrl = result1.headers.location
      console.log('[IPassLogin] 跟随重定向:', redirectUrl)

      const result2 = await ipc.ipassGet(redirectUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Cookie': cookiesToString(),
        }
      })

      if (result2.cookies && result2.cookies.length > 0) {
        addCookies(result2.cookies)
      }
    }

    // 第三步：访问CAS登录页面获取更多Cookie
    const casUrl = 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjE5Ni4xNTAuMTY5LjE0NC4xNTUuMjAwLjE2NS4yMTUuOTUuMjAzLjE1Ny4xNzAuMTQ1LjE5OC4xNjI=/lyuapServer/login'
    console.log('[IPassLogin] 访问CAS页面获取Cookie...')

    const result3 = await ipc.ipassGet(casUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cookie': cookiesToString(),
      }
    })

    console.log('[IPassLogin] CAS页面响应:', result3.success, '状态码:', result3.status || result3.statusCode)

    if (result3.cookies && result3.cookies.length > 0) {
      addCookies(result3.cookies)
    }

    vpnSessionReady = vpnCookies.length > 0
    console.log('[IPassLogin] 会话初始化完成, Cookie数量:', vpnCookies.length)

    return vpnSessionReady
  } catch (error) {
    console.error('[IPassLogin] 初始化WebVPN会话失败:', error)
    return false
  }
}

/**
 * 刷新验证码
 */
const refreshCaptcha = async () => {
  if (!requireCaptcha.value) return

  captchaLoading.value = true
  captchaImage.value = ''
  captchaHint.value = ''

  try {
    if (schoolId.value === 'jcut') {
      // 确保会话已初始化
      if (!vpnSessionReady || vpnCookies.length === 0) {
        console.log('[IPassLogin] 会话未就绪，初始化...')
        await initVpnSession()
      }

      const timestamp = Date.now()
      const kaptchaUrl = `https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjE5Ni4xNTAuMTY5LjE0NC4xNTUuMjAwLjE2NS4yMTUuOTUuMjAzLjE1Ny4xNzAuMTQ1LjE5OC4xNjI=/lyuapServer/kaptcha?_t=${timestamp}&uid=`

      const cookieStr = cookiesToString()
      console.log('[IPassLogin] 请求验证码, Cookie:', cookieStr)

      const result = await ipc.ipassGet(kaptchaUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://sec.jcut.edu.cn/webvpn/',
          'Cookie': cookieStr,
        }
      })

      console.log('[IPassLogin] 验证码响应:', result.success, '状态:', result.status || result.statusCode)

      // 保存新Cookie
      if (result.cookies && result.cookies.length > 0) {
        addCookies(result.cookies)
      }

      if (result.success && result.data) {
        try {
          let data = result.data
          if (typeof data === 'string') {
            data = JSON.parse(data)
          }

          console.log('[IPassLogin] 验证码数据:', Object.keys(data))

          // 检查各种可能的字段名
          const uuid = data.uuid || data.uid || data.id || data.captchaId
          const content = data.content || data.img || data.image || data.base64

          if (uuid && content) {
            captchaUuid.value = uuid
            // 确保是完整的base64图片格式
            if (content.startsWith('data:')) {
              captchaImage.value = content
            } else {
              captchaImage.value = `data:image/png;base64,${content}`
            }
            captchaHint.value = '提示: 可能是算术题'
            console.log('[IPassLogin] 验证码加载成功, UUID:', uuid)
          } else {
            console.error('[IPassLogin] 验证码数据格式不正确:', data)
            ElMessage.error('验证码格式错误')
          }
        } catch (e) {
          console.error('[IPassLogin] 解析验证码失败:', e, '原始数据:', result.data?.substring?.(0, 200))
          ElMessage.error('解析验证码失败')
        }
      } else {
        // 如果失败且是301/302，重新初始化会话
        const status = result.status || result.statusCode
        if (status === 301 || status === 302) {
          console.log('[IPassLogin] 收到重定向，重新初始化会话...')
          vpnSessionReady = false
          await initVpnSession()
          // 不再递归调用，让用户点击刷新
          ElMessage.warning('请点击验证码图片重新获取')
        } else {
          console.error('[IPassLogin] 获取验证码失败:', result)
          ElMessage.error('获取验证码失败，请点击重试')
        }
      }
    }
  } catch (error) {
    console.error('[IPassLogin] 获取验证码失败:', error)
    ElMessage.error('获取验证码失败，请重试')
  } finally {
    captchaLoading.value = false
  }
}

// 检查网络连接状态
const checkNetworkStatus = async () => {
  try {
    networkStatus.value = 'checking'

    const ssoHost = UJNAPI.IPASS_HOST
    const ssoLogin = UJNAPI.IPASS_LOGIN

    if (!ssoHost) {
      networkStatus.value = 'offline'
      return
    }

    // 尝试直接访问SSO
    try {
      const response = await fetch(ssoLogin, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        timeout: 3000
      })

      if (response.ok || response.status === 0) {
        networkStatus.value = 'online'
      } else {
        networkStatus.value = 'vpn'
      }
    } catch (error) {
      console.log('直接连接SSO失败，可能需要VPN')
      networkStatus.value = 'vpn'
    }
  } catch (error) {
    console.error('网络状态检查失败', error)
    networkStatus.value = 'offline'
  }
}

// 处理登录
const handleLogin = async () => {
  if (!loginFormRef.value) return

  try {
    await loginFormRef.value.validate()

    loading.value = true
    loginStatus.value = { success: false, message: '正在登录...' }

    // 根据学校类型执行不同的登录流程
    let result = false

    if (schoolId.value === 'jcut') {
      // 荆楚理工学院登录
      result = await handleJcutLogin()
    } else {
      // 其他学校（济南大学等）使用标准流程
      result = await handleStandardLogin()
    }

    if (result) {
      loginStatus.value = { success: true, message: '登录成功！' }

      // 保存账号密码
      if (loginForm.savePassword) {
        await store.putString('IPASS_ACCOUNT', loginForm.username)
        await store.putString('IPASS_PASSWORD', loginForm.password)
        await store.putBoolean('IPASS_AUTO_LOGIN', loginForm.autoLogin)
      }

      ElMessage.success('登录成功')

      // 延迟跳转
      setTimeout(() => {
        router.push('/')
      }, 500)
    } else {
      loginStatus.value = { success: false, message: '登录失败，请检查账号密码' }
      // 刷新验证码
      if (requireCaptcha.value) {
        await refreshCaptcha()
      }
    }
  } catch (error) {
    console.error('登录失败:', error)
    loginStatus.value = { success: false, message: error.message || '登录失败' }
    // 刷新验证码
    if (requireCaptcha.value) {
      await refreshCaptcha()
    }
  } finally {
    loading.value = false
  }
}

// 标准登录流程（济南大学等）
const handleStandardLogin = async () => {
  // 设置VPN模式
  authService.useVpn = loginForm.useVpn
  await store.putBoolean('EA_USE_VPN', loginForm.useVpn)

  // 设置教务系统VPN模式
  if (loginForm.useVpn) {
    authService.useEasVpn = loginForm.useEasVpn
    await store.putBoolean('EA_USE_EAS_VPN', loginForm.useEasVpn)
  }

  console.log(`开始登录${schoolName.value}...`)
  console.log(`VPN模式: ${loginForm.useVpn}`)

  return await authService.loginIpass(
      loginForm.username,
      loginForm.password,
      loginForm.useVpn
  )
}

// ========== 荆楚理工学院登录流程（严格按照HAR抓包流程） ==========
const handleJcutLogin = async () => {
  try {
    console.log(`[IPassLogin] 开始登录${schoolName.value}（WebVPN模式）...`)

    // ⚠️ 重要：清除旧的登录状态，开始全新的登录流程
    // 防止多次登录时cookie被累积拼接
    vpnCookies = []
    vpnSessionReady = false
    await store.putString('JCUT_VPN_COOKIES', '')
    authService.jcutVpnCookies = []
    console.log('[IPassLogin] 已清除旧的登录状态')

    // 初始化新的VPN会话（获取新的my_vpn_ticket）
    await initVpnSession()

    // ========== RSA加密密码和生成loginusertoken ==========
    const rsaEncryptedPassword = encryptPassword(loginForm.password)
    const loginUserToken = encryptLoginUserToken()

    console.log('[IPassLogin] 密码已RSA加密, 长度:', rsaEncryptedPassword.length)

    // ========== Step 1: POST /lyuapServer/v1/tickets 获取TGT ==========
    console.log('[IPassLogin] Step 1: 提交登录获取TGT...')

    const ticketUrl = 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjE5Ni4xNTAuMTY5LjE0NC4xNTUuMjAwLjE2NS4yMTUuOTUuMjAzLjE1Ny4xNzAuMTQ1LjE5OC4xNjI=/lyuapServer/v1/tickets?vpn-12-cas.jcut.edu.cn'

    const formData = new URLSearchParams()
    formData.append('username', loginForm.username)
    formData.append('password', rsaEncryptedPassword)
    formData.append('service', 'http://my.jcut.edu.cn/')
    formData.append('loginType', '')
    formData.append('id', captchaUuid.value)
    formData.append('code', loginForm.captcha)

    const loginResult = await ipc.ipassPost(ticketUrl, formData.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://sec.jcut.edu.cn',
        'Referer': 'https://sec.jcut.edu.cn/webvpn/',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': cookiesToString(),
        'loginusertoken': loginUserToken,
        'logintoken': 'loginToken',
      }
    })

    console.log('[IPassLogin] Step 1响应:', loginResult.success, loginResult.data)

    if (loginResult.cookies && loginResult.cookies.length > 0) {
      addCookies(loginResult.cookies)
    }

    if (!loginResult.success || !loginResult.data) {
      console.error('[IPassLogin] Step 1失败')
      return false
    }

    let data = loginResult.data
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch (e) {
        console.error('[IPassLogin] 解析响应失败:', e)
        return false
      }
    }

    if (!data.tgt) {
      const msg = data.message || data.msg || '登录失败'
      console.error('[IPassLogin] 登录失败:', msg)
      ElMessage.error(typeof msg === 'string' ? msg : '登录失败，请检查账号密码')
      return false
    }

    const tgt = data.tgt
    const firstST = data.ticket
    console.log('[IPassLogin] Step 1完成，TGT:', tgt, 'ST:', firstST)

    // ========== Step 2: POST /webvpn/cookie/ 同步cookies到WebVPN ==========
    console.log('[IPassLogin] Step 2: 同步cookies到WebVPN...')

    const cookiesToSync = [
      { name: 'loginType', value: '1' },
      { name: 'session', value: '1' },
      { name: 'CASTGC', value: tgt }
    ]

    for (const cookie of cookiesToSync) {
      const syncData = new URLSearchParams()
      syncData.append('domain', 'cas.jcut.edu.cn')
      syncData.append('name', cookie.name)
      syncData.append('value', cookie.value)
      syncData.append('path', '/')
      syncData.append('expires', '')

      await ipc.ipassPost('https://sec.jcut.edu.cn/webvpn/cookie/', syncData.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Accept': '*/*',
          'Origin': 'https://sec.jcut.edu.cn',
          'Referer': 'https://sec.jcut.edu.cn/webvpn/',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': cookiesToString(),
        }
      })
      console.log(`[IPassLogin] 同步cookie ${cookie.name}: done`)
    }

    // ========== Step 3: GET /rump_frontend/login/ 获取redirectTo cookie ==========
    // 这是关键步骤！必须获取redirectTo cookie，后续请求才能成功
    console.log('[IPassLogin] Step 3: 获取redirectTo cookie...')

    const nextUrl = encodeURIComponent(`https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMA==/LjIwNi4xNzQuMTAwLjIwNC4xNDguMjE4LjE2NC4xNDUuMTUwLjIwMi4xNzQuOTkuMTk4LjIwOQ==/?ticket=${firstST}`)
    const loginPageUrl = `https://sec.jcut.edu.cn/rump_frontend/login/?next=${nextUrl}`

    console.log('[IPassLogin] Step 3 URL:', loginPageUrl)

    const loginPageResult = await ipc.ipassGet(loginPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cookie': cookiesToString(),
      }
    })

    console.log('[IPassLogin] Step 3响应:', loginPageResult.status, loginPageResult.success)

    if (loginPageResult.cookies && loginPageResult.cookies.length > 0) {
      addCookies(loginPageResult.cookies)
      console.log('[IPassLogin] Step 3获取到cookies:', loginPageResult.cookies.map(c => {
        if (typeof c === 'object') return c.name
        if (typeof c === 'string') return c.split('=')[0]
        return 'unknown'
      }))
    } else {
      console.warn('[IPassLogin] Step 3没有获取到cookies，尝试从响应头提取...')
    }

    // 打印当前所有cookies，确认redirectTo是否存在
    console.log('[IPassLogin] 当前所有cookies:', vpnCookies)

    // ========== Step 4: POST /lyuapServer/v1/tickets/{TGT} 换取新ST ==========
    console.log('[IPassLogin] Step 4: 用TGT换取新ST...')

    const serviceTicketUrl = `https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjE5Ni4xNTAuMTY5LjE0NC4xNTUuMjAwLjE2NS4yMTUuOTUuMjAzLjE1Ny4xNzAuMTQ1LjE5OC4xNjI=/lyuapServer/v1/tickets/${tgt}?vpn-12-cas.jcut.edu.cn`

    const stFormData = new URLSearchParams()
    stFormData.append('service', 'https://sec.jcut.edu.cn/rump_frontend/loginFromCas/')
    stFormData.append('loginToken', 'loginToken')

    console.log('[IPassLogin] Step 4 URL:', serviceTicketUrl)
    console.log('[IPassLogin] Step 4 cookies:', cookiesToString())

    const stResult = await ipc.ipassPost(serviceTicketUrl, stFormData.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://sec.jcut.edu.cn',
        'Referer': 'https://sec.jcut.edu.cn/webvpn/',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': cookiesToString(),
        'loginusertoken': loginUserToken,
        'logintoken': 'loginToken',
      }
    })

    console.log('[IPassLogin] Step 4响应:', stResult.success, stResult.status, stResult.data)

    if (stResult.cookies && stResult.cookies.length > 0) {
      addCookies(stResult.cookies)
    }

    if (!stResult.success || !stResult.data) {
      console.error('[IPassLogin] Step 4失败，响应:', stResult)
      // 即使Step 4失败，TGT已获取，标记为部分成功
      authService.ipassLoginStatus.value = true
      authService.useVpn = true
      await saveLoginCookies()
      loginStatus.value = { success: true, message: '登录成功！' }
      ElMessage.success('登录成功')
      setTimeout(() => { router.push('/') }, 500)
      return true
    }

    const newST = stResult.data.trim()
    console.log('[IPassLogin] Step 4完成，新ST:', newST)

    // ========== Step 5: GET /rump_frontend/loginFromCas/ 获取my_client_ticket ==========
    console.log('[IPassLogin] Step 5: 获取my_client_ticket...')

    const loginFromCasUrl = `https://sec.jcut.edu.cn/rump_frontend/loginFromCas/?ticket=${newST}`

    console.log('[IPassLogin] Step 5 URL:', loginFromCasUrl)

    const casResult = await ipc.ipassGet(loginFromCasUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://sec.jcut.edu.cn/webvpn/',
        'Cookie': cookiesToString(),
      }
    })

    console.log('[IPassLogin] Step 5响应:', casResult.success, casResult.status)

    if (casResult.cookies && casResult.cookies.length > 0) {
      addCookies(casResult.cookies)
      console.log('[IPassLogin] Step 5获取到的cookies:', casResult.cookies.map(c => {
        if (typeof c === 'object') return c.name
        if (typeof c === 'string') return c.split('=')[0]
        return 'unknown'
      }))
    }

    // ========== Step 6-7: 跟随重定向激活session ==========
    // Step 5返回302，需要跟随重定向才能让token生效
    let redirectUrl = casResult.headers?.location
    if (redirectUrl) {
      console.log('[IPassLogin] Step 6: 跟随重定向激活session...')
      console.log('[IPassLogin] Step 6 URL:', redirectUrl)

      // 确保URL是完整的
      if (!redirectUrl.startsWith('http')) {
        redirectUrl = 'https://sec.jcut.edu.cn' + redirectUrl
      }

      const step6Result = await ipc.ipassGet(redirectUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Cookie': cookiesToString(),
        }
      })

      console.log('[IPassLogin] Step 6响应:', step6Result.status)

      if (step6Result.cookies && step6Result.cookies.length > 0) {
        addCookies(step6Result.cookies)
      }

      // 如果还有重定向，继续跟随 (Step 7)
      let redirectUrl2 = step6Result.headers?.location
      if (redirectUrl2) {
        console.log('[IPassLogin] Step 7: 继续跟随重定向...')

        if (!redirectUrl2.startsWith('http')) {
          redirectUrl2 = 'https://sec.jcut.edu.cn' + redirectUrl2
        }

        const step7Result = await ipc.ipassGet(redirectUrl2, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Cookie': cookiesToString(),
          }
        })

        console.log('[IPassLogin] Step 7响应:', step7Result.status)

        if (step7Result.cookies && step7Result.cookies.length > 0) {
          addCookies(step7Result.cookies)
        }

        // 如果还有重定向，再跟一次 (Step 8)
        let redirectUrl3 = step7Result.headers?.location
        if (redirectUrl3) {
          console.log('[IPassLogin] Step 8: 最后一次重定向...')

          if (!redirectUrl3.startsWith('http')) {
            redirectUrl3 = 'https://sec.jcut.edu.cn' + redirectUrl3
          }

          const step8Result = await ipc.ipassGet(redirectUrl3, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Cookie': cookiesToString(),
            }
          })

          console.log('[IPassLogin] Step 8响应:', step8Result.status)

          if (step8Result.cookies && step8Result.cookies.length > 0) {
            addCookies(step8Result.cookies)
          }
        }
      }
    }

    console.log('[IPassLogin] ✅ SSO流程完成，开始第二轮认证(shiro-cas)...')

    // ========== 第二轮认证: shiro-cas (后端门户API认证) ==========
    // 没有这一步，后端API会返回"未登录或会话已过期"

    // Step 9: POST /tickets/{TGT} 获取shiro-cas的ST
    console.log('[IPassLogin] Step 9: 获取shiro-cas的ST...')

    const shiroCasSTUrl = `https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjE5Ni4xNTAuMTY5LjE0NC4xNTUuMjAwLjE2NS4yMTUuOTUuMjAzLjE1Ny4xNzAuMTQ1LjE5OC4xNjI=/lyuapServer/v1/tickets/${tgt}?vpn-12-cas.jcut.edu.cn`

    const shiroFormData = new URLSearchParams()
    shiroFormData.append('service', 'https://my.jcut.edu.cn/shiro-cas')
    shiroFormData.append('loginToken', 'loginToken')

    const shiroSTResult = await ipc.ipassPost(shiroCasSTUrl, shiroFormData.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://sec.jcut.edu.cn',
        'Referer': 'https://sec.jcut.edu.cn/webvpn/',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': cookiesToString(),
        'loginusertoken': loginUserToken,
        'logintoken': 'loginToken',
      }
    })

    console.log('[IPassLogin] Step 9响应:', shiroSTResult.success, shiroSTResult.status, shiroSTResult.data)

    if (shiroSTResult.success && shiroSTResult.data) {
      const shiroST = shiroSTResult.data.trim()
      console.log('[IPassLogin] Step 9完成，shiro-cas ST:', shiroST)

      // Step 10: GET /shiro-cas?ticket=ST 激活后端session
      console.log('[IPassLogin] Step 10: 激活后端session...')

      const shiroCasUrl = `https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjIwNi4xNzQuMTAwLjIwNC4xNDguMjE4LjE2NC4xNDUuMTUwLjIwMi4xNzQuOTkuMTk4LjIwOQ==/shiro-cas?ticket=${shiroST}`

      const shiroResult = await ipc.ipassGet(shiroCasUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Cookie': cookiesToString(),
        }
      })

      console.log('[IPassLogin] Step 10响应:', shiroResult.status)

      if (shiroResult.cookies && shiroResult.cookies.length > 0) {
        addCookies(shiroResult.cookies)
      }

      // 如果有重定向，继续跟随
      if (shiroResult.headers?.location) {
        let shiroRedirect = shiroResult.headers.location
        if (!shiroRedirect.startsWith('http')) {
          shiroRedirect = 'https://sec.jcut.edu.cn' + shiroRedirect
        }

        console.log('[IPassLogin] Step 11: 跟随shiro-cas重定向...')

        const step11Result = await ipc.ipassGet(shiroRedirect, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Cookie': cookiesToString(),
          }
        })

        console.log('[IPassLogin] Step 11响应:', step11Result.status)

        if (step11Result.cookies && step11Result.cookies.length > 0) {
          addCookies(step11Result.cookies)
        }
      }

      console.log('[IPassLogin] ✅ 第二轮认证完成，后端session已激活')
    } else {
      console.warn('[IPassLogin] ⚠️ 第二轮认证失败，API可能无法正常工作')
    }

    // 登录成功，输出最终的cookie列表
    console.log('[IPassLogin] ===== 登录成功，最终Cookie列表 =====')
    vpnCookies.forEach((c, i) => {
      const name = c.split('=')[0]
      const value = c.split('=').slice(1).join('=')
      console.log(`[IPassLogin] Cookie ${i+1}: ${name} = ${value.substring(0, 50)}...`)
    })
    console.log('[IPassLogin] =====================================')

    authService.ipassLoginStatus.value = true
    authService.useVpn = true
    await saveLoginCookies()

    // 获取并保存用户名
    const verifyResult = await verifyLoginStatus()
    if (verifyResult.valid && verifyResult.username) {
      await store.putString('IPASS_USER_NAME', verifyResult.username)
      console.log('[IPassLogin] 保存用户名:', verifyResult.username)
    }

    loginStatus.value = { success: true, message: '登录成功！' }
    ElMessage.success('登录成功')
    setTimeout(() => { router.push('/') }, 500)

    return true

  } catch (error) {
    console.error('[IPassLogin] 登录失败:', error)
    throw error
  }
}

// 重置表单
const resetForm = () => {
  if (loginFormRef.value) {
    loginFormRef.value.resetFields()
  }
  loginStatus.value = null
}

// 加载保存的账号信息
const loadSavedAccount = async () => {
  try {
    const savedUsername = await store.getString('IPASS_ACCOUNT', '')
    const savedPassword = await store.getString('IPASS_PASSWORD', '')
    const autoLogin = await store.getBoolean('IPASS_AUTO_LOGIN', false)
    const useVpn = await store.getBoolean('EA_USE_VPN', false)
    const useEasVpn = await store.getBoolean('EA_USE_EAS_VPN', false)

    if (savedUsername) {
      loginForm.username = savedUsername
    }
    if (savedPassword) {
      loginForm.password = savedPassword
      loginForm.savePassword = true
    }
    loginForm.autoLogin = autoLogin

    // 如果是仅VPN学校，强制使用VPN
    if (isVpnOnlySchool.value) {
      loginForm.useVpn = true
    } else {
      loginForm.useVpn = useVpn
    }

    loginForm.useEasVpn = useEasVpn

    // 自动登录
    if (autoLogin && savedUsername && savedPassword) {
      console.log('执行自动登录...')
      await handleLogin()
    }
  } catch (error) {
    console.error('加载账号信息失败:', error)
  }
}

// 监听学校变化
watch(schoolId, async (newId) => {
  console.log('学校切换:', newId)
  // 重置会话状态
  vpnSessionReady = false
  vpnCookies = []
  // 重置表单
  resetForm()
  // 如果需要验证码，获取验证码
  if (requireCaptcha.value) {
    await refreshCaptcha()
  }
  // 如果是仅VPN学校，强制使用VPN
  if (isVpnOnlySchool.value) {
    loginForm.useVpn = true
  }
})

// 组件挂载
// ========== 新增：验证登录状态是否有效 ==========
const verifyLoginStatus = async () => {
  if (schoolId.value !== 'jcut') return { valid: false, username: '' }

  try {
    console.log('[IPassLogin] 验证登录状态...')

    // 使用 tryLoginUserInfo API 验证登录状态
    const verifyUrl = 'https://sec.jcut.edu.cn/webvpn/LjIwMS4xNjkuMTcwLjIxMC4xNjQ=/LjIwNi4xNzQuMTAwLjIwNC4xNDguMjE4LjE2NC4xNDUuMTUwLjIwMi4xNzQuOTkuMTk4LjIwOQ==/tryLoginUserInfo?vpn-12-my.jcut.edu.cn'

    const result = await ipc.ipassPost(verifyUrl, '', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://sec.jcut.edu.cn',
        'Referer': 'https://sec.jcut.edu.cn/webvpn/',
        'Cookie': cookiesToString(),
      }
    })

    console.log('[IPassLogin] 验证响应:', result.success, result.status, result.data)

    if (result.success && result.data) {
      let data = result.data
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data)
        } catch (e) {
          return { valid: false, username: '' }
        }
      }

      // 检查是否登录成功
      // 成功: {"meta":{"success":true,...},"data":{"userId":"xxx","userName":"xxx",...}}
      // 失败: {"meta":{"success":false,"statusCode":302,"message":"未登录或会话已过期"}}
      if (data.meta && data.meta.success === true && data.data) {
        const username = data.data.userName || data.data.userId || ''
        console.log('[IPassLogin] ✅ 登录状态有效，用户:', username)
        return { valid: true, username: username }
      }
    }

    console.log('[IPassLogin] 登录已过期或未登录')
    return { valid: false, username: '' }
  } catch (error) {
    console.error('[IPassLogin] 验证登录状态失败:', error)
    return { valid: false, username: '' }
  }
}

// ========== 新增：检查并恢复登录状态 ==========
const checkAndRestoreLoginStatus = async () => {
  if (schoolId.value !== 'jcut') return { loggedIn: false, username: '' }

  // 检查是否有保存的session cookies
  const savedCookies = await store.getString('JCUT_VPN_COOKIES', '')
  if (savedCookies) {
    try {
      const cookies = JSON.parse(savedCookies)
      if (cookies.length > 0) {
        vpnCookies = cookies
        vpnSessionReady = true
        // 同时恢复到authService
        authService.jcutVpnCookies = [...cookies]
        console.log('[IPassLogin] 恢复保存的cookies:', cookies.length)

        // 验证登录是否仍然有效
        const verifyResult = await verifyLoginStatus()
        if (verifyResult.valid) {
          authService.ipassLoginStatus.value = true
          authService.useVpn = true
          // 保存用户名到store，供App.vue使用
          if (verifyResult.username) {
            await store.putString('IPASS_USER_NAME', verifyResult.username)
          }
          return { loggedIn: true, username: verifyResult.username }
        } else {
          // 登录已过期，清除保存的cookies
          await store.putString('JCUT_VPN_COOKIES', '')
          vpnCookies = []
          vpnSessionReady = false
          authService.jcutVpnCookies = []
        }
      }
    } catch (e) {
      console.error('[IPassLogin] 解析保存的cookies失败:', e)
    }
  }
  return { loggedIn: false, username: '' }
}

// ========== 新增：保存登录cookies ==========
const saveLoginCookies = async () => {
  if (vpnCookies.length > 0) {
    // 只保存关键cookie：my_vpn_ticket 和 my_client_ticket
    const essentialCookies = vpnCookies.filter(c => {
      const name = c.split('=')[0]
      return name === 'my_vpn_ticket' || name === 'my_client_ticket'
    })

    // 验证cookie格式正确（特别是my_client_ticket不应该是拼接的多个JWT）
    const clientTicket = essentialCookies.find(c => c.startsWith('my_client_ticket='))
    if (clientTicket) {
      const value = clientTicket.split('=').slice(1).join('=')
      // 正常JWT只有3个部分（2个.分隔符），如果有超过2个.说明可能被拼接了
      const dotCount = (value.match(/\./g) || []).length
      if (dotCount !== 2) {
        console.error('[IPassLogin] ⚠️ my_client_ticket格式异常，可能被拼接了，dotCount:', dotCount)
        // 不保存异常的cookie
        return
      }
    }

    await store.putString('JCUT_VPN_COOKIES', JSON.stringify(essentialCookies))
    authService.jcutVpnCookies = [...essentialCookies]
    console.log('[IPassLogin] 保存登录cookies:', essentialCookies.map(c => c.split('=')[0]))
  }
}

onMounted(async () => {
  // 加载主题设置
  const savedDarkMode = localStorage.getItem('ujn_dark_mode')
  if (savedDarkMode === '1') {
    isDarkMode.value = true
    document.documentElement.classList.add('dark-theme')
  }

  console.log(`当前学校: ${schoolName.value} (${schoolId.value})`)
  console.log(`SSO类型: ${ssoType.value}`)
  console.log(`需要验证码: ${requireCaptcha.value}`)
  console.log(`仅VPN登录: ${isVpnOnlySchool.value}`)

  // 如果是仅VPN学校，强制使用VPN
  if (isVpnOnlySchool.value) {
    loginForm.useVpn = true
  }

  await loadSavedAccount()
  await checkNetworkStatus()

  // ========== 检查是否已登录（像教务登录一样处理） ==========
  if (schoolId.value === 'jcut') {
    const loginResult = await checkAndRestoreLoginStatus()
    if (loginResult.loggedIn) {
      console.log('[IPassLogin] 检测到已登录状态，用户:', loginResult.username)
      const displayName = loginResult.username || '用户'
      loginStatus.value = { success: true, message: `您已登录 ${displayName}` }
      ElMessage.success(`您已登录 ${displayName}，正在跳转...`)
      // 延迟跳转，像教务登录一样
      setTimeout(() => {
        router.push('/')
      }, 500)
      return // 已登录，不需要初始化验证码
    }
  }

  // 如果需要验证码，初始化会话并获取验证码
  if (requireCaptcha.value && schoolId.value === 'jcut') {
    // 先初始化会话
    const sessionOk = await initVpnSession()
    if (sessionOk) {
      // 然后获取验证码
      await refreshCaptcha()
    } else {
      ElMessage.warning('WebVPN连接失败，请点击验证码重试')
    }
  }
})
</script>

<style>
/* 全局CSS变量 */
:root {
  --primary-color: #5c6cff;
  --primary-color-rgb: 92, 108, 255;
  --primary-light: #8a96ff;
  --primary-dark: #4155e2;
  --success-color: #34C759;
  --warning-color: #FF9500;
  --danger-color: #FF3B30;
  --info-color: #5AC8FA;
  --bg-color: #f5f7fa;
  --card-bg: #ffffff;
  --text-primary: #303133;
  --text-secondary: #606266;
  --text-hint: #909399;
  --border-color: #EBEEF5;
  --shadow-light: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  --shadow-medium: 0 4px 16px 0 rgba(0, 0, 0, 0.08);
  --transition-normal: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

:root.dark-theme {
  --primary-color: #7c8aff;
  --primary-light: #a5afff;
  --primary-dark: #5c6cff;
  --bg-color: #121212;
  --card-bg: #242424;
  --text-primary: rgba(255, 255, 255, 0.9);
  --text-secondary: rgba(255, 255, 255, 0.7);
  --text-hint: rgba(255, 255, 255, 0.5);
  --border-color: #3e3e3e;
  --shadow-light: 0 2px 12px 0 rgba(0, 0, 0, 0.2);
  --shadow-medium: 0 4px 16px 0 rgba(0, 0, 0, 0.3);
}
</style>

<style scoped>
/* 页面容器 */
.login-container {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
  position: relative;
  min-height: 100vh;
  background-color: var(--bg-color);
  color: var(--text-primary);
  transition: var(--transition-normal);
}

/* 背景装饰 */
.bg-decoration {
  position: fixed;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  overflow: hidden;
  z-index: 0;
  pointer-events: none;
}

.bg-particles {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, var(--primary-color) 0%, transparent 70%);
  opacity: 0.1;
  filter: blur(10px);
  animation: float 30s linear infinite;
}

.bg-particles:nth-child(1) { width: 300px; height: 300px; top: 10%; left: 5%; animation-duration: 45s; }
.bg-particles:nth-child(2) { width: 200px; height: 200px; top: 40%; right: 10%; animation-duration: 35s; animation-delay: 2s; }
.bg-particles:nth-child(3) { width: 100px; height: 100px; bottom: 30%; left: 20%; animation-duration: 25s; animation-delay: 5s; }
.bg-particles:nth-child(4) { width: 150px; height: 150px; bottom: 10%; right: 15%; animation-duration: 40s; animation-delay: 10s; }
.bg-particles:nth-child(5) { width: 180px; height: 180px; top: 20%; right: 30%; animation-duration: 50s; animation-delay: 7s; }
.bg-particles:nth-child(6) { width: 120px; height: 120px; bottom: 40%; right: 40%; animation-duration: 55s; animation-delay: 3s; }
.bg-particles:nth-child(7) { width: 250px; height: 250px; top: 60%; left: 10%; animation-duration: 60s; animation-delay: 15s; }
.bg-particles:nth-child(8) { width: 200px; height: 200px; bottom: 20%; left: 40%; animation-duration: 45s; animation-delay: 8s; }

.bg-gradient {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(92, 108, 255, 0.03) 0%, rgba(92, 108, 255, 0) 50%);
}

@keyframes float {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  25% { transform: translate(20px, 30px) rotate(90deg) scale(1.1); }
  50% { transform: translate(40px, 20px) rotate(180deg) scale(1.2); }
  75% { transform: translate(20px, -10px) rotate(270deg) scale(1.1); }
  100% { transform: translate(0, 0) rotate(360deg) scale(1); }
}

/* 顶部操作栏 */
.top-actions {
  display: flex;
  justify-content: flex-end;
  padding: 10px 0;
  position: relative;
  z-index: 10;
}

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--card-bg);
  box-shadow: var(--shadow-light);
  cursor: pointer;
  transition: var(--transition-normal);
}

.theme-toggle:hover {
  transform: rotate(30deg);
  box-shadow: var(--shadow-medium);
}

.theme-toggle .el-icon {
  font-size: 20px;
  color: var(--primary-color);
}

/* 页面标题 */
.page-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--text-primary);
  position: relative;
  z-index: 1;
  text-align: center;
}

/* 原有样式 - 添加z-index确保在背景之上 */
.login-container {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
}

.page-title {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
  font-size: 24px;
}

.login-card {
  position: relative;
  z-index: 1;
  padding: 20px;
}

.login-options {
  display: flex;
  gap: 20px;
  margin: 10px 0;
  flex-wrap: wrap;
}

.login-status {
  text-align: center;
  margin: 15px 0;
}

.status-success {
  color: #67c23a;
}

.status-error {
  color: #f56c6c;
}

.login-tips {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f7fa;
  border-radius: 4px;
  font-size: 13px;
  color: #606266;
}

.login-tips p {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 8px 0;
}

.login-tips .el-icon {
  color: #409eff;
}

/* 验证码样式 */
.captcha-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.captcha-image {
  width: 120px;
  height: 40px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}

.captcha-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.captcha-image:hover {
  border-color: #409eff;
}

.captcha-loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.captcha-placeholder {
  font-size: 12px;
  color: #909399;
}

.captcha-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
  display: flex;
  justify-content: space-between;
}

.captcha-hint .hint-text {
  color: #e6a23c;
}

/* 加载动画 */
.is-loading {
  animation: rotating 2s linear infinite;
}

@keyframes rotating {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>