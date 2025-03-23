<!-- src/views/debug/LoginDebug.vue -->
<template>
  <div class="debug-container">
    <h1>登录调试工具</h1>

    <el-card class="debug-card">
      <template #header>
        <div class="card-header">
          <h2>教务系统登录测试</h2>
        </div>
      </template>

      <el-form :model="loginForm" label-width="100px">
        <el-form-item label="学号">
          <el-input v-model="loginForm.username" placeholder="请输入学号"></el-input>
        </el-form-item>

        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" show-password></el-input>
        </el-form-item>

        <el-form-item label="教务节点">
          <el-select v-model="loginForm.nodeIndex" placeholder="请选择教务节点">
            <el-option
                v-for="(node, index) in eaNodes"
                :key="index"
                :label="`节点${index + 1}: ${node}`"
                :value="index">
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item label="入学年份">
          <el-input-number v-model="loginForm.entranceYear" :min="1990" :max="2025"></el-input-number>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleLogin" :loading="loading">登录测试</el-button>
          <el-button @click="checkLoginStatus">检查登录状态</el-button>
          <el-button @click="clearLogs">清空日志</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="debug-card">
      <template #header>
        <div class="card-header">
          <h2>公钥加密测试</h2>
        </div>
      </template>

      <el-form :model="encryptForm" label-width="100px">
        <el-form-item label="模数(Modulus)">
          <el-input v-model="encryptForm.modulus" type="textarea" rows="3"></el-input>
        </el-form-item>

        <el-form-item label="指数(Exponent)">
          <el-input v-model="encryptForm.exponent"></el-input>
        </el-form-item>

        <el-form-item label="密码">
          <el-input v-model="encryptForm.password" type="password" show-password></el-input>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="testEncrypt" :loading="encryptLoading">测试加密</el-button>
        </el-form-item>

        <el-form-item label="加密结果" v-if="encryptResult">
          <el-input v-model="encryptResult" type="textarea" rows="3" readonly></el-input>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="debug-card log-card">
      <template #header>
        <div class="card-header">
          <h2>登录日志</h2>
        </div>
      </template>

      <div class="log-container">
        <pre v-for="(log, index) in logs" :key="index" :class="getLogClass(log)">{{ log.message }}</pre>
      </div>
    </el-card>

    <el-card class="debug-card cookie-card">
      <template #header>
        <div class="card-header">
          <h2>Cookie管理</h2>
        </div>
      </template>

      <el-button @click="showCookies" :loading="cookieLoading">查看当前Cookie</el-button>
      <el-button type="danger" @click="clearCookies">清除Cookie</el-button>

      <div class="cookie-container" v-if="cookies.length > 0">
        <h3>当前Cookie ({{ cookies.length }})</h3>
        <el-table :data="cookies" style="width: 100%" border>
          <el-table-column prop="name" label="名称" width="180"></el-table-column>
          <el-table-column prop="value" label="值" width="280"></el-table-column>
          <el-table-column prop="domain" label="域"></el-table-column>
          <el-table-column prop="path" label="路径"></el-table-column>
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { UJNAPI } from '@/constants/api';
import ipc from '@/utils/ipc';
import EASAccount from '@/models/EASAccount';
import getenPassword from '@/utils/cryptoUtils'; // 直接导入原始的加密方法

// 教务节点列表
const eaNodes = UJNAPI.EA_HOSTS;

// 教务账号实例
const easAccount = EASAccount.getInstance();

// 表单数据
const loginForm = reactive({
  username: '',
  password: '',
  nodeIndex: 0,
  entranceYear: new Date().getFullYear() - 4
});

// 加密测试表单
const encryptForm = reactive({
  modulus: '',
  exponent: '',
  password: ''
});

// 状态
const loading = ref(false);
const encryptLoading = ref(false);
const cookieLoading = ref(false);
const logs = ref([]);
const cookies = ref([]);
const encryptResult = ref('');

// 获取日志类型的CSS类
function getLogClass(log) {
  return {
    'log-info': log.type === 'info',
    'log-success': log.type === 'success',
    'log-error': log.type === 'error',
    'log-warning': log.type === 'warning'
  };
}

// 添加日志
function addLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  logs.value.push({
    message: `[${timestamp}] ${message}`,
    type
  });

  // 自动滚动到底部
  setTimeout(() => {
    const logContainer = document.querySelector('.log-container');
    if (logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }, 0);
}

// 清空日志
function clearLogs() {
  logs.value = [];
}

// 测试密码加密
function testEncrypt() {
  if (!encryptForm.modulus || !encryptForm.exponent || !encryptForm.password) {
    ElMessage.warning('请完整填写加密参数');
    return;
  }

  try {
    encryptLoading.value = true;
    addLog(`开始测试密码加密...`, 'info');

    // 直接使用原始的getenPassword函数进行加密
    const result = getenPassword(
        encryptForm.password,
        encryptForm.modulus,
        encryptForm.exponent
    );

    if (result) {
      encryptResult.value = result;
      addLog(`加密成功: ${result.substring(0, 10)}...`, 'success');
    } else {
      encryptResult.value = '';
      addLog(`加密失败: 返回结果为空`, 'error');
    }
  } catch (error) {
    addLog(`加密异常: ${error.message}`, 'error');
    ElMessage.error(`加密错误: ${error.message}`);
  } finally {
    encryptLoading.value = false;
  }
}

// 显示当前Cookie
async function showCookies() {
  try {
    cookieLoading.value = true;
    addLog('获取Cookie...', 'info');

    const cookieList = await ipc.getStoreValue('eaCookie', []);
    cookies.value = cookieList.map(cookieStr => {
      try {
        const parts = cookieStr.split(';');
        const mainPart = parts[0].split('=');
        const name = mainPart[0].trim();
        const value = mainPart.slice(1).join('=').trim();

        let domain = '', path = '';

        // 解析其他部分
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i].trim();
          if (part.startsWith('Domain=')) {
            domain = part.substring(7);
          } else if (part.startsWith('Path=')) {
            path = part.substring(5);
          }
        }

        return { name, value, domain, path };
      } catch (e) {
        return {
          name: '解析错误',
          value: cookieStr,
          domain: '未知',
          path: '未知',
          error: e.message
        };
      }
    });

    addLog(`找到 ${cookies.value.length} 个Cookie`, 'success');
  } catch (error) {
    addLog(`获取Cookie失败: ${error.message}`, 'error');
  } finally {
    cookieLoading.value = false;
  }
}

// 清除Cookie
async function clearCookies() {
  try {
    addLog('清除Cookie...', 'info');

    await ipc.setStoreValue('eaCookie', []);
    easAccount.cookieJar.clearCookies();
    cookies.value = [];

    addLog('Cookie已清除', 'success');
    ElMessage.success('Cookie已清除');
  } catch (error) {
    addLog(`清除Cookie失败: ${error.message}`, 'error');
    ElMessage.error(`清除失败: ${error.message}`);
  }
}

// 登录测试
async function handleLogin() {
  if (!loginForm.username || !loginForm.password) {
    ElMessage.warning('请输入学号和密码');
    return;
  }

  try {
    loading.value = true;
    addLog(`开始登录测试 - 用户名: ${loginForm.username}, 节点: ${loginForm.nodeIndex}`, 'info');

    // 设置教务节点
    if (loginForm.nodeIndex >= 0 && loginForm.nodeIndex < eaNodes.length) {
      addLog(`切换到节点: ${eaNodes[loginForm.nodeIndex]}`, 'info');
      easAccount.changeHost(loginForm.nodeIndex);
    }

    // 设置入学年份
    easAccount.entranceTime = loginForm.entranceYear;
    addLog(`设置入学年份: ${loginForm.entranceYear}`, 'info');

    // 执行登录
    addLog('执行登录...', 'info');

    const startTime = Date.now();
    const result = await easAccount.login(loginForm.username, loginForm.password, true);
    const endTime = Date.now();

    if (result) {
      addLog(`登录成功！耗时: ${endTime - startTime}ms`, 'success');
      ElMessage.success('登录成功');

      // 获取Cookie
      await showCookies();
    } else {
      addLog('登录失败：用户名或密码错误', 'error');
      ElMessage.error('登录失败');
    }
  } catch (error) {
    addLog(`登录异常: ${error.message}`, 'error');
    ElMessage.error(`登录异常: ${error.message}`);
  } finally {
    loading.value = false;
  }
}

// 检查登录状态
async function checkLoginStatus() {
  try {
    addLog('检查登录状态...', 'info');

    const startTime = Date.now();
    const result = await easAccount.absCheckLogin();
    const endTime = Date.now();

    if (result) {
      addLog(`当前已登录! 耗时: ${endTime - startTime}ms`, 'success');
      ElMessage.success('当前已登录');
    } else {
      addLog('未登录或登录已失效', 'warning');
      ElMessage.warning('未登录或登录已失效');
    }
  } catch (error) {
    addLog(`检查状态异常: ${error.message}`, 'error');
    ElMessage.error(`检查状态异常: ${error.message}`);
  }
}

// 获取公钥用于测试
async function fetchPublicKey() {
  try {
    addLog('尝试获取公钥用于测试...', 'info');

    const host = eaNodes[loginForm.nodeIndex || 0];
    const url = `http://${host}/${UJNAPI.EA_LOGIN_PUBLIC_KEY}`;

    const result = await ipc.easGet(url, {
      params: { time: Date.now(), _: Date.now() }
    });

    if (result.success && result.data) {
      try {
        const data = JSON.parse(result.data);
        if (data.modulus && data.exponent) {
          encryptForm.modulus = data.modulus;
          encryptForm.exponent = data.exponent;
          addLog('成功获取公钥，已填充到加密测试表单', 'success');
        } else {
          addLog('公钥数据不完整', 'warning');
        }
      } catch (e) {
        addLog(`解析公钥失败: ${e.message}`, 'error');
      }
    } else {
      addLog('获取公钥失败', 'error');
    }
  } catch (error) {
    addLog(`获取公钥异常: ${error.message}`, 'error');
  }
}

// 初始化
onMounted(async () => {
  addLog('调试工具已加载', 'info');

  try {
    // 加载已保存的账号
    const savedUsername = await ipc.getStoreValue('EAS_ACCOUNT', '');
    const savedEntranceYear = await ipc.getStoreValue('ENTRANCE_TIME', new Date().getFullYear() - 4);
    const savedNodeIndex = await ipc.getStoreValue('EA_HOST', 0);

    if (savedUsername) {
      loginForm.username = savedUsername;
      loginForm.entranceYear = savedEntranceYear;
      loginForm.nodeIndex = savedNodeIndex;
      addLog(`已加载保存的账号: ${savedUsername}`, 'info');

      // 尝试获取公钥用于测试
      fetchPublicKey();
    } else {
      addLog('未找到保存的账号信息', 'info');
    }

    // 检查登录状态
    const isLogin = await easAccount.absCheckLogin();
    if (isLogin) {
      addLog('当前已处于登录状态', 'success');
    } else {
      addLog('当前未登录', 'info');
    }
  } catch (error) {
    addLog(`初始化错误: ${error.message}`, 'error');
  }
});
</script>

<style scoped>
.debug-container {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
}

.debug-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h2 {
  font-size: 18px;
  margin: 0;
}

.log-container {
  height: 300px;
  overflow-y: auto;
  background-color: #1e1e1e;
  color: #fff;
  padding: 10px;
  border-radius: 4px;
  font-family: monospace;
}

.log-container pre {
  margin: 4px 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.log-info {
  color: #8cc1ff;
}

.log-success {
  color: #67c23a;
}

.log-error {
  color: #f56c6c;
}

.log-warning {
  color: #e6a23c;
}

.cookie-container {
  margin-top: 15px;
}

.cookie-container h3 {
  margin-bottom: 10px;
}
</style>