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
          <el-radio-button label="current">当前周</el-radio-button>
          <el-radio-button label="select">选择周次</el-radio-button>
          <el-radio-button label="all">完整校历</el-radio-button>
        </el-radio-group>

        <el-select
            v-if="weekViewMode === 'select'"
            v-model="selectedWeek"
            placeholder="选择周次"
            style="margin-left: 10px;"
        >
          <el-option
              v-for="week in calendarData.weeks"
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
const calculateCurrentWeek = (data) => {
  // 从注释部分获取开学日期
  if (data.htmlContent) {
    const notesMatch = data.htmlContent.match(/注：[^。]*(\d+)月(\d+)日[^。]*上课/);
    if (notesMatch && notesMatch.length >= 3) {
      try {
        const startMonth = parseInt(notesMatch[1]);
        const startDay = parseInt(notesMatch[2]);

        // 获取当前年份
        const currentYear = new Date().getFullYear();

        // 创建开学日期对象
        const startDate = new Date(currentYear, startMonth - 1, startDay);

        // 如果开学日期在未来，可能是去年的日期
        if (startDate > new Date() && startMonth > 6) {
          startDate.setFullYear(currentYear - 1);
        }

        // 计算周数
        const timeDiff = new Date() - startDate;
        const dayDiff = Math.floor(timeDiff / (24 * 60 * 60 * 1000));
        const weekDiff = Math.floor(dayDiff / 7) + 1;

        return Math.max(1, weekDiff);
      } catch (e) {
        console.error('解析开学日期失败:', e);
      }
    }
  }

  // 如果无法从注释中获取，使用默认逻辑
  if (data.weeks && data.weeks.length > 0) {
    // 确保周数不超过总周数
    const maxWeek = Math.max(...data.weeks.map(w => w.number));
    return Math.min(maxWeek, 10); // 假设现在大约是第10周
  }

  // 如果无法计算，默认返回第1周
  return 1;
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
  // 从实际数据中根据所选周次生成表格数据
  const weekNum = weekViewMode.value === 'select' ? selectedWeek.value : currentWeek.value;

  // 从校历中找出对应的周次（中文"一"、"二"、"三"等）
  const weekChinese = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'][weekNum - 1];

  // 查找对应的数据行
  const content = calendarData.value.htmlContent || '';

  // 创建基本表格结构
  let result = [{
    date: '日期',
    monday: '周一',
    tuesday: '周二',
    wednesday: '周三',
    thursday: '周四',
    friday: '周五',
    saturday: '周六',
    sunday: '周日'
  }];

  try {
    // 尝试从HTML内容中提取周次对应的日期
    // 查找包含当前周次的行
    const weekRowPattern = new RegExp(`<b><span[^>]*>${weekChinese}</span></b>`, 'i');
    const weekRowMatch = content.match(weekRowPattern);

    if (weekRowMatch) {
      // 找到周次所在位置
      const rowStartPos = weekRowMatch.index;
      // 寻找一行包含7个日期的内容（一周的数据）
      const rowContent = content.substring(Math.max(0, rowStartPos - 500), rowStartPos + 2000);

      // 查找这行中的日期数字
      const datePattern = /<span[^>]*>(\d+)<\/span>/g;
      const dates = [];
      let match;

      while ((match = datePattern.exec(rowContent)) !== null && dates.length < 7) {
        dates.push(match[1]);
      }

      // 从HTML中提取当前月份
      const monthPattern = /<b><span[^>]*>(\d+)<\/span><\/b><b><span[^>]*>月<\/span><\/b>/i;
      const monthMatch = rowContent.match(monthPattern) || content.match(monthPattern);
      const month = monthMatch ? monthMatch[1] : '';

      // 创建带有日期的表格行
      if (dates.length > 0 && month) {
        result.push({
          date: `${month}月`,
          monday: dates[0] || '',
          tuesday: dates[1] || '',
          wednesday: dates[2] || '',
          thursday: dates[3] || '',
          friday: dates[4] || '',
          saturday: dates[5] || '',
          sunday: dates[6] || ''
        });
      }

      // 添加事件行 - 从注释中提取该周的重要事件
      const events = extractEventsForWeek(weekNum);
      if (events.length > 0) {
        result.push({
          date: '事件',
          monday: events[0] || '',
          tuesday: events[1] || '',
          wednesday: events[2] || '',
          thursday: events[3] || '',
          friday: events[4] || '',
          saturday: events[5] || '',
          sunday: events[6] || ''
        });
      }
    }
  } catch (error) {
    console.error('解析周次数据失败:', error);
  }

  // 如果没有成功提取数据，返回基本结构
  if (result.length === 1) {
    result.push({
      date: '第' + weekNum + '周',
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

// 从注释中提取特定周的事件
const extractEventsForWeek = (weekNum) => {
  // 注释通常会提到开学、放假、考试周等信息
  const events = ['', '', '', '', '', '', '']; // 周一到周日

  const content = calendarData.value.htmlContent || '';
  const notes = content.match(/注：([\s\S]*?)<\/p>/g) || [];

  // 解析注释内容
  notes.forEach(note => {
    // 提取特定周的信息
    if (note.includes(`第${weekNum}周`) || note.includes(`${weekNum}周`)) {
      // 如果注释特别提到了这周，提取信息
      const eventMatch = note.match(/第\d+周[^，。]*([^，。]+)/);
      if (eventMatch) {
        // 将事件添加到对应的日期
        events[0] = eventMatch[1];
      }
    }

    // 检查是否为考试周
    if (note.includes('考试周') && note.includes(`${weekNum}`)) {
      events[0] = '考试周';
    }

    // 检查特殊日期，如开学、放假等
    const datePatterns = [
      { pattern: /(\d+)月(\d+)日[^，。]*上课/,       event: '上课' },
      { pattern: /(\d+)月(\d+)日[^，。]*报到/,       event: '报到' },
      { pattern: /(\d+)月(\d+)日[^，。]*放假/,       event: '放假' },
      { pattern: /(\d+)月(\d+)日[^，。]*清明节/,     event: '清明节' },
      { pattern: /(\d+)月(\d+)日[^，。]*劳动节/,     event: '劳动节' },
      { pattern: /(\d+)月(\d+)日[^，。]*端午节/,     event: '端午节' }
    ];

    datePatterns.forEach(({ pattern, event }) => {
      const matches = [...note.matchAll(pattern)];

      for (const match of matches) {
        if (match && match.length >= 3) {
          const month = parseInt(match[1]);
          const day = parseInt(match[2]);

          // 简单检查该日期是否可能落在当前周
          const dateCell = getDateCellForWeek(weekNum, month, day);
          if (dateCell !== -1) {
            events[dateCell] = event;
          }
        }
      }
    });
  });

  return events;
};

// 简化的日期比较函数
const getDateCellForWeek = (weekNum, month, day) => {
  // 这是一个简化的实现，实际应用中应该基于日期范围计算
  const content = calendarData.value.htmlContent || '';

  // 找到相应周次对应的日期格
  const weekChinese = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'][weekNum - 1];

  // 查找包含当前周次的行
  const weekRowPattern = new RegExp(`<b><span[^>]*>${weekChinese}</span></b>`, 'i');
  const weekRowMatch = content.match(weekRowPattern);

  if (weekRowMatch) {
    // 找到周次所在位置
    const rowStartPos = weekRowMatch.index;

    // 在该行附近查找月份和日期
    const nearbyContent = content.substring(Math.max(0, rowStartPos - 500), rowStartPos + 500);

    // 查找月份
    const monthPattern = /<b><span[^>]*>(\d+)<\/span><\/b><b><span[^>]*>月<\/span><\/b>/i;
    const monthMatch = nearbyContent.match(monthPattern);
    const rowMonth = monthMatch ? parseInt(monthMatch[1]) : -1;

    // 如果月份匹配
    if (rowMonth === month) {
      // 查找所有日期单元格
      const datePattern = /<span[^>]*>(\d+)<\/span>/g;
      let match;
      let index = 0;
      let dates = [];

      while ((match = datePattern.exec(nearbyContent)) !== null && index < 7) {
        dates.push(parseInt(match[1]));
        index++;
      }

      // 查找日期匹配的单元格
      const dayIndex = dates.findIndex(d => d === day);
      if (dayIndex !== -1) {
        return dayIndex;
      }
    }
  }

  return -1; // 未找到对应的日期单元格
};

// 处理HTML内容
const processHtmlContent = (html) => {
  if (!html) return '';

  // 移除无用的样式属性，保留基本结构
  return html
      .replace(/style="[^"]*"/g, '')
      .replace(/class="[^"]*"/g, '')
      .replace(/lang="[^"]*"/g, '')
      .replace(/mso-[^=]*="[^"]*"/g, '')
      .replace(/<o:p><\/o:p>/g, '')
      .replace(/&nbsp;/g, ' ');
};

// 获取重要日期
const getImportantDates = () => {
  const dates = [];

  // 如果有导入日期数据，使用它
  if (calendarData.value.importantDates && calendarData.value.importantDates.length > 0) {
    return calendarData.value.importantDates.map(date => {
      if (date.type === 'exam') {
        return {
          name: date.name,
          type: date.type,
          timeString: `第${date.startWeek}-${date.endWeek}周`
        };
      } else {
        return {
          name: date.name,
          type: date.type,
          timeString: `${date.month}月${date.day}日`
        };
      }
    });
  }

  // 从HTML内容中提取重要日期
  const content = calendarData.value.htmlContent || '';
  if (!content) return dates;

  // 查找注释部分
  const notesMatch = content.match(/<p[^>]*>注：([\s\S]*?)<\/p>/);
  if (notesMatch && notesMatch[1]) {
    const notesText = notesMatch[1];

    // 提取开学日期
    const classRegex = /(\d+)月(\d+)日[^，。]*上课/g;
    let classMatch;
    while ((classMatch = classRegex.exec(notesText)) !== null) {
      if (classMatch.length >= 3) {
        dates.push({
          name: '上课',
          type: 'primary',
          timeString: `${classMatch[1]}月${classMatch[2]}日`
        });
      }
    }

    // 提取报到日期
    const reportRegex = /(\d+)月(\d+)日[^，。]*报到/g;
    let reportMatch;
    while ((reportMatch = reportRegex.exec(notesText)) !== null) {
      if (reportMatch.length >= 3) {
        dates.push({
          name: '报到',
          type: 'primary',
          timeString: `${reportMatch[1]}月${reportMatch[2]}日`
        });
      }
    }

    // 提取考试周信息
    const examRegex = /(\d+)[—-](\d+)周为(?:集中)?考试周/g;
    let examMatch;
    while ((examMatch = examRegex.exec(notesText)) !== null) {
      if (examMatch.length >= 3) {
        dates.push({
          name: '考试周',
          type: 'exam',
          timeString: `第${examMatch[1]}-${examMatch[2]}周`
        });
      }
    }
  }

  // 查找红色标记的节假日
  const holidayRegex = /<b><span[^>]*color:red[^>]*>(\d+)<\/span><\/b>[\s\S]*?<b><span[^>]*color:red[^>]*>([^<]+)<\/span><\/b>/g;
  let holidayMatch;

  while ((holidayMatch = holidayRegex.exec(content)) !== null) {
    if (holidayMatch.length >= 3) {
      // 从周围文本中提取月份
      const monthSearch = content.substring(Math.max(0, holidayMatch.index - 200), holidayMatch.index);
      const monthMatch = monthSearch.match(/<b><span[^>]*>(\d+)<\/span><\/b><b><span[^>]*>月<\/span><\/b>/);

      const month = monthMatch ? monthMatch[1] : '';
      const day = holidayMatch[1];
      const name = holidayMatch[2].trim();

      if (month && day && name) {
        dates.push({
          name,
          type: 'holiday',
          timeString: `${month}月${day}日`
        });
      }
    }
  }

  // 按时间顺序排序
  return dates.sort((a, b) => {
    // 提取月和日
    const aMonthMatch = a.timeString.match(/(\d+)月/);
    const aDayMatch = a.timeString.match(/月(\d+)日/);
    const bMonthMatch = b.timeString.match(/(\d+)月/);
    const bDayMatch = b.timeString.match(/月(\d+)日/);

    // 如果都有月份和日期信息，按日期排序
    if (aMonthMatch && aDayMatch && bMonthMatch && bDayMatch) {
      const aMonth = parseInt(aMonthMatch[1]);
      const aDay = parseInt(aDayMatch[1]);
      const bMonth = parseInt(bMonthMatch[1]);
      const bDay = parseInt(bDayMatch[1]);

      if (aMonth !== bMonth) {
        return aMonth - bMonth;
      }
      return aDay - bDay;
    }

    // 默认排序
    return 0;
  });
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
    currentWeek.value = calculateCurrentWeek(data);
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
    currentWeek.value = calculateCurrentWeek(data);
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
</style>