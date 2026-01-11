<template>
  <div class="page-container">
    <h1 class="page-title">系统设置</h1>

    <!-- 学校配置 -->
    <SchoolConfig />

    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <h3>基本设置</h3>
        </div>
      </template>

      <el-form :model="settingsForm" label-width="120px">
        <el-form-item label="显示教师信息">
          <el-switch v-model="settingsForm.showTeacher" @change="saveSettings" />
          <div class="setting-desc">在课表中显示任课教师姓名</div>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <h3>课表设置</h3>
        </div>
      </template>

      <el-form :model="lessonSettings" label-width="120px">
        <el-form-item label="开学日期">
          <el-date-picker
              v-model="lessonSettings.openingDate"
              type="date"
              placeholder="选择开学日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              @change="saveOpeningDate"
          />
          <div class="setting-desc">用于计算当前教学周次</div>
        </el-form-item>

        <el-divider content-position="left">课程时间设置</el-divider>

        <div class="time-settings">
          <div v-for="(timeSlot, index) in lessonSettings.timeSlots" :key="index" class="time-slot-item">
            <span class="time-slot-label">第{{ index + 1 }}节:</span>
            <el-time-picker
                v-model="timeSlot.start"
                format="HH:mm"
                placeholder="开始时间"
                :disabled-hours="disabledHours"
                :step="300"
                @change="saveTimeSettings"
            />
            <span class="time-separator">-</span>
            <el-time-picker
                v-model="timeSlot.end"
                format="HH:mm"
                placeholder="结束时间"
                :disabled-hours="disabledHours"
                :step="300"
                @change="saveTimeSettings"
            />
            <el-button
                type="danger"
                :icon="Delete"
                circle
                size="small"
                @click="removeTimeSlot(index)"
                v-if="index >= 10"
            />
          </div>

          <div class="add-time-slot">
            <el-button type="primary" :icon="Plus" @click="addTimeSlot">添加课程时间段</el-button>
          </div>

          <div class="reset-time-settings">
            <el-button @click="resetTimeSettings">恢复默认时间设置</el-button>
          </div>
        </div>
      </el-form>
    </el-card>

    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <h3>账号设置</h3>
        </div>
      </template>

      <div class="account-settings">
        <div class="account-item">
          <div class="account-info">
            <h4>教务系统账号</h4>
            <div v-if="accountInfo.eas.username" class="account-details">
              <div>登录账号：{{ accountInfo.eas.username }}</div>
              <div>入学年份：{{ accountInfo.eas.entranceYear }}</div>
              <div>
                登录状态：
                <el-tag :type="accountInfo.eas.isLoggedIn ? 'success' : 'danger'" size="small">
                  {{ accountInfo.eas.isLoggedIn ? '已登录' : '未登录' }}
                </el-tag>
              </div>
            </div>
            <el-empty v-else description="未设置教务系统账号" :image-size="60"></el-empty>
          </div>
          <div class="account-actions">
            <el-button type="primary" size="small" @click="goToLogin('eas')">{{ accountInfo.eas.username ? '重新登录' : '去登录' }}</el-button>
            <el-popconfirm title="确定要清除登录信息吗？" @confirm="clearAccount('eas')">
              <template #reference>
                <el-button type="danger" size="small" :disabled="!accountInfo.eas.username">清除登录</el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>

        <el-divider />

        <div class="account-item">
          <div class="account-info">
            <h4>智慧校园账号</h4>
            <div v-if="accountInfo.ipass.username" class="account-details">
              <div>登录账号：{{ accountInfo.ipass.username }}</div>
              <div>
                登录状态：
                <el-tag :type="accountInfo.ipass.isLoggedIn ? 'success' : 'danger'" size="small">
                  {{ accountInfo.ipass.isLoggedIn ? '已登录' : '未登录' }}
                </el-tag>
              </div>
            </div>
            <el-empty v-else description="未设置智慧校园账号" :image-size="60"></el-empty>
          </div>
          <div class="account-actions">
            <el-button type="primary" size="small" @click="goToLogin('ipass')">{{ accountInfo.ipass.username ? '重新登录' : '去登录' }}</el-button>
            <el-popconfirm title="确定要清除登录信息吗？" @confirm="clearAccount('ipass')">
              <template #reference>
                <el-button type="danger" size="small" :disabled="!accountInfo.ipass.username">清除登录</el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>
      </div>
    </el-card>

    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <h3>数据管理</h3>
        </div>
      </template>

      <div class="data-settings">
        <div class="data-item">
          <div class="data-info">
            <h4>课表数据</h4>
            <div class="data-status">
              <span v-if="dataStatus.lessonTable">
                上次更新: {{ formatTime(dataStatus.lessonTable.lastUpdate) }}
              </span>
              <span v-else>未获取课表数据</span>
            </div>
          </div>
          <div class="data-actions">
            <el-button type="primary" size="small" @click="refreshData('lessonTable')">刷新数据</el-button>
            <el-popconfirm title="确定要清除课表数据吗？" @confirm="clearData('lessonTable')">
              <template #reference>
                <el-button type="danger" size="small" :disabled="!dataStatus.lessonTable">清除数据</el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>

        <el-divider />

        <div class="data-item">
          <div class="data-info">
            <h4>成绩数据</h4>
            <div class="data-status">
              <span v-if="dataStatus.marks">
                上次更新: {{ formatTime(dataStatus.marks.lastUpdate) }}
              </span>
              <span v-else>未获取成绩数据</span>
            </div>
          </div>
          <div class="data-actions">
            <el-button type="primary" size="small" @click="refreshData('marks')">刷新数据</el-button>
            <el-popconfirm title="确定要清除成绩数据吗？" @confirm="clearData('marks')">
              <template #reference>
                <el-button type="danger" size="small" :disabled="!dataStatus.marks">清除数据</el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>

        <el-divider />

        <div class="data-item">
          <div class="data-info">
            <h4>通知数据</h4>
            <div class="data-status">
              <span v-if="dataStatus.notices">
                上次更新: {{ formatTime(dataStatus.notices.lastUpdate) }}
              </span>
              <span v-else>未获取通知数据</span>
            </div>
          </div>
          <div class="data-actions">
            <el-button type="primary" size="small" @click="refreshData('notices')">刷新数据</el-button>
            <el-popconfirm title="确定要清除通知数据吗？" @confirm="clearData('notices')">
              <template #reference>
                <el-button type="danger" size="small" :disabled="!dataStatus.notices">清除数据</el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>

        <el-divider />

        <div class="data-item">
          <div class="data-info">
            <h4>考试数据</h4>
            <div class="data-status">
              <span v-if="dataStatus.exams">
                上次更新: {{ formatTime(dataStatus.exams.lastUpdate) }}
              </span>
              <span v-else>未获取考试数据</span>
            </div>
          </div>
          <div class="data-actions">
            <el-button type="primary" size="small" @click="refreshData('exams')">刷新数据</el-button>
            <el-popconfirm title="确定要清除考试数据吗？" @confirm="clearData('exams')">
              <template #reference>
                <el-button type="danger" size="small" :disabled="!dataStatus.exams">清除数据</el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>
      </div>

      <div class="global-actions">
        <el-popconfirm title="确定要清除所有数据吗？此操作不可恢复！" @confirm="clearAllData">
          <template #reference>
            <el-button type="danger">清除所有数据</el-button>
          </template>
        </el-popconfirm>
      </div>
    </el-card>

    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <h3>关于应用</h3>
        </div>
      </template>

      <div class="about-info">
        <div class="app-logo-container">
          <el-icon :size="80" color="#409EFF"><School /></el-icon>
        </div>
        <div class="app-details">
          <h2>{{ appName }}</h2>
          <p>版本：v{{ appVersion }}</p>
          <p>{{ schoolName }}助手 - 提供课表查询、成绩查询等服务</p>
          <p>开发者：{{ schoolName }}信息科学与工程学院</p>
        </div>
      </div>

      <div class="app-actions">
        <el-button type="primary" @click="checkUpdate">检查更新</el-button>
        <el-button @click="openProject">项目主页</el-button>
        <el-button @click="openHelp">帮助文档</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { School, Plus, Delete } from '@element-plus/icons-vue';
import store from '@/utils/store';
import authService from '@/services/authService';
import schoolService from '@/services/schoolService';
import SchoolConfig from '@/components/SchoolConfig.vue';
import API from '@/constants/api';

const router = useRouter();
const appVersion = ref('2.0.1');

// 学校名称（动态）
const schoolName = computed(() => API.SCHOOL_NAME || '济南大学');
const appName = computed(() => `${API.SCHOOL_SHORT_NAME || '济大'} Assistant`);

// 设置表单
const settingsForm = reactive({
  showTeacher: false,
});

// 课表设置
const lessonSettings = reactive({
  openingDate: '',
  timeSlots: [
    { start: null, end: null },
    { start: null, end: null },
    { start: null, end: null },
    { start: null, end: null },
    { start: null, end: null },
    { start: null, end: null },
    { start: null, end: null },
    { start: null, end: null },
    { start: null, end: null },
    { start: null, end: null }
  ]
});

// 账号信息
const accountInfo = reactive({
  eas: {
    username: '',
    entranceYear: '',
    isLoggedIn: false
  },
  ipass: {
    username: '',
    isLoggedIn: false
  }
});

// 数据状态
const dataStatus = reactive({
  lessonTable: null,
  marks: null,
  notices: null,
  exams: null
});

// 禁用不必要的小时选项
const disabledHours = () => {
  return Array.from({ length: 7 }).map((_, i) => i);
};

// 创建时间日期对象
const createTimeDate = (timeStr) => {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

// 格式化时间对象为字符串
const formatTimeToString = (date) => {
  if (!date) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

// 加载设置
const loadSettings = async () => {
  try {
    // 加载基本设置
    settingsForm.showTeacher = await store.getBoolean('SHOW_TEACHER', false);

    // 加载开学日期
    const openingDate = await store.getString('CUSTOM_OPENING_DATE', '');
    if (openingDate) {
      lessonSettings.openingDate = openingDate;
    } else {
      const lessonTableInfo = await store.getObject('lesson_table_info', null);
      if (lessonTableInfo && lessonTableInfo.startDay) {
        try {
          const startDate = new Date(lessonTableInfo.startDay);
          lessonSettings.openingDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        } catch (e) {
          console.error('解析课表开学日期失败:', e);
        }
      }
    }

    // 加载时间段设置
    const timeSettings = await store.getObject('LESSON_TIME_SETTINGS', null);
    if (timeSettings) {
      lessonSettings.timeSlots = timeSettings.map(slot => ({
        start: createTimeDate(slot.start),
        end: createTimeDate(slot.end)
      }));
    } else {
      // 默认时间设置
      const defaultSlots = [
        { start: '08:00', end: '08:50' },
        { start: '09:00', end: '09:50' },
        { start: '10:10', end: '11:00' },
        { start: '11:10', end: '12:00' },
        { start: '14:00', end: '14:50' },
        { start: '15:00', end: '15:50' },
        { start: '16:10', end: '17:00' },
        { start: '17:10', end: '18:00' },
        { start: '19:00', end: '19:50' },
        { start: '20:00', end: '20:50' }
      ];
      lessonSettings.timeSlots = defaultSlots.map(slot => ({
        start: createTimeDate(slot.start),
        end: createTimeDate(slot.end)
      }));
    }

    // 加载账号信息
    await loadAccountInfo();

    // 加载数据状态
    await loadDataStatus();
  } catch (error) {
    console.error('加载设置失败:', error);
  }
};

// 加载账号信息
const loadAccountInfo = async () => {
  try {
    // 教务系统账号
    const easUsername = await store.getString('EAS_ACCOUNT', '');
    const entranceYear = await store.getInt('ENTRANCE_TIME', 0);
    accountInfo.eas.username = easUsername;
    accountInfo.eas.entranceYear = entranceYear > 0 ? entranceYear : '';
    accountInfo.eas.isLoggedIn = authService.easLoginStatus?.value || false;

    // 智慧校园账号
    const ipassUsername = await store.getString('IPASS_ACCOUNT', '');
    accountInfo.ipass.username = ipassUsername;
    accountInfo.ipass.isLoggedIn = authService.ipassLoginStatus?.value || false;
  } catch (error) {
    console.error('加载账号信息失败:', error);
  }
};

// 加载数据状态
const loadDataStatus = async () => {
  try {
    // 课表数据
    const lessonTable = await store.getObject('lesson_table', null);
    const lessonTableInfo = await store.getObject('lesson_table_info', null);
    if (lessonTable && lessonTableInfo) {
      dataStatus.lessonTable = {
        lastUpdate: new Date(lessonTableInfo.lastUpdate || Date.now())
      };
    }

    // 成绩数据
    let hasMarks = false;
    for (let i = 0; i < 8; i++) {
      const marks = await store.getObject(`marks_${i}`, null);
      if (marks && marks.length > 0) {
        hasMarks = true;
        break;
      }
    }
    if (hasMarks) {
      dataStatus.marks = {
        lastUpdate: new Date(await store.getInt('MARKS_LAST_UPDATE', Date.now()))
      };
    }

    // 通知数据
    const notices = await store.getObject('eas_notices', null);
    if (notices && notices.length > 0) {
      dataStatus.notices = {
        lastUpdate: new Date(await store.getInt('NOTICES_LAST_UPDATE', Date.now()))
      };
    }

    // 考试数据
    let hasExams = false;
    for (let i = 0; i < 8; i++) {
      const exams = await store.getObject(`exams_${i}`, null);
      if (exams && exams.length > 0) {
        hasExams = true;
        break;
      }
    }
    if (hasExams) {
      dataStatus.exams = {
        lastUpdate: new Date(await store.getInt('EXAMS_LAST_UPDATE', Date.now()))
      };
    }
  } catch (error) {
    console.error('加载数据状态失败:', error);
  }
};

// 保存设置
const saveSettings = async () => {
  try {
    await store.putBoolean('SHOW_TEACHER', settingsForm.showTeacher);

    window.dispatchEvent(new CustomEvent('ujn_settings_changed', {
      detail: { showTeacher: settingsForm.showTeacher }
    }));

    ElMessage.success('设置已保存');
  } catch (error) {
    console.error('保存设置失败:', error);
    ElMessage.error('保存设置失败');
  }
};

// 保存开学日期
const saveOpeningDate = async () => {
  try {
    if (lessonSettings.openingDate) {
      await store.putString('CUSTOM_OPENING_DATE', lessonSettings.openingDate);
      ElMessage.success('开学日期已保存');
    }
  } catch (error) {
    console.error('保存开学日期失败:', error);
    ElMessage.error('保存开学日期失败');
  }
};

// 保存时间段设置
const saveTimeSettings = async () => {
  try {
    const timeData = lessonSettings.timeSlots.map(slot => ({
      start: formatTimeToString(slot.start),
      end: formatTimeToString(slot.end)
    }));

    await store.putObject('LESSON_TIME_SETTINGS', timeData);
    ElMessage.success('时间设置已保存');
  } catch (error) {
    console.error('保存时间设置失败:', error);
    ElMessage.error('保存时间设置失败');
  }
};

// 添加时间段
const addTimeSlot = () => {
  lessonSettings.timeSlots.push({ start: null, end: null });
};

// 移除时间段
const removeTimeSlot = (index) => {
  if (lessonSettings.timeSlots.length > 10) {
    lessonSettings.timeSlots.splice(index, 1);
    saveTimeSettings();
  }
};

// 重置时间设置
const resetTimeSettings = async () => {
  try {
    await ElMessageBox.confirm('确定要恢复默认时间设置吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });

    const defaultSlots = [
      { start: '08:00', end: '08:50' },
      { start: '09:00', end: '09:50' },
      { start: '10:10', end: '11:00' },
      { start: '11:10', end: '12:00' },
      { start: '14:00', end: '14:50' },
      { start: '15:00', end: '15:50' },
      { start: '16:10', end: '17:00' },
      { start: '17:10', end: '18:00' },
      { start: '19:00', end: '19:50' },
      { start: '20:00', end: '20:50' }
    ];

    lessonSettings.timeSlots = defaultSlots.map(slot => ({
      start: createTimeDate(slot.start),
      end: createTimeDate(slot.end)
    }));

    await saveTimeSettings();
    ElMessage.success('已恢复默认课程时间设置');
  } catch (error) {
    if (error === 'cancel') return;
    console.error('重置时间设置失败:', error);
  }
};

// 跳转登录
const goToLogin = (type) => {
  router.push(`/login/${type}`);
};

// 清除账号
const clearAccount = async (type) => {
  try {
    if (type === 'eas') {
      await authService.logoutEas();
      await store.remove('EAS_ACCOUNT');
      await store.remove('EAS_PASSWORD');
      accountInfo.eas.username = '';
      accountInfo.eas.isLoggedIn = false;
    } else {
      await authService.logoutIpass();
      await store.remove('IPASS_ACCOUNT');
      await store.remove('IPASS_PASSWORD');
      accountInfo.ipass.username = '';
      accountInfo.ipass.isLoggedIn = false;
    }
    ElMessage.success('已清除登录信息');
  } catch (error) {
    console.error('清除账号失败:', error);
    ElMessage.error('清除失败');
  }
};

// 刷新数据
const refreshData = (type) => {
  const routes = {
    lessonTable: '/eas/lesson-table',
    marks: '/eas/marks',
    notices: '/home',
    exams: '/eas/exam'
  };
  router.push(routes[type] || '/home');
};

// 清除数据
const clearData = async (type) => {
  try {
    switch (type) {
      case 'lessonTable':
        await store.remove('lesson_table');
        await store.remove('lesson_table_info');
        dataStatus.lessonTable = null;
        break;
      case 'marks':
        for (let i = 0; i < 8; i++) {
          await store.remove(`marks_${i}`);
        }
        dataStatus.marks = null;
        break;
      case 'notices':
        await store.remove('eas_notices');
        dataStatus.notices = null;
        break;
      case 'exams':
        for (let i = 0; i < 8; i++) {
          await store.remove(`exams_${i}`);
        }
        dataStatus.exams = null;
        break;
    }
    ElMessage.success('数据已清除');
  } catch (error) {
    console.error('清除数据失败:', error);
    ElMessage.error('清除失败');
  }
};

// 清除所有数据
const clearAllData = async () => {
  try {
    await clearData('lessonTable');
    await clearData('marks');
    await clearData('notices');
    await clearData('exams');
    ElMessage.success('所有数据已清除');
  } catch (error) {
    console.error('清除所有数据失败:', error);
    ElMessage.error('清除失败');
  }
};

// 格式化时间
const formatTime = (time) => {
  if (!time) return '未知';
  try {
    const date = new Date(time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  } catch (e) {
    return '未知';
  }
};

// 检查更新
const checkUpdate = async () => {
  try {
    ElMessage.info('正在检查更新...');

    const result = await window.ipcRenderer?.invoke('check-update');

    if (!result) {
      ElMessage.warning('无法检查更新，请稍后再试');
      return;
    }

    if (result.hasUpdate) {
      await ElMessageBox.confirm(
          `发现新版本 ${result.latestVersion}，当前版本 ${appVersion.value}，是否前往下载？`,
          '发现新版本',
          {
            confirmButtonText: '前往下载',
            cancelButtonText: '暂不更新',
            type: 'info',
            dangerouslyUseHTMLString: true,
            message: `<div>
              <p>发现新版本 <strong>${result.latestVersion}</strong></p>
              <p>当前版本: ${appVersion.value}</p>
              <div style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px; max-height: 200px; overflow-y: auto;">
                ${result.releaseNotes ? result.releaseNotes.replace(/\n/g, '<br>') : '无详细说明'}
              </div>
            </div>`
          }
      ).then(() => {
        window.ipcRenderer.invoke('open-external-url', result.releaseUrl);
      }).catch(() => {});
    } else {
      ElMessage.success('当前已是最新版本');
    }
  } catch (error) {
    console.error('检查更新失败:', error);
    ElMessage.error('检查更新失败: ' + error.message);
  }
};

// 打开项目主页
const openProject = () => {
  const projectUrl = 'https://github.com/shizhihen2003/UJN-Assistant-Electron';
  if (window.ipcRenderer) {
    window.ipcRenderer.invoke('open-external-url', projectUrl);
  } else {
    window.open(projectUrl, '_blank', 'noopener,noreferrer');
  }
};

// 打开帮助文档
const openHelp = () => {
  const helpUrl = 'https://github.com/shizhihen2003/UJN-Assistant-Electron/blob/main/README.md';
  if (window.ipcRenderer) {
    window.ipcRenderer.invoke('open-external-url', helpUrl);
  } else {
    window.open(helpUrl, '_blank', 'noopener,noreferrer');
  }
};

// 初始化
onMounted(async () => {
  await loadSettings();
});
</script>

<style scoped>
.settings-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.setting-desc {
  color: #909399;
  font-size: 12px;
  margin-top: 5px;
}

.account-settings, .data-settings {
  padding: 0 20px;
}

.account-item, .data-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 0;
}

.account-details {
  margin-top: 10px;
  color: #606266;
  font-size: 14px;
}

.account-details div {
  margin-bottom: 5px;
}

.account-actions, .data-actions {
  display: flex;
  gap: 10px;
}

.data-status {
  color: #606266;
  font-size: 14px;
  margin-top: 5px;
}

.global-actions {
  margin-top: 20px;
  text-align: center;
}

.time-settings {
  margin-top: 15px;
}

.time-slot-item {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.time-slot-label {
  width: 70px;
  text-align: right;
  margin-right: 15px;
  color: #606266;
}

.time-separator {
  margin: 0 10px;
  color: #909399;
}

.add-time-slot {
  margin-top: 20px;
  margin-bottom: 15px;
}

.reset-time-settings {
  margin-top: 20px;
  text-align: right;
}

.about-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  margin-bottom: 30px;
  padding: 20px 0 0 0;
}

.app-logo-container {
  margin-bottom: 20px;
}

.app-details {
  flex: 1;
  min-width: 0;
}

.app-details h2 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 24px;
}

.app-details p {
  margin: 8px 0;
  color: #606266;
  line-height: 1.5;
}

.app-actions {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 20px;
}
</style>
