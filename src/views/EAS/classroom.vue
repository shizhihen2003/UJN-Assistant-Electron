<template>
  <div class="empty-classroom-view">
    <div class="page-header">
      <h1>空教室查询</h1>
      <p class="subtitle">查询符合条件的空闲教室，支持按周次、星期、节次筛选</p>
    </div>

    <!-- 登录提示 -->
    <el-alert
        v-if="!isLoggedIn"
        title="请先登录教务系统"
        type="warning"
        description="空教室查询功能需要教务系统登录权限，请先登录后再进行查询"
        show-icon
        :closable="false">
      <template #default>
        <router-link to="/login/eas">
          <el-button type="primary" size="small">前往登录</el-button>
        </router-link>
      </template>
    </el-alert>

    <!-- 查询组件 -->
    <EmptyClassroomQuery v-if="isLoggedIn" />
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import EmptyClassroomQuery from './components/EmptyClassroomQuery.vue';
import authService from '@/services/authService.js';

export default {
  name: 'EmptyClassroomView',
  components: {
    EmptyClassroomQuery
  },
  setup() {
    const isLoggedIn = ref(false);

    // 检查登录状态
    const checkLoginStatus = async () => {
      try {
        const loginStatus = authService.getLoginStatus();
        isLoggedIn.value = loginStatus.eas || false;

        if (!isLoggedIn.value) {
          // 如果未检测到登录状态，尝试检查教务系统登录状态
          const isEasLoggedIn = await authService.checkEasLogin();
          isLoggedIn.value = isEasLoggedIn;
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
        isLoggedIn.value = false;
      }
    };

    onMounted(() => {
      checkLoginStatus();
    });

    return {
      isLoggedIn
    };
  }
};
</script>

<style scoped>
.empty-classroom-view {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #409EFF;
}

.subtitle {
  font-size: 14px;
  color: #909399;
}
</style>