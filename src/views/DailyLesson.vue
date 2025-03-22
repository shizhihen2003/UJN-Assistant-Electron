<template>
  <div class="page-container">
    <h1 class="page-title">当日课表</h1>
    <el-card class="daily-schedule">
      <el-row>
        <el-col :span="24">
          <div class="date-display">
            <h2>{{ currentDate }}</h2>
            <h3>第{{ currentWeek }}周 {{ dayOfWeekText }}</h3>
          </div>
        </el-col>
      </el-row>

      <el-empty v-if="todayLessons.length === 0" description="今日无课" />

      <div v-else class="lessons-container">
        <el-card
            v-for="(lesson, index) in todayLessons"
            :key="index"
            class="lesson-card"
            :style="{ borderLeft: `5px solid ${getLessonColor(lesson.color)}` }"
        >
          <div class="lesson-time">{{ getTimeSlot(lesson.count, lesson.len) }}</div>
          <div class="lesson-title">{{ lesson.name }}</div>
          <div class="lesson-location">{{ lesson.place }}</div>
          <div v-if="!hideTeacher && lesson.teacher" class="lesson-teacher">
            <el-tag size="small">{{ lesson.teacher }}</el-tag>
          </div>
        </el-card>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

// 模拟数据 - 实际开发中需要从存储或API获取
const currentWeek = ref(1)
const currentDayOfWeek = ref(new Date().getDay() || 7) // 1-7 表示周一到周日
const dayOfWeekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
const dayOfWeekText = computed(() => dayOfWeekMap[currentDayOfWeek.value])

// 格式化当前日期
const currentDate = computed(() => {
  const date = new Date()
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
})

// 是否隐藏教师信息
const hideTeacher = ref(true)

// 模拟今日课程数据
const todayLessons = ref([
  {
    name: '高等数学',
    place: '教学楼 A101',
    teacher: '张老师',
    count: 1, // 第几节开始
    len: 2,   // 持续几节课
    color: 1  // 颜色编号
  },
  {
    name: '大学物理',
    place: '教学楼 B203',
    teacher: '李老师',
    count: 3,
    len: 2,
    color: 2
  },
  {
    name: '程序设计',
    place: '计算机楼 304',
    teacher: '王老师',
    count: 7,
    len: 2,
    color: 3
  }
])

// 颜色映射
function getLessonColor(index) {
  const colors = [
    '#409EFF', // 蓝色
    '#67C23A', // 绿色
    '#E6A23C', // 黄色
    '#F56C6C', // 红色
    '#909399', // 灰色
    '#9B55FF', // 紫色
    '#36CEBB'  // 青色
  ]
  return colors[index % colors.length]
}

// 获取时间段
function getTimeSlot(start, len) {
  const timeSlots = [
    '08:00-08:50', // 第1节
    '09:00-09:50', // 第2节
    '10:10-11:00', // 第3节
    '11:10-12:00', // 第4节
    '14:00-14:50', // 第5节
    '15:00-15:50', // 第6节
    '16:10-17:00', // 第7节
    '17:10-18:00', // 第8节
    '19:00-19:50', // 第9节
    '20:00-20:50'  // 第10节
  ]

  const startTime = timeSlots[start - 1].split('-')[0]
  const endTime = timeSlots[start + len - 2].split('-')[1]

  return `${startTime} - ${endTime}`
}

// 加载设置和课表数据
onMounted(async () => {
  // 实际开发中，这里应该从electron-store获取设置和课表数据
  try {
    // 获取设置
    // const settings = await window.electronAPI.getStoreValue('settings')
    // hideTeacher.value = settings.hideTeacher

    // 加载课表数据 - 实际项目中需要替换为真实数据
  } catch (error) {
    console.error('加载数据失败:', error)
  }
})
</script>

<style scoped>
.daily-schedule {
  margin-top: 20px;
}

.date-display {
  text-align: center;
  margin-bottom: 20px;
}

.date-display h2 {
  font-size: 24px;
  margin-bottom: 5px;
  color: #303133;
}

.date-display h3 {
  font-size: 18px;
  color: #606266;
  font-weight: normal;
}

.lessons-container {
  margin-top: 20px;
}

.lesson-card {
  margin-bottom: 15px;
  position: relative;
  padding: 15px;
}

.lesson-time {
  font-size: 14px;
  color: #909399;
  margin-bottom: 5px;
}

.lesson-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 5px;
  color: #303133;
}

.lesson-location {
  font-size: 14px;
  color: #606266;
  margin-bottom: 5px;
}

.lesson-teacher {
  margin-top: 5px;
}
</style>