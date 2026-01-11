<template>
  <div class="page-container" :class="{ 'dark-mode': isDarkMode }">
    <!-- 背景动画装饰 -->
    <div class="bg-decoration">
      <div class="bg-particles" v-for="n in 8" :key="n"></div>
      <div class="bg-gradient"></div>
    </div>

    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <div class="logo-animation">
          <div class="logo-circle"></div>
          <el-icon class="title-icon"><Calendar /></el-icon>
        </div>
        <div class="title-content">
          <h1 class="page-title">校历查询</h1>
          <p class="page-subtitle">{{ calendarData.semesterInfo?.year || '-' }} 学年 {{ calendarData.semesterInfo?.semester || '-' }}</p>
        </div>
      </div>

      <div class="header-right">
        <div class="theme-switch" @click="toggleDarkMode">
          <el-icon v-if="isDarkMode"><Sunny /></el-icon>
          <el-icon v-else><Moon /></el-icon>
          <span>{{ isDarkMode ? '浅色模式' : '深色模式' }}</span>
        </div>
        <el-button type="primary" @click="refreshCalendar" :loading="loading" class="refresh-btn" round>
          <el-icon><Refresh /></el-icon> 刷新校历
        </el-button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <div class="loader">
        <div class="loader-circle"></div>
        <div class="loader-line-mask">
          <div class="loader-line"></div>
        </div>
        <div class="loader-text">加载校历数据中</div>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-container">
      <!-- 未登录错误 -->
      <div v-if="isLoginError" class="login-error">
        <div class="error-icon">
          <el-icon><Lock /></el-icon>
        </div>
        <div class="error-content">
          <h3 class="error-title">需要登录</h3>
          <p class="error-message">{{ error }}</p>
          <div class="error-buttons">
            <el-button type="primary" @click="goToLogin" class="login-button">
              <el-icon><Key /></el-icon> 去登录
            </el-button>
            <el-button @click="refreshCalendar" class="retry-button">
              <el-icon><RefreshRight /></el-icon> 重试
            </el-button>
          </div>
        </div>
      </div>

      <!-- 普通错误 -->
      <div v-else class="general-error">
        <div class="error-icon">
          <el-icon><WarningFilled /></el-icon>
        </div>
        <div class="error-content">
          <h3 class="error-title">数据加载失败</h3>
          <p class="error-message">{{ error }}</p>
          <el-button type="danger" @click="refreshCalendar" class="error-button" round>
            <el-icon><RefreshRight /></el-icon> 重新获取
          </el-button>
        </div>
      </div>
    </div>

    <!-- 主要内容 -->
    <div v-else class="calendar-content">
      <!-- ========== PDF视图（荆楚理工等） ========== -->
      <div v-if="isPdfType" class="pdf-calendar-section">
        <div class="overview-section">
          <div class="overview-card pdf-card">
            <div class="overview-header">
              <el-icon><Document /></el-icon>
              <h3>校历文件</h3>
            </div>
            <div class="overview-body">
              <div class="pdf-info">
                <div class="pdf-icon-wrapper">
                  <el-icon class="pdf-icon"><Document /></el-icon>
                </div>
                <div class="pdf-text">
                  <p class="pdf-name">{{ calendarData.title || '校历查询' }}</p>
                  <p class="pdf-desc">点击查看或下载校历PDF文件</p>
                </div>
              </div>
              <div class="pdf-actions">
                <el-button type="primary" @click="openPdf" size="large">
                  <el-icon><View /></el-icon> 在线查看
                </el-button>
                <el-button @click="downloadPdf" size="large">
                  <el-icon><Download /></el-icon> 下载PDF
                </el-button>
              </div>
            </div>
          </div>

          <div class="overview-card update-info">
            <div class="overview-header">
              <el-icon><InfoFilled /></el-icon>
              <h3>更新信息</h3>
            </div>
            <div class="overview-body">
              <div class="update-data">
                <div class="update-item">
                  <div class="update-label">最后更新</div>
                  <div class="update-value">{{ formatTime(updateTime) }}</div>
                </div>
                <div class="update-item">
                  <div class="update-label">数据来源</div>
                  <div class="update-value">学校门户</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== HTML表格视图（济南大学等） ========== -->
      <template v-else>
        <!-- 状态概览 -->
        <div class="overview-section">
          <div class="overview-card current-semester">
            <div class="overview-header">
              <el-icon><School /></el-icon>
              <h3>学期概览</h3>
            </div>
            <div class="overview-body">
              <div class="overview-data">
                <div class="data-item">
                  <div class="data-value">{{ currentWeek }}</div>
                  <div class="data-label">当前周</div>
                </div>
                <div class="data-item">
                  <div class="data-value">{{ totalWeeks }}</div>
                  <div class="data-label">总周数</div>
                </div>
                <div class="data-item">
                  <div class="data-value">{{ importantDatesCount }}</div>
                  <div class="data-label">重要日期</div>
                </div>
              </div>
              <div class="progress-bar-container">
                <div class="progress-label">
                  <span>学期进度</span>
                  <span>{{ Math.round(semesterProgress) }}%</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: semesterProgress + '%' }"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="overview-card current-week">
            <div class="overview-header">
              <el-icon><Timer /></el-icon>
              <h3>本周信息</h3>
            </div>
            <div class="overview-body">
              <div class="week-calendar">
                <div class="week-header">
                  <div class="month-year">{{ getCurrentMonthYear() }}</div>
                  <div class="week-number">第 {{ currentWeek }} 周</div>
                </div>
                <div class="days-grid">
                  <div v-for="(day, index) in weekDays" :key="index" class="day-cell"
                       :class="{ 'is-today': day.isToday, 'is-weekend': day.isWeekend }">
                    <div class="day-name">{{ day.name }}</div>
                    <div class="day-number">{{ day.date }}</div>
                    <div v-if="day.event" class="day-event">{{ day.event }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="overview-card update-info">
            <div class="overview-header">
              <el-icon><InfoFilled /></el-icon>
              <h3>更新信息</h3>
            </div>
            <div class="overview-body">
              <div class="update-data">
                <div class="update-item">
                  <div class="update-label">最后更新</div>
                  <div class="update-value">{{ formatTime(updateTime) }}</div>
                </div>
                <div class="update-item">
                  <div class="update-label">数据来源</div>
                  <div class="update-value">智慧济大</div>
                </div>
              </div>
              <div class="update-note">
                <el-icon><Bell /></el-icon>
                <span>校历数据每周自动更新一次</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 内容标签页 -->
        <div class="tab-container">
          <div class="tab-header">
            <div class="tab-item" :class="{ 'active': activeTabName === 'table' }" @click="activeTabName = 'table'">
              <el-icon><Grid /></el-icon>
              <span>表格视图</span>
            </div>
            <div class="tab-item" :class="{ 'active': activeTabName === 'dates' }" @click="activeTabName = 'dates'">
              <el-icon><Bell /></el-icon>
              <span>重要日期</span>
            </div>
          </div>

          <!-- 表格视图 -->
          <div v-show="activeTabName === 'table'" class="tab-content">
            <div class="calendar-table-container">
              <div class="table-wrapper">
                <div class="table-content" v-html="processHtmlContent(calendarData.htmlContent)"></div>
              </div>
            </div>
          </div>

          <!-- 重要日期 -->
          <div v-show="activeTabName === 'dates'" class="tab-content">
            <div class="dates-filters">
              <div class="filter-title">
                <el-icon><Filter /></el-icon>
                <span>按类型筛选</span>
              </div>
              <div class="filter-options">
                <div class="filter-option" :class="{ 'active': filters.holiday }" @click="toggleFilter('holiday')">
                  <div class="filter-color holiday-color"></div>
                  <span>节假日</span>
                </div>
                <div class="filter-option" :class="{ 'active': filters.exam }" @click="toggleFilter('exam')">
                  <div class="filter-color exam-color"></div>
                  <span>考试周</span>
                </div>
                <div class="filter-option" :class="{ 'active': filters.event }" @click="toggleFilter('event')">
                  <div class="filter-color event-color"></div>
                  <span>其他事件</span>
                </div>
              </div>
            </div>

            <div class="dates-grid">
              <div v-for="(date, index) in filteredImportantDates" :key="index"
                   class="date-card" :class="'date-type-' + date.type">
                <div class="date-icon">
                  <el-icon v-if="date.type === 'holiday'"><SuitcaseLine /></el-icon>
                  <el-icon v-else-if="date.type === 'exam'"><Reading /></el-icon>
                  <el-icon v-else><Bell /></el-icon>
                </div>
                <div class="date-content">
                  <div class="date-name">{{ date.name }}</div>
                  <div class="date-time">{{ date.timeString }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 底部信息 -->
    <div class="page-footer">
      <span>校历查询 · 数据来源于学校门户</span>
      <span>更新时间: {{ formatTime(updateTime) }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  Refresh,
  RefreshRight,
  Calendar,
  Timer,
  School,
  Moon,
  Sunny,
  Bell,
  Reading,
  SuitcaseLine,
  WarningFilled,
  InfoFilled,
  Grid,
  Filter,
  Lock,
  Key,
  Document,
  View,
  Download
} from '@element-plus/icons-vue';
import calendarService from '@/services/calendarService';
import store from '@/utils/store';
import authService from '@/services/authService';

const router = useRouter();

// 状态变量
const loading = ref(true);
const error = ref(null);
const calendarData = ref({});
const updateTime = ref(null);
const currentWeek = ref(1);
const activeTabName = ref('table');
const isDarkMode = ref(false);
const isLoginError = ref(false);
const filters = ref({
  holiday: true,
  exam: true,
  event: true
});

// 周历数据
const weekDays = ref([]);

// 判断是否为PDF类型（根据calendarService返回的type字段）
const isPdfType = computed(() => calendarData.value.type === 'pdf');

// 总周数
const totalWeeks = computed(() => {
  return calendarData.value.semesterInfo?.weekcount || 19;
});

// 计算重要日期数量
const importantDatesCount = computed(() => {
  return (calendarData.value.importantDates || []).length;
});

// 计算学期进度
const semesterProgress = computed(() => {
  const progress = (currentWeek.value / totalWeeks.value) * 100;
  return Math.min(100, Math.max(0, progress));
});

// 过滤后的重要日期
const filteredImportantDates = computed(() => {
  const allDates = calendarData.value.importantDates || [];
  return allDates.filter(date => {
    if (date.type === 'holiday' && filters.value.holiday) return true;
    if (date.type === 'exam' && filters.value.exam) return true;
    if (date.type === 'event' && filters.value.event) return true;
    return false;
  });
});

// 切换过滤器
const toggleFilter = (type) => {
  filters.value[type] = !filters.value[type];
};

// 切换深色模式
const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value;

  try {
    localStorage.setItem('calendar_dark_mode', isDarkMode.value ? '1' : '0');
  } catch (e) {
    console.error('保存主题设置失败:', e);
  }

  if (isDarkMode.value) {
    document.documentElement.classList.add('dark-theme');
  } else {
    document.documentElement.classList.remove('dark-theme');
  }
};

// 格式化时间
const formatTime = (time) => {
  if (!time) return '未知';

  try {
    const date = new Date(time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  } catch (error) {
    return '未知';
  }
};

// 获取当前月和年
const getCurrentMonthYear = () => {
  const now = new Date();
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
};

// 生成当前周日历数据
const generateWeekDays = () => {
  const now = new Date();
  const currentDay = now.getDay() || 7;
  const dayNames = ['一', '二', '三', '四', '五', '六', '日'];

  const days = [];

  for (let i = 1; i <= 7; i++) {
    const dayDate = new Date(now);
    dayDate.setDate(now.getDate() - (currentDay - i));

    let event = null;
    const dateStr = `${dayDate.getMonth() + 1}月${dayDate.getDate()}日`;

    if (calendarData.value.importantDates) {
      const foundEvent = calendarData.value.importantDates.find(d =>
          d.timeString && d.timeString.includes(dateStr)
      );
      if (foundEvent) {
        event = foundEvent.name;
      }
    }

    days.push({
      name: '周' + dayNames[i-1],
      date: dayDate.getDate(),
      isToday: i === currentDay,
      isWeekend: i >= 6,
      event: event
    });
  }

  weekDays.value = days;
};

// 计算当前周次
const calculateCurrentWeek = async (data) => {
  try {
    let startDate = null;

    if (data.htmlContent) {
      const notesMatch = data.htmlContent.match(/注：[^。]*?(\d+)月(\d+)日[^。]*?上课/);
      if (notesMatch && notesMatch.length >= 3) {
        const startMonth = parseInt(notesMatch[1]);
        const startDay = parseInt(notesMatch[2]);
        const currentYear = new Date().getFullYear();
        startDate = new Date(currentYear, startMonth - 1, startDay);
      }
    }

    if (!startDate) {
      try {
        const customOpeningDate = await store.getString('CUSTOM_OPENING_DATE', '');
        if (customOpeningDate) {
          startDate = new Date(customOpeningDate);
        }
      } catch (error) {
        console.error('从自定义设置获取开学日期失败:', error);
      }
    }

    if (!startDate) {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();

      if (currentMonth < 7) {
        startDate = new Date(currentYear, 1, 24);
      } else {
        startDate = new Date(currentYear, 8, 1);
      }
    }

    const now = new Date();
    const timeDiff = now - startDate;
    const dayDiff = Math.floor(timeDiff / (24 * 60 * 60 * 1000));
    const weekDiff = Math.floor(dayDiff / 7) + 1;

    return Math.max(1, Math.min(weekDiff, 20));
  } catch (error) {
    console.error('计算当前周次失败:', error);
    return 1;
  }
};

// 处理HTML内容
const processHtmlContent = (html) => {
  if (!html) return '';

  let processedHtml = html
      .replace(/style="[^"]*"/g, function(match) {
        if (match.includes('color:')) {
          const colorMatch = match.match(/color:\s*([^;"}]+)/);
          if (colorMatch) {
            return `style="color:${colorMatch[1]}"`;
          }
        }
        return '';
      })
      .replace(/class="[^"]*"/g, '')
      .replace(/lang="[^"]*"/g, '')
      .replace(/mso-[^=]*="[^"]*"/g, '')
      .replace(/<o:p><\/o:p>/g, '')
      .replace(/&nbsp;/g, ' ');

  processedHtml = processedHtml.replace(/<table/g, '<table class="calendar-table"');
  processedHtml = processedHtml.replace(/<tr/g, '<tr class="calendar-row"');
  processedHtml = processedHtml.replace(/<td/g, '<td class="calendar-cell"');

  return processedHtml;
};

// 显示消息提示
const showMessage = (message, type = 'info', duration = 3000) => {
  ElMessage({
    message,
    type,
    duration,
    showClose: true,
    customClass: 'custom-message'
  });
};

// 跳转到登录页面
const goToLogin = () => {
  router.push('/login/ipass');
};

// 打开PDF
const openPdf = () => {
  const pdfUrl = calendarData.value.pdfUrl;
  if (!pdfUrl) {
    showMessage('校历链接不可用', 'warning');
    return;
  }

  if (window.electronAPI && window.electronAPI.openExternal) {
    window.electronAPI.openExternal(pdfUrl);
  } else {
    window.open(pdfUrl, '_blank');
  }

  showMessage('正在打开校历...', 'success');
};

// 下载PDF
const downloadPdf = () => {
  const pdfUrl = calendarData.value.pdfUrl;
  if (!pdfUrl) {
    showMessage('校历链接不可用', 'warning');
    return;
  }

  const link = document.createElement('a');
  link.href = pdfUrl;
  link.download = `${calendarData.value.title || '校历'}.pdf`;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showMessage('开始下载校历...', 'success');
};

// 刷新校历数据
const refreshCalendar = async () => {
  try {
    loading.value = true;
    error.value = null;
    isLoginError.value = false;

    // calendarService会根据学校类型自动选择获取方式
    const data = await calendarService.getCalendarData(true);
    calendarData.value = data;
    updateTime.value = data.updateTime;

    // 如果是HTML类型，计算周次和生成周历
    if (data.type !== 'pdf') {
      currentWeek.value = await calculateCurrentWeek(data);
      generateWeekDays();
    }

    showMessage('校历数据已更新', 'success');
  } catch (err) {
    console.error('刷新校历失败:', err);

    if (err.message && err.message.startsWith('NOT_LOGGED_IN:')) {
      isLoginError.value = true;
      error.value = err.message.replace('NOT_LOGGED_IN:', '');
      showMessage('需要登录才能查看校历', 'warning');
    } else {
      error.value = '获取校历数据失败: ' + (err.message || '未知错误');
      showMessage('获取校历数据失败，请稍后再试', 'error');
    }
  } finally {
    loading.value = false;
  }
};

// 初始化主题
const initTheme = () => {
  try {
    const savedTheme = localStorage.getItem('calendar_dark_mode');
    if (savedTheme !== null) {
      isDarkMode.value = savedTheme === '1';

      if (isDarkMode.value) {
        document.documentElement.classList.add('dark-theme');
      } else {
        document.documentElement.classList.remove('dark-theme');
      }
    }
  } catch (e) {
    console.error('获取主题设置失败:', e);
  }
};

// 初始化粒子背景动画
const initParticles = () => {
  const particles = document.querySelectorAll('.bg-particles');
  particles.forEach((particle, index) => {
    const size = Math.floor(Math.random() * 20) + 10;
    const posX = Math.floor(Math.random() * 100);
    const posY = Math.floor(Math.random() * 100);
    const delay = Math.random() * 5;
    const duration = Math.random() * 20 + 20;

    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${posX}%`;
    particle.style.top = `${posY}%`;
    particle.style.animationDelay = `${delay}s`;
    particle.style.animationDuration = `${duration}s`;
  });
};

// 组件挂载
onMounted(async () => {
  initTheme();
  initParticles();
  await refreshCalendar();
});

// 组件卸载前清理
onBeforeUnmount(() => {
  // 清理工作
});
</script>

<style scoped>
/* ========== 基础变量 ========== */
:root {
  --app-primary-color: #5c6cff;
  --app-primary-color-light: rgba(92, 108, 255, 0.1);
  --app-danger-color: #ff726f;
  --app-warning-color: #ffbe3d;
  --app-success-color: #52c41a;
  --app-bg: #ffffff;
  --app-bg-secondary: #f5f7fa;
  --app-text-primary: #1a1a2e;
  --app-text-secondary: #666;
  --app-text-tertiary: #999;
  --app-border-color: #eaeaea;
  --app-table-bg: #fff;
  --app-table-border: #e8e8e8;
  --app-table-header-bg: #f5f7fa;
  --app-tab-active-bg: rgba(92, 108, 255, 0.1);
}

.dark-mode {
  --app-primary-color: #7b8aff;
  --app-primary-color-light: rgba(123, 138, 255, 0.15);
  --app-bg: #1a1a2e;
  --app-bg-secondary: #252542;
  --app-text-primary: #f0f0f0;
  --app-text-secondary: #a0a0a0;
  --app-text-tertiary: #707070;
  --app-border-color: #3a3a5a;
  --app-table-bg: #252542;
  --app-table-border: #3a3a5a;
  --app-table-header-bg: #1a1a2e;
  --app-tab-active-bg: rgba(123, 138, 255, 0.2);
}

/* ========== 页面容器 ========== */
.page-container {
  position: relative;
  min-height: 100vh;
  padding: 30px;
  background-color: var(--app-bg);
  color: var(--app-text-primary);
  overflow: hidden;
  transition: background-color 0.3s, color 0.3s;
}

/* ========== 背景装饰 ========== */
.bg-decoration {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 0;
  pointer-events: none;
}

.bg-particles {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, var(--app-primary-color) 0%, transparent 70%);
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

@keyframes float {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  25% { transform: translate(20px, 30px) rotate(90deg) scale(1.1); }
  50% { transform: translate(40px, 20px) rotate(180deg) scale(1.2); }
  75% { transform: translate(20px, -10px) rotate(270deg) scale(1.1); }
  100% { transform: translate(0, 0) rotate(360deg) scale(1); }
}

.bg-gradient {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(92, 108, 255, 0.03) 0%, rgba(92, 108, 255, 0) 50%);
}

/* ========== 页面头部 ========== */
.page-header {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-animation {
  position: relative;
  width: 50px;
  height: 50px;
}

.logo-circle {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--app-primary-color), #8f9bff);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
}

.title-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 24px;
  color: white;
}

.title-content {
  display: flex;
  flex-direction: column;
}

.page-title {
  font-size: 26px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(135deg, var(--app-primary-color), #8f9bff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-subtitle {
  font-size: 14px;
  color: var(--app-text-secondary);
  margin: 4px 0 0 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.theme-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  background-color: var(--app-bg-secondary);
  cursor: pointer;
  font-size: 14px;
  color: var(--app-text-secondary);
  transition: all 0.3s;
}

.theme-switch:hover {
  background-color: var(--app-primary-color-light);
  color: var(--app-primary-color);
}

.refresh-btn {
  font-weight: 500;
}

/* ========== 加载状态 ========== */
.loading-container {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.loader {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.loader-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--app-primary-color), #8f9bff);
  animation: pulse 1.5s infinite;
}

.loader-line-mask {
  width: 60px;
  height: 30px;
  margin-top: -30px;
  overflow: hidden;
}

.loader-line {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 3px solid transparent;
  border-top-color: var(--app-primary-color);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loader-text {
  margin-top: 20px;
  font-size: 16px;
  color: var(--app-text-secondary);
  animation: blink 1.5s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ========== 错误状态 ========== */
.error-container {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.login-error, .general-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px;
  background-color: var(--app-bg-secondary);
  border-radius: 20px;
  max-width: 400px;
}

.error-icon {
  font-size: 60px;
  margin-bottom: 20px;
}

.login-error .error-icon {
  color: var(--app-warning-color);
}

.general-error .error-icon {
  color: var(--app-danger-color);
}

.error-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 12px 0;
}

.error-message {
  font-size: 14px;
  color: var(--app-text-secondary);
  margin: 0 0 24px 0;
  line-height: 1.6;
}

.error-buttons {
  display: flex;
  gap: 12px;
}

/* ========== 概览区域 ========== */
.overview-section {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 30px;
}

.overview-card {
  background-color: var(--app-bg-secondary);
  border-radius: 16px;
  padding: 20px;
  transition: transform 0.3s, box-shadow 0.3s;
}

.overview-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.overview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  font-size: 16px;
  color: var(--app-primary-color);
}

.overview-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.overview-data {
  display: flex;
  justify-content: space-around;
  margin-bottom: 16px;
}

.data-item {
  text-align: center;
}

.data-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--app-primary-color);
}

.data-label {
  font-size: 13px;
  color: var(--app-text-secondary);
  margin-top: 4px;
}

.progress-bar-container {
  margin-top: 12px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--app-text-secondary);
  margin-bottom: 8px;
}

.progress-bar {
  height: 8px;
  background-color: var(--app-bg);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--app-primary-color), #8f9bff);
  border-radius: 4px;
  transition: width 0.5s;
}

/* ========== PDF卡片 ========== */
.pdf-card {
  grid-column: span 2;
}

.pdf-info {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px;
  background: var(--app-bg);
  border-radius: 12px;
  margin-bottom: 16px;
}

.pdf-icon-wrapper {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  border-radius: 12px;
}

.pdf-icon {
  font-size: 32px;
  color: white;
}

.pdf-text .pdf-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--app-text-primary);
}

.pdf-text .pdf-desc {
  font-size: 14px;
  color: var(--app-text-secondary);
  margin: 0;
}

.pdf-actions {
  display: flex;
  gap: 12px;
}

/* ========== 周历 ========== */
.current-week {
  grid-column: span 2;
}

.week-calendar {
  background-color: var(--app-bg);
  border-radius: 12px;
  padding: 16px;
}

.week-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.month-year {
  font-size: 16px;
  font-weight: 600;
}

.week-number {
  font-size: 14px;
  color: var(--app-primary-color);
  font-weight: 500;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.day-cell {
  text-align: center;
  padding: 10px 4px;
  border-radius: 10px;
  background-color: var(--app-bg-secondary);
  transition: all 0.3s;
}

.day-cell:hover {
  background-color: var(--app-primary-color-light);
}

.day-cell.is-today {
  background: linear-gradient(135deg, var(--app-primary-color), #8f9bff);
  color: white;
}

.day-cell.is-weekend {
  background-color: rgba(255, 114, 111, 0.1);
}

.day-cell.is-weekend.is-today {
  background: linear-gradient(135deg, var(--app-primary-color), #8f9bff);
}

.day-name {
  font-size: 12px;
  color: var(--app-text-secondary);
  margin-bottom: 4px;
}

.day-cell.is-today .day-name {
  color: rgba(255, 255, 255, 0.8);
}

.day-number {
  font-size: 18px;
  font-weight: 600;
}

.day-event {
  font-size: 10px;
  color: var(--app-danger-color);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.day-cell.is-today .day-event {
  color: rgba(255, 255, 255, 0.9);
}

/* ========== 更新信息 ========== */
.update-data {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.update-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.update-label {
  font-size: 14px;
  color: var(--app-text-secondary);
}

.update-value {
  font-size: 14px;
  font-weight: 500;
}

.update-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 10px;
  background-color: var(--app-bg);
  border-radius: 8px;
  font-size: 13px;
  color: var(--app-text-secondary);
}

/* ========== 标签页 ========== */
.tab-container {
  position: relative;
  z-index: 1;
  background-color: var(--app-bg-secondary);
  border-radius: 16px;
  overflow: hidden;
}

.tab-header {
  display: flex;
  background-color: var(--app-bg-secondary);
  padding: 6px;
  border-bottom: 1px solid var(--app-border-color);
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  color: var(--app-text-secondary);
  cursor: pointer;
  transition: all 0.3s;
}

.tab-item:hover {
  color: var(--app-primary-color);
}

.tab-item.active {
  background-color: var(--app-tab-active-bg);
  color: var(--app-primary-color);
  font-weight: 600;
}

.tab-content {
  padding: 20px;
  min-height: 300px;
}

/* ========== 表格视图 ========== */
.calendar-table-container {
  overflow-x: auto;
}

.table-wrapper {
  padding: 8px;
  min-width: 700px;
}

.table-content :deep(.calendar-table) {
  width: 100%;
  border-collapse: collapse;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 16px;
  background-color: var(--app-table-bg);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
  color: var(--app-text-primary);
}

.table-content :deep(.calendar-cell) {
  border: 1px solid var(--app-table-border);
  padding: 14px 12px;
  text-align: center;
  transition: background-color 0.2s;
  font-size: 15px;
}

.table-content :deep(.calendar-row:first-child .calendar-cell) {
  background-color: var(--app-table-header-bg);
  font-weight: 600;
}

.table-content :deep(.calendar-row:hover .calendar-cell) {
  background-color: var(--app-primary-color-light);
}

.table-content :deep(span[style*="color:red"]) {
  color: var(--app-danger-color) !important;
  font-weight: bold;
  display: inline-block;
  padding: 3px 6px;
  border-radius: 4px;
  background-color: rgba(255, 114, 111, 0.1);
}

/* ========== 重要日期 ========== */
.dates-filters {
  margin-bottom: 20px;
  padding: 16px;
  background-color: var(--app-bg-secondary);
  border-radius: 12px;
}

.filter-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-primary);
  margin-bottom: 12px;
}

.filter-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 20px;
  background-color: var(--app-bg);
  font-size: 14px;
  color: var(--app-text-secondary);
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}

.filter-option:hover {
  transform: translateY(-2px);
}

.filter-option.active {
  font-weight: 600;
  color: var(--app-text-primary);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.filter-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.holiday-color { background-color: var(--app-warning-color); }
.exam-color { background-color: var(--app-danger-color); }
.event-color { background-color: var(--app-primary-color); }

.dates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.date-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  background-color: var(--app-bg-secondary);
  transition: all 0.3s;
}

.date-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
}

.date-type-holiday {
  border-left: 4px solid var(--app-warning-color);
  background: linear-gradient(to right, rgba(255, 190, 61, 0.1), var(--app-bg-secondary) 60%);
}

.date-type-exam {
  border-left: 4px solid var(--app-danger-color);
  background: linear-gradient(to right, rgba(255, 114, 111, 0.1), var(--app-bg-secondary) 60%);
}

.date-type-event {
  border-left: 4px solid var(--app-primary-color);
  background: linear-gradient(to right, rgba(92, 108, 255, 0.1), var(--app-bg-secondary) 60%);
}

.date-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background-color: var(--app-bg);
  font-size: 20px;
}

.date-type-holiday .date-icon { color: var(--app-warning-color); }
.date-type-exam .date-icon { color: var(--app-danger-color); }
.date-type-event .date-icon { color: var(--app-primary-color); }

.date-content { flex: 1; }

.date-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text-primary);
  margin-bottom: 4px;
}

.date-time {
  font-size: 14px;
  color: var(--app-text-secondary);
}

/* ========== 页脚 ========== */
.page-footer {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  padding-top: 30px;
  margin-top: 30px;
  font-size: 13px;
  color: var(--app-text-tertiary);
  border-top: 1px solid var(--app-border-color);
}

/* ========== 响应式 ========== */
@media (max-width: 992px) {
  .overview-section {
    grid-template-columns: 1fr 1fr;
  }

  .current-week, .pdf-card {
    grid-column: span 2;
  }
}

@media (max-width: 768px) {
  .page-container {
    padding: 20px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .header-right {
    width: 100%;
    justify-content: space-between;
  }

  .overview-section {
    grid-template-columns: 1fr;
  }

  .current-week, .pdf-card {
    grid-column: span 1;
  }

  .days-grid {
    gap: 4px;
  }

  .day-cell {
    padding: 6px 2px;
  }

  .day-name {
    font-size: 10px;
  }

  .day-number {
    font-size: 14px;
  }

  .dates-grid {
    grid-template-columns: 1fr;
  }

  .page-footer {
    flex-direction: column;
    gap: 8px;
    align-items: center;
  }

  .pdf-info {
    flex-direction: column;
    text-align: center;
  }

  .pdf-actions {
    flex-direction: column;
    width: 100%;
  }

  .pdf-actions .el-button {
    width: 100%;
  }
}
</style>