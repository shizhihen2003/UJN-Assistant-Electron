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

      <el-empty v-if="loading" description="加载中...">
        <el-button :loading="true">加载课表</el-button>
      </el-empty>

      <el-empty v-else-if="needLogin" description="请先登录教务系统">
        <el-button type="primary" @click="goToLogin">去登录</el-button>
      </el-empty>

      <el-empty v-else-if="noOpeningDateSet" description="未设置开学日期">
        <el-button type="primary" @click="goToSettings">去设置</el-button>
      </el-empty>

      <el-empty v-else-if="todayLessons.length === 0" description="今日无课" />

      <div v-else class="lessons-container">
        <el-card
            v-for="(lesson, index) in todayLessons"
            :key="index"
            class="lesson-card"
            :style="{ borderLeft: `5px solid ${getLessonColor(lesson.color)}` }"
        >
          <div class="lesson-time">{{ getFullTimeRange(lesson.count, lesson.len) }}</div>
          <div class="lesson-title">{{ lesson.name }}</div>
          <div class="lesson-location">{{ lesson.place }}</div>
          <div v-if="showTeacher && lesson.teacher" class="lesson-teacher">
            <el-tag size="small">{{ lesson.teacher }}</el-tag>
          </div>
        </el-card>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import store from '@/utils/store';
import EASAccount from '@/models/EASAccount';

const router = useRouter();
const loading = ref(true);
const needLogin = ref(false);
const noOpeningDateSet = ref(false);
const currentWeek = ref(1);
const currentDayOfWeek = ref(new Date().getDay() || 7); // 1-7 表示周一到周日
const dayOfWeekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const dayOfWeekText = computed(() => dayOfWeekMap[currentDayOfWeek.value]);

// 格式化当前日期
const currentDate = computed(() => {
  const date = new Date();
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
});

// 是否显示教师信息
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

// 今日课程列表
const todayLessons = ref([]);

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
  ];
  return colors[(index || 0) % colors.length];
}

// 获取完整时间范围
function getFullTimeRange(startSlot, len) {
  if (!startSlot || !len) {
    return '未知时间';
  }

  const endSlot = startSlot + len - 1;

  // 获取起始和结束时间
  const startTime = getTimeStart(startSlot);
  const endTime = getTimeEnd(endSlot);

  // 显示完整时间范围
  return `${startTime} - ${endTime} (第${startSlot}-${endSlot}节)`;
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

// 跳转到登录页面
const goToLogin = () => {
  router.push('/login/eas');
};

// 跳转到设置页面
const goToSettings = () => {
  router.push('/settings');
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

// 提取今日课程
const extractTodayLessons = (lessonTable, week, dayOfWeek) => {
  try {
    todayLessons.value = [];

    if (!lessonTable.lessons || !lessonTable.lessons[dayOfWeek - 1]) {
      return;
    }

    const dayLessons = lessonTable.lessons[dayOfWeek - 1];
    const weekBit = BigInt(1) << BigInt(week - 1);

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
          todayLessons.value.push({
            ...lesson,
            count: group.count || (timeIndex + 1),
            len: lesson.len || 1
          });
          break; // 找到第一个匹配的课程就跳出循环
        }
      }
    }

    // 按照课程开始时间排序
    todayLessons.value.sort((a, b) => (a.count - b.count));

  } catch (error) {
    console.error('提取今日课程失败:', error);
    todayLessons.value = [];
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

    // 设置当前周次
    currentWeek.value = getCurrentWeek(startDay, savedInfo.totalWeek || 20);

    // 如果未设置开学日期，提前返回
    if (noOpeningDateSet.value) {
      loading.value = false;
      return;
    }

    // 提取今日课程
    extractTodayLessons(savedTable, currentWeek.value, currentDayOfWeek.value);

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
    // 加载设置 - 获取显示教师信息的设置
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

// 组件卸载时移除事件监听器
onUnmounted(() => {
  window.removeEventListener('ujn_settings_changed', handleSettingsChanged);
});
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