<template>
  <div class="page-container">
    <h1 class="page-title">教务通知</h1>

    <div class="controls">
      <el-button type="primary" @click="queryNotices" :loading="loading">
        <el-icon><Refresh /></el-icon> 刷新通知
      </el-button>
    </div>

    <el-card v-if="needLogin" class="notice-card login-tip">
      <el-empty description="请先登录教务系统">
        <el-button type="primary" @click="goToLogin">去登录</el-button>
      </el-empty>
    </el-card>

    <el-card v-else-if="loading" class="notice-card">
      <div class="loading-container">
        <el-skeleton :rows="5" animated />
      </div>
    </el-card>

    <template v-else>
      <el-empty v-if="notices.length === 0" description="暂无通知" />

      <el-card v-for="(notice, index) in notices" :key="index" class="notice-card">
        <template #header>
          <div class="notice-header">
            <span class="notice-title">{{ notice.title || notice.content.substring(0, 30) + '...' }}</span>
            <span class="notice-time">{{ formatTime(notice.time) }}</span>
          </div>
        </template>
        <div class="notice-content">{{ notice.content }}</div>
      </el-card>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import EASAccount from '@/models/EASAccount'
import store from '@/utils/store'

const router = useRouter()
const loading = ref(false)
const needLogin = ref(false)
const notices = ref([])

// 格式化时间
const formatTime = (timeString) => {
  if (!timeString) return ''

  try {
    // 处理YYYY-MM-DD HH:MM:SS格式
    const date = new Date(timeString.replace(/-/g, '/'))
    if (isNaN(date.getTime())) {
      return timeString
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  } catch (error) {
    console.error('时间格式化失败:', error)
    return timeString
  }
}

// 加载缓存的通知
const loadCachedNotices = async () => {
  try {
    const cachedNotices = await store.getObject('eas_notices', [])
    if (cachedNotices && cachedNotices.length > 0) {
      notices.value = cachedNotices
      console.log('从缓存加载通知:', cachedNotices.length)
    }
  } catch (error) {
    console.error('加载缓存通知失败:', error)
  }
}

// 刷新通知
const queryNotices = async () => {
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

    // 查询通知
    console.log('开始查询教务通知')
    const noticeResults = await easAccount.queryNotice(1, 20)

    // 处理结果
    if (noticeResults && noticeResults.length > 0) {
      notices.value = noticeResults

      // 缓存通知
      await store.putObject('eas_notices', noticeResults)

      ElMessage.success(`成功获取 ${noticeResults.length} 条通知`)
    } else {
      if (notices.value.length === 0) {
        ElMessage.info('暂无教务通知')
      } else {
        ElMessage.info('通知已是最新')
      }
    }
  } catch (error) {
    console.error('查询通知失败:', error)

    if (error.message && error.message.includes('登录')) {
      needLogin.value = true
      ElMessage.warning('请先登录教务系统')
    } else {
      ElMessage.error('获取通知失败: ' + error.message)
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
  // 首先加载缓存的通知
  await loadCachedNotices()

  // 如果已经有缓存，显示缓存内容后再刷新
  if (notices.value.length > 0) {
    setTimeout(() => {
      queryNotices()
    }, 1000)
  } else {
    // 如果没有缓存，直接查询
    await queryNotices()
  }
})
</script>

<style scoped>
.controls {
  margin-bottom: 20px;
}

.notice-card {
  margin-bottom: 15px;
}

.notice-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.notice-title {
  font-weight: bold;
  font-size: 16px;
}

.notice-time {
  color: #909399;
  font-size: 14px;
}

.notice-content {
  margin-top: 10px;
  color: #606266;
  line-height: 1.6;
  white-space: pre-line;
}

.loading-container {
  padding: 20px 0;
}

.login-tip {
  padding: 40px 0;
}
</style>