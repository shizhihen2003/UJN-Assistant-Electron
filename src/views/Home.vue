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
                      <template v-if="!hideTeacher && lesson.teacher">
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
                <div class="notice-title">{{ notice.title }}</div>
                <div class="notice-meta">
                  <span class="notice-source">{{ notice.source }}</span>
                  <span class="notice-date">{{ notice.date }}</span>
                </div>
              </div>
            </template>
            <template v-else>
              <el-empty description="暂无通知" />
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
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Calendar, Monitor, Bell, Document, DataLine, Collection,
  AlarmClock, User, Timer, Key
} from '@element-plus/icons-vue'

const router = useRouter()

// 状态变量
const isLoading = ref(true)
const isNoticeLoading = ref(true)
const currentWeek = ref(1)
const currentDayOfWeek = ref(new Date().getDay() || 7) // 1-7 表示周一到周日
const hideTeacher = ref(false)

const dayOfWeekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
const dayOfWeekText = computed(() => dayOfWeekMap[currentDayOfWeek.value])

// 日期信息
const dateInfo = computed(() => {
  const date = new Date()
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
})

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
]

// 模拟今日课程数据
const todayLessons = ref([])
const nextLesson = ref(null)

// 模拟通知数据
const notices = ref([])

// 模拟考试数据
const upcomingExams = ref([])

// 获取下一节课信息
function getNextClassInfo() {
  if (nextLesson.value) {
    return `下一节: ${nextLesson.value.name} ${getTimeSlot(nextLesson.value.count, nextLesson.value.len)}`
  } else if (todayLessons.value.length > 0) {
    return '今日课程已结束'
  } else {
    return '今日无课'
  }
}

// 获取下一场考试信息
function getNextExamInfo() {
  if (upcomingExams.value.length > 0) {
    const nextExam = upcomingExams.value[0]
    return `${nextExam.name} (${nextExam.date})`
  } else {
    return '近期无考试'
  }
}

// 判断是否为当前正在进行的课程
function isCurrentLesson(lesson) {
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()

  const timeSlots = [
    {start: '08:00', end: '08:50'}, // 第1节
    {start: '09:00', end: '09:50'}, // 第2节
    {start: '10:10', end: '11:00'}, // 第3节
    {start: '11:10', end: '12:00'}, // 第4节
    {start: '14:00', end: '14:50'}, // 第5节
    {start: '15:00', end: '15:50'}, // 第6节
    {start: '16:10', end: '17:00'}, // 第7节
    {start: '17:10', end: '18:00'}, // 第8节
    {start: '19:00', end: '19:50'}, // 第9节
    {start: '20:00', end: '20:50'}  // 第10节
  ]

  const lessonStart = timeSlots[lesson.count - 1].start.split(':').map(Number)
  const lessonEnd = timeSlots[lesson.count + lesson.len - 2].end.split(':').map(Number)

  const currentTimeInMinutes = hour * 60 + minute
  const lessonStartInMinutes = lessonStart[0] * 60 + lessonStart[1]
  const lessonEndInMinutes = lessonEnd[0] * 60 + lessonEnd[1]

  return currentTimeInMinutes >= lessonStartInMinutes && currentTimeInMinutes <= lessonEndInMinutes
}

// 获取时间段
function getTimeSlot(start, len) {
  const timeSlots = [
    {start: '08:00', end: '08:50'}, // 第1节
    {start: '09:00', end: '09:50'}, // 第2节
    {start: '10:10', end: '11:00'}, // 第3节
    {start: '11:10', end: '12:00'}, // 第4节
    {start: '14:00', end: '14:50'}, // 第5节
    {start: '15:00', end: '15:50'}, // 第6节
    {start: '16:10', end: '17:00'}, // 第7节
    {start: '17:10', end: '18:00'}, // 第8节
    {start: '19:00', end: '19:50'}, // 第9节
    {start: '20:00', end: '20:50'}  // 第10节
  ]

  const startTime = timeSlots[start - 1].start
  const endTime = timeSlots[start + len - 2].end

  return `${startTime}-${endTime}`
}

// 查看通知详情
function viewNoticeDetail(notice) {
  localStorage.setItem('currentNotice', JSON.stringify(notice))
  router.push('/eas/notice?id=' + notice.id)
}

// 加载数据
onMounted(async () => {
  try {
    // 在实际项目中，这里应该使用electron-store或IPC通信获取数据
    setTimeout(() => {
      // 模拟数据加载
      hideTeacher.value = false
      currentWeek.value = 12 // 假设当前是第12周

      // 模拟今日课程数据
      todayLessons.value = [
        {
          name: '高等数学',
          place: '教学楼 A101',
          teacher: '张老师',
          count: 1, // 第几节开始
          len: 2,   // 持续几节课
          color: 0  // 颜色编号
        },
        {
          name: '大学物理',
          place: '教学楼 B203',
          teacher: '李老师',
          count: 3,
          len: 2,
          color: 1
        },
        {
          name: '程序设计',
          place: '计算机楼 304',
          teacher: '王老师',
          count: 7,
          len: 2,
          color: 2
        }
      ]

      // 设置下一节课信息
      const now = new Date()
      const hour = now.getHours()
      const minute = now.getMinutes()

      // 简单逻辑：根据当前时间确定下一节课
      if (hour < 8 || (hour === 8 && minute < 50)) {
        nextLesson.value = todayLessons.value[0] // 8点前，下一节课是第一节
      } else if (hour < 10 || (hour === 10 && minute < 10)) {
        nextLesson.value = todayLessons.value[1] // 10:10前，下一节课是第三节
      } else if (hour < 16 || (hour === 16 && minute < 10)) {
        nextLesson.value = todayLessons.value[2] // 16:10前，下一节课是第七节
      } else {
        nextLesson.value = null // 今天没有课了
      }

      isLoading.value = false
    }, 1000)

    // 加载通知数据
    setTimeout(() => {
      notices.value = [
        {
          id: 1,
          title: '关于2024-2025学年第二学期期中考试安排的通知',
          content: '各学院、各部门：期中考试定于第9周进行，请各学院做好相关准备工作...',
          date: '2025-03-20',
          type: 'warning',
          source: '教务处'
        },
        {
          id: 2,
          title: '关于开展2025届毕业生学位申请工作的通知',
          content: '各学院：根据学校安排，现开展2025届毕业生学位申请工作，请各位学生...',
          date: '2025-03-18',
          type: 'primary',
          source: '教务处'
        },
        {
          id: 3,
          title: '关于开展创新创业项目申报的通知',
          content: '各学院：为促进学生创新能力培养，学校将开展2025年创新创业项目申报...',
          date: '2025-03-15',
          type: 'success',
          source: '创新创业学院'
        },
        {
          id: 4,
          title: '关于2024-2025学年第二学期教材发放的通知',
          content: '各位同学：本学期教材已到，请各班级学习委员于本周内到教材科领取...',
          date: '2025-03-10',
          type: 'info',
          source: '教务处'
        },
        {
          id: 5,
          title: '关于校园网络系统维护的通知',
          content: '全校师生：计划于本周六上午8:00-12:00对校园网络系统进行维护升级...',
          date: '2025-03-08',
          type: 'warning',
          source: '信息中心'
        }
      ]
      isNoticeLoading.value = false
    }, 1500)

    // 加载考试数据
    setTimeout(() => {
      upcomingExams.value = [
        {
          id: 1,
          name: '高等数学期中考试',
          date: '2025-04-15',
          time: '08:30-10:30',
          location: '第一教学楼 101'
        },
        {
          id: 2,
          name: '大学物理期中考试',
          date: '2025-04-18',
          time: '14:00-16:00',
          location: '第二教学楼 205'
        }
      ]
    }, 1200)

  } catch (error) {
    console.error('加载数据失败:', error)
    isLoading.value = false
    isNoticeLoading.value = false
  }
})
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

/* 响应式调整 */
@media screen and (max-width: 768px) {
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media screen and (max-width: 480px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }
}
</style>