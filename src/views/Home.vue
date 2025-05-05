<template>
  <div class="home-container" :class="{ 'dark-mode': isDarkMode }">
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

    <!-- 状态卡片 -->
    <div class="status-cards">
      <el-row :gutter="20">
        <el-col :xs="24" :sm="8">
          <el-card class="status-card today-card" shadow="never">
            <template v-if="isLoading">
              <div class="card-loading">
                <div class="loading-spinner"></div>
              </div>
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
        <el-col :xs="24" :sm="8">
          <el-card class="status-card classes-card" shadow="never">
            <template v-if="isLoading">
              <div class="card-loading">
                <div class="loading-spinner"></div>
              </div>
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
        <el-col :xs="24" :sm="8">
          <el-card class="status-card exams-card" shadow="never">
            <template v-if="isLoading">
              <div class="card-loading">
                <div class="loading-spinner"></div>
              </div>
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

    <el-row :gutter="20" class="content-row">
      <!-- 今日课程 -->
      <el-col :xs="24" :md="12" ref="classPanelCol">
        <el-card class="content-card" ref="classPanel">
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
              <div class="content-loading">
                <div class="loading-spinner"></div>
              </div>
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
              <div class="empty-state">
                <el-empty description="今日无课">
                  <template #image>
                    <div class="custom-empty-icon">
                      <el-icon :size="40" color="var(--text-hint)"><Calendar /></el-icon>
                    </div>
                  </template>
                </el-empty>
              </div>
            </template>
          </div>
        </el-card>
      </el-col>

      <!-- 通知公告 -->
      <el-col :xs="24" :md="12">
        <el-card class="content-card" ref="noticePanel">
          <template #header>
            <div class="card-header">
              <h2>通知公告</h2>
              <router-link to="/eas/notice">
                <el-button text>查看全部</el-button>
              </router-link>
            </div>
          </template>
          <div class="notice-list" ref="noticeList">
            <template v-if="isNoticeLoading">
              <div class="content-loading">
                <div class="loading-spinner"></div>
              </div>
            </template>
            <template v-else-if="notices.length">
              <transition-group name="list" tag="div" class="notice-items">
                <div
                    v-for="(notice, index) in notices.slice(0, visibleNoticeCount)"
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
              </transition-group>
              <div v-if="notices.length > visibleNoticeCount" class="more-notices">
                <router-link to="/eas/notice" class="more-link">
                  查看更多通知 ({{ notices.length - visibleNoticeCount }}+)
                </router-link>
              </div>
            </template>
            <template v-else>
              <div class="empty-state">
                <el-empty v-if="!needLogin" description="暂无通知">
                  <template #image>
                    <div class="custom-empty-icon">
                      <el-icon :size="40" color="var(--text-hint)"><Bell /></el-icon>
                    </div>
                  </template>
                </el-empty>
                <el-empty v-else description="请先登录教务系统">
                  <template #image>
                    <div class="custom-empty-icon">
                      <el-icon :size="40" color="var(--text-hint)"><Key /></el-icon>
                    </div>
                  </template>
                  <el-button type="primary" @click="goToLogin" class="login-btn">去登录</el-button>
                </el-empty>
              </div>
            </template>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 全部功能 -->
    <div class="all-features">
      <h2 class="section-title">全部功能</h2>
      <el-row :gutter="20">
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
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  Calendar, Monitor, Bell, Document, DataLine, Collection,
  AlarmClock, User, Timer, Key, Moon, Sunny
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus';
import authService from '@/services/authService';
import store from '@/utils/store';
import EASAccount from '@/models/EASAccount';

const router = useRouter();

// DOM引用
const classPanel = ref(null);
const noticePanel = ref(null);
const noticeList = ref(null);
const classPanelCol = ref(null);

// 可见通知数量
const visibleNoticeCount = ref(3); // 默认显示3条，实际会根据高度动态调整

// 状态变量
const isLoading = ref(true);
const isNoticeLoading = ref(true);
const needLogin = ref(false);
const currentWeek = ref(1);
const currentDayOfWeek = ref(new Date().getDay() || 7); // 1-7 表示周一到周日
const showTeacher = ref(false);

// 主题切换
const isDarkMode = ref(false);

// 日期信息
const dayOfWeekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const dayOfWeekText = computed(() => dayOfWeekMap[currentDayOfWeek.value]);

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

// 数据状态
const todayLessons = ref([]);
const nextLesson = ref(null);
const notices = ref([]);
const upcomingExams = ref([]);
const timeSlots = ref([]);

// 主题切换功能
const loadThemePreference = () => {
  const savedTheme = localStorage.getItem('theme_preference');
  isDarkMode.value = savedTheme === 'dark';
  applyTheme();
};

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;
  localStorage.setItem('theme_preference', isDarkMode.value ? 'dark' : 'light');
  applyTheme();
};

const applyTheme = () => {
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark-theme');
  } else {
    document.documentElement.classList.remove('dark-theme');
  }
};

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

// 调整显示的通知数量
const adjustVisibleNoticeCount = () => {
  if (!noticePanel.value || !classPanel.value || notices.value.length === 0) return;

  // 获取课程面板的高度
  const classPanelHeight = classPanel.value.$el.clientHeight;

  // 获取通知面板头部的高度
  const noticeHeaderHeight = noticePanel.value.$el.querySelector('.card-header').clientHeight;

  // 计算通知列表可用高度
  const availableHeight = classPanelHeight - noticeHeaderHeight - 40; // 40px是内边距

  if (availableHeight <= 0) return;

  // 重置通知数量
  visibleNoticeCount.value = 0;

  // 延迟执行，确保DOM已更新
  nextTick(() => {
    // 获取单个通知的高度，如果没有通知则使用默认高度
    const noticeItemHeight = notices.value.length > 0 ?
        document.querySelector('.notice-item')?.clientHeight || 120 : 120;

    // 如果没有通知项，默认显示3条
    if (!noticeItemHeight) {
      visibleNoticeCount.value = 3;
      return;
    }

    // 计算可以显示的通知数量（保留"查看更多"的空间）
    const maxNotices = Math.floor((availableHeight - 40) / noticeItemHeight);

    // 设置可见通知数量（至少显示1条）
    visibleNoticeCount.value = Math.max(1, maxNotices);

    console.log(`调整通知显示数量: ${visibleNoticeCount.value}，可用高度: ${availableHeight}，单条高度: ${noticeItemHeight}`);
  });
};

// 加载所有数据
const loadAllData = async () => {
  try {
    isLoading.value = true;

    // 加载主题偏好
    loadThemePreference();

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

    // 延迟调整通知显示数量
    setTimeout(() => {
      adjustVisibleNoticeCount();
    }, 100);
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

// 监听窗口大小变化
const handleResize = () => {
  adjustVisibleNoticeCount();
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

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize);

  // 启动自动刷新
  startAutoRefresh();

  // 加载所有数据
  await loadAllData();
});

// 在组件卸载时清理
onUnmounted(() => {
  // 移除事件监听器
  window.removeEventListener('ujn_settings_changed', handleSettingsChanged);
  window.removeEventListener('resize', handleResize);

  // 停止自动刷新
  stopAutoRefresh();
});
</script>

<style>
:root {
  /* 主色调 */
  --primary-color: #5c6cff;
  --primary-color-rgb: 92, 108, 255;
  --primary-light: #8a96ff;
  --primary-dark: #4155e2;

  /* 功能色 */
  --success-color: #34C759;
  --warning-color: #FF9500;
  --danger-color: #FF3B30;
  --info-color: #5AC8FA;

  /* 中性色 */
  --bg-color: #f5f7fa;
  --card-bg: #ffffff;
  --text-primary: #303133;
  --text-secondary: #606266;
  --text-hint: #909399;
  --border-color: #EBEEF5;

  /* 阴影 */
  --shadow-light: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  --shadow-medium: 0 4px 16px 0 rgba(0, 0, 0, 0.08);
  --shadow-dark: 0 8px 24px 0 rgba(0, 0, 0, 0.12);

  /* 过渡 */
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
  --shadow-dark: 0 8px 24px 0 rgba(0, 0, 0, 0.4);
}
</style>

<style scoped>
/* 全局容器样式 */
.home-container {
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

.bg-particles:nth-child(1) {
  width: 300px;
  height: 300px;
  top: 10%;
  left: 5%;
  animation-duration: 45s;
}

.bg-particles:nth-child(2) {
  width: 200px;
  height: 200px;
  top: 40%;
  right: 10%;
  animation-duration: 35s;
  animation-delay: 2s;
}

.bg-particles:nth-child(3) {
  width: 100px;
  height: 100px;
  bottom: 30%;
  left: 20%;
  animation-duration: 25s;
  animation-delay: 5s;
}

.bg-particles:nth-child(4) {
  width: 150px;
  height: 150px;
  bottom: 10%;
  right: 15%;
  animation-duration: 40s;
  animation-delay: 10s;
}

.bg-particles:nth-child(5) {
  width: 180px;
  height: 180px;
  top: 20%;
  right: 30%;
  animation-duration: 50s;
  animation-delay: 7s;
}

.bg-particles:nth-child(6) {
  width: 120px;
  height: 120px;
  bottom: 40%;
  right: 40%;
  animation-duration: 55s;
  animation-delay: 3s;
}

.bg-particles:nth-child(7) {
  width: 250px;
  height: 250px;
  top: 60%;
  left: 10%;
  animation-duration: 60s;
  animation-delay: 15s;
}

.bg-particles:nth-child(8) {
  width: 200px;
  height: 200px;
  bottom: 20%;
  left: 40%;
  animation-duration: 45s;
  animation-delay: 8s;
}

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

/* 状态卡片样式 */
.status-cards {
  margin-bottom: 30px;
  position: relative;
  z-index: 1;
}

.status-card {
  height: 150px; /* 统一卡片高度 */
  display: flex;
  border-radius: 16px;
  overflow: hidden;
  transition: var(--transition-normal);
  position: relative;
  color: white;
  margin-bottom: 20px;
}

.status-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow-medium);
}

.today-card {
  background: linear-gradient(135deg, #5c6cff, #7c8aff);
}

.classes-card {
  background: linear-gradient(135deg, #34C759, #00C7BE);
}

.exams-card {
  background: linear-gradient(135deg, #FF9500, #FF3B30);
}

.card-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
}

.loading-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top: 3px solid #ffffff;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.card-icon {
  position: absolute;
  top: 15px;
  right: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
}

.card-icon .el-icon {
  font-size: 26px;
  color: rgba(255, 255, 255, 0.8);
}

.card-content {
  padding: 25px 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
}

.card-content h3 {
  font-size: 20px;
  margin: 0 0 12px 0;
  font-weight: 600;
  opacity: 0.9;
}

.card-value {
  font-size: 26px;
  font-weight: 600;
  margin-bottom: 15px;
  line-height: 1.2;
}

.card-subtitle {
  font-size: 15px;
  opacity: 0.8;
}

/* 标题样式 */
.section-title {
  font-size: 20px;
  font-weight: 600;
  margin: 30px 0 20px;
  padding-bottom: 10px;
  position: relative;
  color: var(--text-primary);
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
  margin-bottom: 30px;
  position: relative;
  z-index: 1;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.feature-link {
  text-decoration: none;
  color: inherit;
}

.feature-card {
  height: 130px; /* 增加高度 */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  border-radius: 16px;
  background-color: var(--card-bg);
  transition: var(--transition-normal);
  box-shadow: var(--shadow-light);
}

.feature-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow-medium);
}

.feature-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border-radius: 12px;
  margin-bottom: 20px; /* 增加间距 */
  transition: all 0.3s ease;
}

.feature-card:hover .feature-icon {
  transform: scale(1.1) rotate(5deg);
}

.feature-icon .el-icon {
  font-size: 24px;
  color: white;
}

.feature-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  text-align: center;
}

/* 内容卡片行 */
.content-row {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
}

/* 内容卡片 */
.content-card {
  margin-bottom: 30px;
  border-radius: 16px;
  background-color: var(--card-bg);
  box-shadow: var(--shadow-light);
  transition: var(--transition-normal);
  overflow: hidden;
  position: relative;
  z-index: 1;
  height: 100%; /* 确保两个卡片高度相同 */
  display: flex;
  flex-direction: column;
}

.content-card:hover {
  box-shadow: var(--shadow-medium);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid var(--border-color);
  min-height: 60px; /* 设置最小高度 */
}

.card-header h2 {
  font-size: 18px;
  margin: 0;
  font-weight: 600;
  color: var(--text-primary);
}

.today-classes {
  flex: 1; /* 让内容区域填充剩余高度 */
  padding: 20px;
  overflow-y: auto;
}

.notice-list {
  flex: 1; /* 让内容区域填充剩余高度 */
  padding: 20px;
  overflow: hidden; /* 隐藏溢出部分 */
  display: flex;
  flex-direction: column;
}

.notice-items {
  overflow-y: auto; /* 允许内容滚动 */
}

.content-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

/* 今日课程 */
.lesson-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lesson-row {
  display: flex;
  padding: 16px;
  background-color: var(--bg-color);
  border-radius: 12px;
  transition: var(--transition-normal);
  box-shadow: var(--shadow-light);
  position: relative;
  overflow: hidden;
}

.lesson-row::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 4px;
  background-color: var(--primary-color);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.lesson-row:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-medium);
}

.lesson-row:hover::before {
  opacity: 1;
}

.lesson-row.current-lesson {
  background-color: rgba(var(--primary-color-rgb), 0.1);
  box-shadow: var(--shadow-medium);
}

.lesson-row.current-lesson::before {
  opacity: 1;
  width: 6px;
}

.lesson-time {
  min-width: 100px;
  padding-right: 15px;
  border-right: 1px solid var(--border-color);
}

.time-slot {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.lesson-count {
  font-size: 13px;
  color: var(--text-secondary);
}

.lesson-info {
  flex: 1;
  padding-left: 15px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.lesson-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 8px;
  line-height: 1.4;
}

.lesson-details {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* 通知公告 */
.notice-item {
  padding: 16px;
  margin-bottom: 12px;
  border-radius: 12px;
  background-color: var(--bg-color);
  cursor: pointer;
  transition: var(--transition-normal);
  box-shadow: var(--shadow-light);
}

.notice-item:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-medium);
}

.notice-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 10px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-content-preview {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  min-height: 42px;
}

.notice-meta {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-hint);
}

/* 查看更多通知 */
.more-notices {
  margin-top: 10px;
  padding: 12px;
  text-align: center;
  border-top: 1px dashed var(--border-color);
}

.more-link {
  color: var(--primary-color);
  font-size: 14px;
  text-decoration: none;
  font-weight: 500;
  transition: var(--transition-normal);
  display: block;
  padding: 8px;
  border-radius: 8px;
}

.more-link:hover {
  background-color: rgba(var(--primary-color-rgb), 0.05);
  transform: translateY(-2px);
}

/* 全部功能 */
.all-features {
  margin-bottom: 40px;
  position: relative;
  z-index: 1;
}

.all-feature-card {
  height: 110px; /* 统一高度 */
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 15px;
  border-radius: 16px;
  background-color: var(--card-bg);
  transition: var(--transition-normal);
  margin-bottom: 20px;
  box-shadow: var(--shadow-light);
}

.all-feature-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow-medium);
}

.all-feature-card .feature-icon {
  min-width: 50px;
  height: 50px;
  margin-bottom: 0;
  border-radius: 12px;
}

.all-feature-card:hover .feature-icon {
  transform: scale(1.1) rotate(5deg);
}

.all-feature-card .feature-content {
  flex: 1;
  min-width: 0; /* 确保内容可以压缩 */
  padding: 5px 0; /* 添加内边距 */
}

.all-feature-card .feature-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.all-feature-card .feature-desc {
  font-size: 14px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 空状态样式 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  height: 100%;
  min-height: 250px;
}

.custom-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100px;
  height: 100px;
  margin-bottom: 20px;
  background-color: rgba(var(--primary-color-rgb), 0.05);
  border-radius: 50%;
  opacity: 0.7;
}

.login-btn {
  margin-top: 20px;
  padding: 8px 24px;
  border-radius: 8px;
  font-weight: 500;
  transition: var(--transition-normal);
}

/* 列表动画 */
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

/* 响应式调整 */
@media screen and (max-width: 992px) {
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}

@media screen and (max-width: 768px) {
  .home-container {
    padding: 16px;
  }

  .status-card {
    height: auto;
    min-height: 140px;
    margin-bottom: 16px;
  }

  .card-content {
    padding: 20px;
  }

  .card-content h3 {
    margin-bottom: 10px;
    font-size: 18px;
  }

  .card-value {
    font-size: 22px;
    margin-bottom: 10px;
  }

  .feature-grid {
    gap: 12px;
  }

  .feature-card {
    height: 110px;
    padding: 16px;
  }

  .feature-icon {
    width: 45px;
    height: 45px;
    margin-bottom: 15px;
  }

  .lesson-row, .notice-item {
    padding: 14px;
  }

  .all-feature-card {
    margin-bottom: 16px;
    padding: 14px;
    height: 100px;
  }

  /* 在移动设备上让通知区域有自己的高度 */
  .content-card {
    height: auto;
    margin-bottom: 20px;
  }

  .notice-list {
    max-height: 350px;
  }
}

@media screen and (max-width: 576px) {
  .feature-grid {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .feature-card {
    height: 100px;
    padding: 12px;
  }

  .feature-title {
    font-size: 14px;
  }

  .lesson-time {
    min-width: 90px;
  }

  .time-slot {
    font-size: 14px;
  }

  .lesson-title {
    font-size: 15px;
  }

  .all-feature-card .feature-icon {
    min-width: 40px;
    height: 40px;
  }

  .all-feature-card .feature-title {
    font-size: 15px;
  }

  .all-feature-card .feature-desc {
    font-size: 13px;
  }

  .empty-state {
    padding: 30px 15px;
  }
}
</style>