<template>
  <div class="page-container">
    <h1 class="page-title">课表查询</h1>

    <!-- 登录提示 -->
    <div v-if="needLogin" class="login-tip">
      <el-empty description="请先登录教务系统">
        <el-button type="primary" @click="goToLogin">去登录</el-button>
      </el-empty>
    </div>

    <!-- 课表查询界面 -->
    <div v-else>
      <el-card class="query-section">
        <el-form :inline="true" :model="queryForm" class="query-form">
          <el-form-item label="学年学期">
            <el-select v-model="queryForm.year" placeholder="选择学年学期" style="width: 240px;">
              <el-option
                  v-for="(year, index) in yearOptions"
                  :key="index"
                  :label="year"
                  :value="index"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="查询类型">
            <el-select v-model="queryForm.type" placeholder="查询类型">
              <el-option label="个人课表" :value="0" />
              <!-- 暂时禁用班级课表查询 -->
              <!-- <el-option label="班级课表" :value="1" /> -->
            </el-select>
          </el-form-item>

          <el-form-item>
            <el-button type="primary" @click="queryLesson" :loading="loading">查询</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <div v-if="termText" class="term-info">
        <el-alert type="info" :closable="false">
          {{ termText }}
          <div v-if="termTimeText">{{ termTimeText }}</div>
        </el-alert>
      </div>

      <!-- 课表显示 -->
      <el-card v-if="hasLessonTable" class="lesson-table-card">
        <div class="lesson-table-header">
          <el-select v-model="currentWeek" placeholder="选择周次">
            <el-option
                v-for="week in totalWeeks"
                :key="week"
                :label="`第${week}周`"
                :value="week"
            />
          </el-select>

          <el-button type="primary" plain @click="saveLesson" v-if="needSave">保存课表</el-button>
        </div>

        <div class="lesson-table-container">
          <div class="lesson-table">
            <!-- 表头 -->
            <div class="table-header">
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

            <!-- 表格内容 -->
            <div class="table-body">
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
          </div>
        </div>
      </el-card>

      <el-empty v-else-if="hasQueried" description="暂无课表数据" />
    </div>

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
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import ipc from '@/utils/ipc'
import store from '@/utils/store'
import EASAccount from '@/models/EASAccount'

const router = useRouter()
const needLogin = ref(false)
const loading = ref(false)
const hasQueried = ref(false)
const needSave = ref(false)

// 课表查询表单
const queryForm = ref({
  year: 0,   // 默认当前学年
  type: 0    // 默认个人课表
})

// 课表信息
const termText = ref('')
const termTimeText = ref('')
const hasLessonTable = ref(false)
const totalWeeks = ref(20)
const currentWeek = ref(1)
const currentDay = ref(new Date().getDay() || 7) // 1-7 表示周一到周日
const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const hideTeacher = ref(true)

// 课程详情
const dialogVisible = ref(false)
const selectedLesson = ref(null)

// 课表数据
const lessonTable = ref({
  startDay: new Date(),
  totalWeek: 20,
  lessons: Array(7).fill().map(() => Array(10).fill(null))
})

// 教务账号实例
const easAccount = EASAccount.getInstance()

// 学年选项 - 直接硬编码完整的学年列表
const yearOptions = computed(() => [
  '2022-2023学年 第一学期',
  '2022-2023学年 第二学期',
  '2023-2024学年 第一学期',
  '2023-2024学年 第二学期',
  '2024-2025学年 第一学期',
  '2024-2025学年 第二学期',
  '2025-2026学年 第一学期',
  '2025-2026学年 第二学期'
])

// 计算当前学年学期的索引（基于硬编码的学年列表）
const calculateCurrentYearIndex = () => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // 默认值为当前或最近的学期
  let selectedIndex = 5 // 默认为2024-2025学年第二学期

  if (currentYear === 2022) {
    selectedIndex = currentMonth >= 8 ? 0 : 0 // 第一学期
  } else if (currentYear === 2023) {
    selectedIndex = currentMonth >= 8 ? 2 : 1 // 根据月份决定学期
  } else if (currentYear === 2024) {
    selectedIndex = currentMonth >= 8 ? 4 : 3 // 根据月份决定学期
  } else if (currentYear === 2025) {
    selectedIndex = currentMonth >= 8 ? 6 : 5 // 根据月份决定学期
  } else if (currentYear === 2026) {
    selectedIndex = currentMonth >= 8 ? 7 : 7 // 尚未到达，使用最后一个
  } else if (currentYear > 2026) {
    selectedIndex = 7 // 超出范围，使用最后一个
  } else if (currentYear < 2022) {
    selectedIndex = 0 // 早于范围，使用第一个
  }

  console.log(`当前日期: ${currentYear}年${currentMonth}月，选择学期索引: ${selectedIndex}`)
  return selectedIndex
}

// 获取当前周次
const getCurrentWeek = () => {
  const now = new Date()
  const startDay = lessonTable.value.startDay

  if (!(startDay instanceof Date)) {
    return 1
  }

  // 计算当前周次
  const timeDiff = now.getTime() - startDay.getTime()
  const dayDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
  const weekDiff = Math.floor(dayDiff / 7) + 1

  return Math.max(1, Math.min(weekDiff, totalWeeks.value))
}

// 检查指定位置是否有课
const hasLesson = (day, timeSlot) => {
  const dayIndex = day - 1;
  const timeIndex = timeSlot - 1;

  if (!lessonTable.value.lessons[dayIndex] || !lessonTable.value.lessons[dayIndex][timeIndex]) {
    return false;
  }

  const group = lessonTable.value.lessons[dayIndex][timeIndex];
  if (!group || !group.lessons || group.lessons.length === 0) {
    return false;
  }

  // 使用字符串形式的周次进行检查
  return group.lessons.some(lesson => {
    // 将存储的字符串转回 BigInt 进行比较，或直接比较字符串中的位
    const weekBits = typeof lesson.week === 'string' ? lesson.week : lesson.week.toString();
    const weekNum = BigInt(weekBits);
    return (weekNum & (1n << BigInt(currentWeek.value - 1))) !== 0n;
  });
}

// 获取指定位置的课程
const getLessonAt = (day, timeSlot) => {
  const dayIndex = day - 1
  const timeIndex = timeSlot - 1

  if (!lessonTable.value.lessons[dayIndex] || !lessonTable.value.lessons[dayIndex][timeIndex]) {
    return null
  }

  const group = lessonTable.value.lessons[dayIndex][timeIndex]
  if (!group || !group.lessons || group.lessons.length === 0) {
    return null
  }

  // 返回当前周的课程
  return group.lessons.find(lesson => (lesson.week & (1n << BigInt(currentWeek.value - 1))) !== 0n)
}

// 计算课程块的高度
const getLessonHeight = (day, timeSlot) => {
  const lesson = getLessonAt(day, timeSlot)
  return lesson ? lesson.len * 60 : 60
}

// 获取时间范围
const getTimeRange = (timeSlot, endTime = false) => {
  // 修复：确保timeSlot是数字类型
  const slot = parseInt(timeSlot)
  if (isNaN(slot)) {
    return '未知时间'
  }

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

  // 确保索引在有效范围内
  if (slot < 1 || slot > timeRanges.length) {
    return '未知时间'
  }

  return endTime ? timeRanges[slot - 1][1] : timeRanges[slot - 1][0]
}

// 课程颜色
const getLessonColor = (index) => {
  const colors = [
    'rgba(64, 158, 255, 0.7)', // 蓝色
    'rgba(103, 194, 58, 0.7)',  // 绿色
    'rgba(230, 162, 60, 0.7)',  // 黄色
    'rgba(245, 108, 108, 0.7)', // 红色
    'rgba(144, 147, 153, 0.7)', // 灰色
    'rgba(155, 85, 255, 0.7)',  // 紫色
    'rgba(54, 206, 187, 0.7)'   // 青色
  ]
  return colors[(index || 0) % colors.length]
}

// 格式化周次
const formatWeeks = (weekBitmap) => {
  if (!weekBitmap) return '未知'

  try {
    // 将BigInt转换为二进制字符串，然后处理
    const binaryString = weekBitmap.toString(2).padStart(20, '0').split('').reverse().join('')
    const weeks = []
    let start = null

    for (let i = 0; i < binaryString.length; i++) {
      if (binaryString[i] === '1') {
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
      if (start === binaryString.length) {
        weeks.push(`${start}`)
      } else {
        weeks.push(`${start}-${binaryString.length}`)
      }
    }

    return weeks.join(', ')
  } catch (error) {
    console.error('格式化周次失败:', error)
    return '未知'
  }
}

// 显示课程详情
const showLessonDetail = (lesson) => {
  if (!lesson) return
  selectedLesson.value = lesson
  dialogVisible.value = true
}

// 跳转到登录页面
const goToLogin = () => {
  router.push('/login/eas')
}

// 查询课表
const queryLesson = async () => {
  try {
    loading.value = true
    hasQueried.value = true

    // 获取查询参数 - 直接从选择项中提取学年和学期
    const yearVal = parseInt(queryForm.value.year)

    // 分解学年字符串获取学年开始年份
    const yearText = yearOptions.value[yearVal]
    const yearMatch = yearText.match(/(\d{4})-\d{4}/)
    if (!yearMatch) {
      ElMessage.error('无法解析学年信息')
      return
    }

    // 提取学年和学期
    const xnm = yearMatch[1] // 直接使用学年开始年份
    const xqm = yearVal % 2 === 0 ? '3' : '12' // 偶数索引是第一学期(3)，奇数索引是第二学期(12)

    console.log('查询参数:', {
      yearVal,
      yearText,
      xnm,
      xqm,
      type: queryForm.value.type
    })

    // 检查登录状态
    try {
      await easAccount.checkLogin()
    } catch (error) {
      console.error('登录状态检查失败:', error)
      needLogin.value = true
      return
    }

    // 只支持个人课表查询
    const response = await queryPersonalLessonTable(xnm, xqm)

    if (!response.success) {
      ElMessage.error(response.error || '查询课表失败')
      return
    }

    // 解析课表数据
    const result = response.data
    if (result.error) {
      ElMessage.error(result.error)
      return
    }

    // 更新课表数据
    lessonTable.value = result.lessonTable
    termText.value = result.termText
    termTimeText.value = `开学时间: ${formatDate(result.lessonTable.startDay)}`
    totalWeeks.value = result.lessonTable.totalWeek
    currentWeek.value = getCurrentWeek()
    hasLessonTable.value = true
    needSave.value = true

    ElMessage.success('查询课表成功')
  } catch (error) {
    console.error('查询课表错误:', error)
    ElMessage.error('查询课表失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

// 查询个人课表
const queryPersonalLessonTable = async (xnm, xqm) => {
  try {
    // 构建请求体
    const formData = {
      xnm: xnm,
      xqm: xqm,
      kzlx: 'ck'
    }

    // 获取Cookie
    const cookies = await easAccount.cookieJar.getCookies()

    // 发送请求
    const response = await ipc.easPost(
        easAccount.getFullUrl('jwglxt/kbcx/xskbcx_cxXsgrkb.html'),
        formData,
        {
          cookies: cookies,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': easAccount.getFullUrl(''),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        }
    )

    if (!response.success) {
      throw new Error(response.error || '查询课表失败')
    }

    // 获取学年信息
    const schoolYearInfo = await getSchoolYearData()

    // 调试：输出接收到的原始响应数据
    try {
      console.log('接收到的课表API响应前200字符:', response.data.substring(0, 200));

      // 尝试解析，判断是否为有效的JSON
      const testParse = JSON.parse(response.data);
      console.log('课表API返回项目数量:', (testParse.kbList || []).length);
    } catch (e) {
      console.error('课表响应解析测试失败:', e);
    }

    // 解析课表数据
    const result = parsePersonalLessonTable(response.data, schoolYearInfo)
    return { success: true, data: result }
  } catch (error) {
    console.error('查询个人课表失败:', error)
    return { success: false, error: error.message || '查询个人课表失败' }
  }
}

// 获取学年信息
const getSchoolYearData = async () => {
  try {
    // 获取Cookie
    const cookies = await easAccount.cookieJar.getCookies()

    // 获取学年信息
    const response = await ipc.easGet(
        easAccount.getFullUrl('jwglxt/xtgl/index_cxAreaFive.html?localeKey=zh_CN&gnmkdm=index'),
        {
          cookies: cookies,
          headers: {
            'Referer': easAccount.getFullUrl(''),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        }
    )

    if (!response.success) {
      throw new Error(response.error || '获取学年信息失败')
    }

    // 解析学年信息
    const html = response.data

    // 提取学年学期信息
    const timeMatch = html.match(/([0-9]{4}-[0-9]{4})学年([0-9])学期\((\\d{4}-\\d{2}-\\d{2})至(\\d{4}-\\d{2}-\\d{2})\)/)

    let termText = ''
    let startDay = new Date()
    let totalWeek = 20

    if (timeMatch) {
      termText = timeMatch[0]

      try {
        // 从HTML中提取开学日期
        const doc = new DOMParser().parseFromString(html, 'text/html')
        const rows = doc.querySelectorAll('tbody tr')

        if (rows.length > 0) {
          const firstRow = rows[0]
          const cells = firstRow.querySelectorAll('td')

          for (let i = 0; i < cells.length; i++) {
            const cell = cells[i]
            if (cell.textContent.trim() === '1') {
              // 找到第1周的单元格
              const dateId = cell.getAttribute('id')
              if (dateId) {
                const dateParts = dateId.split('-')
                if (dateParts.length === 3) {
                  startDay = new Date(
                      parseInt(dateParts[0]),
                      parseInt(dateParts[1]) - 1,
                      parseInt(dateParts[2])
                  )
                }
              }
              break
            }
          }
        }
      } catch (error) {
        console.error('解析开学日期失败:', error)
      }
    }

    return {
      termText,
      startDay,
      totalWeek
    }
  } catch (error) {
    console.error('获取学年信息失败:', error)
    return {
      termText: '',
      startDay: new Date(),
      totalWeek: 20
    }
  }
}

// 解析个人课表数据
const parsePersonalLessonTable = (data, schoolYearInfo) => {
  try {
    const result = {
      error: null,
      termText: schoolYearInfo.termText,
      lessonTable: {
        startDay: schoolYearInfo.startDay,
        totalWeek: schoolYearInfo.totalWeek,
        lessons: Array(7).fill().map(() => Array(10).fill(null))
      }
    }

    // 解析JSON数据
    let jsonData
    try {
      jsonData = JSON.parse(data)
      // 调试输出
      console.log('课表数据解析成功，课程数量:', (jsonData.kbList || []).length);
    } catch (error) {
      console.error('解析课表JSON失败:', error);
      console.log('数据前50字符:', data.substring(0, 50));
      result.error = '解析课表数据失败'
      return result
    }

    // 检查是否有课表数据
    if (!jsonData.kbList || jsonData.kbList.length === 0) {
      if (jsonData.xsxx && jsonData.xnxqsfkz && jsonData.xnxqsfkz === true) {
        result.error = '该学年学期课表当前时间段不允许查看'
      } else if (!jsonData.xsxx) {
        result.error = '该学年学期无您的注册信息'
      } else {
        const kblen = (jsonData.kbList || []).length
        const sjklen = (jsonData.sjkList || []).length
        const jxhjkclen = (jsonData.jxhjkcList || []).length
        const xkkg = jsonData.xkkg || false

        if (kblen === 0 && sjklen === 0 && jxhjkclen === 0 && xkkg) {
          result.error = '该学年学期尚无您的课表'
        } else if (!xkkg) {
          result.error = '该学年学期的课表尚未开放'
        } else {
          result.error = '未找到课表数据'
        }
      }

      if (!result.error) {
        result.error = '获取课表失败'
      }

      return result
    }

    // 处理课程数据
    const colors = new Map()
    let colorIndex = 1

    // 遍历课表列表，输出每个课程的详细信息用于调试
    jsonData.kbList.forEach((course, index) => {
      console.log(`课程${index+1}:`, {
        name: course.kcmc,
        day: course.xqj,
        time: course.jcs,
        place: course.cdmc,
        weeks: course.zcd
      });
    });

    for (const course of jsonData.kbList) {
      try {
        // 解析课程上课时间
        const dayOfWeek = parseInt(course.xqj)
        const timeRanges = course.jcs.split('-')
        const startTime = parseInt(timeRanges[0])
        const endTime = parseInt(timeRanges[1] || timeRanges[0])
        const length = endTime - startTime + 1

        // 处理上课周次
        const weeks = parseCourseWeeks(course.zcd)

        // 输出周次解析结果用于调试
        console.log(`课程: ${course.kcmc}, 周次: ${course.zcd}, 解析结果:`, weeks.toString(2));

        // 设置课程颜色
        const name = course.kcmc.trim()
        if (!colors.has(name)) {
          colors.set(name, colorIndex)
          colorIndex = (colorIndex % 7) + 1
        }

        // 创建课程对象
        const lesson = {
          type: 0, // 自动添加
          kchID: course.kch_id || course.kch || '',
          color: colors.get(name),
          len: length,
          week: BigInt(weeks),
          name: name,
          place: (course.cdmc || '').trim(),
          teacher: (course.xm || '').trim()
        }

        // 添加到课表
        const dayIndex = dayOfWeek - 1
        const timeIndex = startTime - 1

        // 确保行列索引有效
        if (dayIndex >= 0 && dayIndex < 7 && timeIndex >= 0 && timeIndex < 10) {
          // 创建或获取课程组
          if (!result.lessonTable.lessons[dayIndex][timeIndex]) {
            result.lessonTable.lessons[dayIndex][timeIndex] = {
              week: dayOfWeek,
              count: startTime,
              lessons: []
            }
          }

          // 添加课程
          result.lessonTable.lessons[dayIndex][timeIndex].lessons.push(lesson)
        } else {
          console.warn(`课程索引超出范围: 星期=${dayOfWeek}, 节次=${startTime}`);
        }
      } catch (error) {
        console.error('解析课程数据失败:', error, course)
      }
    }

    return result
  } catch (error) {
    console.error('解析课表失败:', error)
    return {
      error: '解析课表失败',
      termText: '',
      lessonTable: {
        startDay: new Date(),
        totalWeek: 20,
        lessons: Array(7).fill().map(() => Array(10).fill(null))
      }
    }
  }
}

// 解析课程上课周次 - 改进版，增加详细的调试输出
const parseCourseWeeks = (zcd) => {
  if (!zcd) return "0"

  try {
    console.log(`开始解析周次: ${zcd}`);
    let weeks = 0n

    // 移除末尾的"周"字
    let weekStr = zcd.endsWith('周') ? zcd.substring(0, zcd.length - 1) : zcd
    console.log(`处理后的周次字符串: ${weekStr}`);

    // 按逗号分割不同的周次区间
    const segments = weekStr.split(',')
    console.log(`分割后的周次段: ${segments.join(' | ')}`);

    for (const segment of segments) {
      let _segment = segment.trim()
      let type = -1 // 默认所有周

      // 处理单双周
      if (_segment.endsWith(')')) {
        if (_segment.includes('(单)')) {
          type = 0 // 单周
          console.log(`检测到单周: ${_segment}`);
        } else if (_segment.includes('(双)')) {
          type = 1 // 双周
          console.log(`检测到双周: ${_segment}`);
        }
        // 移除括号内容
        _segment = _segment.substring(0, _segment.indexOf('('))
        console.log(`移除括号后: ${_segment}`);
      }

      // 处理区间
      if (_segment.includes('-')) {
        const range = _segment.split('-')
        if (range.length === 2) {
          const start = parseInt(range[0])
          const end = parseInt(range[1])

          console.log(`周次区间: ${start}-${end}, 类型: ${type === -1 ? '全部' : type === 0 ? '单周' : '双周'}`);

          if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0) {
            if (type === -1) {
              // 所有周
              for (let i = start; i <= end; i++) {
                weeks |= 1n << BigInt(i - 1)
              }
            } else {
              // 单周或双周
              for (let i = start; i <= end; i++) {
                if ((i % 2 === 1 && type === 0) || (i % 2 === 0 && type === 1)) {
                  weeks |= 1n << BigInt(i - 1)
                }
              }
            }
          }
        }
      } else {
        // 单个周次
        const week = parseInt(_segment)
        if (!isNaN(week) && week > 0) {
          console.log(`单周次: ${week}`);
          weeks |= 1n << BigInt(week - 1)
        }
      }
    }

    // 返回字符串而不是 BigInt
    console.log(`周次解析结果 (二进制): ${weeks.toString(2)}`);
    return weeks.toString() // 改为返回字符串
  } catch (error) {
    console.error('解析课程周次失败:', error, zcd)
    return "0"
  }
}

// 格式化日期
const formatDate = (date) => {
  if (!date) return ''

  try {
    const d = new Date(date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch (error) {
    return ''
  }
}

// 保存课表
const saveLesson = async () => {
  try {
    // 创建可序列化的课表副本
    const serializableTable = JSON.parse(JSON.stringify({
      ...lessonTable.value,
      lessons: lessonTable.value.lessons.map(dayLessons =>
          dayLessons.map(group => {
            if (!group) return null;
            return {
              ...group,
              lessons: group.lessons.map(lesson => ({
                ...lesson,
                // 确保 week 是字符串
                week: typeof lesson.week === 'bigint' ? lesson.week.toString() : lesson.week
              }))
            };
          })
      )
    }));

    // 保存转换后的课表
    await store.putObject('lesson_table', serializableTable);

    // 其余保存逻辑不变
    await store.putObject('lesson_table_info', {
      startDay: lessonTable.value.startDay,
      totalWeek: lessonTable.value.totalWeek
    });

    needSave.value = false;
    ElMessage.success('保存课表成功');
  } catch (error) {
    console.error('保存课表失败:', error);
    ElMessage.error('保存课表失败: ' + (error.message || '未知错误'));
  }
}

// 加载设置和课表数据
onMounted(async () => {
  try {
    // 设置默认选中当前学期
    queryForm.value.year = calculateCurrentYearIndex()

    // 获取教务系统设置
    hideTeacher.value = await store.getBoolean('HIDE_TEACHER', true)

    // 检查登录状态
    try {
      await easAccount.checkLogin()
    } catch (error) {
      console.log('未登录教务系统:', error)
      needLogin.value = true
      return
    }

    // 加载本地保存的课表
    const savedTable = await store.getObject('lesson_table', null)
    const savedInfo = await store.getObject('lesson_table_info', null)

    if (savedTable && savedInfo) {
      lessonTable.value = savedTable
      totalWeeks.value = savedInfo.totalWeek || 20
      currentWeek.value = getCurrentWeek()
      hasLessonTable.value = true
    }

    // 自动查询当前学期课表（如果需要）
    if (!hasLessonTable.value) {
      // queryLesson() // 可选：自动查询
    }
  } catch (error) {
    console.error('加载数据失败:', error)
  }
})
</script>

<style scoped>
.login-tip {
  padding: 40px 0;
}

.query-section {
  margin-bottom: 20px;
}

.query-form {
  display: flex;
  flex-wrap: wrap;
}

.term-info {
  margin-bottom: 20px;
}

.lesson-table-card {
  margin-top: 20px;
}

.lesson-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.lesson-table-container {
  overflow-x: auto;
}

.lesson-table {
  min-width: 800px;
}

.table-header {
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

.table-body {
  display: flex;
  flex-direction: column;
}

.time-row {
  display: flex;
  border-bottom: 1px solid #ebeef5;
  min-height: 60px;
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