<!-- src/views/Login/IPassLogin.vue 支持多学校版本 -->
<template>
  <div class="login-container">
    <h1 class="page-title">{{ schoolName }}统一认证登录</h1>

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
          <el-checkbox v-model="loginForm.useVpn" v-if="vpnEnabled">使用VPN登录</el-checkbox>
        </div>

        <!-- 教务系统VPN登录选项 -->
        <div class="login-options" v-if="loginForm.useVpn && vpnEnabled">
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
          <p><el-icon><InfoFilled /></el-icon> {{ schoolName }}账号通常与教务系统账号相同</p>
          <p><el-icon><InfoFilled /></el-icon> 此登录用于VPN访问校内资源</p>
          <p v-if="loginForm.useVpn"><el-icon><Warning /></el-icon> 当前使用VPN模式登录，适用于校外网络</p>
          <p v-if="loginForm.useVpn && loginForm.useEasVpn"><el-icon><InfoFilled /></el-icon> 登录成功后将自动使用VPN登录教务系统</p>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock, Connection, RefreshLeft, InfoFilled, Warning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import authService from '@/services/authService'
import { UJNAPI } from '@/constants/api'
import ipc from '@/utils/ipc'
import store from '@/utils/store'

const router = useRouter()

// 初始化状态
const loginFormRef = ref(null)
const loading = ref(false)
const loginStatus = ref(null)
const networkStatus = ref('checking')

// 动态获取当前学校名称
const schoolName = computed(() => {
  return UJNAPI.SCHOOL_NAME || ''
})

// VPN是否启用
const vpnEnabled = computed(() => {
  return UJNAPI.VPN_ENABLED
})

// 登录表单
const loginForm = reactive({
  username: '',
  password: '',
  savePassword: true,
  autoLogin: false,
  useVpn: false,
  useEasVpn: false
})

// 表单校验规则
const rules = {
  username: [
    { required: true, message: '请输入学号', trigger: 'blur' },
    { pattern: /^\d+$/, message: '学号应为数字', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
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

    // 设置VPN模式
    authService.useVpn = loginForm.useVpn
    await store.putBoolean('EA_USE_VPN', loginForm.useVpn)

    // 设置教务系统VPN模式
    if (loginForm.useVpn) {
      authService.useEasVpn = loginForm.useEasVpn
      await store.putBoolean('EA_USE_EAS_VPN', loginForm.useEasVpn)
    }

    // 执行登录
    console.log(`开始登录${schoolName.value}...`)
    console.log(`VPN模式: ${loginForm.useVpn}`)

    const result = await authService.loginIpass(
        loginForm.username,
        loginForm.password,
        loginForm.useVpn
    )

    if (result) {
      loginStatus.value = { success: true, message: '登录成功！' }
      ElMessage.success(`${schoolName.value}登录成功`)

      // 保存账号信息
      if (loginForm.savePassword) {
        await ipc.setStoreValue('IPASS_ACCOUNT', loginForm.username)
        await ipc.setStoreValue('IPASS_PASSWORD', loginForm.password)
      } else {
        await ipc.setStoreValue('IPASS_ACCOUNT', loginForm.username)
        await ipc.setStoreValue('IPASS_PASSWORD', '')
      }

      // 保存自动登录设置
      await store.putBoolean('IPASS_AUTO_LOGIN', loginForm.autoLogin)

      // 如果选择了使用VPN登录教务系统，自动登录教务系统
      if (loginForm.useVpn && loginForm.useEasVpn) {
        loginStatus.value = { success: true, message: '正在登录教务系统...' }
        try {
          const easResult = await authService.loginEasViaVpn(loginForm.username, loginForm.password)
          if (easResult) {
            ElMessage.success('教务系统登录成功')
            loginStatus.value = { success: true, message: '教务系统登录成功，正在跳转...' }
          } else {
            ElMessage.warning('教务系统自动登录失败，请稍后手动登录')
          }
        } catch (error) {
          console.error('教务系统登录失败', error)
          ElMessage.warning('教务系统自动登录失败，请稍后手动登录')
        }
      }

      // 延迟跳转首页
      setTimeout(() => {
        router.push('/')
      }, 1000)
    } else {
      loginStatus.value = { success: false, message: '用户名或密码错误' }
      ElMessage.error('登录失败：用户名或密码错误')
    }
  } catch (error) {
    console.error('登录失败', error)
    loginStatus.value = { success: false, message: `登录失败: ${error.message || '未知错误'}` }
    ElMessage.error(`登录失败: ${error.message || '网络错误'}`)
  } finally {
    loading.value = false
  }
}

// 重置表单
const resetForm = () => {
  if (loginFormRef.value) {
    loginFormRef.value.resetFields()
    loginStatus.value = null
  }
}

// 监听VPN设置变化
watch(() => loginForm.useVpn, async (newValue) => {
  console.log(`VPN设置已更改: ${newValue}`)
  authService.useVpn = !!newValue

  if (!newValue) {
    loginForm.useEasVpn = false
    authService.useEasVpn = false
    await store.putBoolean('EA_USE_EAS_VPN', false)
  }

  try {
    await store.putBoolean('EA_USE_VPN', !!newValue)
  } catch (error) {
    console.error('保存VPN设置失败', error)
  }
})

// 监听教务系统VPN设置变化
watch(() => loginForm.useEasVpn, async (newValue) => {
  console.log(`教务系统VPN设置已更改: ${newValue}`)
  if (loginForm.useVpn) {
    authService.useEasVpn = !!newValue
    try {
      await store.putBoolean('EA_USE_EAS_VPN', !!newValue)
    } catch (error) {
      console.error('保存教务系统VPN设置失败', error)
    }
  }
})

// 加载已保存的数据
onMounted(async () => {
  try {
    // 检查是否已登录
    if (authService.ipassLoginStatus.value) {
      ElMessage.info(`您已登录${schoolName.value}`)
      router.push('/')
      return
    }

    // 加载已保存的VPN设置
    try {
      const savedUseVpn = await store.getBoolean('EA_USE_VPN', false)
      loginForm.useVpn = savedUseVpn

      const savedUseEasVpn = await store.getBoolean('EA_USE_EAS_VPN', false)
      loginForm.useEasVpn = savedUseEasVpn

      authService.useVpn = !!savedUseVpn
      authService.useEasVpn = !!savedUseEasVpn

      console.log(`从存储加载VPN设置: ${!!savedUseVpn}, 教务系统VPN: ${!!savedUseEasVpn}`)
    } catch (error) {
      console.error('加载VPN设置失败', error)
    }

    // 加载已保存的账号信息
    try {
      const savedAccount = await ipc.getStoreValue('IPASS_ACCOUNT')
      const savedPassword = await ipc.getStoreValue('IPASS_PASSWORD')
      const savedAutoLogin = await store.getBoolean('IPASS_AUTO_LOGIN', false)

      if (savedAccount) {
        loginForm.username = savedAccount
        loginForm.password = savedPassword || ''
        loginForm.savePassword = !!savedPassword
        loginForm.autoLogin = savedAutoLogin

        // 如果设置了自动登录
        if (savedAutoLogin && savedAccount && savedPassword) {
          handleLogin()
        }
      }
    } catch (error) {
      console.error('加载账号信息失败', error)
    }

    // 检查网络状态
    checkNetworkStatus()
  } catch (error) {
    console.error('加载数据失败', error)
  }
})
</script>

<style scoped>
.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--el-color-primary);
}

.login-card {
  width: 100%;
  max-width: 480px;
  border-radius: 8px;
}

.login-options {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-top: 16px;
  margin-bottom: 16px;
}

.login-status {
  text-align: center;
  margin-top: 16px;
}

.status-success {
  color: var(--el-color-success);
}

.status-error {
  color: var(--el-color-danger);
}

.login-tips {
  margin-top: 24px;
  padding: 12px;
  background-color: var(--el-color-info-light-9);
  border-radius: 4px;
}

.login-tips p {
  display: flex;
  align-items: center;
  margin: 8px 0;
  font-size: 13px;
  color: var(--el-color-info-dark-2);
}

.login-tips .el-icon {
  margin-right: 8px;
  color: var(--el-color-info);
}

.login-tips p:last-child .el-icon {
  color: var(--el-color-warning);
}
</style>
