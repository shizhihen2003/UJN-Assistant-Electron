<template>
  <div class="page-container">
    <h1 class="page-title">智慧济大登录</h1>

    <el-card class="login-card">
      <el-form :model="loginForm" :rules="rules" ref="loginFormRef" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="loginForm.username" placeholder="请输入学号"></el-input>
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input v-model="loginForm.password" type="password" placeholder="请输入密码"></el-input>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleLogin" :loading="loading">登录</el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

// 登录表单
const loginFormRef = ref(null)
const loginForm = reactive({
  username: '',
  password: ''
})

// 表单验证规则
const rules = {
  username: [
    { required: true, message: '请输入学号', trigger: 'blur' },
    { pattern: /^\d+$/, message: '学号应为数字', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

const loading = ref(false)

// 处理登录
const handleLogin = async () => {
  if (!loginFormRef.value) return

  try {
    await loginFormRef.value.validate()

    loading.value = true

    // 实际开发中，这里应该调用实际的登录API
    // 模拟登录过程
    setTimeout(() => {
      // 保存登录信息
      saveLoginInfo()

      // 显示成功消息
      ElMessage.success('登录成功')

      loading.value = false
    }, 1500)
  } catch (error) {
    loading.value = false
    console.error('表单验证失败:', error)
  }
}

// 保存登录信息
const saveLoginInfo = async () => {
  try {
    // 保存凭证
    const credentials = {
      type: 'ipass',
      account: loginForm.username,
      password: loginForm.password
    }

    // 实际开发中，这里应该使用electronAPI保存信息
    // await window.electronAPI.setStoreValue('credentials', credentials)

    console.log('保存的登录信息:', credentials)
  } catch (error) {
    console.error('保存登录信息失败:', error)
    ElMessage.error('保存登录信息失败')
  }
}

// 重置表单
const resetForm = () => {
  if (loginFormRef.value) {
    loginFormRef.value.resetFields()
  }
}

// 加载已保存的数据
onMounted(async () => {
  try {
    // 实际开发中，这里应该使用electronAPI获取保存的信息
    // const credentials = await window.electronAPI.getStoreValue('credentials')

    // 模拟数据
    const credentials = { type: 'ipass', account: '', password: '' }

    if (credentials && credentials.type === 'ipass') {
      loginForm.username = credentials.account || ''
      loginForm.password = credentials.password || ''
    }
  } catch (error) {
    console.error('加载数据失败:', error)
  }
})
</script>

<style scoped>
.login-card {
  max-width: 500px;
  margin: 0 auto;
}
</style>