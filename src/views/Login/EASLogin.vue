<!-- src/views/login/EASLogin.vue -->
<template>
  <div class="login-container">
    <h1 class="page-title">教务系统登录</h1>

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

        <el-form-item label="入学年份" prop="entranceYear">
          <el-input-number
              v-model="loginForm.entranceYear"
              :min="2000"
              :max="currentYear"
              controls-position="right"
          ></el-input-number>
          <div class="form-tip">通常是学号的前四位</div>
        </el-form-item>

        <el-form-item label="教务节点">
          <el-select v-model="loginForm.nodeIndex" placeholder="请选择教务节点">
            <el-option
                v-for="(node, index) in eaNodes"
                :key="index"
                :label="`节点${index + 1}: ${node}`"
                :value="index"
            ></el-option>
          </el-select>
          <div class="form-tip">默认选择节点1，如果登录失败可尝试其他节点</div>
        </el-form-item>

        <el-form-item>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-button type="primary" @click="handleLogin" :loading="loading" style="width: 100%">
                <el-icon><Key /></el-icon> 登录
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
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock, Key, RefreshLeft, Connection } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import authService from '@/services/authService'
import { UJNAPI } from '@/constants/api'

const router = useRouter()

// 初始化状态
const loginFormRef = ref(null)
const loading = ref(false)
const loginStatus = ref(null)
const currentYear = new Date().getFullYear()

// 教务节点列表
const eaNodes = UJNAPI.EA_HOSTS

// 登录表单
const loginForm = reactive({
  username: '',
  password: '',
  entranceYear: currentYear - 4, // 默认为四年前
  nodeIndex: 0, // 默认使用第一个节点
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
  ],
  entranceYear: [
    { required: true, message: '请选择入学年份', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value < 1990 || value > currentYear) {
          callback(new Error('入学年份不合理'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
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
    const result = await authService.loginEas(
        loginForm.username,
        loginForm.password,
        loginForm.entranceYear,
        loginForm.nodeIndex
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

// 根据学号自动设置入学年份
const autoSetEntranceYear = () => {
  const studentId = loginForm.username
  if (studentId && studentId.length >= 4) {
    const yearStr = studentId.substring(0, 4)
    const year = parseInt(yearStr, 10)

    if (!isNaN(year) && year >= 1990 && year <= currentYear) {
      loginForm.entranceYear = year
    }
  }
}

// 监听学号变化，自动设置入学年份
const watchUsername = computed(() => loginForm.username)
watchUsername.value && autoSetEntranceYear()

// 加载已保存的数据
onMounted(async () => {
  try {
    // 检查是否已登录
    const status = authService.getLoginStatus()
    if (status.eas) {
      ElMessage.info('您已登录教务系统')
      router.push('/')
      return
    }

    // 加载已保存的账号信息
    const savedAccount = await authService.getSavedAccount('eas')
    if (savedAccount) {
      loginForm.username = savedAccount.username || ''
      loginForm.password = savedAccount.password || ''
      loginForm.entranceYear = savedAccount.entranceYear || currentYear - 4
      loginForm.nodeIndex = savedAccount.nodeIndex || 0

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

.form-tip {
  font-size: 12px;
  color: var(--el-color-info);
  margin-top: 4px;
}
</style>