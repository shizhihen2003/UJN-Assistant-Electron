<template>
  <div class="page-container">
    <h1 class="page-title">学业查询</h1>
    <el-card>
      <div v-if="needLogin" class="login-tip">
        <el-empty description="请先登录教务系统">
          <el-button type="primary" @click="goToLogin">去登录</el-button>
        </el-empty>
      </div>
      <div v-else>
        <p>学业查询功能正在开发中...</p>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const needLogin = ref(false)

const goToLogin = () => {
  router.push('/login/eas')
}
</script>

<style scoped>
.login-tip {
  padding: 40px 0;
}
</style>