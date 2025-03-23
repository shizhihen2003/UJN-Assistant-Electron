<!-- src/views/Login/EASLogin.vue -->
<template>
  <div class="login-container">
    <h1 class="page-title">教务系统登录</h1>

    <el-card class="login-card" v-loading="loading">
      <el-form
          :model="loginForm"
          :rules="rules"
          ref="loginFormRef"
          label-width="80px"
          @submit.prevent="handleLogin"
      >
        <el-form-item label="学号" prop="username">
          <el-input v-model="loginForm.username" placeholder="请输入学号" autocomplete="off">
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
              v-model="loginForm.password"
              type="password"
              placeholder="请输入密码"
              autocomplete="off"
              show-password
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="入学年份" prop="entranceYear">
          <el-input-number
              v-model="loginForm.entranceYear"
              :min="1990"
              :max="currentYear"
              controls-position="right"
          ></el-input-number>
          <div class="form-tip">通常是学号的前四位</div>
        </el-form-item>

        <el-form-item label="教务节点">
          <el-select v-model="loginForm.nodeIndex" placeholder="请选择教务节点">
            <el-option
                v-for="(node, index) in eaNodes"
                :key="index"
                :label="`节点${index + 1}: ${node}`"
                :value="index"
            ></el-option>
          </el-select>
          <div class="form-tip">默认选择节点1，如果登录失败可尝试其他节点</div>
        </el-form-item>

        <el-form-item>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-button type="primary" @click="handleLogin" :loading="loading" style="width: 100%">
                <el-icon><Key /></el-icon> 登录
              </el-button>
            </el-col>
            <el-col :span="12">
              <el-button @click="resetForm" style="width: 100%">
                <el-icon><RefreshLeft /></el-icon> 重置
              </el-button>
            </el-col>
          </el-row>
        </el-form-item>

        <div class="login-options">
          <el-checkbox v-model="loginForm.savePassword">记住密码</el-checkbox>
          <el-checkbox v-model="loginForm.autoLogin">自动登录</el-checkbox>
        </div>

        <div class="login-status" v-if="loginStatus">
          <span :class="{'status-success': loginStatus.success, 'status-error': !loginStatus.success}">
            {{ loginStatus.message }}
          </span>
        </div>
      </el-form>

      <div class="server-status" v-if="serverStatus">
        <el-alert
            :title="serverStatus.message"
            :type="serverStatus.type"
            :closable="false"
            show-icon
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock, Key, RefreshLeft, Connection } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import authService from '@/services/authService'
import { UJNAPI } from '@/constants/api'
import ipc from '@/utils/ipc'

const router = useRouter()

// 初始化状态
const loginFormRef = ref(null)
const loading = ref(false)
const loginStatus = ref(null)
const serverStatus = ref(null)
const currentYear = new Date().getFullYear()

// 教务节点列表
const eaNodes = UJNAPI.EA_HOSTS

// 登录表单
const loginForm = reactive({
  username: '',
  password: '',
  entranceYear: currentYear - 4, // 默认为四年前
  nodeIndex: 0, // 默认使用第一个节点
  savePassword: true,
  autoLogin: false
})

// 表单校验规则
const rules = {
  username: [
    { required: true, message: '请输入学号', trigger: 'blur' },
    { pattern: /^\d+$/, message: '学号应为数字', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ],
  entranceYear: [
    { required: true, message: '请选择入学年份', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value < 1990 || value > currentYear) {
          callback(new Error('入学年份不合理'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 检查教务服务器连接状态
const checkServerStatus = async () => {
  try {
    const host = eaNodes[loginForm.nodeIndex]
    const url = `http://${host}/jwglxt/xtgl/login_slogin.html`

    loading.value = true
    serverStatus.value = { message: '正在检查教务服务器状态...', type: 'info' }

    // 使用ipc直接发送请求检查状态
    const result = await ipc.easGet(url, { timeout: 5000 })

    if (result.success) {
      serverStatus.value = { message: '教务服务器连接正常', type: 'success' }
      setTimeout(() => {
        serverStatus.value = null
      }, 3000)
    } else {
      serverStatus.value = { message: '教务服务器连接异常，可尝试切换节点', type: 'warning' }
    }
  } catch (error) {
    console.error('服务器状态检查失败', error)
    serverStatus.value = { message: '教务服务器连接失败', type: 'error' }
  } finally {
    loading.value = false
  }
}

// 处理登录
const handleLogin = async () => {
  if (!loginFormRef.value) return;

  try {
    // 表单验证
    await loginFormRef.value.validate();

    // 显示加载状态
    loading.value = true;
    loginStatus.value = { success: false, message: '正在登录...' };

    // 检查教务节点
    if (loginForm.nodeIndex >= 0 && loginForm.nodeIndex < eaNodes.length) {
      // 设置主机
      authService.easAccount.changeHost(loginForm.nodeIndex);
    }

    // 清空之前可能的登录状态，确保重新登录
    authService.logoutEas();

    // 执行登录
    console.log("开始登录...");
    console.log(`使用账号: ${loginForm.username}, 节点索引: ${loginForm.nodeIndex}, 入学年份: ${loginForm.entranceYear}`);

    const result = await authService.loginEas(
        loginForm.username,
        loginForm.password,
        loginForm.entranceYear,
        loginForm.nodeIndex
    );

    console.log("登录结果:", result);

    // 更新登录状态
    loading.value = false;

    if (result === true) {
      // 登录成功
      loginStatus.value = { success: true, message: '登录成功，正在跳转...' };
      ElMessage.success('登录成功');

      // 保存账号信息
      if (loginForm.savePassword) {
        try {
          await ipc.setStoreValue('EAS_ACCOUNT', loginForm.username);
          await ipc.setStoreValue('EAS_PASSWORD', loginForm.password);
          await ipc.setStoreValue('ENTRANCE_TIME', loginForm.entranceYear);
          await ipc.setStoreValue('EA_HOST', loginForm.nodeIndex);
          console.log("账号信息保存成功");
        } catch (error) {
          console.error('保存账号信息失败', error);
        }
      }

      // 保存自动登录设置
      if (loginForm.autoLogin) {
        await authService.saveAutoLogin('eas', true);
      }

      // 延迟跳转首页
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } else {
      // 登录失败
      loginStatus.value = { success: false, message: '用户名或密码错误' };
      ElMessage.error('登录失败：用户名或密码错误');

      // 检查服务器状态
      checkServerStatus();
    }
  } catch (error) {
    console.error('登录过程出现异常', error);
    loading.value = false;
    loginStatus.value = { success: false, message: `登录失败: ${error.message || '未知错误'}` };
    ElMessage.error(`登录失败: ${error.message || '网络错误'}`);

    // 检查服务器状态
    checkServerStatus();
  }
}

// 重置表单
const resetForm = () => {
  if (loginFormRef.value) {
    loginFormRef.value.resetFields()
    loginStatus.value = null
    serverStatus.value = null
  }
}

// 根据学号自动设置入学年份
const autoSetEntranceYear = () => {
  const studentId = loginForm.username
  if (studentId && studentId.length >= 4) {
    const yearStr = studentId.substring(0, 4)
    const year = parseInt(yearStr, 10)

    if (!isNaN(year) && year >= 1990 && year <= currentYear) {
      loginForm.entranceYear = year
    }
  }
}

// 监听学号变化，自动设置入学年份
watch(() => loginForm.username, (newValue) => {
  if (newValue) {
    autoSetEntranceYear()
  }
})

// 监听节点变化
watch(() => loginForm.nodeIndex, () => {
  serverStatus.value = null
})

// 加载已保存的数据
onMounted(async () => {
  try {
    // 检查是否已登录
    const status = authService.getLoginStatus()
    if (status.eas) {
      ElMessage.info('您已登录教务系统')
      router.push('/')
      return
    }

    // 加载已保存的账号信息
    const savedAccount = await authService.getSavedAccount('eas')
    if (savedAccount) {
      loginForm.username = savedAccount.username || ''
      loginForm.password = savedAccount.password || ''
      loginForm.entranceYear = savedAccount.entranceYear || currentYear - 4
      loginForm.nodeIndex = savedAccount.nodeIndex || 0
      loginForm.autoLogin = savedAccount.autoLogin || false

      // 如果设置了自动登录
      if (savedAccount.autoLogin && savedAccount.username && savedAccount.password) {
        handleLogin()
      }
    }

    // 检查服务器状态
    checkServerStatus()
  } catch (error) {
    console.error('加载数据失败', error)
    ElMessage.warning('加载保存的账号信息失败')
  }
})
</script>

<style scoped>
.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--el-color-primary);
}

.login-card {
  width: 100%;
  max-width: 480px;
  border-radius: 8px;
}

.login-options {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  margin-bottom: 16px;
}

.login-status {
  text-align: center;
  margin-top: 16px;
  margin-bottom: 16px;
}

.status-success {
  color: var(--el-color-success);
}

.status-error {
  color: var(--el-color-danger);
}

.form-tip {
  font-size: 12px;
  color: var(--el-color-info);
  margin-top: 4px;
}

.server-status {
  margin-top: 16px;
}
</style>