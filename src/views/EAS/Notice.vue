<template>
  <div class="page-container" :class="{ 'dark-mode': isDarkMode }">
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

    <h1 class="page-title">教务通知</h1>

    <div class="controls">
      <el-button type="primary" @click="queryNotices" :loading="loading">
        <el-icon><Refresh /></el-icon> 刷新通知
      </el-button>
    </div>

    <el-card v-if="needLogin" class="notice-card login-tip">
      <el-empty description="请先登录教务系统">
        <el-button type="primary" @click="goToLogin">去登录</el-button>
      </el-empty>
    </el-card>

    <el-card v-else-if="loading" class="notice-card">
      <div class="loading-container">
        <el-skeleton :rows="5" animated />
      </div>
    </el-card>

    <template v-else>
      <el-empty v-if="notices.length === 0" description="暂无通知" />

      <el-card v-for="(notice, index) in notices" :key="index" class="notice-card">
        <template #header>
          <div class="notice-header">
            <span class="notice-title">{{ notice.title || notice.content.substring(0, 30) + '...' }}</span>
            <span class="notice-time">{{ formatTime(notice.time) }}</span>
          </div>
        </template>
        <div class="notice-content">{{ notice.content }}</div>
      </el-card>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, Moon, Sunny } from '@element-plus/icons-vue'
import EASAccount from '@/models/EASAccount'
import store from '@/utils/store'

const router = useRouter()
const loading = ref(false)
const needLogin = ref(false)
const notices = ref([])

// 主题切换
const isDarkMode = ref(false)

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value
  document.documentElement.classList.toggle('dark-theme', isDarkMode.value)
  localStorage.setItem('ujn_dark_mode', isDarkMode.value ? '1' : '0')
}

// 格式化时间
const formatTime = (timeString) => {
  if (!timeString) return ''

  try {
    // 处理YYYY-MM-DD HH:MM:SS格式
    const date = new Date(timeString.replace(/-/g, '/'))
    if (isNaN(date.getTime())) {
      return timeString
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  } catch (error) {
    console.error('时间格式化失败:', error)
    return timeString
  }
}

// 加载缓存的通知
const loadCachedNotices = async () => {
  try {
    const cachedNotices = await store.getObject('eas_notices', [])
    if (cachedNotices && cachedNotices.length > 0) {
      notices.value = cachedNotices
      console.log('从缓存加载通知:', cachedNotices.length)
    }
  } catch (error) {
    console.error('加载缓存通知失败:', error)
  }
}

// 刷新通知
const queryNotices = async () => {
  loading.value = true
  needLogin.value = false

  try {
    const easAccount = EASAccount.getInstance()

    // 检查登录状态
    const isLoggedIn = await easAccount.absCheckLogin()
    if (!isLoggedIn) {
      const loginSuccess = await easAccount.login()
      if (!loginSuccess) {
        needLogin.value = true
        ElMessage.warning('请先登录教务系统')
        return
      }
    }

    // 查询通知
    console.log('开始查询教务通知')
    const noticeResults = await easAccount.queryNotice(1, 20)

    // 处理结果
    if (noticeResults && noticeResults.length > 0) {
      notices.value = noticeResults

      // 缓存通知
      await store.putObject('eas_notices', noticeResults)

      ElMessage.success(`成功获取 ${noticeResults.length} 条通知`)
    } else {
      if (notices.value.length === 0) {
        ElMessage.info('暂无教务通知')
      } else {
        ElMessage.info('通知已是最新')
      }
    }
  } catch (error) {
    console.error('查询通知失败:', error)

    if (error.message && error.message.includes('登录')) {
      needLogin.value = true
      ElMessage.warning('请先登录教务系统')
    } else {
      ElMessage.error('获取通知失败: ' + error.message)
    }
  } finally {
    loading.value = false
  }
}

// 跳转到登录页面
const goToLogin = () => {
  router.push('/login/eas')
}

// 初始化
onMounted(async () => {
  // 加载主题设置
  const savedDarkMode = localStorage.getItem('ujn_dark_mode')
  if (savedDarkMode === '1') {
    isDarkMode.value = true
    document.documentElement.classList.add('dark-theme')
  }

  // 首先加载缓存的通知
  await loadCachedNotices()

  // 如果已经有缓存，显示缓存内容后再刷新
  if (notices.value.length > 0) {
    setTimeout(() => {
      queryNotices()
    }, 1000)
  } else {
    // 如果没有缓存，直接查询
    await queryNotices()
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
.page-container {
  padding: 20px;
  max-width: 1200px;
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
}

/* 原有样式 */
.controls {
  margin-bottom: 20px;
  position: relative;
  z-index: 1;
}

.notice-card {
  margin-bottom: 15px;
  position: relative;
  z-index: 1;
  background-color: var(--card-bg);
  border-radius: 16px;
  box-shadow: var(--shadow-light);
  transition: var(--transition-normal);
}

.notice-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-medium);
}

.notice-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.notice-title {
  font-weight: bold;
  font-size: 16px;
  color: var(--text-primary);
}

.notice-time {
  color: var(--text-hint);
  font-size: 14px;
}

.notice-content {
  margin-top: 10px;
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-line;
}

.loading-container {
  padding: 20px 0;
}

.login-tip {
  padding: 40px 0;
}

/* 响应式 */
@media screen and (max-width: 768px) {
  .page-container {
    padding: 16px;
  }
}
</style>