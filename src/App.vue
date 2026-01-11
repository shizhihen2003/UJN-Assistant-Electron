<template>
  <div class="app-container">
    <!-- 标题栏 (自定义窗口标题栏) -->
    <div class="title-bar">
      <div class="title-bar-content">
        <img src="./assets/logo.png" alt="UJN Logo" class="app-logo" />
        <span class="app-title">UJN Assistant</span>
      </div>
      <div class="window-controls">
        <div class="control-button minimize" @click="minimizeWindow">
          <el-icon><Minus /></el-icon>
        </div>
        <div class="control-button maximize" @click="maximizeWindow">
          <el-icon><FullScreen /></el-icon>
        </div>
        <div class="control-button close" @click="closeWindow">
          <el-icon><Close /></el-icon>
        </div>
      </div>
    </div>

    <div class="app-body">
      <!-- 侧边栏导航 -->
      <div class="sidebar" :class="{ 'collapsed': isSidebarCollapsed }">
        <div class="sidebar-toggle" @click="toggleSidebar">
          <el-icon><ArrowLeft v-if="!isSidebarCollapsed" /><ArrowRight v-else /></el-icon>
        </div>

        <el-menu
            :default-active="activeMenu"
            :collapse="isSidebarCollapsed"
            :router="true"
            class="sidebar-menu"
        >
          <el-menu-item index="/">
            <el-icon><HomeFilled /></el-icon>
            <template #title>首页</template>
          </el-menu-item>

          <el-sub-menu index="/schedule">
            <template #title>
              <el-icon><Calendar /></el-icon>
              <span>课表</span>
            </template>
            <el-menu-item index="/daily-lesson">
              <el-icon><Monitor /></el-icon>
              <span>当日课表</span>
            </el-menu-item>
            <el-menu-item index="/term-lesson">
              <el-icon><Notebook /></el-icon>
              <span>学期课表</span>
            </el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="/eas">
            <template #title>
              <el-icon><School /></el-icon>
              <span>教务查询</span>
            </template>
            <el-menu-item index="/eas/notice">
              <el-icon><Bell /></el-icon>
              <span>教务通知</span>
            </el-menu-item>
            <el-menu-item index="/eas/lesson-table">
              <el-icon><Document /></el-icon>
              <span>课表查询</span>
            </el-menu-item>
            <el-menu-item index="/eas/marks">
              <el-icon><DataLine /></el-icon>
              <span>成绩查询</span>
            </el-menu-item>
            <el-menu-item index="/eas/exams">
              <el-icon><AlarmClock /></el-icon>
              <span>考试查询</span>
            </el-menu-item>
            <el-menu-item index="/eas/empty-classroom">
              <el-icon><School /></el-icon>
              <span>空教室查询</span>
            </el-menu-item>
          </el-sub-menu>

          <!-- 门户查询 - 动态显示学校名称 -->
          <el-sub-menu index="/ipass">
            <template #title>
              <el-icon><School /></el-icon>
              <span>{{ schoolShortName }}门户</span>
            </template>
            <el-menu-item index="/ipass/school-calendar">
              <el-icon><Bell /></el-icon>
              <span>校历查询</span>
            </el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="/user">
            <template #title>
              <el-icon><User /></el-icon>
              <span>账号管理</span>
            </template>
            <el-menu-item index="/login/eas">
              <el-icon><Key /></el-icon>
              <span>教务登录</span>
            </el-menu-item>
            <!-- 门户登录 - 动态显示学校名称 -->
            <el-menu-item index="/login/ipass">
              <el-icon><Connection /></el-icon>
              <span>{{ schoolShortName }}门户登录</span>
            </el-menu-item>
          </el-sub-menu>

          <el-menu-item index="/ai-assistant">
            <el-icon><ChatDotRound /></el-icon>
            <template #title>AI 助手</template>
          </el-menu-item>

          <el-menu-item index="/settings">
            <el-icon><Setting /></el-icon>
            <template #title>设置</template>
          </el-menu-item>
        </el-menu>

        <div class="sidebar-footer">
          <div class="current-time">{{ currentTime }}</div>
          <div class="status-indicator" :class="{ 'online': isOnline, 'offline': !isOnline }">
            {{ isOnline ? '已连接' : '未连接' }}
          </div>
        </div>
      </div>

      <!-- 主内容区 -->
      <div class="main-content" :class="{ 'expanded': isSidebarCollapsed }">
        <div class="content-header">
          <div class="breadcrumb">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
              <el-breadcrumb-item v-if="currentRoute.meta.title">{{ currentRoute.meta.title }}</el-breadcrumb-item>
            </el-breadcrumb>
          </div>

          <!-- 用户信息区域 - 根据登录状态显示不同内容 -->
          <div class="user-info" v-if="isLoggedIn">
            <el-dropdown trigger="click">
              <div class="user-dropdown">
                <el-avatar :size="32" :src="userAvatar">{{ userInitials }}</el-avatar>
                <span class="username">{{ userName }}</span>
                <el-icon><CaretBottom /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item divided @click="handleLogout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div class="login-btn" v-else>
            <router-link to="/login/eas">
              <el-button type="primary" size="small">登录</el-button>
            </router-link>
          </div>
        </div>

        <div class="content-body">
          <el-config-provider :locale="zhCn">
            <router-view v-slot="{ Component }">
              <transition name="fade" mode="out-in">
                <keep-alive :include="cachedViews">
                  <component :is="Component" />
                </keep-alive>
              </transition>
            </router-view>
          </el-config-provider>
        </div>

        <div class="status-bar">
          <div class="status-message">{{ statusMessage }}</div>
          <div class="version">v3.0.0</div>
        </div>
      </div>
    </div>

    <!-- 首次启动学校选择对话框 -->
    <SchoolSetupDialog ref="schoolSetupDialog" @completed="onSchoolSetupCompleted" />
  </div>
</template>

<script setup>
// App.vue 的 script 部分
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  HomeFilled, Calendar, School, User, Setting, Monitor, Notebook,
  Bell, Document, DataLine, Collection, AlarmClock, Key, Connection,
  Timer, CaretBottom, ArrowLeft, ArrowRight, Minus, FullScreen, Close, OfficeBuilding,
  ChatDotRound
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import authService from '@/services/authService'
import store from '@/utils/store'
import SchoolSetupDialog from '@/components/SchoolSetupDialog.vue'
import { UJNAPI } from '@/constants/api'

// 学校选择对话框引用
const schoolSetupDialog = ref(null)

// 动态获取学校名称
const schoolShortName = computed(() => UJNAPI.SCHOOL_SHORT_NAME || '济大')
const schoolName = computed(() => UJNAPI.SCHOOL_NAME || '济南大学')

// 侧边栏状态
const isSidebarCollapsed = ref(false)
const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
  localStorage.setItem('sidebarStatus', isSidebarCollapsed.value ? '1' : '0')
}

// 路由相关
const route = useRoute()
const activeMenu = computed(() => route.path)
const currentRoute = computed(() => route)

// 缓存视图
const cachedViews = ref(['Home', 'DailyLesson', 'TermLesson'])

// 用户信息
const isLoggedIn = ref(false)
const userName = ref('')
const userAvatar = ref('')
const userInitials = computed(() => {
  return userName.value ? userName.value.charAt(0).toUpperCase() : 'U'
})

// 状态信息
const statusMessage = ref('就绪')
const isOnline = ref(true)
const currentTime = ref('')

// 更新时间
const updateTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 检查登录状态
const checkLoginStatus = async () => {
  try {
    const status = authService.getLoginStatus()
    isLoggedIn.value = status.isLoggedIn

    if (isLoggedIn.value) {
      const userInfo = authService.getUserInfo()
      userName.value = userInfo.name || userInfo.studentId || '用户'
    }
  } catch (error) {
    console.error('检查登录状态失败', error)
  }
}

// 登出
const handleLogout = async () => {
  try {
    await authService.logoutAll()
    isLoggedIn.value = false
    userName.value = ''
    ElMessage.success('已退出登录')
  } catch (error) {
    console.error('登出失败', error)
    ElMessage.error('登出失败')
  }
}

// 窗口控制
const minimizeWindow = () => {
  if (window.electron) {
    window.electron.ipcRenderer.send('window-minimize')
  }
}

const maximizeWindow = () => {
  if (window.electron) {
    window.electron.ipcRenderer.send('window-maximize')
  }
}

const closeWindow = () => {
  if (window.electron) {
    window.electron.ipcRenderer.send('window-close')
  }
}

// 检查是否首次启动
const checkFirstLaunch = async () => {
  try {
    const hasSetup = await store.getBoolean('HAS_SCHOOL_SETUP', false)
    if (!hasSetup) {
      // 首次启动，显示学校选择对话框
      setTimeout(() => {
        schoolSetupDialog.value?.show();
      }, 500);
    }
  } catch (error) {
    console.error('检查首次启动失败', error)
  }
}

// 学校设置完成回调 - 修复：确保设置 HAS_SCHOOL_SETUP
const onSchoolSetupCompleted = async (schoolId) => {
  console.log('学校设置完成:', schoolId);
  // 标记已完成学校设置，防止无限弹窗
  await store.putBoolean('HAS_SCHOOL_SETUP', true);
  // 同时写入localStorage确保生效
  localStorage.setItem('ujn_assistant_HAS_SCHOOL_SETUP', 'true');
  // 刷新页面以应用新的学校配置
  window.location.reload();
}

// 组件挂载
onMounted(async () => {
  // 恢复侧边栏状态
  const savedSidebarStatus = localStorage.getItem('sidebarStatus')
  if (savedSidebarStatus === '1') {
    isSidebarCollapsed.value = true
  }

  // 更新时间
  updateTime()
  setInterval(updateTime, 60000)

  // 检查登录状态
  await checkLoginStatus()

  // 检查是否首次启动
  await checkFirstLaunch()

  // 监听登录状态变化
  watch(() => authService.easLoginStatus.value, (newVal) => {
    checkLoginStatus()
  })

  watch(() => authService.ipassLoginStatus.value, (newVal) => {
    checkLoginStatus()
  })
})
</script>

<style>
/* 全局样式 */
:root {
  /* 主色调 - 与其他页面一致 */
  --primary-color: #5c6cff;
  --primary-color-rgb: 92, 108, 255;
  --primary-light: #8a96ff;
  --primary-dark: #4155e2;

  /* 功能色 */
  --success-color: #34C759;
  --warning-color: #FF9500;
  --danger-color: #FF3B30;
  --info-color: #5AC8FA;

  /* 背景色 */
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-tertiary: #f0f2f5;
  --bg-color: #f5f7fa;
  --card-bg: #ffffff;

  /* 文字色 */
  --text-primary: #303133;
  --text-secondary: #606266;
  --text-hint: #909399;

  /* 边框和阴影 */
  --border-color: #EBEEF5;
  --shadow-light: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  --shadow-medium: 0 4px 16px 0 rgba(0, 0, 0, 0.08);

  /* 过渡 */
  --transition-normal: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

/* 深色模式 */
:root.dark-theme {
  --primary-color: #7c8aff;
  --primary-light: #a5afff;
  --primary-dark: #5c6cff;

  --bg-primary: #1a1a1a;
  --bg-secondary: #242424;
  --bg-tertiary: #2a2a2a;
  --bg-color: #121212;
  --card-bg: #242424;

  --text-primary: rgba(255, 255, 255, 0.9);
  --text-secondary: rgba(255, 255, 255, 0.7);
  --text-hint: rgba(255, 255, 255, 0.5);

  --border-color: #3e3e3e;
  --shadow-light: 0 2px 12px 0 rgba(0, 0, 0, 0.2);
  --shadow-medium: 0 4px 16px 0 rgba(0, 0, 0, 0.3);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-primary);
}

/* 标题栏样式 */
.title-bar {
  height: 32px;
  background-color: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  -webkit-app-region: drag;
  padding: 0 15px;
}

.title-bar-content {
  display: flex;
  align-items: center;
}

.app-logo {
  width: 20px;
  height: 20px;
  margin-right: 8px;
}

.app-title {
  font-size: 14px;
  font-weight: 500;
}

.window-controls {
  display: flex;
  -webkit-app-region: no-drag;
}

.control-button {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  margin-left: 2px;
  cursor: pointer;
}

.control-button:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.control-button.close:hover {
  background-color: #ff4d4f;
}

/* 主体内容区 */
.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 侧边栏样式 */
.sidebar {
  width: 200px;
  height: 100%;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
  position: relative;
}

.sidebar.collapsed {
  width: 64px;
}

.sidebar-toggle {
  position: absolute;
  top: 10px;
  right: -12px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  cursor: pointer;
  z-index: 10;
  transition: transform 0.3s;
}

.sidebar-toggle:hover {
  background-color: var(--bg-tertiary);
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  overflow-y: auto;
}

.sidebar-footer {
  padding: 10px;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-secondary);
}

.status-indicator {
  margin-top: 5px;
  display: flex;
  align-items: center;
}

.status-indicator.online::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--success-color);
  margin-right: 5px;
}

.status-indicator.offline::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--danger-color);
  margin-right: 5px;
}

/* 主内容区样式 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: margin-left 0.3s;
  background-color: var(--bg-primary);
}

.content-header {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.breadcrumb {
  font-size: 14px;
}

.user-info {
  display: flex;
  align-items: center;
}

.user-dropdown {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 5px 10px;
  border-radius: 4px;
}

.user-dropdown:hover {
  background-color: var(--bg-tertiary);
}

.username {
  margin: 0 5px;
  font-size: 14px;
}

.content-body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.status-bar {
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  padding: 0 16px;
  font-size: 12px;
  color: var(--text-secondary);
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Element Plus 自定义主题 */
:deep(.el-menu) {
  border-right: none;
}

:deep(.el-menu-item.is-active) {
  background-color: rgba(0, 122, 255, 0.1);
  color: var(--primary-color);
}

:deep(.el-menu-item:hover) {
  background-color: var(--bg-tertiary);
}

:deep(.el-sub-menu__title:hover) {
  background-color: var(--bg-tertiary);
}
</style>