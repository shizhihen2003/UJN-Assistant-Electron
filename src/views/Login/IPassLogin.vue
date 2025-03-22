<!-- src/views/login/IPassLogin.vue -->
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
        </div>

        <div class="login-status" v-if="loginStatus">
          <span :class="{'status-success': loginStatus.success, 'status-error': !loginStatus.success}">
            {{ loginStatus.message }}
          </span>
        </div>

        <div class="login-tips">
          <p><el-icon><InfoFilled /></el-icon> 智慧济大账号通常与教务系统账号相同</p>
          <p><el-icon><InfoFilled /></el-icon> 此登录用于VPN访问校内资源和电子饮水卡等服务</p>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock, Connection, RefreshLeft, InfoFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import authService from '@/services/authService'

const router = useRouter()

// 初始化状态
const loginFormRef = ref(null)
const loading = ref(false)
const loginStatus = ref(null)

// 登录表单
const loginForm = reactive({
  username: '',
  password: '',
  savePassword: true,
  autoLogin: false
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

// 处理登录
const handleLogin = async () => {
  if (!loginFormRef.value) return

  try {
    // 表单验证
    await loginFormRef.value.validate()

    // 显示加载状态
    loading.value = true
    loginStatus.value = { success: false, message: '正在登录...' }

    // 执行登录
    const result = await authService.loginIpass(
        loginForm.username,
        loginForm.password
    )

    if (result) {
      // 登录成功
      loginStatus.value = { success: true, message: '登录成功，正在跳转...' }
      ElMessage.success('登录成功')

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
    const status = authService.getLoginStatus()
    if (status.ipass) {
      ElMessage.info('您已登录智慧济大')
      router.push('/')
      return
    }

    // 加载已保存的账号信息
    const savedAccount = await authService.getSavedAccount('ipass')
    if (savedAccount) {
      loginForm.username = savedAccount.username || ''
      loginForm.password = savedAccount.password || ''

      // 如果设置了自动登录
      if (savedAccount.autoLogin) {
        loginForm.autoLogin = true
        handleLogin()
      }
    }
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
</style>