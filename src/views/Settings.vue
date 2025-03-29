<template>
  <div class="page-container">
    <h1 class="page-title">系统设置</h1>

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
            <h4>智慧济大账号</h4>
            <div v-if="accountInfo.ipass.username" class="account-details">
              <div>登录账号：{{ accountInfo.ipass.username }}</div>
              <div>
                登录状态：
                <el-tag :type="accountInfo.ipass.isLoggedIn ? 'success' : 'danger'" size="small">
                  {{ accountInfo.ipass.isLoggedIn ? '已登录' : '未登录' }}
                </el-tag>
              </div>
            </div>
            <el-empty v-else description="未设置智慧济大账号" :image-size="60"></el-empty>
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
          <h2>UJN Assistant</h2>
          <p>版本：v{{ appVersion }}</p>
          <p>济南大学助手 - 提供课表查询、成绩查询等服务</p>
          <p>开发者：济南大学信息科学与工程学院</p>
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
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { School, Plus, Delete } from '@element-plus/icons-vue';
import store from '@/utils/store';
import authService from '@/services/authService';

const router = useRouter();
const appVersion = ref('1.0.0');

// 设置表单
const settingsForm = reactive({
  showTeacher: false,
});

// 课表设置
const lessonSettings = reactive({
  openingDate: '',
  timeSlots: [
    { start: null, end: null }, // 第1节
    { start: null, end: null }, // 第2节
    { start: null, end: null }, // 第3节
    { start: null, end: null }, // 第4节
    { start: null, end: null }, // 第5节
    { start: null, end: null }, // 第6节
    { start: null, end: null }, // 第7节
    { start: null, end: null }, // 第8节
    { start: null, end: null }, // 第9节
    { start: null, end: null }  // 第10节
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
  return Array.from({ length: 7 }).map((_, i) => i); // 禁用0-6小时
};

// 加载设置
const loadSettings = async () => {
  try {
    // 加载基本设置 - 直接加载"显示教师信息"设置
    settingsForm.showTeacher = await store.getBoolean('SHOW_TEACHER', false);

    // 加载开学日期
    const openingDate = await store.getString('CUSTOM_OPENING_DATE', '');
    if (openingDate) {
      lessonSettings.openingDate = openingDate;
    } else {
      // 尝试从课表信息中获取开学日期
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
      // 转换字符串时间段为时间对象数组
      lessonSettings.timeSlots = timeSettings.map(timeStr => {
        const [startStr, endStr] = timeStr.split('-');
        // 创建日期对象用于时间选择器
        const startDate = createTimeDate(startStr);
        const endDate = createTimeDate(endStr);

        return {
          start: startDate,
          end: endDate
        };
      });
    } else {
      // 设置默认时间段
      const defaultTimeSlots = [
        { start: '08:00', end: '08:50' }, // 第1节
        { start: '09:00', end: '09:50' }, // 第2节
        { start: '10:10', end: '11:00' }, // 第3节
        { start: '11:10', end: '12:00' }, // 第4节
        { start: '14:00', end: '14:50' }, // 第5节
        { start: '15:00', end: '15:50' }, // 第6节
        { start: '16:10', end: '17:00' }, // 第7节
        { start: '17:10', end: '18:00' }, // 第8节
        { start: '19:00', end: '19:50' }, // 第9节
        { start: '20:00', end: '20:50' }  // 第10节
      ];

      lessonSettings.timeSlots = defaultTimeSlots.map(slot => {
        return {
          start: createTimeDate(slot.start),
          end: createTimeDate(slot.end)
        };
      });
    }

    // 加载账号信息
    const easAccount = await store.getString('EAS_ACCOUNT', '');
    const ipassAccount = await store.getString('IPASS_ACCOUNT', '');
    const entranceYear = await store.getInt('ENTRANCE_TIME', 0);

    // 更新账号信息
    accountInfo.eas.username = easAccount;
    accountInfo.eas.entranceYear = entranceYear;
    accountInfo.ipass.username = ipassAccount;

    // 获取登录状态
    const loginStatus = authService.getLoginStatus();
    accountInfo.eas.isLoggedIn = loginStatus.eas;
    accountInfo.ipass.isLoggedIn = loginStatus.ipass;

    // 获取数据状态
    await loadDataStatus();

    // 获取应用版本
    if (window.electron) {
      appVersion.value = await window.electron.getVersion();
    }
  } catch (error) {
    console.error('加载设置失败:', error);
    ElMessage.error('加载设置失败');
  }
};

// 保存开学日期
const saveOpeningDate = async () => {
  try {
    if (!lessonSettings.openingDate) {
      ElMessage.warning('请选择有效的开学日期');
      return;
    }

    await store.putString('CUSTOM_OPENING_DATE', lessonSettings.openingDate);
    ElMessage.success('开学日期保存成功');
  } catch (error) {
    console.error('保存开学日期失败:', error);
    ElMessage.error('保存开学日期失败');
  }
};

// 保存时间设置
const saveTimeSettings = async () => {
  try {
    // 验证时间设置是否完整
    for (const slot of lessonSettings.timeSlots) {
      if (!slot.start || !slot.end) {
        ElMessage.warning('请为所有课程时间段设置完整的开始和结束时间');
        return;
      }
    }

    // 转换为字符串数组格式保存
    const timeStrings = lessonSettings.timeSlots.map(slot => {
      // 格式化时间为字符串
      const formatTime = (date) => {
        if (!date) return '';
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      };

      return `${formatTime(slot.start)}-${formatTime(slot.end)}`;
    });

    await store.putObject('LESSON_TIME_SETTINGS', timeStrings);
    ElMessage.success('课程时间设置保存成功');
  } catch (error) {
    console.error('保存课程时间设置失败:', error);
    ElMessage.error('保存课程时间设置失败');
  }
};

// 创建时间日期对象辅助函数
const createTimeDate = (timeString) => {
  if (!timeString) return null;

  const [hours, minutes] = timeString.split(':').map(part => parseInt(part, 10));
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

// 添加时间段
const addTimeSlot = () => {
  const startDate = new Date();
  startDate.setHours(8, 0, 0);

  const endDate = new Date();
  endDate.setHours(8, 50, 0);

  lessonSettings.timeSlots.push({
    start: startDate,
    end: endDate
  });
};

// 移除时间段
const removeTimeSlot = (index) => {
  // 只允许移除额外添加的时间段（默认有10个）
  if (index >= 10) {
    lessonSettings.timeSlots.splice(index, 1);
    saveTimeSettings();
  }
};

// 重置时间设置
const resetTimeSettings = async () => {
  try {
    // 确认对话框
    await ElMessageBox.confirm(
        '确定要恢复默认课程时间设置吗？您的自定义设置将被覆盖。',
        '重置确认',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
    );

    // 默认时间设置
    const defaultTimeSlots = [
      { start: '08:00', end: '08:50' }, // 第1节
      { start: '09:00', end: '09:50' }, // 第2节
      { start: '10:10', end: '11:00' }, // 第3节
      { start: '11:10', end: '12:00' }, // 第4节
      { start: '14:00', end: '14:50' }, // 第5节
      { start: '15:00', end: '15:50' }, // 第6节
      { start: '16:10', end: '17:00' }, // 第7节
      { start: '17:10', end: '18:00' }, // 第8节
      { start: '19:00', end: '19:50' }, // 第9节
      { start: '20:00', end: '20:50' }  // 第10节
    ];

    // 重置为默认时间段 - 使用日期对象
    lessonSettings.timeSlots = defaultTimeSlots.map(slot => {
      return {
        start: createTimeDate(slot.start),
        end: createTimeDate(slot.end)
      };
    });

    // 保存设置
    await saveTimeSettings();
    ElMessage.success('已恢复默认课程时间设置');
  } catch (error) {
    if (error === 'cancel') {
      return;
    }
    console.error('重置时间设置失败:', error);
    ElMessage.error('重置时间设置失败');
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
    // 保存基本设置 - 直接保存"显示教师信息"设置
    await store.putBoolean('SHOW_TEACHER', settingsForm.showTeacher);

    // 触发自定义事件来通知所有组件设置已更改
    window.dispatchEvent(new CustomEvent('ujn_settings_changed', {
      detail: {
        showTeacher: settingsForm.showTeacher
      }
    }));

    console.log('保存教师信息显示设置:', settingsForm.showTeacher);
    ElMessage.success('设置已保存');
  } catch (error) {
    console.error('保存设置失败:', error);
    ElMessage.error('保存设置失败');
  }
};

// 格式化时间
const formatTime = (time) => {
  if (!time) return '未知';

  try {
    const date = new Date(time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  } catch (error) {
    return '未知';
  }
};

// 清除账号
const clearAccount = async (type) => {
  try {
    if (type === 'eas') {
      await store.remove('EAS_ACCOUNT');
      await store.remove('EAS_PASSWORD');
      await store.remove('EA_HOST');
      await store.remove('EAS_AUTO_LOGIN');
      authService.logoutEas();

      accountInfo.eas.username = '';
      accountInfo.eas.entranceYear = '';
      accountInfo.eas.isLoggedIn = false;

      ElMessage.success('已清除教务系统账号');
    } else if (type === 'ipass') {
      await store.remove('IPASS_ACCOUNT');
      await store.remove('IPASS_PASSWORD');
      await store.remove('IPASS_AUTO_LOGIN');
      authService.logoutIpass();

      accountInfo.ipass.username = '';
      accountInfo.ipass.isLoggedIn = false;

      ElMessage.success('已清除智慧济大账号');
    }
  } catch (error) {
    console.error(`清除${type}账号失败:`, error);
    ElMessage.error(`清除${type}账号失败`);
  }
};

// 跳转到登录页面
const goToLogin = (type) => {
  if (type === 'eas') {
    router.push('/login/eas');
  } else if (type === 'ipass') {
    router.push('/login/ipass');
  }
};

// 刷新数据
const refreshData = (dataType) => {
  if (dataType === 'lessonTable') {
    router.push('/eas/lesson-table');
  } else if (dataType === 'marks') {
    router.push('/eas/marks');
  } else if (dataType === 'notices') {
    router.push('/eas/notice');
  } else if (dataType === 'exams') {
    router.push('/eas/exams');
  }
};

// 清除数据
const clearData = async (dataType) => {
  try {
    if (dataType === 'lessonTable') {
      await store.remove('lesson_table');
      await store.remove('lesson_table_info');
      dataStatus.lessonTable = null;
      ElMessage.success('已清除课表数据');
    } else if (dataType === 'marks') {
      for (let i = 0; i < 8; i++) {
        await store.remove(`marks_${i}`);
      }
      await store.remove('MARKS_LAST_UPDATE');
      dataStatus.marks = null;
      ElMessage.success('已清除成绩数据');
    } else if (dataType === 'notices') {
      await store.remove('eas_notices');
      await store.remove('NOTICES_LAST_UPDATE');
      dataStatus.notices = null;
      ElMessage.success('已清除通知数据');
    } else if (dataType === 'exams') {
      for (let i = 0; i < 8; i++) {
        await store.remove(`exams_${i}`);
      }
      await store.remove('EXAMS_LAST_UPDATE');
      dataStatus.exams = null;
      ElMessage.success('已清除考试数据');
    }
  } catch (error) {
    console.error(`清除${dataType}数据失败:`, error);
    ElMessage.error(`清除${dataType}数据失败`);
  }
};

// 清除所有数据
const clearAllData = async () => {
  try {
    // 显示确认对话框
    await ElMessageBox.confirm(
        '此操作将清除所有本地数据，包括账号信息、课表、成绩等，确定要继续吗？',
        '警告',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
    );

    // 清除所有数据
    await store.clear();

    // 重置状态
    accountInfo.eas.username = '';
    accountInfo.eas.entranceYear = '';
    accountInfo.eas.isLoggedIn = false;
    accountInfo.ipass.username = '';
    accountInfo.ipass.isLoggedIn = false;

    dataStatus.lessonTable = null;
    dataStatus.marks = null;
    dataStatus.notices = null;
    dataStatus.exams = null;

    // 登出账号
    authService.logoutAll();

    ElMessage.success('已清除所有数据');

    // 回到首页
    router.push('/');
  } catch (error) {
    if (error === 'cancel') {
      return;
    }
    console.error('清除所有数据失败:', error);
    ElMessage.error('清除所有数据失败');
  }
};

// 检查应用更新
const checkUpdate = async () => {
  try {
    // 检查是否在Electron环境中运行
    if (!window.ipcRenderer) {
      ElMessage.info('当前环境不支持自动检查更新');
      return;
    }

    // 显示正在检查的提示信息
    ElMessage.info('正在检查更新...');

    // 调用主进程检查GitHub上的最新版本
    const result = await window.ipcRenderer.invoke('check-github-release');

    // 如果检查过程中出现错误
    if (result.error) {
      ElMessage.error(`检查更新失败: ${result.error}`);
      return;
    }

    // 如果有新版本可用
    if (result.hasUpdate) {
      // 显示确认对话框，询问用户是否要更新
      ElMessageBox.confirm(
          `发现新版本 v${result.latestVersion}，当前版本 v${result.currentVersion}，是否前往下载页面？`,
          '检查更新',
          {
            confirmButtonText: '前往下载',      // 确认按钮文本
            cancelButtonText: '暂不更新',       // 取消按钮文本
            type: 'info',                      // 对话框类型
            dangerouslyUseHTMLString: true,    // 允许HTML内容
            // 构建包含版本信息和更新说明的HTML消息
            message: `<div>
            <p>发现新版本 v${result.latestVersion}，当前版本 v${result.currentVersion}</p>
            <p>更新内容:</p>
            <div style="max-height: 200px; overflow-y: auto; background: #f5f7fa; padding: 10px; border-radius: 4px;">
              ${result.releaseNotes ? result.releaseNotes.replace(/\n/g, '<br>') : '无详细说明'}
            </div>
          </div>`
          }
      ).then(() => {
        // 用户点击"前往下载"，在系统默认浏览器中打开release页面
        window.ipcRenderer.invoke('open-external-url', result.releaseUrl);
      }).catch(() => {
        // 用户点击"暂不更新"，不执行任何操作
      });
    } else {
      // 已经是最新版本
      ElMessage.success('当前已是最新版本');
    }
  } catch (error) {
    // 处理其他可能的错误
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

.app-logo img {
  width: 80px;
  height: 80px;
}

.app-details {
  flex: 1;
  min-width: 0; /* 确保文字容器不会溢出 */
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