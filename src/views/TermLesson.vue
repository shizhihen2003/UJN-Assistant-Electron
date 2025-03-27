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

    <el-empty v-if="loading" description="加载中...">
      <el-button :loading="true">加载课表</el-button>
    </el-empty>

    <el-empty v-else-if="needLogin" description="请先登录教务系统">
      <el-button type="primary" @click="goToLogin">去登录</el-button>
    </el-empty>

    <el-card v-else class="term-schedule">
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
              <div v-if="!hideTeacher && getLessonAt(day, timeSlot).teacher" class="lesson-teacher">
                {{ getLessonAt(day, timeSlot).teacher }}
              </div>
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
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import store from '@/utils/store';
import EASAccount from '@/models/EASAccount';

const router = useRouter();
const loading = ref(true);
const needLogin = ref(false);

// 状态变量
const totalWeeks = ref(20);
const currentWeek = ref(1);
const currentDay = ref(new Date().getDay() || 7); // 1-7 表示周一到周日
const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const hideTeacher = ref(true);

// 课表数据
const lessonTable = ref({
  startDay: new Date(),
  totalWeek: 20,
  lessons: Array(7).fill().map(() => Array(10).fill(null))
});

// 对话框状态
const dialogVisible = ref(false);
const selectedLesson = ref(null);

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
  ];

  // 确保索引在有效范围内
  if (timeSlot < 1 || timeSlot > timeRanges.length) {
    return '未知时间';
  }

  return endTime ? timeRanges[timeSlot - 1][1] : timeRanges[timeSlot - 1][0];
}

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

// 格式化周次
function formatWeeks(weekBitmap) {
  try {
    // 确保 weekBitmap 是 BigInt
    const bitmap = parseBigInt(weekBitmap);

    // 将 BigInt 转换为二进制字符串，然后处理
    const binaryString = bitmap.toString(2).padStart(totalWeeks.value, '0').split('').reverse().join('');
    const weeks = [];
    let start = null;

    for (let i = 0; i < binaryString.length; i++) {
      if (binaryString[i] === '1') {
        if (start === null) start = i + 1;
      } else {
        if (start !== null) {
          if (i === start) {
            weeks.push(`${start}`);
          } else {
            weeks.push(`${start}-${i}`);
          }
          start = null;
        }
      }
    }

    if (start !== null) {
      if (start === binaryString.length) {
        weeks.push(`${start}`);
      } else {
        weeks.push(`${start}-${binaryString.length}`);
      }
    }

    return weeks.join(', ');
  } catch (error) {
    console.error('格式化周次失败:', error);
    return '未知';
  }
}

// 检查指定位置是否有课
function hasLesson(day, timeSlot) {
  try {
    const dayIndex = day - 1;
    const timeIndex = timeSlot - 1;

    if (!lessonTable.value.lessons[dayIndex] || !lessonTable.value.lessons[dayIndex][timeIndex]) {
      return false;
    }

    const group = lessonTable.value.lessons[dayIndex][timeIndex];
    if (!group || !group.lessons || group.lessons.length === 0) {
      return false;
    }

    // 检查周次位图
    return group.lessons.some(lesson => {
      const weekBits = parseBigInt(lesson.week);
      const weekBit = BigInt(1) << BigInt(currentWeek.value - 1);
      return (weekBits & weekBit) !== 0n;
    });
  } catch (error) {
    console.error('检查课程失败:', error);
    return false;
  }
}

// 获取指定位置的课程
function getLessonAt(day, timeSlot) {
  try {
    const dayIndex = day - 1;
    const timeIndex = timeSlot - 1;

    if (!lessonTable.value.lessons[dayIndex] || !lessonTable.value.lessons[dayIndex][timeIndex]) {
      return null;
    }

    const group = lessonTable.value.lessons[dayIndex][timeIndex];
    if (!group || !group.lessons || group.lessons.length === 0) {
      return null;
    }

    // 获取当前周的课程
    const weekBit = BigInt(1) << BigInt(currentWeek.value - 1);
    return group.lessons.find(lesson => {
      const weekBits = parseBigInt(lesson.week);
      return (weekBits & weekBit) !== 0n;
    });
  } catch (error) {
    console.error('获取课程失败:', error);
    return null;
  }
}

// 计算课程块的高度
function getLessonHeight(day, timeSlot) {
  const lesson = getLessonAt(day, timeSlot);
  return lesson ? lesson.len * 60 : 60;
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
  ];
  return colors[(index || 0) % colors.length];
}

// 显示课程详情
function showLessonDetail(lesson) {
  if (!lesson) return;
  selectedLesson.value = lesson;
  dialogVisible.value = true;
}

// 跳转到登录页面
const goToLogin = () => {
  router.push('/login/eas');
};

// 根据保存的数据获取当前周次
const getCurrentWeek = (startDayStr, totalWeeks) => {
  try {
    const now = new Date();
    const startDay = new Date(startDayStr);

    // 计算当前周次
    const timeDiff = now.getTime() - startDay.getTime();
    const dayDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const weekDiff = Math.floor(dayDiff / 7) + 1;

    return Math.max(1, Math.min(weekDiff, totalWeeks));
  } catch (error) {
    console.error('计算当前周次失败:', error);
    return 1;
  }
};

// 加载课表数据
const loadLessonTable = async () => {
  try {
    loading.value = true;

    // 加载保存的课表数据
    const savedTable = await store.getObject('lesson_table', null);
    const savedInfo = await store.getObject('lesson_table_info', null);

    if (!savedTable || !savedInfo) {
      loading.value = false;
      ElMessage.warning('未找到课表数据，请先在课表查询页面获取数据');
      needLogin.value = true;
      return;
    }

    // 设置课表数据
    lessonTable.value = savedTable;

    // 设置总周数和当前周次
    totalWeeks.value = savedInfo.totalWeek || 20;
    currentWeek.value = getCurrentWeek(savedInfo.startDay, totalWeeks.value);

    loading.value = false;
  } catch (error) {
    console.error('加载课表数据失败:', error);
    ElMessage.error('加载课表数据失败: ' + error.message);
    loading.value = false;
  }
};

// 加载设置和课表数据
onMounted(async () => {
  try {
    // 加载设置
    hideTeacher.value = await store.getBoolean('HIDE_TEACHER', true);

    // 加载课表
    await loadLessonTable();
  } catch (error) {
    console.error('初始化失败:', error);
    loading.value = false;
  }
});

// 监听周次变化
watch(currentWeek, (newWeek) => {
  console.log(`当前周次变更为: 第${newWeek}周`);
});
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
  position: relative;
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
  height: 60px;
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
  position: absolute;
  left: 2px;
  right: 2px;
  top: 2px;
  z-index: 1;
}

.lesson-name {
  font-weight: bold;
  margin-bottom: 5px;
  font-size: 14px;
}

.lesson-place {
  font-size: 12px;
  margin-bottom: 3px;
}

.lesson-teacher {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
}
</style>