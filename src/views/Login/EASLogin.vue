<!-- src/views/Login/EASLogin.vue 支持多学校版本 -->
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
    <h1 class="page-title">{{ schoolName }}教务系统登录</h1>

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
              :min="1990"
              :max="currentYear"
              controls-position="right"
          ></el-input-number>
          <div class="form-tip">通常是学号的前四位</div>
        </el-form-item>

        <el-form-item label="教务节点" v-if="eaNodes.length > 1">
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

      <div class="server-status" v-if="serverStatus">
        <el-alert
            :title="serverStatus.message"
            :type="serverStatus.type"
            :closable="false"
            show-icon
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock, Key, RefreshLeft, Connection, Moon, Sunny } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import authService from '@/services/authService'
import { UJNAPI } from '@/constants/api'
import ipc from '@/utils/ipc'
import store from '@/utils/store'
import EASAccount from '@/models/EASAccount'

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
const serverStatus = ref(null)
const currentYear = new Date().getFullYear()

// 学校信息 - 使用ref，在mounted时获取
const schoolName = ref('教务')
const eaNodes = ref([])

// 刷新学校配置
const refreshSchoolConfig = () => {
  schoolName.value = UJNAPI.SCHOOL_NAME || '教务'
  eaNodes.value = UJNAPI.EA_HOSTS || []
  console.log(`[EASLogin] 当前学校: ${schoolName.value}, 节点数: ${eaNodes.value.length}`)
}

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

// 检查教务服务器连接状态
const checkServerStatus = async () => {
  try {
    const hosts = eaNodes.value
    if (!hosts || hosts.length === 0) {
      serverStatus.value = { message: '未配置教务节点', type: 'error' }
      return
    }

    loading.value = true
    serverStatus.value = { message: '正在检查教务服务器状态...', type: 'info' }

    // 获取最新的EASAccount实例（会自动检测学校切换并更新配置）
    const easAccount = EASAccount.getInstance()

    // 确保路径前缀已初始化
    await easAccount.ensurePathPrefix()

    // 使用EASAccount的getFullUrl方法构建正确的URL（会自动添加路径前缀）
    const url = easAccount.getFullUrl(UJNAPI.EA_LOGIN)
    console.log('[EASLogin] 检查服务器状态URL:', url)
    console.log('[EASLogin] 当前主机:', easAccount.host)

    // 使用ipc直接发送请求检查状态
    const result = await ipc.easGet(url, { timeout: 5000 })

    if (result.success) {
      serverStatus.value = { message: '教务服务器连接正常', type: 'success' }
      setTimeout(() => {
        serverStatus.value = null
      }, 3000)
    } else {
      serverStatus.value = { message: '教务服务器连接异常，可尝试切换节点', type: 'warning' }
    }
  } catch (error) {
    console.error('服务器状态检查失败', error)
    serverStatus.value = { message: '教务服务器连接失败', type: 'error' }
  } finally {
    loading.value = false
  }
}

// 处理登录
const handleLogin = async () => {
  if (!loginFormRef.value) return;

  try {
    // 表单验证
    await loginFormRef.value.validate();

    // 显示加载状态
    loading.value = true;
    loginStatus.value = { success: false, message: '正在登录...' };

    // 检查教务节点
    const hosts = eaNodes.value
    if (loginForm.nodeIndex >= 0 && loginForm.nodeIndex < hosts.length) {
      // 获取最新的EASAccount实例并设置主机
      const easAccount = EASAccount.getInstance();
      easAccount.changeHost(loginForm.nodeIndex);
    }

    // 清空之前可能的登录状态，确保重新登录
    authService.logoutEas();

    // 执行登录
    console.log("开始登录...");
    console.log(`使用账号: ${loginForm.username}, 节点索引: ${loginForm.nodeIndex}, 入学年份: ${loginForm.entranceYear}`);
    console.log(`当前学校: ${UJNAPI.SCHOOL_NAME}, 节点: ${hosts[loginForm.nodeIndex]}`);

    // 确保保存入学年份到持久化存储
    try {
      await store.putInt('ENTRANCE_TIME', loginForm.entranceYear);
      console.log(`入学年份 ${loginForm.entranceYear} 已保存到本地存储`);
    } catch (e) {
      console.error("保存入学年份失败", e);
    }

    const result = await authService.loginEas(
        loginForm.username,
        loginForm.password,
        loginForm.entranceYear,
        loginForm.nodeIndex
    );

    console.log("登录结果:", result);

    // 更新登录状态
    loading.value = false;

    if (result === true) {
      // 登录成功
      loginStatus.value = { success: true, message: '登录成功，正在跳转...' };
      ElMessage.success('登录成功');

      // 保存账号信息
      if (loginForm.savePassword) {
        try {
          await ipc.setStoreValue('EAS_ACCOUNT', loginForm.username);
          await ipc.setStoreValue('EAS_PASSWORD', loginForm.password);
          await ipc.setStoreValue('ENTRANCE_TIME', loginForm.entranceYear);
          await ipc.setStoreValue('EA_HOST', loginForm.nodeIndex);
          console.log("账号信息保存成功");
        } catch (error) {
          console.error('保存账号信息失败', error);
        }
      }

      // 保存自动登录设置
      if (loginForm.autoLogin) {
        await authService.saveAutoLogin('eas', true);
      }

      // 延迟跳转首页
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } else {
      // 登录失败
      loginStatus.value = { success: false, message: '用户名或密码错误' };
      ElMessage.error('登录失败：用户名或密码错误');

      // 检查服务器状态
      checkServerStatus();
    }
  } catch (error) {
    console.error('登录过程出现异常', error);
    loading.value = false;
    loginStatus.value = { success: false, message: `登录失败: ${error.message || '未知错误'}` };
    ElMessage.error(`登录失败: ${error.message || '网络错误'}`);

    // 检查服务器状态
    checkServerStatus();
  }
}

// 重置表单
const resetForm = () => {
  if (loginFormRef.value) {
    loginFormRef.value.resetFields()
    loginStatus.value = null
    serverStatus.value = null
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
watch(() => loginForm.username, (newValue) => {
  if (newValue) {
    autoSetEntranceYear()
  }
})

// 监听节点变化
watch(() => loginForm.nodeIndex, () => {
  serverStatus.value = null
})

// 加载已保存的数据
onMounted(async () => {
  // 刷新学校配置
  refreshSchoolConfig()

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
      loginForm.autoLogin = savedAccount.autoLogin || false

      console.log(`已加载保存的账号信息，入学年份: ${loginForm.entranceYear}`);

      // 如果设置了自动登录
      if (savedAccount.autoLogin && savedAccount.username && savedAccount.password) {
        handleLogin()
      }
    } else {
      // 即使没有保存账号，也尝试加载入学年份
      const savedEntranceYear = await store.getInt('ENTRANCE_TIME', 0)
      if (savedEntranceYear > 0) {
        loginForm.entranceYear = savedEntranceYear
        console.log(`已加载保存的入学年份: ${loginForm.entranceYear}`);
      }
    }

    // 检查服务器状态
    checkServerStatus()
  } catch (error) {
    console.error('加载数据失败', error)
    ElMessage.warning('加载保存的账号信息失败')
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
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  min-height: 100vh;
  position: relative;
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
  position: absolute;
  top: 20px;
  right: 20px;
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
  margin-bottom: 24px;
  color: var(--primary-color);
  position: relative;
  z-index: 1;
}

/* 登录卡片 */
.login-card {
  width: 100%;
  max-width: 480px;
  border-radius: 8px;
  position: relative;
  z-index: 1;
  background-color: var(--card-bg);
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
  margin-bottom: 16px;
}

.status-success {
  color: var(--success-color);
}

.status-error {
  color: var(--danger-color);
}

.form-tip {
  font-size: 12px;
  color: var(--text-hint);
  margin-top: 4px;
}

.server-status {
  margin-top: 16px;
}
</style>