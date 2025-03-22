<template>
  <div class="home">
    <h1 class="welcome-title">欢迎使用 UJN-Assistant</h1>
    <div class="feature-grid">
      <el-card v-for="(item, index) in features" :key="index" shadow="hover"
               class="feature-card" @click="navigate(item.route)">
        <template #header>
          <div class="card-header">
            <h3>{{ item.title }}</h3>
          </div>
        </template>
        <div class="card-content">
          <el-icon :size="40" :color="'#409EFF'">
            <component :is="item.icon" />
          </el-icon>
          <p>{{ item.description }}</p>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Calendar, Bell, Document, DataLine, Collection, AlarmClock, User } from '@element-plus/icons-vue'

const router = useRouter()

const features = ref([
  {
    title: '当日课表',
    description: '查看今日的课程安排',
    icon: Calendar,
    route: '/daily-lesson'
  },
  {
    title: '学期课表',
    description: '查看完整学期课表',
    icon: Calendar,
    route: '/term-lesson'
  },
  {
    title: '教务通知',
    description: '浏览最新教务通知',
    icon: Bell,
    route: '/eas/notice'
  },
  {
    title: '课表查询',
    description: '查询课表信息',
    icon: Document,
    route: '/eas/lesson-table'
  },
  {
    title: '成绩查询',
    description: '查询考试成绩',
    icon: DataLine,
    route: '/eas/marks'
  },
  {
    title: '学业查询',
    description: '查询学业情况',
    icon: Collection,
    route: '/eas/academic'
  },
  {
    title: '考试查询',
    description: '查询考试安排',
    icon: AlarmClock,
    route: '/eas/exams'
  },
  {
    title: '账号登录',
    description: '登录教务/智慧济大',
    icon: User,
    route: '/login/eas'
  }
])

const navigate = (route) => {
  router.push(route)
}
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.welcome-title {
  text-align: center;
  margin-bottom: 30px;
  color: #303133;
  font-size: 28px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}

.feature-card {
  cursor: pointer;
  transition: transform 0.3s;
}

.feature-card:hover {
  transform: translateY(-5px);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px 0;
}

.card-content p {
  margin-top: 15px;
  color: #606266;
}
</style>