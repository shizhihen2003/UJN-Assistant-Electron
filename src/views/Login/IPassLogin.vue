<template>
  <div class="login-container">
    <h1 class="page-title">智慧济大登录</h1>

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
          <el-checkbox v-model="loginForm.useVpn">使用VPN登录</el-checkbox>
        </div>

        <div class="login-status" v-if="loginStatus">
          <span :class="{'status-success': loginStatus.success, 'status-error': !loginStatus.success}">
            {{ loginStatus.message }}
          </span>
        </div>

        <div class="login-tips">
          <p><el-icon><InfoFilled /></el-icon> 智慧济大账号通常与教务系统账号相同</p>
          <p><el-icon><InfoFilled /></el-icon> 此登录用于VPN访问校内资源和电子饮水卡等服务</p>
          <p v-if="loginForm.useVpn"><el-icon><Warning /></el-icon> 当前使用VPN模式登录，适用于校外网络</p>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock, Connection, RefreshLeft, InfoFilled, Warning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import authService from '@/services/authService'
import ipc from '@/utils/ipc'
import store from '@/utils/store'

const router = useRouter()

// 初始化状态
const loginFormRef = ref(null)
const loading = ref(false)
const loginStatus = ref(null)
const networkStatus = ref('checking') // 'checking', 'online', 'offline', 'vpn'

// 登录表单
const loginForm = reactive({
  username: '',
  password: '',
  savePassword: true,
  autoLogin: false,
  useVpn: false
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

    // 尝试直接访问智慧济大
    try {
      const response = await fetch('http://sso.ujn.edu.cn/tpass/login', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        timeout: 3000
      })

      if (response.ok || response.status === 0) { // status 0 可能在no-cors模式下表示成功
        networkStatus.value = 'online'
        console.log('直接访问可用')
        loginForm.useVpn = false
        return
      }
    } catch (error) {
      console.log('直接访问失败:', error)
    }

    // 尝试通过VPN访问
    try {
      const response = await fetch('https://webvpn.ujn.edu.cn/', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        timeout: 3000
      })

      if (response.ok || response.status === 0) {
        networkStatus.value = 'vpn'
        console.log('VPN访问可用')
        loginForm.useVpn = true
        ElMessage.info('检测到校外网络环境，已自动切换为VPN模式')
        return
      }
    } catch (error) {
      console.log('VPN访问失败:', error)
    }

    // 如果两种访问方式都失败
    networkStatus.value = 'offline'
    console.log('网络不可用')
    ElMessage.warning('检测到网络连接可能存在问题，建议检查网络')

  } catch (error) {
    console.error('网络检查失败', error)
    networkStatus.value = 'unknown'
  }
}

// 处理登录
const handleLogin = async () => {
  if (!loginFormRef.value) return

  try {
    // 表单验证
    await loginFormRef.value.validate()

    // 显示加载状态
    loading.value = true
    loginStatus.value = { success: false, message: '正在登录...' }

    // 同步VPN设置到authService - 立即设置为当前值，不要等待Promise
    authService.useVpn = loginForm.useVpn

    // 保存VPN设置到存储
    try {
      await store.putBoolean('EA_USE_VPN', loginForm.useVpn)
    } catch (error) {
      console.error('保存VPN设置失败', error)
    }

    console.log(`开始登录: 用户名=${loginForm.username}, 使用VPN=${loginForm.useVpn}`)

    // 执行登录
    const result = await authService.loginIpass(
        loginForm.username,
        loginForm.password
    )

    if (result) {
      // 登录成功
      loginStatus.value = { success: true, message: '登录成功，正在跳转...' }
      ElMessage.success('登录成功')

      // 保存账户信息
      if (loginForm.savePassword) {
        await ipc.setStoreValue('IPASS_ACCOUNT', loginForm.username)
        await ipc.setStoreValue('IPASS_PASSWORD', loginForm.password)
      } else {
        // 如果不记住密码，只保存账号
        await ipc.setStoreValue('IPASS_ACCOUNT', loginForm.username)
        await ipc.setStoreValue('IPASS_PASSWORD', '')
      }

      // 保存自动登录设置
      await store.putBoolean('IPASS_AUTO_LOGIN', loginForm.autoLogin)

      // 延迟跳转首页
      setTimeout(() => {
        router.push('/')
      }, 1000)
    } else {
      // 登录失败
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

// 加载已保存的数据
onMounted(async () => {
  try {
    // 检查是否已登录
    if (authService.ipassLoginStatus.value) {
      ElMessage.info('您已登录智慧济大')
      router.push('/')
      return
    }

    // 加载已保存的VPN设置
    try {
      const savedUseVpn = await store.getBoolean('EA_USE_VPN', false)
      loginForm.useVpn = savedUseVpn
      // 直接设置为布尔值，不要等待Promise
      authService.useVpn = !!savedUseVpn // 使用双感叹号确保是布尔值
      console.log(`从存储加载VPN设置: ${!!savedUseVpn}`)
    } catch (error) {
      console.error('加载VPN设置失败', error)
      // 默认为false
      loginForm.useVpn = false
      authService.useVpn = false
    }

    // 检查网络状态，可能会更新VPN设置
    await checkNetworkStatus()

    // 加载已保存的账号信息
    try {
      const savedUsername = await ipc.getStoreValue('IPASS_ACCOUNT', '')
      const savedPassword = await ipc.getStoreValue('IPASS_PASSWORD', '')
      const savedAutoLogin = await store.getBoolean('IPASS_AUTO_LOGIN', false)

      if (savedUsername) {
        loginForm.username = savedUsername

        if (savedPassword) {
          loginForm.password = savedPassword
          loginForm.savePassword = true

          // 如果设置了自动登录
          if (savedAutoLogin) {
            loginForm.autoLogin = true
            // 设置一个短暂的延迟，让界面有时间渲染
            setTimeout(() => {
              handleLogin()
            }, 500)
          }
        }
      }
    } catch (error) {
      console.error('加载账号信息失败', error)
    }
  } catch (error) {
    console.error('加载数据失败', error)
  }
})

// 监听VPN设置变化
watch(() => loginForm.useVpn, async (newValue) => {
  console.log(`VPN设置已更改: ${newValue}`)
  // 直接设置布尔值到authService
  authService.useVpn = !!newValue
  // 同时保存到存储
  try {
    await store.putBoolean('EA_USE_VPN', !!newValue)
  } catch (error) {
    console.error('保存VPN设置失败', error)
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