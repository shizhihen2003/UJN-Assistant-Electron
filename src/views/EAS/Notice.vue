<template>
  <div class="page-container">
    <h1 class="page-title">教务通知</h1>

    <div class="controls">
      <el-button type="primary" @click="refreshNotices" :loading="loading">
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
            <span class="notice-title">{{ notice.content.length > 30 ? notice.content.substring(0, 30) + '...' : notice.content }}</span>
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

const router = useRouter()
const loading = ref(false)
const needLogin = ref(false)
const notices = ref([])

// 格式化时间
const formatTime = (timeString) => {
  if (!timeString) return ''

  try {
    const date = new Date(timeString)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  } catch (error) {
    return timeString
  }
}

// 刷新通知
const refreshNotices = async () => {
  loading.value = true

  try {
    // 实际开发中，这里应该调用实际的API获取通知
    // 模拟获取通知数据
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 模拟数据
    notices.value = [
      {
        id: '1',
        time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        content: '关于2024-2025学年第一学期期末考试安排的通知'
      },
      {
        id: '2',
        time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        content: '关于2024-2025学年暑假放假时间的通知'
      },
      {
        id: '3',
        time: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        content: '关于本科生转专业申请的通知'
      }
    ]

    needLogin.value = false
  } catch (error) {
    console.error('获取通知失败:', error)

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
  await refreshNotices()
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
}

.loading-container {
  padding: 20px 0;
}

.login-tip {
  padding: 40px 0;
}
</style>