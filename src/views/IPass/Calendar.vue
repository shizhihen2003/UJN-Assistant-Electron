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

    <!-- 主要内容 -->
    <div v-else class="calendar-content">
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
    </div>

    <!-- 底部信息 -->
    <div class="page-footer">
      <span>校历查询 · 数据来源于智慧济大</span>
      <span>更新时间: {{ formatTime(updateTime) }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
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
  Filter
} from '@element-plus/icons-vue';
import calendarService from '@/services/calendarService';
import store from '@/utils/store';

// 状态变量
const loading = ref(true);
const error = ref(null);
const calendarData = ref({});
const updateTime = ref(null);
const currentWeek = ref(1);
const activeTabName = ref('table');
const isDarkMode = ref(false);
const filters = ref({
  holiday: true,
  exam: true,
  event: true
});

// 创建周历数据
const weekDays = ref([]);

// 总周数
const totalWeeks = computed(() => {
  return 19; // 假设一学期19周
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
  const allDates = getImportantDates();
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

  // 保存到本地存储
  try {
    localStorage.setItem('calendar_dark_mode', isDarkMode.value ? '1' : '0');
  } catch (e) {
    console.error('保存主题设置失败:', e);
  }

  // 应用主题色到根元素
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

// 获取当前周的日期范围
const getCurrentWeekDates = () => {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7; // 将0(周日)转为7

  // 计算本周一的日期
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek - 1));

  // 计算本周日的日期
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + (7 - dayOfWeek));

  return `${monday.getMonth() + 1}月${monday.getDate()}日 - ${sunday.getMonth() + 1}月${sunday.getDate()}日`;
};

// 生成当前周日历数据
const generateWeekDays = () => {
  const now = new Date();
  const currentDay = now.getDay() || 7; // 0是周日，转为7
  const dayNames = ['一', '二', '三', '四', '五', '六', '日'];

  const days = [];

  // 生成当前周的天数
  for (let i = 1; i <= 7; i++) {
    const dayDate = new Date(now);
    dayDate.setDate(now.getDate() - (currentDay - i));

    // 检查是否有重要事件
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
    // 首先尝试从HTML内容获取开学日期
    let startDate = null;

    if (data.htmlContent) {
      const notesMatch = data.htmlContent.match(/注：[^。]*?(\d+)月(\d+)日[^。]*?上课/);
      if (notesMatch && notesMatch.length >= 3) {
        const startMonth = parseInt(notesMatch[1]);
        const startDay = parseInt(notesMatch[2]);
        const currentYear = new Date().getFullYear();

        // 创建开学日期对象
        startDate = new Date(currentYear, startMonth - 1, startDay);

        // 处理年份问题：如果开学日期在未来且是第一学期（8月以后），可能是去年的日期
        const now = new Date();
        if (startDate > now && startMonth <= 6) {
          // 春季学期，如果开学日期在未来，使用当前年份
          // 不做调整
        } else if (startDate < now && startMonth >= 8) {
          // 秋季学期，如果开学日期在过去，使用当前年份
          // 不做调整
        }

        console.log('从HTML内容提取到开学日期:', startDate.toLocaleDateString());
      }
    }

    // 如果从HTML提取失败，尝试从设置中获取自定义开学日期
    if (!startDate) {
      try {
        const customOpeningDate = await store.getString('CUSTOM_OPENING_DATE', '');
        if (customOpeningDate) {
          startDate = new Date(customOpeningDate);
          console.log('从自定义设置获取开学日期:', startDate.toLocaleDateString());
        }
      } catch (error) {
        console.error('从自定义设置获取开学日期失败:', error);
      }
    }

    // 如果都没有获取到，使用合理的默认值
    if (!startDate) {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();

      // 如果当前月份在1-7月，说明是春季学期，开学日期应该是当年2月
      // 如果当前月份在8-12月，说明是秋季学期，开学日期应该是当年9月
      if (currentMonth < 7) {
        startDate = new Date(currentYear, 1, 24); // 当年2月24日
      } else {
        startDate = new Date(currentYear, 8, 1); // 当年9月1日
      }

      console.log('使用默认开学日期:', startDate.toLocaleDateString());
    }

    // 计算当前是第几周
    const now = new Date();
    const timeDiff = now - startDate;
    const dayDiff = Math.floor(timeDiff / (24 * 60 * 60 * 1000));
    const weekDiff = Math.floor(dayDiff / 7) + 1;

    // 确保周数在合理范围内（1-20周）
    const calculatedWeek = Math.max(1, Math.min(weekDiff, 20));

    console.log('计算得到当前周次:', calculatedWeek);
    return calculatedWeek;
  } catch (error) {
    console.error('计算当前周次失败:', error);
    return 1; // 出错时返回第1周
  }
};

// 处理HTML内容
const processHtmlContent = (html) => {
  if (!html) return '';

  // 保留颜色样式，移除其他无用样式
  let processedHtml = html
      .replace(/style="[^"]*"/g, function(match) {
        // 只保留包含color属性的样式
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

  // 给表格添加类
  processedHtml = processedHtml.replace(/<table/g, '<table class="calendar-table"');
  processedHtml = processedHtml.replace(/<tr/g, '<tr class="calendar-row"');
  processedHtml = processedHtml.replace(/<td/g, '<td class="calendar-cell"');

  return processedHtml;
};

// 获取重要日期
const getImportantDates = () => {
  // 直接使用calendarService提取的重要日期
  const dates = calendarData.value.importantDates || [];
  console.log('Vue组件中的重要日期:', dates);  // 添加调试日志
  return dates;
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

// 刷新校历数据
const refreshCalendar = async () => {
  try {
    loading.value = true;
    error.value = null;

    // 从服务获取校历数据
    const data = await calendarService.getCalendarData(true);
    calendarData.value = data;
    updateTime.value = data.updateTime;

    // 计算当前周次
    currentWeek.value = await calculateCurrentWeek(data);

    // 生成周日历
    generateWeekDays();

    showMessage('校历数据已更新', 'success');
  } catch (err) {
    console.error('刷新校历失败:', err);
    error.value = '获取校历数据失败: ' + (err.message || '未知错误');
    showMessage('获取校历数据失败，请稍后再试', 'error');
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
    const size = Math.floor(Math.random() * 20) + 10; // 10-30px
    const posX = Math.floor(Math.random() * 100);
    const posY = Math.floor(Math.random() * 100);
    const delay = Math.random() * 5;
    const duration = Math.random() * 20 + 20; // 20-40s

    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${posX}%`;
    particle.style.top = `${posY}%`;
    particle.style.animationDelay = `${delay}s`;
    particle.style.animationDuration = `${duration}s`;
  });
};

// 初始加载
onMounted(async () => {
  // 初始化主题
  initTheme();

  // 初始化粒子背景
  setTimeout(initParticles, 100);

  try {
    // 从服务获取校历数据
    const data = await calendarService.getCalendarData();
    calendarData.value = data;
    updateTime.value = data.updateTime;

    // 计算当前周次
    currentWeek.value = await calculateCurrentWeek(data);

    // 生成周日历
    generateWeekDays();
  } catch (err) {
    console.error('加载校历数据失败:', err);
    error.value = '获取校历数据失败: ' + (err.message || '未知错误');
    showMessage('获取校历数据失败，请稍后再试', 'error');
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  // 移除主题类
  document.documentElement.classList.remove('dark-theme');
});
</script>

<style>
/* 深色主题变量 */
:root.dark-theme {
  --app-bg: #121212;
  --app-bg-secondary: #1e1e1e;
  --app-card-bg: #242424;
  --app-text-primary: rgba(255, 255, 255, 0.9);
  --app-text-secondary: rgba(255, 255, 255, 0.6);
  --app-text-tertiary: rgba(255, 255, 255, 0.4);
  --app-border-color: rgba(255, 255, 255, 0.1);
  --app-primary-color: #5c6cff;
  --app-primary-color-light: rgba(92, 108, 255, 0.2);
  --app-success-color: #40c98f;
  --app-warning-color: #ffbe3d;
  --app-danger-color: #ff726f;
  --app-card-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
  --app-table-bg: #1a1a1a;
  --app-table-border: #333;
  --app-table-header-bg: #2a2a2a;
  --app-tab-active-bg: #2a2a2a;
}

/* 浅色主题变量（默认） */
:root {
  --app-bg: #f5f7fa;
  --app-bg-secondary: #ffffff;
  --app-card-bg: #ffffff;
  --app-text-primary: #303133;
  --app-text-secondary: #606266;
  --app-text-tertiary: #909399;
  --app-border-color: #e4e7ed;
  --app-primary-color: #5c6cff;
  --app-primary-color-light: rgba(92, 108, 255, 0.1);
  --app-success-color: #40c98f;
  --app-warning-color: #ffbe3d;
  --app-danger-color: #ff726f;
  --app-card-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  --app-table-bg: #fff;
  --app-table-border: #ebeef5;
  --app-table-header-bg: #f5f7fa;
  --app-tab-active-bg: #f0f2f5;
}
</style>

<style scoped>
/* 主容器样式 */
.page-container {
  padding: 30px;
  max-width: 1200px;
  margin: 0 auto;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  position: relative;
  background-color: var(--app-bg);
  color: var(--app-text-primary);
  min-height: calc(100vh - 60px);
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.dark-mode {
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

/* 背景装饰 */
.bg-decoration {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
}

.bg-particles {
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--app-primary-color) 0%, transparent 70%);
  opacity: 0.3;
  animation: float 30s linear infinite;
}

@keyframes float {
  0% {
    transform: translate(0, 0) rotate(0deg) scale(1);
  }
  33% {
    transform: translate(30px, 50px) rotate(120deg) scale(1.2);
  }
  66% {
    transform: translate(-20px, 20px) rotate(240deg) scale(0.8);
  }
  100% {
    transform: translate(0, 0) rotate(360deg) scale(1);
  }
}

.bg-gradient {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at top right,
  rgba(92, 108, 255, 0.08) 0%,
  transparent 60%),
  radial-gradient(circle at bottom left,
      rgba(64, 201, 143, 0.08) 0%,
      transparent 60%);
}

/* 页面头部 */
.page-header {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--app-border-color);
}

.header-left {
  display: flex;
  align-items: center;
}

.logo-animation {
  position: relative;
  width: 48px;
  height: 48px;
  margin-right: 16px;
}

.logo-circle {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: conic-gradient(var(--app-primary-color), var(--app-success-color), var(--app-warning-color), var(--app-danger-color), var(--app-primary-color));
  animation: rotate 6s linear infinite;
}

.logo-circle::before {
  content: '';
  position: absolute;
  top: 4px;
  left: 4px;
  right: 4px;
  bottom: 4px;
  background-color: var(--app-bg);
  border-radius: 50%;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.title-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 24px;
  color: var(--app-primary-color);
}

.title-content {
  display: flex;
  flex-direction: column;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  color: var(--app-text-primary);
  background: linear-gradient(90deg, var(--app-primary-color), var(--app-success-color));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
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
  font-size: 14px;
  color: var(--app-text-secondary);
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 20px;
  transition: all 0.3s;
  background-color: var(--app-bg-secondary);
}

.theme-switch:hover {
  background-color: var(--app-primary-color-light);
  color: var(--app-primary-color);
}

.refresh-btn {
  transition: all 0.3s;
  font-weight: 600;
  padding: 10px 20px;
  box-shadow: 0 4px 12px rgba(92, 108, 255, 0.2);
}

.refresh-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(92, 108, 255, 0.3);
}

/* 加载状态 */
.loading-container {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400px;
  padding: 40px 0;
}

.loader {
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.loader-circle {
  position: absolute;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 3px solid var(--app-primary-color-light);
}

.loader-line-mask {
  position: absolute;
  width: 60px;
  height: 30px;
  top: 0;
  overflow: hidden;
}

.loader-line {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 3px solid transparent;
  border-top-color: var(--app-primary-color);
  animation: spin 1.5s ease infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loader-text {
  position: absolute;
  bottom: -30px;
  font-size: 14px;
  color: var(--app-text-secondary);
  animation: pulse 1.5s ease infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* 错误状态 */
.error-container {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 40px;
  text-align: center;
}

.error-icon {
  font-size: 48px;
  color: var(--app-danger-color);
  margin-bottom: 20px;
  animation: bounce 2s ease infinite;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-20px); }
  60% { transform: translateY(-10px); }
}

.error-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--app-text-primary);
  margin-bottom: 12px;
}

.error-message {
  font-size: 16px;
  color: var(--app-text-secondary);
  margin-bottom: 24px;
  max-width: 500px;
}

.error-button {
  font-weight: 600;
  padding: 10px 24px;
}

/* 主要内容 */
.calendar-content {
  position: relative;
  z-index: 1;
  animation: fadeIn 0.6s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 概览部分 */
.overview-section {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
  margin-bottom: 30px;
}

.overview-card {
  background-color: var(--app-card-bg);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--app-card-shadow);
  transition: all 0.3s;
}

.overview-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
}

.overview-header {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--app-border-color);
}

.overview-header .el-icon {
  font-size: 20px;
  color: var(--app-primary-color);
}

.overview-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.overview-body {
  padding: 20px;
}

/* 学期概览 */
.overview-data {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24px;
}

.data-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  flex: 1;
}

.data-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--app-primary-color);
  margin-bottom: 6px;
}

.data-label {
  font-size: 14px;
  color: var(--app-text-secondary);
}

.progress-bar-container {
  padding: 0 10px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--app-text-secondary);
  margin-bottom: 8px;
}

.progress-bar {
  height: 8px;
  width: 100%;
  background-color: var(--app-primary-color-light);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--app-primary-color), var(--app-success-color));
  border-radius: 4px;
  transition: width 0.5s ease;
}

/* 本周信息 */
.week-calendar {
  display: flex;
  flex-direction: column;
}

.week-header {
  margin-bottom: 16px;
  text-align: center;
}

.month-year {
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text-primary);
  margin-bottom: 4px;
}

.week-number {
  font-size: 14px;
  color: var(--app-text-secondary);
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.day-cell {
  padding: 8px 4px;
  border-radius: 8px;
  background-color: var(--app-bg-secondary);
  text-align: center;
  transition: transform 0.2s;
}

.day-cell:hover {
  transform: scale(1.05);
}

.is-today {
  background-color: var(--app-primary-color-light);
  border: 1px solid var(--app-primary-color);
}

.is-weekend {
  background-color: rgba(255, 190, 61, 0.1);
}

.day-name {
  font-size: 12px;
  color: var(--app-text-tertiary);
  margin-bottom: 4px;
}

.day-number {
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text-primary);
  margin-bottom: 4px;
}

.day-event {
  font-size: 11px;
  color: var(--app-primary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 2px 4px;
  background-color: var(--app-primary-color-light);
  border-radius: 4px;
}

/* 更新信息 */
.update-data {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
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
  color: var(--app-text-primary);
  font-weight: 500;
}

.update-note {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background-color: var(--app-primary-color-light);
  border-radius: 8px;
  font-size: 13px;
  color: var(--app-primary-color);
}

.update-note .el-icon {
  font-size: 16px;
}

/* 标签页容器 */
.tab-container {
  position: relative;
  background-color: var(--app-card-bg);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--app-card-shadow);
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

/* 表格视图样式 */
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

.table-content :deep(.calendar-cell[rowspan]) {
  vertical-align: middle;
  background-color: var(--app-table-header-bg);
  font-weight: 600;
}

.table-content :deep(.calendar-cell[colspan]) {
  text-align: center;
  background-color: var(--app-table-header-bg);
  font-weight: 600;
}

/* 红色日期突出显示 */
.table-content :deep(span[style*="color:red"]) {
  color: var(--app-danger-color) !important;
  font-weight: bold;
  display: inline-block;
  padding: 3px 6px;
  border-radius: 4px;
  background-color: rgba(255, 114, 111, 0.1);
}

/* 重要日期样式 */
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

.holiday-color {
  background-color: var(--app-warning-color);
}

.exam-color {
  background-color: var(--app-danger-color);
}

.event-color {
  background-color: var(--app-primary-color);
}

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

.date-type-holiday .date-icon {
  color: var(--app-warning-color);
}

.date-type-exam .date-icon {
  color: var(--app-danger-color);
}

.date-type-event .date-icon {
  color: var(--app-primary-color);
}

.date-content {
  flex: 1;
}

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

/* 页脚 */
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

/* 响应式调整 */
@media (max-width: 992px) {
  .overview-section {
    grid-template-columns: 1fr 1fr;
  }

  .current-week {
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

  .current-week {
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
}
</style>