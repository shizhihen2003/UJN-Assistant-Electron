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

      <!-- 周次选择 -->
      <div class="week-selector">
        <el-radio-group v-model="weekViewMode" size="large" @change="changeWeekView">
          <el-radio-button value="current">当前周</el-radio-button>
          <el-radio-button value="select">选择周次</el-radio-button>
          <el-radio-button value="all">完整校历</el-radio-button>
        </el-radio-group>

        <el-select
            v-if="weekViewMode === 'select'"
            v-model="selectedWeek"
            placeholder="选择周次"
            style="margin-left: 10px;"
        >
          <el-option
              v-for="week in weekOptions"
              :key="week.id"
              :label="week.name"
              :value="week.number"
          />
        </el-select>
      </div>

      <!-- 校历显示 -->
      <el-tabs v-model="activeTabName" class="calendar-tabs">
        <!-- 表格视图 -->
        <el-tab-pane label="表格视图" name="table">
          <template v-if="weekViewMode === 'all'">
            <div class="full-calendar-container">
              <el-card v-if="calendarData.htmlContent" class="full-calendar">
                <div class="html-content" v-html="processHtmlContent(calendarData.htmlContent)"></div>
              </el-card>
              <el-empty v-else description="无法获取完整校历内容" />
            </div>
          </template>
          <template v-else>
            <!-- 周视图 -->
            <el-table :data="getWeekTableData()" style="width: 100%" border>
              <el-table-column label="时间" prop="date" width="100" />
              <el-table-column label="周一" prop="monday" />
              <el-table-column label="周二" prop="tuesday" />
              <el-table-column label="周三" prop="wednesday" />
              <el-table-column label="周四" prop="thursday" />
              <el-table-column label="周五" prop="friday" />
              <el-table-column label="周六" prop="saturday" />
              <el-table-column label="周日" prop="sunday" />
            </el-table>
          </template>
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
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import calendarService from '@/services/calendarService';
import store from '@/utils/store';


// 状态变量
const loading = ref(true);
const error = ref(null);
const calendarData = ref({});
const updateTime = ref(null);
const currentWeek = ref(1);
const activeTabName = ref('table');
const weekViewMode = ref('current');
const selectedWeek = ref(1);

// 当前日期和周几
const today = new Date();
const currentDay = ref(today.getDay() || 7); // 1-7 表示周一到周日

// 周次选项
const weekOptions = computed(() => {
  const options = [];
  for (let i = 1; i <= 19; i++) {
    options.push({
      id: i,
      name: `第${i}周`,
      number: i
    });
  }
  return options;
});

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

// 改变周视图
const changeWeekView = () => {
  if (weekViewMode.value === 'current') {
    selectedWeek.value = currentWeek.value;
  } else if (weekViewMode.value === 'all') {
    // 不需要特殊处理，直接显示完整校历
  }
};

// 获取周视图表格数据
const getWeekTableData = () => {
  const weekNum = weekViewMode.value === 'select' ? selectedWeek.value : currentWeek.value;
  const content = calendarData.value.htmlContent || '';

  // 创建基本表格结构 - 只保留一个表头
  let result = [];

  try {
    // 使用更精确的方法来查找对应周次的数据
    const weekData = extractWeekData(weekNum, content);

    if (weekData) {
      // 日期行
      result.push({
        date: `${weekData.month}月`,
        monday: weekData.dates[0] || '',
        tuesday: weekData.dates[1] || '',
        wednesday: weekData.dates[2] || '',
        thursday: weekData.dates[3] || '',
        friday: weekData.dates[4] || '',
        saturday: weekData.dates[5] || '',
        sunday: weekData.dates[6] || ''
      });

      // 事件行
      if (weekData.events.some(e => e !== '')) {
        result.push({
          date: '事件',
          monday: weekData.events[0] || '',
          tuesday: weekData.events[1] || '',
          wednesday: weekData.events[2] || '',
          thursday: weekData.events[3] || '',
          friday: weekData.events[4] || '',
          saturday: weekData.events[5] || '',
          sunday: weekData.events[6] || ''
        });
      }
    } else {
      // 如果没有找到具体周数据，显示周次信息
      result.push({
        date: `第${weekNum}周`,
        monday: '',
        tuesday: '',
        wednesday: '',
        thursday: '',
        friday: '',
        saturday: '',
        sunday: ''
      });
    }
  } catch (error) {
    console.error('解析周次数据失败:', error);
    result.push({
      date: `第${weekNum}周`,
      monday: '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
      saturday: '',
      sunday: ''
    });
  }

  return result;
};

// 从HTML内容中提取特定周的数据
const extractWeekData = (weekNum, content) => {
  try {
    // 处理周次的中文数字
    const weekChinese = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
      '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'][weekNum - 1];

    // 查找包含当前周次的行 - 修正正则表达式，添加全局标志
    const weekRowPattern = new RegExp(`<b><span[^>]*>${weekChinese}</span></b>`, 'gi');
    const rowMatches = content.match(weekRowPattern);

    if (!rowMatches) {
      console.log(`未找到第${weekNum}周的数据`);
      return null;
    }

    // 获取该周所在的表格行
    const rowIndex = content.indexOf(rowMatches[0]);

    // 截取该行所在的table row
    const rowStartIndex = content.lastIndexOf('<tr', rowIndex);
    const rowEndIndex = content.indexOf('</tr>', rowIndex) + 5;
    const rowContent = content.substring(rowStartIndex, rowEndIndex);

    // 提取该行的所有单元格
    const cellPattern = /<td[^>]*>[\s\S]*?<\/td>/g;
    const cells = rowContent.match(cellPattern) || [];

    // 提取日期
    const dates = [];
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const dateMatch = cell.match(/<span[^>]*>(\d+)<\/span>/);
      if (dateMatch && dateMatch[1]) {
        const date = parseInt(dateMatch[1]);
        if (date > 0 && date <= 31) {
          dates.push(date.toString());
        } else {
          dates.push('');
        }
      } else {
        dates.push('');
      }
    }

    // 改进月份提取方法 - 先在当前行寻找月份
    let month = '';

    // 方法1: 检查第一个单元格是否包含月份
    const firstCellMonth = cells[0] && cells[0].match(/<span[^>]*>(\d+)<\/span>[^<]*<span[^>]*>月<\/span>/);
    if (firstCellMonth && firstCellMonth[1]) {
      month = firstCellMonth[1];
      console.log(`在当前行第一个单元格找到月份: ${month}月`);
    } else {
      // 方法2: 向前搜索包含月份的行
      let prevRowContent = content.substring(0, rowStartIndex);
      const prevRowStart = prevRowContent.lastIndexOf('<tr');
      if (prevRowStart >= 0) {
        const prevRow = prevRowContent.substring(prevRowStart);
        const monthMatch = prevRow.match(/<span[^>]*>(\d+)<\/span>[^<]*<span[^>]*>月<\/span>/);
        if (monthMatch && monthMatch[1]) {
          month = monthMatch[1];
          console.log(`在前一行找到月份: ${month}月`);
        }
      }

      // 方法3: 最后尝试搜索整个文档
      if (!month) {
        const monthSearchContent = content.substring(0, rowIndex);
        const monthPattern = /<span[^>]*>(\d+)<\/span>[^<]*<span[^>]*>月<\/span>/g;
        const allMonthMatches = [...monthSearchContent.matchAll(monthPattern)];
        if (allMonthMatches.length > 0) {
          const lastMonthMatch = allMonthMatches[allMonthMatches.length - 1];
          month = lastMonthMatch[1];
          console.log(`在整个文档中找到最接近的月份: ${month}月`);
        }
      }
    }

    // 提取事件（节假日等）
    const events = [];
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const eventMatch = cell.match(/<span[^>]*?color:red[^>]*>([^<]+)<\/span>/);
      if (eventMatch && eventMatch[1] &&
          !['校训', '校风', '弘毅', '博学', '求真', '至善', '勤奋', '严谨', '团结', '创新'].includes(eventMatch[1].trim())) {
        events.push(eventMatch[1].trim());
      } else {
        events.push('');
      }
    }

    // 确保数组长度为7
    while (dates.length < 7) dates.push('');
    while (events.length < 7) events.push('');

    return {
      month: month,
      dates: dates.slice(0, 7),
      events: events.slice(0, 7)
    };
  } catch (error) {
    console.error('提取周数据失败:', error);
    return null;
  }
};

// 处理HTML内容
const processHtmlContent = (html) => {
  if (!html) return '';

  // 保留颜色样式，移除其他无用样式
  return html
      .replace(/style="[^"]*"/g, function(match) {
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
    selectedWeek.value = currentWeek.value;

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
    selectedWeek.value = currentWeek.value;
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

.week-selector {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
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