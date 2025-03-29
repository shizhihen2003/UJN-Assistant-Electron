<template>
  <div class="home-container">
    <!-- 状态卡片 -->
    <div class="status-cards">
      <el-row :gutter="16">
        <el-col :span="8">
          <el-card class="status-card today-card" shadow="hover">
            <template v-if="isLoading">
              <el-skeleton :rows="3" animated />
            </template>
            <template v-else>
              <div class="card-icon">
                <el-icon><Calendar /></el-icon>
              </div>
              <div class="card-content">
                <h3>今天</h3>
                <div class="card-value">{{ dateInfo }}</div>
                <div class="card-subtitle">第 {{ currentWeek }} 周 {{ dayOfWeekText }}</div>
              </div>
            </template>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card class="status-card classes-card" shadow="hover">
            <template v-if="isLoading">
              <el-skeleton :rows="3" animated />
            </template>
            <template v-else>
              <div class="card-icon">
                <el-icon><Document /></el-icon>
              </div>
              <div class="card-content">
                <h3>今日课程</h3>
                <div class="card-value">{{ todayLessons.length }} 节课</div>
                <div class="card-subtitle">{{ getNextClassInfo() }}</div>
              </div>
            </template>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card class="status-card exams-card" shadow="hover">
            <template v-if="isLoading">
              <el-skeleton :rows="3" animated />
            </template>
            <template v-else>
              <div class="card-icon">
                <el-icon><AlarmClock /></el-icon>
              </div>
              <div class="card-content">
                <h3>考试</h3>
                <div class="card-value">{{ upcomingExams.length }} 场考试</div>
                <div class="card-subtitle">{{ getNextExamInfo() }}</div>
              </div>
            </template>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 快捷入口 -->
    <div class="quick-access">
      <h2 class="section-title">快捷入口</h2>
      <div class="feature-grid">
        <router-link
            v-for="(feature, index) in features.slice(0, 4)"
            :key="index"
            :to="feature.route"
            class="feature-link"
        >
          <el-card class="feature-card" shadow="hover">
            <div class="feature-icon" :style="{ backgroundColor: feature.color }">
              <el-icon><component :is="feature.icon" /></el-icon>
            </div>
            <div class="feature-title">{{ feature.title }}</div>
          </el-card>
        </router-link>
      </div>
    </div>

    <el-row :gutter="16">
      <!-- 今日课程 -->
      <el-col :xs="24" :md="12">
        <el-card class="content-card">
          <template #header>
            <div class="card-header">
              <h2>今日课程</h2>
              <router-link to="/daily-lesson">
                <el-button text>查看全部</el-button>
              </router-link>
            </div>
          </template>
          <div class="today-classes">
            <template v-if="isLoading">
              <el-skeleton :rows="5" animated />
            </template>
            <template v-else-if="todayLessons.length">
              <div class="lesson-table">
                <div
                    v-for="(lesson, index) in todayLessons"
                    :key="index"
                    class="lesson-row"
                    :class="{ 'current-lesson': isCurrentLesson(lesson) }"
                >
                  <div class="lesson-time">
                    <div class="time-slot">{{ getTimeSlot(lesson.count, lesson.len) }}</div>
                    <div class="lesson-count">第 {{ lesson.count }}-{{ lesson.count + lesson.len - 1 }} 节</div>
                  </div>
                  <div class="lesson-info">
                    <div class="lesson-title">{{ lesson.name }}</div>
                    <div class="lesson-details">
                      <el-tag size="small" effect="plain">{{ lesson.place }}</el-tag>
                      <template v-if="showTeacher && lesson.teacher">
                        <el-tag size="small" type="info" effect="plain">{{ lesson.teacher }}</el-tag>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <el-empty description="今日无课" />
            </template>
          </div>
        </el-card>
      </el-col>

      <!-- 通知公告 -->
      <el-col :xs="24" :md="12">
        <el-card class="content-card">
          <template #header>
            <div class="card-header">
              <h2>通知公告</h2>
              <router-link to="/eas/notice">
                <el-button text>查看全部</el-button>
              </router-link>
            </div>
          </template>
          <div class="notice-list">
            <template v-if="isNoticeLoading">
              <el-skeleton :rows="5" animated />
            </template>
            <template v-else-if="notices.length">
              <div
                  v-for="(notice, index) in notices.slice(0, 5)"
                  :key="index"
                  class="notice-item"
                  @click="viewNoticeDetail(notice)"
              >
                <div class="notice-title">{{ notice.title || '无标题通知' }}</div>
                <div class="notice-content-preview">{{ getNoticePreview(notice.content) }}</div>
                <div class="notice-meta">
                  <span class="notice-source">{{ notice.source || '教务系统' }}</span>
                  <span class="notice-date">{{ formatNoticeDate(notice.time) }}</span>
                </div>
              </div>
            </template>
            <template v-else>
              <el-empty v-if="!needLogin" description="暂无通知" />
              <el-empty v-else description="请先登录教务系统">
                <el-button type="primary" @click="goToLogin">去登录</el-button>
              </el-empty>
            </template>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 全部功能 -->
    <div class="all-features">
      <h2 class="section-title">全部功能</h2>
      <el-row :gutter="16">
        <el-col
            v-for="(feature, index) in features"
            :key="index"
            :xs="12"
            :sm="8"
            :md="6"
            :lg="4"
        >
          <router-link :to="feature.route" class="feature-link">
            <el-card class="all-feature-card" shadow="hover">
              <div class="feature-icon" :style="{ backgroundColor: feature.color }">
                <el-icon><component :is="feature.icon" /></el-icon>
              </div>
              <div class="feature-content">
                <div class="feature-title">{{ feature.title }}</div>
                <div class="feature-desc">{{ feature.description }}</div>
              </div>
            </el-card>
          </router-link>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Calendar, Monitor, Bell, Document, DataLine, Collection,
  AlarmClock, User, Timer, Key
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus';
import authService from '@/services/authService';
import store from '@/utils/store';
import EASAccount from '@/models/EASAccount';

const router = useRouter();

// 状态变量
const isLoading = ref(true);
const isNoticeLoading = ref(true);
const needLogin = ref(false);
const currentWeek = ref(1);
const currentDayOfWeek = ref(new Date().getDay() || 7); // 1-7 表示周一到周日
const showTeacher = ref(false);

const dayOfWeekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const dayOfWeekText = computed(() => dayOfWeekMap[currentDayOfWeek.value]);

// 日期信息
const dateInfo = computed(() => {
  const date = new Date();
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
});

// 功能导航
const features = [
  {
    title: '当日课表',
    description: '查看今日的课程安排',
    icon: 'Monitor',
    route: '/daily-lesson',
    color: '#007AFF'
  },
  {
    title: '学期课表',
    description: '查看完整学期课表',
    icon: 'Calendar',
    route: '/term-lesson',
    color: '#34C759'
  },
  {
    title: '教务通知',
    description: '浏览最新教务通知',
    icon: 'Bell',
    route: '/eas/notice',
    color: '#FF9500'
  },
  {
    title: '课表查询',
    description: '查询课表信息',
    icon: 'Document',
    route: '/eas/lesson-table',
    color: '#FF3B30'
  },
  {
    title: '成绩查询',
    description: '查询考试成绩',
    icon: 'DataLine',
    route: '/eas/marks',
    color: '#5856D6'
  },
  {
    title: '学业查询',
    description: '查询学业情况',
    icon: 'Collection',
    route: '/eas/academic',
    color: '#5AC8FA'
  },
  {
    title: '考试查询',
    description: '查询考试安排',
    icon: 'AlarmClock',
    route: '/eas/exams',
    color: '#FF2D55'
  },
  {
    title: '账号登录',
    description: '登录教务/智慧济大',
    icon: 'Key',
    route: '/login/eas',
    color: '#00C7BE'
  }
];

// 今日课程数据
const todayLessons = ref([]);
const nextLesson = ref(null);

// 通知数据
const notices = ref([]);

// 考试数据
const upcomingExams = ref([]);

// 时间设置 - 初始为空，从设置中加载
const timeSlots = ref([]);

// 监听设置变更事件
const handleSettingsChanged = async (event) => {
  if (event && event.detail) {
    // 直接从事件中获取新的设置值
    showTeacher.value = event.detail.showTeacher;
    console.log('实时更新教师信息显示设置:', showTeacher.value);
  } else {
    // 从存储中重新加载设置
    showTeacher.value = await store.getBoolean('SHOW_TEACHER', false);
    console.log('重新加载教师信息显示设置:', showTeacher.value);
  }
};

// 加载自定义时间设置
const loadTimeSettings = async () => {
  try {
    const customTimeSettings = await store.getObject('LESSON_TIME_SETTINGS', null);
    if (customTimeSettings && customTimeSettings.length > 0) {
      console.log('加载自定义时间设置:', customTimeSettings);
      timeSlots.value = customTimeSettings;
    } else {
      // 如果设置中没有时间数据，加载默认值
      const defaultTimeSlots = [
        '08:00-08:50', '09:00-09:50', '10:10-11:00', '11:10-12:00',
        '14:00-14:50', '15:00-15:50', '16:10-17:00', '17:10-18:00',
        '19:00-19:50', '20:00-20:50'
      ];
      timeSlots.value = defaultTimeSlots;
      console.log('使用默认时间设置');
    }
  } catch (error) {
    console.error('加载时间设置失败:', error);
    // 出错时加载默认值
    const defaultTimeSlots = [
      '08:00-08:50', '09:00-09:50', '10:10-11:00', '11:10-12:00',
      '14:00-14:50', '15:00-15:50', '16:10-17:00', '17:10-18:00',
      '19:00-19:50', '20:00-20:50'
    ];
    timeSlots.value = defaultTimeSlots;
  }
};

// 获取下一节课信息
function getNextClassInfo() {
  if (!todayLessons.value.length) {
    return '今日无课';
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  // 找到下一节要上的课
  for (const lesson of todayLessons.value) {
    const startTimeStr = getTimeStart(lesson.count);
    if (!startTimeStr) continue;

    const [startHour, startMinute] = startTimeStr.split(':').map(Number);
    const startTime = startHour * 60 + startMinute;

    if (startTime > currentTime) {
      return `下一节: ${lesson.name} ${getTimeStart(lesson.count)}`;
    }
  }

  return '今日课程已结束';
}

// 获取下一场考试信息
function getNextExamInfo() {
  if (upcomingExams.value.length > 0) {
    const nextExam = upcomingExams.value[0];
    return `${nextExam.name} (${nextExam.date})`;
  } else {
    return '近期无考试';
  }
}

// 判断是否为当前正在进行的课程
function isCurrentLesson(lesson) {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const currentTimeInMinutes = hour * 60 + minute;

  // 获取课程的开始和结束时间
  const startTimeStr = getTimeStart(lesson.count);
  const endTimeStr = getTimeEnd(lesson.count + lesson.len - 1);

  if (!startTimeStr || !endTimeStr) return false;

  const [startHour, startMinute] = startTimeStr.split(':').map(Number);
  const [endHour, endMinute] = endTimeStr.split(':').map(Number);

  const lessonStartInMinutes = startHour * 60 + startMinute;
  const lessonEndInMinutes = endHour * 60 + endMinute;

  return currentTimeInMinutes >= lessonStartInMinutes && currentTimeInMinutes <= lessonEndInMinutes;
}

// 获取开始时间
function getTimeStart(timeSlot) {
  // 确保索引在有效范围内
  if (timeSlot < 1 || timeSlot > timeSlots.value.length || !timeSlots.value[timeSlot - 1]) {
    return null;
  }

  // 从时间段设置中获取开始时间
  const timeRange = timeSlots.value[timeSlot - 1].split('-');
  if (!timeRange || timeRange.length < 1) {
    return null;
  }
  return timeRange[0] || null;
}

// 获取结束时间
function getTimeEnd(timeSlot) {
  // 确保索引在有效范围内
  if (timeSlot < 1 || timeSlot > timeSlots.value.length || !timeSlots.value[timeSlot - 1]) {
    return null;
  }

  // 从时间段设置中获取结束时间
  const timeRange = timeSlots.value[timeSlot - 1].split('-');
  if (!timeRange || timeRange.length < 2) {
    return null;
  }
  return timeRange[1] || null;
}

// 获取时间段
function getTimeSlot(start, len) {
  if (!start || !len) return '未知时间';

  const startTimeStr = getTimeStart(start);
  const endTimeStr = getTimeEnd(start + len - 1);

  if (!startTimeStr || !endTimeStr) return `第${start}-${start + len - 1}节`;

  return `${startTimeStr}-${endTimeStr}`;
}

// 格式化通知日期
function formatNoticeDate(date) {
  if (!date) return '';

  try {
    const noticeDate = new Date(date);
    if (isNaN(noticeDate.getTime())) return date;

    return `${noticeDate.getFullYear()}-${String(noticeDate.getMonth() + 1).padStart(2, '0')}-${String(noticeDate.getDate()).padStart(2, '0')}`;
  } catch (error) {
    return date;
  }
}

// 获取通知内容预览
function getNoticePreview(content) {
  if (!content) return '暂无内容';

  // 移除HTML标签
  const plainText = content.replace(/<[^>]*>/g, '');

  // 截取合适长度的预览
  return plainText.length > 60 ? plainText.substring(0, 60) + '...' : plainText;
}

// 查看通知详情
function viewNoticeDetail(notice) {
  localStorage.setItem('currentNotice', JSON.stringify(notice));
  router.push('/eas/notice?id=' + notice.id);
}

// 跳转到登录页面
const goToLogin = () => {
  router.push('/login/eas');
};

// 将 BigInt 字符串转换为 BigInt 对象
function parseBigInt(str) {
  try {
    if (typeof str === 'string') {
      return BigInt(str);
    } else if (typeof str === 'number') {
      return BigInt(str);
    } else if (typeof str === 'bigint') {
      return str;
    }
    return 0n;
  } catch (e) {
    console.error('解析 BigInt 失败:', e, str);
    return 0n;
  }
}

// 检查登录状态
const checkLoginStatus = async () => {
  try {
    // 获取登录状态
    const loginStatus = authService.getLoginStatus();
    needLogin.value = !loginStatus.eas;
    return loginStatus.eas;
  } catch (error) {
    console.error('检查登录状态失败:', error);
    needLogin.value = true;
    return false;
  }
};

// 根据保存的数据获取当前周次
const getCurrentWeek = async () => {
  try {
    // 从设置中获取自定义开学日期
    const customOpeningDate = await store.getString('CUSTOM_OPENING_DATE', null);
    // 从课表信息中获取开学日期
    const lessonTableInfo = await store.getObject('lesson_table_info', null);

    const startDayStr = customOpeningDate || (lessonTableInfo ? lessonTableInfo.startDay : null);
    const totalWeeks = lessonTableInfo ? lessonTableInfo.totalWeek : 20;

    if (!startDayStr) {
      console.warn('未设置开学日期');
      return 1;
    }

    const now = new Date();
    const startDay = new Date(startDayStr);

    // 检查开学日期是否有效
    if (isNaN(startDay.getTime())) {
      console.error('无效的开学日期:', startDayStr);
      return 1;
    }

    // 计算当前周次
    const timeDiff = now.getTime() - startDay.getTime();
    const dayDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const weekDiff = Math.floor(dayDiff / 7) + 1;

    console.log(`当前日期: ${now}, 开学日期: ${startDay}, 天数差: ${dayDiff}, 周次: ${weekDiff}`);
    return Math.max(1, Math.min(weekDiff, totalWeeks));
  } catch (error) {
    console.error('计算当前周次失败:', error);
    return 1;
  }
};

// 提取今日课程
const extractTodayLessons = async () => {
  try {
    // 加载课表数据
    const savedTable = await store.getObject('lesson_table', null);
    if (!savedTable || !savedTable.lessons) {
      console.log('未找到课表数据');
      return [];
    }

    const dayLessons = savedTable.lessons[currentDayOfWeek.value - 1];
    if (!dayLessons) return [];

    const weekBit = BigInt(1) << BigInt(currentWeek.value - 1);
    const todayClasses = [];

    // 遍历时间段
    for (let timeIndex = 0; timeIndex < dayLessons.length; timeIndex++) {
      const group = dayLessons[timeIndex];
      if (!group || !group.lessons || group.lessons.length === 0) {
        continue;
      }

      // 查找本周的课程
      for (const lesson of group.lessons) {
        // 解析周次位图
        const weekBitmap = parseBigInt(lesson.week);

        // 判断当前周是否有课
        if ((weekBitmap & weekBit) !== 0n) {
          todayClasses.push({
            ...lesson,
            count: group.count || (timeIndex + 1),
            len: lesson.len || 1
          });
          break; // 找到第一个匹配的课程就跳出循环
        }
      }
    }

    // 按照课程开始时间排序
    return todayClasses.sort((a, b) => (a.count - b.count));
  } catch (error) {
    console.error('提取今日课程失败:', error);
    return [];
  }
};

// 加载近期考试
const loadUpcomingExams = async () => {
  try {
    // 获取当前学期的考试数据
    const examKey = `exams_${currentWeek.value < 16 ? 0 : 1}`; // 简单判断是上学期还是下学期
    const exams = await store.getObject(examKey, []);

    if (!exams || exams.length === 0) {
      // 尝试获取其他学期的考试
      for (let i = 0; i < 8; i++) {
        const termExams = await store.getObject(`exams_${i}`, []);
        if (termExams && termExams.length > 0) {
          // 找到考试数据，跳出循环
          return processExams(termExams);
        }
      }
      return [];
    }

    return processExams(exams);
  } catch (error) {
    console.error('加载考试数据失败:', error);
    return [];
  }
};

// 处理考试数据
const processExams = (exams) => {
  try {
    const now = new Date();
    const futureExams = [];

    for (const exam of exams) {
      try {
        // 解析考试日期
        if (!exam.date) continue;

        const examDate = new Date(exam.date.replace(/-/g, '/'));

        // 如果考试日期大于今天，添加到未来考试列表
        if (examDate > now) {
          futureExams.push(exam);
        }
      } catch (e) {
        console.error('解析考试日期失败:', e);
      }
    }

    // 按日期排序
    return futureExams.sort((a, b) => {
      const dateA = new Date(a.date.replace(/-/g, '/'));
      const dateB = new Date(b.date.replace(/-/g, '/'));
      return dateA - dateB;
    });
  } catch (error) {
    console.error('处理考试数据失败:', error);
    return [];
  }
};

// 加载通知
const loadNotices = async () => {
  try {
    isNoticeLoading.value = true;

    // 加载通知数据
    const savedNotices = await store.getObject('eas_notices', []);
    if (!savedNotices || savedNotices.length === 0) {
      console.log('未找到通知数据');
      isNoticeLoading.value = false;
      return [];
    }

    // 处理通知日期格式
    const processedNotices = savedNotices.map(notice => {
      // 确保通知有时间属性
      if (!notice.time && notice.date) {
        notice.time = notice.date;
      }
      return notice;
    });

    // 按时间排序（从新到旧）
    return processedNotices.sort((a, b) => {
      const timeA = new Date(a.time);
      const timeB = new Date(b.time);
      return timeB - timeA;
    });
  } catch (error) {
    console.error('加载通知数据失败:', error);
    return [];
  } finally {
    isNoticeLoading.value = false;
  }
};

// 加载所有数据
const loadAllData = async () => {
  try {
    isLoading.value = true;

    // 加载设置 - 显示教师信息
    showTeacher.value = await store.getBoolean('SHOW_TEACHER', false);

    // 加载自定义时间设置
    await loadTimeSettings();

    // 获取当前周次
    currentWeek.value = await getCurrentWeek();

    // 检查登录状态
    const isLoggedIn = await checkLoginStatus();

    if (isLoggedIn) {
      // 加载今日课程
      todayLessons.value = await extractTodayLessons();

      // 加载近期考试
      upcomingExams.value = await loadUpcomingExams();

      // 加载通知
      notices.value = await loadNotices();
    } else {
      console.log('未登录教务系统');
      // 尝试加载本地缓存的数据
      todayLessons.value = await extractTodayLessons();
      upcomingExams.value = await loadUpcomingExams();
      notices.value = await loadNotices();
    }

    // 设置下一节课信息
    updateNextLesson();
  } catch (error) {
    console.error('加载数据失败:', error);
    ElMessage.error('加载数据失败，请重试');
  } finally {
    isLoading.value = false;
    isNoticeLoading.value = false;
  }
};

// 更新下一节课信息
const updateNextLesson = () => {
  if (!todayLessons.value.length) {
    nextLesson.value = null;
    return;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  // 找到下一节要上的课
  nextLesson.value = null;
  for (const lesson of todayLessons.value) {
    const startTimeStr = getTimeStart(lesson.count);
    if (!startTimeStr) continue;

    const [startHour, startMinute] = startTimeStr.split(':').map(Number);
    const startTime = startHour * 60 + startMinute;

    if (startTime > currentTime) {
      nextLesson.value = lesson;
      break;
    }
  }
};

// 自动刷新功能
let refreshTimer = null;
const startAutoRefresh = () => {
  // 每分钟更新一次下一节课信息和当前时间
  refreshTimer = setInterval(() => {
    updateNextLesson();
  }, 60000);
};

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

// 生命周期钩子
onMounted(async () => {
  // 注册设置变更事件监听器
  window.addEventListener('ujn_settings_changed', handleSettingsChanged);

  // 启动自动刷新
  startAutoRefresh();

  // 加载所有数据
  await loadAllData();
});

// 在组件卸载时清理
onUnmounted(() => {
  // 移除事件监听器
  window.removeEventListener('ujn_settings_changed', handleSettingsChanged);

  // 停止自动刷新
  stopAutoRefresh();
});
</script>

<style scoped>
.home-container {
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

/* 状态卡片样式 */
.status-cards {
  margin-bottom: 24px;
}

.status-card {
  height: 120px;
  display: flex;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.3s, box-shadow 0.3s;
}

.status-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-medium);
}

.today-card {
  background: linear-gradient(135deg, #007AFF, #5AC8FA);
  color: white;
}

.classes-card {
  background: linear-gradient(135deg, #34C759, #00C7BE);
  color: white;
}

.exams-card {
  background: linear-gradient(135deg, #FF9500, #FF3B30);
  color: white;
}

.card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-bottom: 12px;
}

.card-icon .el-icon {
  font-size: 30px;
}

.card-content {
  padding: 16px;
}

.card-content h3 {
  font-size: 16px;
  margin: 0 0 8px 0;
  font-weight: 500;
  opacity: 0.9;
}

.card-value {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 6px;
}

.card-subtitle {
  font-size: 13px;
  opacity: 0.8;
}

/* 标题样式 */
.section-title {
  font-size: 18px;
  font-weight: 600;
  margin: 24px 0 16px;
  padding-bottom: 8px;
  position: relative;
}

.section-title::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 40px;
  height: 3px;
  background-color: var(--primary-color);
  border-radius: 3px;
}

/* 快捷入口 */
.quick-access {
  margin-bottom: 24px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.feature-link {
  text-decoration: none;
  color: inherit;
}

.feature-card {
  height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border-radius: 8px;
  transition: transform 0.3s, box-shadow 0.3s;
}

.feature-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-medium);
}

.feature-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  margin-bottom: 8px;
}

.feature-icon .el-icon {
  font-size: 20px;
  color: white;
}

.feature-title {
  font-size: 14px;
  font-weight: 500;
}

/* 内容卡片 */
.content-card {
  margin-bottom: 24px;
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h2 {
  font-size: 16px;
  margin: 0;
  font-weight: 600;
  color: var(--text-primary);
}

/* 今日课程 */
.today-classes {
  min-height: 300px;
}

.lesson-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lesson-row {
  display: flex;
  padding: 12px;
  background-color: #F8F9FA;
  border-radius: 6px;
  transition: background-color 0.3s;
}

.lesson-row:hover {
  background-color: #EDF2FC;
}

.lesson-row.current-lesson {
  background-color: #E6F7FF;
  border-left: 3px solid #007AFF;
}

.lesson-time {
  min-width: 90px;
  padding-right: 12px;
  border-right: 1px solid var(--border-color);
}

.time-slot {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.lesson-count {
  font-size: 12px;
  color: var(--text-secondary);
}

.lesson-info {
  flex: 1;
  padding-left: 12px;
}

.lesson-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.lesson-details {
  display: flex;
  gap: 8px;
}

/* 通知公告 */
.notice-list {
  min-height: 300px;
}

.notice-item {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color 0.2s;
}

.notice-item:hover {
  background-color: #F8F9FA;
}

.notice-item:last-child {
  border-bottom: none;
}

.notice-title {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
}

/* 全部功能 */
.all-features {
  margin-bottom: 24px;
}

.all-feature-card {
  height: 80px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 8px;
  transition: transform 0.3s, box-shadow 0.3s;
  margin-bottom: 16px;
}

.all-feature-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-medium);
}

.all-feature-card .feature-icon {
  min-width: 40px;
  margin-bottom: 0;
}

.all-feature-card .feature-content {
  flex: 1;
}

.all-feature-card .feature-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.all-feature-card .feature-desc {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-content-preview {
  font-size: 13px;
  color: #606266;
  margin: 5px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* 响应式调整 */
@media screen and (max-width: 768px) {
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>