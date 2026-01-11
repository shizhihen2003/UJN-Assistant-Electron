<template>
  <div class="page-container" :class="{ 'dark-mode': isDarkMode }">
    <!-- 背景动画装饰 -->
    <div class="bg-decoration">
      <div class="bg-particles" v-for="n in 8" :key="n"></div>
      <div class="bg-gradient"></div>
    </div>

    <!-- 顶部操作栏 -->
    <div class="top-actions">
      <div class="theme-toggle" @click="toggleTheme">
        <el-icon v-if="isDarkMode"><Sunny /></el-icon>
        <el-icon v-else><Moon /></el-icon>
      </div>
    </div>

    <h1 class="page-title">成绩查询</h1>

    <div class="controls">
      <el-select v-model="selectedTerm" placeholder="选择学期" @change="selectTerm">
        <el-option
            v-for="(term, index) in termNames"
            :key="index"
            :label="term"
            :value="index"
        />
      </el-select>
      <el-button type="primary" @click="queryMarks" :loading="loading">
        <el-icon><Search /></el-icon> 查询成绩
      </el-button>
    </div>

    <el-card v-if="needLogin" class="marks-card login-tip">
      <el-empty description="请先登录教务系统">
        <el-button type="primary" @click="goToLogin">去登录</el-button>
      </el-empty>
    </el-card>

    <el-card v-else-if="loading" class="marks-card">
      <div class="loading-container">
        <el-skeleton :rows="5" animated />
      </div>
    </el-card>

    <template v-else>
      <el-empty v-if="marks.length === 0" description="暂无成绩数据" />

      <div v-else class="marks-container">
        <el-card class="summary-card">
          <div class="summary-item">
            <span>学期均分</span>
            <span class="value">{{ calculateAverage() }}</span>
          </div>
          <div class="summary-item">
            <span>通过门数</span>
            <span class="value">{{ countPassedCourses() }}/{{ marks.length }}</span>
          </div>
          <div class="summary-item">
            <span>已获学分</span>
            <span class="value">{{ calculateTotalCredits() }}</span>
          </div>
        </el-card>

        <!-- 成绩排序控制 -->
        <div class="sort-controls">
          <el-radio-group v-model="sortBy" @change="sortMarks">
            <el-radio :value="0">课程类型</el-radio>
            <el-radio :value="1">成绩</el-radio>
            <el-radio :value="2">时间</el-radio>
          </el-radio-group>
          <el-button @click="toggleSortDirection">
            <el-icon><Sort /></el-icon>
            {{ sortDirection > 0 ? '升序' : '降序' }}
          </el-button>
        </div>

        <el-card
            v-for="(mark, index) in marks"
            :key="index"
            class="mark-card"
            :class="{ 'new-mark': mark.isNew === 1 }">
          <div class="mark-header" @click="toggleMarkDetail(index)">
            <div class="mark-title">
              <span class="course-name">{{ mark.name }}</span>
              <el-tag v-if="mark.isNew === 1" type="danger" size="small" @click.stop="clearNew(index)">NEW</el-tag>
            </div>
            <div class="mark-score" :class="getScoreClass(mark.mark)">
              {{ mark.mark }}
            </div>
          </div>

          <div v-show="expandedMarks[index]" class="mark-details">
            <div class="detail-item">
              <span class="label">课程号：</span>
              <span>{{ mark.kchId }}</span>
            </div>
            <div class="detail-item">
              <span class="label">课程类型：</span>
              <span>{{ mark.type }}</span>
            </div>
            <div class="detail-item">
              <span class="label">学分：</span>
              <span>{{ mark.credit }}</span>
            </div>
            <div class="detail-item">
              <span class="label">绩点：</span>
              <span>{{ mark.gpa }}</span>
            </div>
            <div class="detail-item">
              <span class="label">成绩发布时间：</span>
              <span>{{ formatTime(mark.time) }}</span>
            </div>

            <div v-if="mark.items && mark.items.length > 0" class="mark-items">
              <h4>成绩明细</h4>
              <div v-for="(item, itemIndex) in mark.items" :key="itemIndex" class="item">
                <span class="label">{{ item.name }}：</span>
                <span>{{ item.mark }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Sort, Moon, Sunny } from '@element-plus/icons-vue'
import EASAccount from '@/models/EASAccount'
import { UJNAPI } from '@/constants/api'
import store from '@/utils/store'
import ipc from '@/utils/ipc'

// 主题切换
const isDarkMode = ref(false)

const toggleTheme = () => {
  isDarkMode.value = !isDarkMode.value
  document.documentElement.classList.toggle('dark-theme', isDarkMode.value)
  localStorage.setItem('ujn_dark_mode', isDarkMode.value ? '1' : '0')
}

// 只获取基本成绩信息（不含明细）
const getBasicMarks = async (easAccount, index, xnm, xqm) => {
  try {
    console.log(`使用备用方法获取基本成绩信息: 学年=${xnm}, 学期=${xqm}, 索引=${index}`)

    // 获取已保存的Cookie
    const cookies = await easAccount.cookieJar.getCookies()

    // 查询成绩列表
    const markResponse = await ipc.easPost(
        easAccount.getFullUrl(UJNAPI.GET_MARK),
        {
          xnm: xnm,
          xqm: xqm,
          'queryModel.showCount': '999'
        },
        {
          cookies: cookies,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': easAccount.getFullUrl(''),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        }
    )

    if (!markResponse.success) {
      throw new Error(markResponse.error || '查询成绩失败')
    }

    // 解析JSON
    let markData
    try {
      markData = JSON.parse(markResponse.data)
    } catch (error) {
      console.error('解析成绩JSON失败:', error)

      // 检查是否是HTML响应（可能是会话过期）
      if (markResponse.data.includes('<!doctype html>') || markResponse.data.includes('<html>')) {
        throw new Error('会话可能已过期，请重新登录')
      }

      throw error
    }

    // 处理成绩数据
    const markList = []

    if (markData && markData.items) {
      for (const item of markData.items) {
        // 生成一个唯一ID
        const id = `${index}_${item.kch_id}_${Date.now()}`

        // 解析成绩
        const score = parseFloat(item.cj || '0')

        // 计算绩点
        let gpa = '0'
        if (score >= 60) {
          if (item.ksxz === '正常考试') {
            gpa = (score >= 95) ? '5.0' : ((5.0 - (95 - score) / 10).toFixed(2)).toString()
          } else {
            gpa = '1'
          }
        }

        markList.push({
          id,
          kchId: item.kch_id,
          name: item.kcmc.trim(),
          type: item.ksxz || '正常考试',
          credit: item.xf,
          mark: score,
          gpa,
          time: item.tjsj ? new Date(item.tjsj) : new Date(),
          items: [], // 没有明细数据
          index,
          isNew: 1
        })
      }
    }

    return markList
  } catch (error) {
    console.error('获取基本成绩信息失败:', error)
    throw error
  }
}

const router = useRouter()
const loading = ref(false)
const needLogin = ref(false)
const marks = ref([])
const expandedMarks = reactive({})
const selectedTerm = ref(0)
const sortBy = ref(1) // 默认按成绩排序
const sortDirection = ref(-1) // 默认降序

// 学期名称
const termNames = [
  "大一 上学期", "大一 下学期",
  "大二 上学期", "大二 下学期",
  "大三 上学期", "大三 下学期",
  "大四 上学期", "大四 下学期"
]

// 查询缓存状态跟踪
const termQueryStatus = reactive({
  0: false, 1: false, 2: false, 3: false,
  4: false, 5: false, 6: false, 7: false
})

// 格式化时间
const formatTime = (timeString) => {
  if (!timeString) return ''
  try {
    // 处理Date对象或字符串
    let date
    if (typeof timeString === 'string') {
      date = new Date(timeString)
      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        return timeString
      }
    } else if (timeString instanceof Date) {
      date = timeString
    } else {
      return String(timeString)
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  } catch (error) {
    console.error('时间格式化错误:', error)
    return String(timeString)
  }
}

// 获取成绩对应的样式类
const getScoreClass = (score) => {
  if (!score && score !== 0) return ''

  const numScore = parseFloat(score)
  if (isNaN(numScore)) return ''

  if (numScore >= 90) return 'score-excellent'
  if (numScore >= 80) return 'score-good'
  if (numScore >= 70) return 'score-medium'
  if (numScore >= 60) return 'score-pass'
  return 'score-fail'
}

// 切换成绩详情显示
const toggleMarkDetail = (index) => {
  expandedMarks[index] = !expandedMarks[index]
}

// 清除新成绩标记
const clearNew = async (index) => {
  try {
    marks.value[index].isNew = 0

    // 在数据库中更新状态
    await updateMarkReadStatus(marks.value[index].id)

    ElMessage.success('已清除新成绩标记')
  } catch (error) {
    console.error('清除新成绩标记失败:', error)
    ElMessage.error('清除新成绩标记失败')
  }
}

// 更新成绩已读状态
const updateMarkReadStatus = async (markId) => {
  try {
    const termKey = `marks_${selectedTerm.value}`
    const cachedMarks = await store.getObject(termKey, [])

    if (cachedMarks.length === 0) return; // 没有缓存数据

    // 更新缓存中的标记
    const updatedMarks = cachedMarks.map(mark => {
      if (mark.id === markId) {
        return { ...mark, isNew: 0 }
      }
      return mark
    })

    try {
      // 使用JSON序列化和反序列化来确保对象完全可克隆
      const jsonString = JSON.stringify(updatedMarks);
      const safeMarks = JSON.parse(jsonString);

      // 保存更新后的数据
      await store.safePutObject(termKey, safeMarks)
    } catch (storageError) {
      console.error('保存更新后的成绩数据失败:', storageError)
      // 不抛出错误，继续执行
    }
  } catch (error) {
    console.error('更新成绩已读状态失败:', error)
    // 不抛出错误，避免影响用户体验
  }
}

// 计算平均分
const calculateAverage = () => {
  if (marks.value.length === 0) return '0.00'

  let totalScore = 0
  let validCount = 0

  marks.value.forEach(mark => {
    const score = parseFloat(mark.mark)
    if (!isNaN(score)) {
      totalScore += score
      validCount++
    }
  })

  return validCount > 0 ? (totalScore / validCount).toFixed(2) : '0.00'
}

// 计算通过课程数
const countPassedCourses = () => {
  return marks.value.filter(mark => {
    const score = parseFloat(mark.mark)
    return !isNaN(score) && score >= 60
  }).length
}

// 计算总学分
const calculateTotalCredits = () => {
  const total = marks.value.reduce((sum, mark) => {
    const score = parseFloat(mark.mark)
    const credit = parseFloat(mark.credit)

    if (!isNaN(score) && !isNaN(credit) && score >= 60) {
      return sum + credit
    }
    return sum
  }, 0)

  return total.toFixed(1)
}

// 切换学期
const selectTerm = async (index) => {
  selectedTerm.value = index
  await loadMarksForTerm(index)
}

// 加载指定学期的成绩
const loadMarksForTerm = async (termIndex) => {
  try {
    console.log(`加载第${termIndex + 1}学期的成绩数据`)

    // 从缓存加载
    const termKey = `marks_${termIndex}`
    const cachedMarks = await store.getObject(termKey, [])

    if (cachedMarks.length > 0) {
      console.log(`从缓存加载到${cachedMarks.length}条成绩数据`)

      // 处理日期字符串转为Date对象
      const processedMarks = cachedMarks.map(mark => ({
        ...mark,
        time: typeof mark.time === 'string' ? new Date(mark.time) : mark.time
      }));

      marks.value = processedMarks;
      sortMarks()
      termQueryStatus[termIndex] = true
      return true
    }

    // 缓存中没有数据，显示空数据
    marks.value = []
    return false
  } catch (error) {
    console.error('加载成绩数据失败:', error)
    marks.value = []
    return false
  }
}

// 排序成绩
const sortMarks = () => {
  const direction = sortDirection.value

  marks.value.sort((a, b) => {
    switch (sortBy.value) {
      case 0: // 按课程类型
        const typeCompare = a.type.localeCompare(b.type) * direction
        return typeCompare !== 0 ? typeCompare : compareByScore(a, b) * direction

      case 1: // 按成绩
        return compareByScore(a, b) * direction

      case 2: // 按时间
        const aTime = new Date(a.time).getTime()
        const bTime = new Date(b.time).getTime()
        return (aTime - bTime) * direction

      default:
        return 0
    }
  })
}

// 比较成绩
const compareByScore = (a, b) => {
  const scoreA = parseFloat(a.mark)
  const scoreB = parseFloat(b.mark)

  if (isNaN(scoreA) && isNaN(scoreB)) return 0
  if (isNaN(scoreA)) return -1
  if (isNaN(scoreB)) return 1

  return scoreB - scoreA
}

// 切换排序方向
const toggleSortDirection = () => {
  sortDirection.value *= -1
  sortMarks()
}

// 查询成绩
const queryMarks = async () => {
  loading.value = true
  needLogin.value = false

  try {
    const easAccount = EASAccount.getInstance()

    // 检查登录状态
    try {
      await easAccount.checkLogin()
    } catch (error) {
      console.error('登录检查失败:', error)
      needLogin.value = true
      loading.value = false
      return
    }

    // 计算学年和学期参数
    const entranceTime = easAccount.entranceTime
    if (entranceTime <= 0) {
      ElMessage.warning('未设置入学年份，可能导致查询结果异常')
    }

    const termIndex = selectedTerm.value
    const yearNum = Math.floor(termIndex / 2) + entranceTime
    const termNum = termIndex % 2 === 0 ? '3' : '12'

    console.log(`查询成绩: 学年=${yearNum}, 学期=${termNum}, 索引=${termIndex}`)

    // 调用API查询成绩
    try {
      const result = await easAccount.queryMark(termIndex, yearNum.toString(), termNum)

      // 如果没有返回成绩数据
      if (!result || result.length === 0) {
        ElMessage.info('未查询到成绩数据')
        marks.value = []
        loading.value = false
        return
      }

      // 处理查询结果
      marks.value = result

    } catch (error) {
      console.error('查询成绩详情失败:', error)
      ElMessage.warning('获取成绩详情失败，可能是学校关闭了明细查询功能')

      // 尝试只获取基本成绩信息（不包含明细）
      try {
        const basicResult = await getBasicMarks(easAccount, termIndex, yearNum.toString(), termNum)
        if (basicResult && basicResult.length > 0) {
          marks.value = basicResult
          ElMessage.info('已获取基本成绩信息')
        } else {
          ElMessage.info('未查询到成绩数据')
          marks.value = []
          loading.value = false
          return
        }
      } catch (basicError) {
        console.error('获取基本成绩信息失败:', basicError)
        ElMessage.error('获取成绩信息失败')
        marks.value = []
        loading.value = false
        return
      }
    }

    // 排序成绩
    sortMarks()

    // 保存到本地缓存
    try {
      // 创建纯数据对象，手动处理每个字段，确保可以序列化
      const serializableMarks = marks.value.map(mark => {
        // 创建一个纯数据对象
        const simpleMark = {
          id: typeof mark.id === 'string' ? mark.id : `mark_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          kchId: typeof mark.kchId === 'string' ? mark.kchId : '',
          name: typeof mark.name === 'string' ? mark.name : '',
          type: typeof mark.type === 'string' ? mark.type : '',
          credit: typeof mark.credit === 'string' ? mark.credit : String(mark.credit || ''),
          mark: typeof mark.mark === 'number' ? mark.mark : 0,
          gpa: typeof mark.gpa === 'string' ? mark.gpa : String(mark.gpa || ''),
          // 处理日期 - 转为ISO字符串
          time: mark.time ? (mark.time instanceof Date ? mark.time.toISOString() : String(mark.time)) : new Date().toISOString(),
          // 处理成绩项 - 确保每个项都是简单对象
          items: Array.isArray(mark.items) ? mark.items.map(item => ({
            name: typeof item.name === 'string' ? item.name : '',
            mark: typeof item.mark === 'string' ? item.mark : String(item.mark || '')
          })) : [],
          index: typeof mark.index === 'number' ? mark.index : 0,
          isNew: typeof mark.isNew === 'number' ? mark.isNew : 0
        };
        return simpleMark;
      });

      // 使用JSON序列化和反序列化来确保对象完全可克隆
      const jsonString = JSON.stringify(serializableMarks);
      const safeMarks = JSON.parse(jsonString);

      const termKey = `marks_${termIndex}`;
      await store.safePutObject(termKey, safeMarks);
      console.log(`成功保存${safeMarks.length}条成绩数据到缓存`);
    } catch (storageError) {
      console.error('保存成绩数据到缓存失败:', storageError);
      // 不中断流程，仅记录错误
      ElMessage.warning('成绩数据已获取，但无法保存到本地缓存');
    }

    // 更新查询状态
    termQueryStatus[termIndex] = true

    ElMessage.success('成功获取成绩数据')
  } catch (error) {
    console.error('查询成绩失败:', error)

    if (error.message && error.message.includes('登录')) {
      needLogin.value = true
      ElMessage.warning('请先登录教务系统')
    } else {
      ElMessage.error('查询成绩失败: ' + error.message)
    }
  } finally {
    loading.value = false
  }
}

// 跳转到登录页面
const goToLogin = () => {
  router.push('/login/eas')
}

// 初始化
onMounted(async () => {
  try {
    // 加载主题设置
    const savedDarkMode = localStorage.getItem('ujn_dark_mode')
    if (savedDarkMode === '1') {
      isDarkMode.value = true
      document.documentElement.classList.add('dark-theme')
    }

    const easAccount = EASAccount.getInstance()

    // 设置当前学期
    try {
      const currentGrade = easAccount.getCurrentGrade()
      if (currentGrade >= 0 && currentGrade < termNames.length) {
        selectedTerm.value = currentGrade
      }
    } catch (error) {
      console.error('获取当前学期失败:', error)
    }

    // 尝试加载本地数据
    const hasData = await loadMarksForTerm(selectedTerm.value)

    // 尝试检查登录状态，但不显示错误消息
    try {
      if (await easAccount.absCheckLogin()) {
        needLogin.value = false

        // 如果没有本地数据，自动查询
        if (!hasData) {
          await queryMarks()
        }
      } else {
        console.log('未登录，需要先登录')
        needLogin.value = true
      }
    } catch (error) {
      console.log('未登录，需要先登录:', error)
      needLogin.value = true
    }
  } catch (error) {
    console.error('初始化成绩页面失败:', error)
  }
})

// 监听学期变化，自动查询未查询过的学期
watch(selectedTerm, async (newValue) => {
  // 如果之前没有查询过该学期的数据且已登录，自动查询
  if (!termQueryStatus[newValue] && !needLogin.value) {
    await queryMarks()
  }
})
</script>

<style>
/* 全局CSS变量 */
:root {
  --primary-color: #5c6cff;
  --primary-color-rgb: 92, 108, 255;
  --primary-light: #8a96ff;
  --primary-dark: #4155e2;
  --success-color: #34C759;
  --warning-color: #FF9500;
  --danger-color: #FF3B30;
  --info-color: #5AC8FA;
  --bg-color: #f5f7fa;
  --card-bg: #ffffff;
  --text-primary: #303133;
  --text-secondary: #606266;
  --text-hint: #909399;
  --border-color: #EBEEF5;
  --shadow-light: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  --shadow-medium: 0 4px 16px 0 rgba(0, 0, 0, 0.08);
  --transition-normal: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

:root.dark-theme {
  --primary-color: #7c8aff;
  --primary-light: #a5afff;
  --primary-dark: #5c6cff;
  --bg-color: #121212;
  --card-bg: #242424;
  --text-primary: rgba(255, 255, 255, 0.9);
  --text-secondary: rgba(255, 255, 255, 0.7);
  --text-hint: rgba(255, 255, 255, 0.5);
  --border-color: #3e3e3e;
  --shadow-light: 0 2px 12px 0 rgba(0, 0, 0, 0.2);
  --shadow-medium: 0 4px 16px 0 rgba(0, 0, 0, 0.3);
}
</style>

<style scoped>
/* 页面容器 */
.page-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
  min-height: 100vh;
  background-color: var(--bg-color);
  color: var(--text-primary);
  transition: var(--transition-normal);
}

/* 背景装饰 */
.bg-decoration {
  position: fixed;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  overflow: hidden;
  z-index: 0;
  pointer-events: none;
}

.bg-particles {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, var(--primary-color) 0%, transparent 70%);
  opacity: 0.1;
  filter: blur(10px);
  animation: float 30s linear infinite;
}

.bg-particles:nth-child(1) {
  width: 300px;
  height: 300px;
  top: 10%;
  left: 5%;
  animation-duration: 45s;
}

.bg-particles:nth-child(2) {
  width: 200px;
  height: 200px;
  top: 40%;
  right: 10%;
  animation-duration: 35s;
  animation-delay: 2s;
}

.bg-particles:nth-child(3) {
  width: 100px;
  height: 100px;
  bottom: 30%;
  left: 20%;
  animation-duration: 25s;
  animation-delay: 5s;
}

.bg-particles:nth-child(4) {
  width: 150px;
  height: 150px;
  bottom: 10%;
  right: 15%;
  animation-duration: 40s;
  animation-delay: 10s;
}

.bg-particles:nth-child(5) {
  width: 180px;
  height: 180px;
  top: 20%;
  right: 30%;
  animation-duration: 50s;
  animation-delay: 7s;
}

.bg-particles:nth-child(6) {
  width: 120px;
  height: 120px;
  bottom: 40%;
  right: 40%;
  animation-duration: 55s;
  animation-delay: 3s;
}

.bg-particles:nth-child(7) {
  width: 250px;
  height: 250px;
  top: 60%;
  left: 10%;
  animation-duration: 60s;
  animation-delay: 15s;
}

.bg-particles:nth-child(8) {
  width: 200px;
  height: 200px;
  bottom: 20%;
  left: 40%;
  animation-duration: 45s;
  animation-delay: 8s;
}

.bg-gradient {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(92, 108, 255, 0.03) 0%, rgba(92, 108, 255, 0) 50%);
}

@keyframes float {
  0% {
    transform: translate(0, 0) rotate(0deg) scale(1);
  }
  25% {
    transform: translate(20px, 30px) rotate(90deg) scale(1.1);
  }
  50% {
    transform: translate(40px, 20px) rotate(180deg) scale(1.2);
  }
  75% {
    transform: translate(20px, -10px) rotate(270deg) scale(1.1);
  }
  100% {
    transform: translate(0, 0) rotate(360deg) scale(1);
  }
}

/* 顶部操作栏 */
.top-actions {
  display: flex;
  justify-content: flex-end;
  padding: 10px 0;
  position: relative;
  z-index: 10;
}

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--card-bg);
  box-shadow: var(--shadow-light);
  cursor: pointer;
  transition: var(--transition-normal);
}

.theme-toggle:hover {
  transform: rotate(30deg);
  box-shadow: var(--shadow-medium);
}

.theme-toggle .el-icon {
  font-size: 20px;
  color: var(--primary-color);
}

/* 页面标题 */
.page-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

/* 原有样式 */
.controls {
  margin-bottom: 20px;
  display: flex;
  gap: 15px;
  position: relative;
  z-index: 1;
}

.marks-card {
  margin-bottom: 15px;
  position: relative;
  z-index: 1;
  background-color: var(--card-bg);
  border-radius: 16px;
  box-shadow: var(--shadow-light);
}

.marks-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
  position: relative;
  z-index: 1;
}

.summary-card {
  display: flex;
  justify-content: space-around;
  padding: 15px;
  background-color: var(--card-bg);
  border-radius: 16px;
  box-shadow: var(--shadow-light);
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--text-primary);
}

.summary-item .value {
  font-size: 20px;
  font-weight: bold;
  margin-top: 5px;
  color: var(--primary-color);
}

.sort-controls {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.mark-card {
  transition: var(--transition-normal);
  background-color: var(--card-bg);
  border-radius: 12px;
  box-shadow: var(--shadow-light);
}

.mark-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-medium);
}

.mark-card.new-mark {
  border-left: 4px solid #f56c6c;
}

.mark-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.mark-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.course-name {
  font-weight: bold;
  color: var(--text-primary);
}

.mark-score {
  font-size: 20px;
  font-weight: bold;
  padding: 5px 15px;
  border-radius: 15px;
  background-color: var(--bg-color);
}

.score-excellent {
  color: #67c23a;
}

.score-good {
  color: #409eff;
}

.score-medium {
  color: #e6a23c;
}

.score-pass {
  color: #909399;
}

.score-fail {
  color: #f56c6c;
}

.mark-details {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--border-color);
}

.detail-item {
  margin-bottom: 8px;
  display: flex;
  color: var(--text-primary);
}

.detail-item .label {
  color: var(--text-hint);
  width: 120px;
}

.mark-items {
  margin-top: 15px;
  padding: 10px;
  background-color: var(--bg-color);
  border-radius: 4px;
}

.mark-items h4 {
  margin: 0 0 10px 0;
  color: var(--text-secondary);
}

.mark-items .item {
  margin-bottom: 5px;
  display: flex;
  color: var(--text-primary);
}

.mark-items .label {
  color: var(--text-hint);
  width: 120px;
}

.loading-container {
  padding: 20px 0;
}

.login-tip {
  padding: 40px 0;
}

/* 响应式 */
@media screen and (max-width: 768px) {
  .page-container {
    padding: 16px;
  }
}
</style>