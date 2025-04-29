<template>
  <div class="page-container">
    <h1 class="page-title">校历查询</h1>

    <div class="controls">
      <el-button type="primary" @click="refreshCalendar" :loading="loading">
        <el-icon><Refresh /></el-icon> 刷新校历
      </el-button>
    </div>

    <el-card v-if="loading" class="calendar-card">
      <div class="loading-container">
        <el-skeleton :rows="10" animated />
      </div>
    </el-card>

    <el-card v-else-if="error" class="calendar-card">
      <el-empty :description="error">
        <el-button type="primary" @click="refreshCalendar">重试</el-button>
      </el-empty>
    </el-card>

    <div v-else>
      <!-- 学期信息卡片 -->
      <el-card class="semester-info-card">
        <template #header>
          <div class="card-header">
            <h3>{{ calendarData.title || '校历' }}</h3>
          </div>
        </template>
        <div class="semester-info">
          <div class="semester-detail">
            <p><strong>学年:</strong> {{ calendarData.semesterInfo?.year || '-' }}</p>
            <p><strong>学期:</strong> {{ calendarData.semesterInfo?.semester || '-' }}</p>
            <p><strong>当前周次:</strong> 第{{ currentWeek }}周</p>
          </div>
          <div class="update-time">
            最后更新: {{ formatTime(updateTime) }}
          </div>
        </div>
      </el-card>

      <!-- 当前周提示 -->
      <div class="current-week-info">
        <el-alert
            :title="`当前为第${currentWeek}周 (${getCurrentWeekDates()})`"
            type="info"
            :closable="false"
            show-icon
        />
      </div>

      <!-- 校历显示 -->
      <el-tabs v-model="activeTabName" class="calendar-tabs">
        <!-- 表格视图 -->
        <el-tab-pane label="表格视图" name="table">
          <div class="full-calendar-container">
            <el-card v-if="calendarData.htmlContent" class="full-calendar">
              <div class="html-content" v-html="processHtmlContent(calendarData.htmlContent)"></div>
            </el-card>
            <el-empty v-else description="无法获取完整校历内容" />
          </div>
        </el-tab-pane>

        <!-- 重要日期 -->
        <el-tab-pane label="重要日期" name="dates">
          <el-timeline>
            <el-timeline-item
                v-for="(date, index) in getImportantDates()"
                :key="index"
                :type="date.type === 'holiday' ? 'warning' : (date.type === 'exam' ? 'danger' : 'primary')"
                :timestamp="date.timeString"
            >
              {{ date.name }}
            </el-timeline-item>
          </el-timeline>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import {ref, computed, onMounted} from 'vue';
import {ElMessage} from 'element-plus';
import {Refresh} from '@element-plus/icons-vue';
import calendarService from '@/services/calendarService';
import store from '@/utils/store';

// 状态变量
const loading = ref(true);
const error = ref(null);
const calendarData = ref({});
const updateTime = ref(null);
const currentWeek = ref(1);
const activeTabName = ref('table');

// 当前日期和周几
const today = new Date();
const currentDay = ref(today.getDay() || 7); // 1-7 表示周一到周日

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
  return html
      .replace(/style="[^"]*"/g, function (match) {
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
};

// 获取重要日期
const getImportantDates = () => {
  // 直接使用calendarService提取的重要日期
  const dates = calendarData.value.importantDates || [];
  console.log('Vue组件中的重要日期:', dates);  // 添加调试日志
  return dates;
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

    ElMessage.success('校历数据已更新');
  } catch (err) {
    console.error('刷新校历失败:', err);
    error.value = '获取校历数据失败: ' + (err.message || '未知错误');
    ElMessage.error('获取校历数据失败，请稍后再试');
  } finally {
    loading.value = false;
  }
};

// 初始加载
onMounted(async () => {
  try {
    // 从服务获取校历数据
    const data = await calendarService.getCalendarData();
    calendarData.value = data;
    updateTime.value = data.updateTime;

    // 计算当前周次
    currentWeek.value = await calculateCurrentWeek(data);
  } catch (err) {
    console.error('加载校历数据失败:', err);
    error.value = '获取校历数据失败: ' + (err.message || '未知错误');
    ElMessage.error('获取校历数据失败，请稍后再试');
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.page-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--el-color-primary);
}

.controls {
  margin-bottom: 20px;
  display: flex;
  justify-content: flex-end;
}

.calendar-card {
  margin-bottom: 20px;
}

.loading-container {
  padding: 40px 0;
}

.semester-info-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.semester-info {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
}

.semester-detail {
  line-height: 1.6;
}

.update-time {
  font-size: 12px;
  color: #999;
  align-self: flex-end;
}

.current-week-info {
  margin-bottom: 20px;
}

.calendar-tabs {
  margin-top: 20px;
}

.full-calendar-container {
  overflow-x: auto;
}

.full-calendar {
  min-width: 700px;
}

.html-content {
  padding: 10px;
}

.html-content table {
  width: 100%;
  border-collapse: collapse;
}

.html-content table td {
  border: 1px solid #dcdfe6;
  padding: 8px;
  text-align: center;
}

.html-content table td[rowspan] {
  vertical-align: middle;
}

.html-content table td[colspan] {
  text-align: center;
}

/* 添加颜色样式支持 */
.html-content :deep(span[style*="color:red"]) {
  color: red !important;
}
</style>