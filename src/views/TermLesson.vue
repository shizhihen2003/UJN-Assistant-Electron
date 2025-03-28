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

    <el-empty v-else-if="noOpeningDateSet" description="未设置开学日期">
      <el-button type="primary" @click="goToSettings">去设置</el-button>
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
            <div class="time-range">{{ getFullTimeRange(timeSlot) }}</div>
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
              <div v-if="showTeacher && getLessonAt(day, timeSlot).teacher" class="lesson-teacher">
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
        <p v-if="showTeacher && selectedLesson.teacher">
          <strong>教师:</strong> {{ selectedLesson.teacher }}
        </p>
        <p><strong>时间:</strong> {{ getClassTimeDisplay(selectedLesson) }}</p>
        <p><strong>周次:</strong> {{ formatWeeks(selectedLesson.week) }}</p>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import store from '@/utils/store';
import EASAccount from '@/models/EASAccount';

const router = useRouter();
const loading = ref(true);
const needLogin = ref(false);
const noOpeningDateSet = ref(false);

// 状态变量
const totalWeeks = ref(20);
const currentWeek = ref(1);
const currentDay = ref(new Date().getDay() || 7); // 1-7 表示周一到周日
const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const showTeacher = ref(false);

// 时间设置
const timeSlots = ref([
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
]);

// 课表数据
const lessonTable = ref({
  startDay: new Date(),
  totalWeek: 20,
  lessons: Array(7).fill().map(() => Array(10).fill(null))
});

// 对话框状态
const dialogVisible = ref(false);
const selectedLesson = ref(null);

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
      timeSlots.value = customTimeSettings.slice(0, 10);

      // 如果自定义时间段数量小于10，用默认值补齐
      if (customTimeSettings.length < 10) {
        const defaultTimeSlots = [
          '08:00-08:50', '09:00-09:50', '10:10-11:00', '11:10-12:00',
          '14:00-14:50', '15:00-15:50', '16:10-17:00', '17:10-18:00',
          '19:00-19:50', '20:00-20:50'
        ];
        for (let i = customTimeSettings.length; i < 10; i++) {
          timeSlots.value.push(defaultTimeSlots[i]);
        }
      }
    }
  } catch (error) {
    console.error('加载时间设置失败:', error);
  }
};

// 获取完整时间范围
function getFullTimeRange(timeSlot) {
  // 确保索引在有效范围内
  if (timeSlot < 1 || timeSlot > timeSlots.value.length || !timeSlots.value[timeSlot - 1]) {
    return `第${timeSlot}节`;
  }

  return timeSlots.value[timeSlot - 1] || `第${timeSlot}节`;
}

// 获取开始时间
function getTimeStart(timeSlot) {
  // 确保索引在有效范围内
  if (timeSlot < 1 || timeSlot > timeSlots.value.length || !timeSlots.value[timeSlot - 1]) {
    return `第${timeSlot}节`;
  }

  // 从时间段设置中获取开始时间
  const timeRange = timeSlots.value[timeSlot - 1].split('-');
  if (!timeRange || timeRange.length < 1) {
    return `第${timeSlot}节`;
  }
  return timeRange[0] || `第${timeSlot}节`;
}

// 获取结束时间
function getTimeEnd(timeSlot) {
  // 确保索引在有效范围内
  if (timeSlot < 1 || timeSlot > timeSlots.value.length || !timeSlots.value[timeSlot - 1]) {
    return `第${timeSlot}节`;
  }

  // 从时间段设置中获取结束时间
  const timeRange = timeSlots.value[timeSlot - 1].split('-');
  if (!timeRange || timeRange.length < 2) {
    return `第${timeSlot}节`;
  }
  return timeRange[1] || `第${timeSlot}节`;
}

// 获取课程时间显示内容
function getClassTimeDisplay(lesson) {
  if (!lesson || !lesson.count || !lesson.len) {
    return '未知时间';
  }

  const startSlot = lesson.count;
  const endSlot = lesson.count + lesson.len - 1;

  // 获取起始和结束时间
  const startTime = getTimeStart(startSlot);
  const endTime = getTimeEnd(endSlot);

  // 显示完整时间范围
  return `${startTime} - ${endTime} (第${startSlot}-${endSlot}节)`;
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
          if (i - 1 === start - 1) {
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

// 跳转到设置页面
const goToSettings = () => {
  router.push('/settings');
};

// 根据保存的数据获取当前周次
const getCurrentWeek = (startDayStr, totalWeeks) => {
  try {
    if (!startDayStr) {
      noOpeningDateSet.value = true;
      return 1;  // 如果没有设置开学日期，默认为第1周并显示错误提示
    }

    const now = new Date();
    const startDay = new Date(startDayStr);

    // 检查开学日期是否有效
    if (isNaN(startDay.getTime())) {
      console.error('无效的开学日期:', startDayStr);
      noOpeningDateSet.value = true;
      return 1;
    }

    // 计算当前周次
    const timeDiff = now.getTime() - startDay.getTime();
    const dayDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const weekDiff = Math.floor(dayDiff / 7) + 1;

    // 有效的开学日期，隐藏错误提示
    noOpeningDateSet.value = false;

    console.log(`当前日期: ${now}, 开学日期: ${startDay}, 天数差: ${dayDiff}, 周次: ${weekDiff}`);
    return Math.max(1, Math.min(weekDiff, totalWeeks));
  } catch (error) {
    console.error('计算当前周次失败:', error);
    noOpeningDateSet.value = true;
    return 1;
  }
};

// 加载课表数据
const loadLessonTable = async () => {
  try {
    loading.value = true;

    // 加载自定义时间设置
    await loadTimeSettings();

    // 加载保存的课表数据
    const savedTable = await store.getObject('lesson_table', null);
    const savedInfo = await store.getObject('lesson_table_info', null);

    if (!savedTable || !savedInfo) {
      loading.value = false;
      ElMessage.warning('未找到课表数据，请先在课表查询页面获取数据');
      needLogin.value = true;
      return;
    }

    // 从设置中获取自定义开学日期
    const customOpeningDate = await store.getString('CUSTOM_OPENING_DATE', null);
    const startDay = customOpeningDate || savedInfo.startDay;

    // 设置课表数据
    lessonTable.value = savedTable;

    // 设置总周数和当前周次
    totalWeeks.value = savedInfo.totalWeek || 20;
    currentWeek.value = getCurrentWeek(startDay, totalWeeks.value);

    // 如果未设置开学日期，提前返回
    if (noOpeningDateSet.value) {
      loading.value = false;
      return;
    }

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
    // 加载设置 - 注意这里是直接获取显示教师信息的设置
    showTeacher.value = await store.getBoolean('SHOW_TEACHER', false);
    console.log('教师信息显示设置:', showTeacher.value);

    // 注册设置变更事件监听器
    window.addEventListener('ujn_settings_changed', handleSettingsChanged);

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

// 组件卸载时移除事件监听器
onUnmounted(() => {
  window.removeEventListener('ujn_settings_changed', handleSettingsChanged);
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