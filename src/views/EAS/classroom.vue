<template>
  <div class="empty-classroom-view" :class="{ 'dark-mode': isDarkMode }">
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

    <div class="page-header">
      <h1>空教室查询</h1>
      <p class="subtitle">查询符合条件的空闲教室，支持按周次、星期、节次筛选</p>
    </div>

    <!-- 登录提示 -->
    <el-alert
        v-if="!isLoggedIn"
        title="请先登录教务系统"
        type="warning"
        description="空教室查询功能需要教务系统登录权限，请先登录后再进行查询"
        show-icon
        :closable="false">
      <template #default>
        <router-link to="/login/eas">
          <el-button type="primary" size="small">前往登录</el-button>
        </router-link>
      </template>
    </el-alert>

    <!-- 查询组件 -->
    <EmptyClassroomQuery v-if="isLoggedIn" />
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import { Moon, Sunny } from '@element-plus/icons-vue';
import EmptyClassroomQuery from './components/EmptyClassroomQuery.vue';
import authService from '@/services/authService.js';

export default {
  name: 'EmptyClassroomView',
  components: {
    EmptyClassroomQuery,
    Moon,
    Sunny
  },
  setup() {
    const isLoggedIn = ref(false);
    const isDarkMode = ref(false);

    const toggleTheme = () => {
      isDarkMode.value = !isDarkMode.value;
      document.documentElement.classList.toggle('dark-theme', isDarkMode.value);
      localStorage.setItem('ujn_dark_mode', isDarkMode.value ? '1' : '0');
    };

    // 检查登录状态
    const checkLoginStatus = async () => {
      try {
        const loginStatus = authService.getLoginStatus();
        isLoggedIn.value = loginStatus.eas || false;

        if (!isLoggedIn.value) {
          // 如果未检测到登录状态，尝试检查教务系统登录状态
          const isEasLoggedIn = await authService.checkEasLogin();
          isLoggedIn.value = isEasLoggedIn;
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
        isLoggedIn.value = false;
      }
    };

    onMounted(() => {
      // 加载主题设置
      const savedDarkMode = localStorage.getItem('ujn_dark_mode');
      if (savedDarkMode === '1') {
        isDarkMode.value = true;
        document.documentElement.classList.add('dark-theme');
      }

      checkLoginStatus();
    });

    return {
      isLoggedIn,
      isDarkMode,
      toggleTheme
    };
  }
};
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
.empty-classroom-view {
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

.page-header {
  margin-bottom: 20px;
  position: relative;
  z-index: 1;
}

h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--primary-color);
}

.subtitle {
  font-size: 14px;
  color: var(--text-hint);
}

/* 响应式 */
@media screen and (max-width: 768px) {
  .empty-classroom-view {
    padding: 16px;
  }
}
</style>