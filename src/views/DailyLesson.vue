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

      <el-empty v-else-if="todayLessons.length === 0" description="今日无课" />

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
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import store from '@/utils/store';
import EASAccount from '@/models/EASAccount';

const router = useRouter();
const loading = ref(true);
const needLogin = ref(false);
const currentWeek = ref(1);
const currentDayOfWeek = ref(new Date().getDay() || 7); // 1-7 表示周一到周日
const dayOfWeekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const dayOfWeekText = computed(() => dayOfWeekMap[currentDayOfWeek.value]);

// 格式化当前日期
const currentDate = computed(() => {
  const date = new Date();
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
});

// 是否隐藏教师信息
const hideTeacher = ref(true);

// 今日课程列表
const todayLessons = ref([]);

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
  ];

  if (!timeSlots[start - 1] || !timeSlots[start + len - 2]) {
    return `第${start}-${start + len - 1}节`;
  }

  const startTime = timeSlots[start - 1].split('-')[0];
  const endTime = timeSlots[start + len - 2].split('-')[1];

  return `${startTime} - ${endTime}`;
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

    // 设置当前周次
    if (savedInfo.totalWeek) {
      currentWeek.value = getCurrentWeek(savedInfo.startDay, savedInfo.totalWeek);
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