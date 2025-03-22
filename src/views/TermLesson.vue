<template>
  <div class="page-container">
    <h1 class="page-title">学期课表</h1>

    <div class="controls">
      <el-select v-model="currentWeek" placeholder="选择周次">
        <el-option
            v-for="week in totalWeeks"
            :key="week"
            :label="`第${week}周`"
            :value="week"
        />
      </el-select>
    </div>

    <el-card class="term-schedule">
      <div class="schedule-header">
        <div class="time-column">时间</div>
        <div
            v-for="day in 7"
            :key="day"
            class="day-column"
            :class="{ 'current-day': currentDay === day }"
        >
          {{ weekdays[day-1] }}
        </div>
      </div>

      <div class="schedule-body">
        <div
            v-for="timeSlot in 10"
            :key="timeSlot"
            class="time-row"
        >
          <div class="time-column">
            <div class="time-slot">{{ timeSlot }}</div>
            <div class="time-range">{{ getTimeRange(timeSlot) }}</div>
          </div>

          <div
              v-for="day in 7"
              :key="day"
              class="day-column"
              :class="{ 'current-day': currentDay === day }"
          >
            <div
                v-if="hasLesson(day, timeSlot)"
                class="lesson-block"
                :style="{
                height: `${getLessonHeight(day, timeSlot)}px`,
                backgroundColor: getLessonColor(getLessonAt(day, timeSlot).color)
              }"
                @click="showLessonDetail(getLessonAt(day, timeSlot))"
            >
              <div class="lesson-name">{{ getLessonAt(day, timeSlot).name }}</div>
              <div class="lesson-place">{{ getLessonAt(day, timeSlot).place }}</div>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 课程详情对话框 -->
    <el-dialog
        v-model="dialogVisible"
        title="课程详情"
        width="30%"
    >
      <template v-if="selectedLesson">
        <h3>{{ selectedLesson.name }}</h3>
        <p><strong>地点:</strong> {{ selectedLesson.place }}</p>
        <p v-if="!hideTeacher && selectedLesson.teacher">
          <strong>教师:</strong> {{ selectedLesson.teacher }}
        </p>
        <p><strong>时间:</strong> {{ getTimeRange(selectedLesson.count) }} - {{ getTimeRange(selectedLesson.count + selectedLesson.len - 1, true) }}</p>
        <p><strong>周次:</strong> {{ formatWeeks(selectedLesson.week) }}</p>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

// 状态变量
const totalWeeks = ref(20)
const currentWeek = ref(1)
const currentDay = ref(new Date().getDay() || 7) // 1-7 表示周一到周日
const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const hideTeacher = ref(true)

// 对话框状态
const dialogVisible = ref(false)
const selectedLesson = ref(null)

// 模拟课表数据 - 实际开发中需要从存储或API获取
const lessons = ref([
  {
    name: '高等数学',
    place: '教学楼 A101',
    teacher: '张老师',
    day: 1, // 周一
    count: 1, // 第1节开始
    len: 2,   // 持续2节课
    week: 0b111111111111111, // 1-15周有课
    color: 1
  },
  {
    name: '大学物理',
    place: '教学楼 B203',
    teacher: '李老师',
    day: 3, // 周三
    count: 3, // 第3节开始
    len: 2,   // 持续2节课
    week: 0b101010101010101, // 1,3,5,7,9,11,13,15周有课
    color: 2
  },
  {
    name: '程序设计',
    place: '计算机楼 304',
    teacher: '王老师',
    day: 5, // 周五
    count: 7, // 第7节开始
    len: 2,   // 持续2节课
    week: 0b111111111111111, // 1-15周有课
    color: 3
  }
])

// 获取时间范围
function getTimeRange(timeSlot, endTime = false) {
  const timeRanges = [
    ['08:00', '08:50'], // 第1节
    ['09:00', '09:50'], // 第2节
    ['10:10', '11:00'], // 第3节
    ['11:10', '12:00'], // 第4节
    ['14:00', '14:50'], // 第5节
    ['15:00', '15:50'], // 第6节
    ['16:10', '17:00'], // 第7节
    ['17:10', '18:00'], // 第8节
    ['19:00', '19:50'], // 第9节
    ['20:00', '20:50']  // 第10节
  ]

  return endTime ? timeRanges[timeSlot - 1][1] : timeRanges[timeSlot - 1][0]
}

// 格式化周次
function formatWeeks(weekBitmap) {
  const weeks = []
  let start = null

  for (let i = 0; i < 20; i++) {
    if ((weekBitmap & (1 << i)) !== 0) {
      if (start === null) start = i + 1
    } else {
      if (start !== null) {
        if (i === start) {
          weeks.push(`${start}`)
        } else {
          weeks.push(`${start}-${i}`)
        }
        start = null
      }
    }
  }

  if (start !== null) {
    weeks.push(`${start}-${20}`)
  }

  return weeks.join(', ')
}

// 检查指定位置是否有课
function hasLesson(day, timeSlot) {
  return lessons.value.some(lesson =>
      lesson.day === day &&
      timeSlot >= lesson.count &&
      timeSlot < lesson.count + lesson.len &&
      ((lesson.week & (1 << (currentWeek.value - 1))) !== 0)
  )
}

// 获取指定位置的课程
function getLessonAt(day, timeSlot) {
  return lessons.value.find(lesson =>
      lesson.day === day &&
      timeSlot >= lesson.count &&
      timeSlot < lesson.count + lesson.len &&
      ((lesson.week & (1 << (currentWeek.value - 1))) !== 0)
  )
}

// 计算课程块的高度
function getLessonHeight(day, timeSlot) {
  const lesson = getLessonAt(day, timeSlot)
  return lesson ? lesson.len * 60 : 60
}

// 课程颜色
function getLessonColor(index) {
  const colors = [
    'rgba(64, 158, 255, 0.7)', // 蓝色
    'rgba(103, 194, 58, 0.7)',  // 绿色
    'rgba(230, 162, 60, 0.7)',  // 黄色
    'rgba(245, 108, 108, 0.7)', // 红色
    'rgba(144, 147, 153, 0.7)', // 灰色
    'rgba(155, 85, 255, 0.7)',  // 紫色
    'rgba(54, 206, 187, 0.7)'   // 青色
  ]
  return colors[index % colors.length]
}

// 显示课程详情
function showLessonDetail(lesson) {
  selectedLesson.value = lesson
  dialogVisible.value = true
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
.controls {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
}

.term-schedule {
  margin-top: 20px;
}

.schedule-header {
  display: flex;
  border-bottom: 1px solid #ebeef5;
}

.time-column {
  width: 80px;
  text-align: center;
  padding: 10px 0;
  border-right: 1px solid #ebeef5;
  font-weight: bold;
}

.day-column {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  font-weight: bold;
  border-right: 1px solid #ebeef5;
}

.day-column:last-child {
  border-right: none;
}

.current-day {
  background-color: #f0f9ff;
}

.schedule-body {
  display: flex;
  flex-direction: column;
}

.time-row {
  display: flex;
  border-bottom: 1px solid #ebeef5;
}

.time-row:last-child {
  border-bottom: none;
}

.time-slot {
  font-weight: bold;
  font-size: 14px;
}

.time-range {
  font-size: 12px;
  color: #909399;
}

.lesson-block {
  padding: 5px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.lesson-name {
  font-weight: bold;
  margin-bottom: 5px;
  font-size: 14px;
}

.lesson-place {
  font-size: 12px;
}
</style>