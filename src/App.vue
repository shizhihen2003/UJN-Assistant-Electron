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
            <el-menu-item index="/eas/academic">
              <el-icon><Collection /></el-icon>
              <span>学业查询</span>
            </el-menu-item>
            <el-menu-item index="/eas/exams">
              <el-icon><AlarmClock /></el-icon>
              <span>考试查询</span>
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
            <el-menu-item index="/login/ipass">
              <el-icon><Connection /></el-icon>
              <span>智慧济大登录</span>
            </el-menu-item>
          </el-sub-menu>

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

          <div class="user-info" v-if="isLoggedIn">
            <el-dropdown trigger="click">
              <div class="user-dropdown">
                <el-avatar :size="32" :src="userAvatar">{{ userInitials }}</el-avatar>
                <span class="username">{{ userName }}</span>
                <el-icon><CaretBottom /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item>个人信息</el-dropdown-item>
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
          <div class="version">v1.0.0</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  HomeFilled, Calendar, School, User, Setting, Monitor, Notebook,
  Bell, Document, DataLine, Collection, AlarmClock, Key, Connection,
  Timer, CaretBottom, ArrowLeft, ArrowRight, Minus, FullScreen, Close
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

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
  return userName.value ? userName.value.charAt(0).toUpperCase() : '游'
})

// 时间显示
const currentTime = ref('')
const updateTime = () => {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  currentTime.value = `${hours}:${minutes}`
}

// 状态信息
const isOnline = ref(true)
const statusMessage = ref('就绪')

// 窗口控制按钮
const minimizeWindow = () => {
  if (window.electron) {
    window.electron.minimize();
  }
};

const maximizeWindow = () => {
  if (window.electron) {
    window.electron.maximize();
  }
};

const closeWindow = () => {
  if (window.electron) {
    window.electron.close();
  }
};

// 登出处理
const handleLogout = () => {
  isLoggedIn.value = false
  userName.value = ''
  userAvatar.value = ''
  ElMessage.success('已成功退出登录')
}

// 生命周期钩子
onMounted(() => {
  // 初始化侧边栏状态
  const sidebarStatus = localStorage.getItem('sidebarStatus')
  isSidebarCollapsed.value = sidebarStatus === '1'

  // 初始化时间并设置定时器
  updateTime()
  setInterval(updateTime, 60000) // 每分钟更新

  // 从本地存储加载用户状态
  const savedUser = localStorage.getItem('user')
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser)
      isLoggedIn.value = true
      userName.value = user.name
      userAvatar.value = user.avatar || ''
    } catch (e) {
      console.error('Failed to parse user data:', e)
    }
  }

  // 检查网络状态
  window.addEventListener('online', () => {
    isOnline.value = true
    statusMessage.value = '已连接到网络'
    setTimeout(() => {
      statusMessage.value = '就绪'
    }, 3000)
  })

  window.addEventListener('offline', () => {
    isOnline.value = false
    statusMessage.value = '网络连接已断开'
  })
})

// 监听路由变化更新页面标题
watch(
    () => route.meta.title,
    (newTitle) => {
      if (newTitle) {
        document.title = `${newTitle} - UJN Assistant`
      } else {
        document.title = 'UJN Assistant'
      }
    },
    { immediate: true }
)
</script>

<style>
:root {
  /* 应用主题色 */
  --primary-color: #007AFF;
  --secondary-color: #5AC8FA;
  --success-color: #34C759;
  --warning-color: #FF9500;
  --danger-color: #FF3B30;
  --info-color: #5856D6;

  /* 背景色 */
  --bg-primary: #F2F2F7;
  --bg-secondary: #FFFFFF;
  --bg-tertiary: #E5E5EA;

  /* 文本色 */
  --text-primary: #000000;
  --text-secondary: #8E8E93;
  --text-tertiary: #C7C7CC;

  /* 边框和分割线 */
  --border-color: #D1D1D6;
  --divider-color: #C6C6C8;

  /* 阴影 */
  --shadow-light: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-medium: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-dark: 0 10px 15px rgba(0, 0, 0, 0.1);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* 标题栏样式 */
.title-bar {
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--primary-color);
  color: white;
  -webkit-app-region: drag; /* 使标题栏可拖动 */
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
  -webkit-app-region: no-drag; /* 控制按钮不可拖动 */
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
  background-color: rgba(255, 255, 255, 0.1);
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