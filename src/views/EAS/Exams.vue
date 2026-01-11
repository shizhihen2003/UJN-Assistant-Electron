<template>
  <div class="page-container">
    <h1 class="page-title">考试查询</h1>

    <div class="controls">
      <el-select v-model="selectedTerm" placeholder="选择学期" @change="handleTermChange">
        <el-option
            v-for="(name, index) in termNames"
            :key="index"
            :label="name"
            :value="index"
        />
      </el-select>

      <el-button
          type="primary"
          @click="queryExams"
          :loading="loading"
          :disabled="loading"
          style="margin-left: 10px;">
        <el-icon><Search /></el-icon> 查询考试
      </el-button>
    </div>

    <el-card v-if="needLogin" class="exam-card login-tip">
      <el-empty description="请先登录教务系统">
        <el-button type="primary" @click="goToLogin">去登录</el-button>
      </el-empty>
    </el-card>

    <el-card v-else-if="loading" class="exam-card">
      <div class="loading-container">
        <el-skeleton :rows="5" animated />
      </div>
    </el-card>

    <template v-else>
      <el-empty v-if="exams.length === 0" description="暂无考试信息" />

      <el-card v-else class="exam-card">
        <el-table :data="exams" style="width: 100%" border stripe>
          <el-table-column label="课程名称" prop="name" min-width="180" />
          <el-table-column label="考试时间" prop="time" min-width="180" />
          <el-table-column label="考试地点" prop="place" min-width="120" />
          <el-table-column label="状态" width="100">
            <template #default="scope">
              <el-tag :type="getExamStatusType(scope.row)">
                {{ getExamStatus(scope.row) }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import EASAccount from '@/models/EASAccount'
import store from '@/utils/store'

const router = useRouter()
const loading = ref(false)
const needLogin = ref(false)
const exams = ref([])
const selectedTerm = ref(0)

// 学期名称
const termNames = [
  "大一 上学期", "大一 下学期",
  "大二 上学期", "大二 下学期",
  "大三 上学期", "大三 下学期",
  "大四 上学期", "大四 下学期"
]

// 获取当前学期
const getCurrentTerm = async () => {
  try {
    const easAccount = EASAccount.getInstance()
    return easAccount.getCurrentGrade()
  } catch (error) {
    console.error('获取当前学期失败:', error)
    return 0
  }
}

// 处理学期变更
const handleTermChange = (value) => {
  selectedTerm.value = value
  // 可以在这里加载缓存的考试信息
  loadCachedExams()
}

// 加载缓存的考试信息
const loadCachedExams = async () => {
  try {
    const cachedExams = await store.getObject(`exams_${selectedTerm.value}`, [])
    if (cachedExams && cachedExams.length > 0) {
      exams.value = cachedExams
      console.log('从缓存加载考试信息:', cachedExams)
    } else {
      exams.value = []
    }
  } catch (error) {
    console.error('加载缓存考试信息失败:', error)
    exams.value = []
  }
}

// 获取学年和学期参数
const getYearAndTerm = () => {
  const easAccount = EASAccount.getInstance()
  const entranceTime = easAccount.entranceTime
  const pick = selectedTerm.value

  return {
    xnm: (Math.floor(pick / 2) + entranceTime).toString(),
    xqm: (pick % 2 === 0) ? '3' : '12'
  }
}

// 查询考试
const queryExams = async () => {
  loading.value = true
  needLogin.value = false

  try {
    const easAccount = EASAccount.getInstance()

    // 检查登录状态
    const isLoggedIn = await easAccount.absCheckLogin()
    if (!isLoggedIn) {
      const loginSuccess = await easAccount.login()
      if (!loginSuccess) {
        needLogin.value = true
        ElMessage.warning('请先登录教务系统')
        return
      }
    }

    // 获取学年学期参数
    const { xnm, xqm } = getYearAndTerm()
    console.log(`查询考试: 学年=${xnm}, 学期=${xqm}`)

    // 查询考试信息
    const examResults = await easAccount.queryExam(xnm, xqm)

    // 处理结果
    if (examResults && examResults.length > 0) {
      exams.value = examResults

      // 缓存结果
      await store.putObject(`exams_${selectedTerm.value}`, examResults)

      ElMessage.success(`成功查询到 ${examResults.length} 条考试信息`)
    } else {
      exams.value = []
      ElMessage.info('暂无考试信息')
    }
  } catch (error) {
    console.error('查询考试失败:', error)

    if (error.message && error.message.includes('登录')) {
      needLogin.value = true
      ElMessage.warning('请先登录教务系统')
    } else {
      ElMessage.error('查询考试失败: ' + error.message)
    }
  } finally {
    loading.value = false
  }
}

// ========== 修复：解析考试时间 ==========
// 考试时间格式：2026-01-11(14:00-15:30)
// 需要正确解析日期和时间部分
const parseExamTime = (timeStr) => {
  if (!timeStr) return null

  try {
    // 匹配格式：2026-01-11(14:00-15:30) 或 2026-01-11(14:00~15:30)
    const match = timeStr.match(/(\d{4}-\d{2}-\d{2})\s*\((\d{2}:\d{2})\s*[-~]\s*(\d{2}:\d{2})\)/)

    if (match) {
      const dateStr = match[1]  // 2026-01-11
      const startTime = match[2]  // 14:00
      const endTime = match[3]  // 15:30

      // 解析日期
      const [year, month, day] = dateStr.split('-').map(Number)

      // 解析开始时间
      const [startHour, startMinute] = startTime.split(':').map(Number)

      // 解析结束时间
      const [endHour, endMinute] = endTime.split(':').map(Number)

      // 创建开始和结束的 Date 对象
      const startDate = new Date(year, month - 1, day, startHour, startMinute, 0)
      const endDate = new Date(year, month - 1, day, endHour, endMinute, 0)

      return {
        date: new Date(year, month - 1, day, 0, 0, 0),
        startTime: startDate,
        endTime: endDate
      }
    }

    // 如果不匹配带时间的格式，尝试只解析日期
    // 格式：2026-01-11
    const dateOnlyMatch = timeStr.match(/(\d{4}-\d{2}-\d{2})/)
    if (dateOnlyMatch) {
      const [year, month, day] = dateOnlyMatch[1].split('-').map(Number)
      const date = new Date(year, month - 1, day, 23, 59, 59)  // 设置为当天结束时间
      return {
        date: new Date(year, month - 1, day, 0, 0, 0),
        startTime: null,
        endTime: date
      }
    }

    return null
  } catch (e) {
    console.error('解析考试时间失败:', e, timeStr)
    return null
  }
}

// ========== 修复：获取考试状态 ==========
const getExamStatus = (exam) => {
  if (!exam.time) return '未安排'

  try {
    const parsedTime = parseExamTime(exam.time)

    if (!parsedTime) {
      console.warn('无法解析考试时间:', exam.time)
      return '未知'
    }

    const now = new Date()

    // 获取今天的日期（去掉时间部分）
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const examDate = new Date(parsedTime.date.getFullYear(), parsedTime.date.getMonth(), parsedTime.date.getDate())

    // 如果有开始时间和结束时间
    if (parsedTime.startTime && parsedTime.endTime) {
      // 考试已结束：当前时间 > 结束时间
      if (now > parsedTime.endTime) {
        return '已结束'
      }

      // 考试进行中：开始时间 <= 当前时间 <= 结束时间
      if (now >= parsedTime.startTime && now <= parsedTime.endTime) {
        return '进行中'
      }

      // 检查是否是今天的考试（比较日期部分）
      if (examDate.getTime() === today.getTime()) {
        return '今日考试'
      }

      // 计算距离考试还有多少天
      const diffTime = examDate - today
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

      // 7天内
      if (diffDays <= 7) {
        return '即将考试'
      }

      return '待考试'
    }

    // 如果只有日期没有具体时间
    if (parsedTime.date) {
      // 考试日期在今天之前
      if (examDate < today) {
        return '已结束'
      }

      // 考试日期是今天
      if (examDate.getTime() === today.getTime()) {
        return '今日考试'
      }

      // 计算剩余天数
      const diffTime = examDate - today
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays <= 7) {
        return '即将考试'
      }

      return '待考试'
    }

    return '未知'
  } catch (e) {
    console.error('获取考试状态失败:', e)
    return '未知'
  }
}

// 获取考试状态对应的标签类型
const getExamStatusType = (exam) => {
  const status = getExamStatus(exam)

  switch (status) {
    case '已结束':
      return 'info'
    case '进行中':
      return 'success'
    case '今日考试':
      return 'danger'
    case '即将考试':
      return 'warning'
    case '待考试':
      return 'primary'
    case '未安排':
      return 'info'
    default:
      return 'info'
  }
}

// 跳转到登录页面
const goToLogin = () => {
  router.push('/login/eas')
}

// 初始化
onMounted(async () => {
  try {
    // 设置默认选中的学期为当前学期
    selectedTerm.value = await getCurrentTerm()

    // 加载缓存的考试信息
    await loadCachedExams()

    // 如果没有缓存数据，自动查询
    if (exams.value.length === 0) {
      await queryExams()
    }
  } catch (error) {
    console.error('初始化失败:', error)
  }
})
</script>

<style scoped>
.controls {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
}

.exam-card {
  margin-top: 15px;
}

.loading-container {
  padding: 20px 0;
}

.login-tip {
  padding: 40px 0;
}

.el-tag {
  width: 70px;
  text-align: center;
}
</style>