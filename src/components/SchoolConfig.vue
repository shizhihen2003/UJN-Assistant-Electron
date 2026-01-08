<template>
  <div class="school-config">
    <!-- 学校选择 -->
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>学校配置</span>
          <el-button type="primary" size="small" @click="showAddDialog = true">
            <el-icon><Plus /></el-icon>
            添加学校
          </el-button>
        </div>
      </template>

      <el-form label-width="100px">
        <el-form-item label="当前学校">
          <el-select
              v-model="currentSchoolId"
              placeholder="请选择学校"
              @change="handleSchoolChange"
              style="width: 100%"
          >
            <el-option-group label="预置学校">
              <el-option
                  v-for="school in presetSchools"
                  :key="school.id"
                  :label="school.name"
                  :value="school.id"
              >
                <span>{{ school.name }}</span>
                <span style="color: #999; font-size: 12px; margin-left: 8px;">
                  {{ school.shortName }}
                </span>
              </el-option>
            </el-option-group>
            <el-option-group label="自定义学校" v-if="customSchools.length > 0">
              <el-option
                  v-for="school in customSchools"
                  :key="school.id"
                  :label="school.name"
                  :value="school.id"
              >
                <span>{{ school.name }}</span>
                <span style="color: #999; font-size: 12px; margin-left: 8px;">
                  {{ school.shortName }}
                </span>
              </el-option>
            </el-option-group>
          </el-select>
        </el-form-item>

        <!-- 当前学校信息展示 -->
        <el-descriptions :column="2" border v-if="currentConfig.id">
          <el-descriptions-item label="学校名称">{{ currentConfig.name }}</el-descriptions-item>
          <el-descriptions-item label="学校简称">{{ currentConfig.shortName }}</el-descriptions-item>
          <el-descriptions-item label="VPN地址">{{ currentConfig.vpn?.host || '未配置' }}</el-descriptions-item>
          <el-descriptions-item label="统一认证">{{ currentConfig.sso?.host || '未配置' }}</el-descriptions-item>
          <el-descriptions-item label="教务节点数">{{ currentConfig.eas?.hosts?.length || 0 }} 个</el-descriptions-item>
          <el-descriptions-item label="校区数量">{{ currentConfig.campuses?.length || 0 }} 个</el-descriptions-item>
        </el-descriptions>
      </el-form>

      <!-- 自定义学校操作按钮 -->
      <div class="custom-school-actions" v-if="!isPresetSchool && currentConfig.id">
        <el-button type="warning" size="small" @click="editCurrentSchool">
          <el-icon><Edit /></el-icon>
          编辑配置
        </el-button>
        <el-popconfirm
            title="确定要删除这个学校配置吗？"
            @confirm="deleteCurrentSchool"
        >
          <template #reference>
            <el-button type="danger" size="small">
              <el-icon><Delete /></el-icon>
              删除学校
            </el-button>
          </template>
        </el-popconfirm>
        <el-button type="info" size="small" @click="exportCurrentConfig">
          <el-icon><Download /></el-icon>
          导出配置
        </el-button>
      </div>
    </el-card>

    <!-- 添加/编辑学校对话框 -->
    <el-dialog
        v-model="showAddDialog"
        :title="editMode ? '编辑学校配置' : '添加学校配置'"
        width="700px"
        :close-on-click-modal="false"
    >
      <el-tabs v-model="activeTab">
        <!-- 基本信息 -->
        <el-tab-pane label="基本信息" name="basic">
          <el-form :model="editingConfig" label-width="120px">
            <el-form-item label="学校ID" required>
              <el-input
                  v-model="editingConfig.id"
                  placeholder="英文简称，如 sdu, hnu"
                  :disabled="editMode"
              />
              <div class="form-tip">唯一标识，创建后不可修改</div>
            </el-form-item>
            <el-form-item label="学校名称" required>
              <el-input v-model="editingConfig.name" placeholder="如：山东大学" />
            </el-form-item>
            <el-form-item label="学校简称">
              <el-input v-model="editingConfig.shortName" placeholder="如：山大" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- VPN配置 -->
        <el-tab-pane label="VPN配置" name="vpn">
          <el-form :model="editingConfig.vpn" label-width="120px">
            <el-form-item label="启用VPN">
              <el-switch v-model="editingConfig.vpn.enabled" />
            </el-form-item>
            <template v-if="editingConfig.vpn.enabled">
              <el-form-item label="VPN主机" required>
                <el-input
                    v-model="editingConfig.vpn.host"
                    placeholder="如：webvpn.sdu.edu.cn"
                />
              </el-form-item>
              <el-form-item label="VPN登录URL" required>
                <el-input
                    v-model="editingConfig.vpn.loginUrl"
                    placeholder="如：https://webvpn.sdu.edu.cn/"
                />
              </el-form-item>
              <el-form-item label="加密密钥">
                <el-input
                    v-model="editingConfig.vpn.encryptKey"
                    placeholder="默认：wrdvpnisthebest"
                />
                <div class="form-tip">大多数学校使用默认密钥</div>
              </el-form-item>
            </template>
          </el-form>
        </el-tab-pane>

        <!-- 统一认证配置 -->
        <el-tab-pane label="统一认证" name="sso">
          <el-form :model="editingConfig.sso" label-width="120px">
            <el-form-item label="认证类型">
              <el-select v-model="editingConfig.sso.type" style="width: 100%">
                <el-option label="CAS认证" value="cas" />
                <el-option label="OAuth认证" value="oauth" />
                <el-option label="天翼认证 (TPass)" value="tpass" />
                <el-option label="自定义" value="custom" />
              </el-select>
            </el-form-item>
            <el-form-item label="SSO主机" required>
              <el-input
                  v-model="editingConfig.sso.host"
                  placeholder="如：pass.sdu.edu.cn"
              />
            </el-form-item>
            <el-form-item label="登录URL" required>
              <el-input
                  v-model="editingConfig.sso.loginUrl"
                  placeholder="如：https://pass.sdu.edu.cn/cas/login"
              />
            </el-form-item>
            <el-form-item label="门户URL">
              <el-input
                  v-model="editingConfig.sso.portalUrl"
                  placeholder="如：https://www.sdu.edu.cn/"
              />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 教务系统配置 -->
        <el-tab-pane label="教务系统" name="eas">
          <el-form :model="editingConfig.eas" label-width="120px">
            <el-form-item label="系统类型">
              <el-select v-model="editingConfig.eas.type" style="width: 100%">
                <el-option label="正方教务系统" value="zhengfang" />
                <el-option label="新正方教务系统" value="zhengfang_new" />
                <el-option label="金智教务系统" value="kingosoft" />
                <el-option label="URP教务系统" value="urpclass" />
                <el-option label="自定义系统" value="custom" />
              </el-select>
            </el-form-item>

            <el-form-item label="教务主机" required>
              <div class="hosts-list">
                <div
                    v-for="(host, index) in editingConfig.eas.hosts"
                    :key="index"
                    class="host-item"
                >
                  <el-input
                      v-model="editingConfig.eas.hosts[index]"
                      placeholder="如：jwxt.sdu.edu.cn"
                  />
                  <el-button
                      type="danger"
                      :icon="Delete"
                      circle
                      size="small"
                      @click="removeHost(index)"
                      :disabled="editingConfig.eas.hosts.length <= 1"
                  />
                </div>
                <el-button type="primary" size="small" @click="addHost">
                  <el-icon><Plus /></el-icon>
                  添加节点
                </el-button>
              </div>
              <div class="form-tip">支持多节点负载均衡</div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- API路径配置 -->
        <el-tab-pane label="API路径" name="apis">
          <el-form :model="editingConfig.eas.apis" label-width="140px" size="small">
            <el-alert
                title="大多数使用新正方系统的学校可保持默认值"
                type="info"
                :closable="false"
                style="margin-bottom: 16px"
            />
            <el-form-item label="登录接口">
              <el-input v-model="editingConfig.eas.apis.login" />
            </el-form-item>
            <el-form-item label="公钥接口">
              <el-input v-model="editingConfig.eas.apis.publicKey" />
            </el-form-item>
            <el-form-item label="课表查询">
              <el-input v-model="editingConfig.eas.apis.lessonTable" />
            </el-form-item>
            <el-form-item label="成绩查询">
              <el-input v-model="editingConfig.eas.apis.marks" />
            </el-form-item>
            <el-form-item label="考试查询">
              <el-input v-model="editingConfig.eas.apis.exam" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 校区配置 -->
        <el-tab-pane label="校区配置" name="campuses">
          <div class="campuses-list">
            <div
                v-for="(campus, index) in editingConfig.campuses"
                :key="index"
                class="campus-item"
            >
              <el-input
                  v-model="campus.value"
                  placeholder="校区值"
                  style="width: 100px"
              />
              <el-input
                  v-model="campus.label"
                  placeholder="校区名称"
                  style="flex: 1"
              />
              <el-button
                  type="danger"
                  :icon="Delete"
                  circle
                  size="small"
                  @click="removeCampus(index)"
              />
            </div>
            <el-button type="primary" size="small" @click="addCampus">
              <el-icon><Plus /></el-icon>
              添加校区
            </el-button>
          </div>
        </el-tab-pane>

        <!-- 导入配置 -->
        <el-tab-pane label="导入配置" name="import" v-if="!editMode">
          <el-form label-width="100px">
            <el-form-item label="配置JSON">
              <el-input
                  v-model="importJson"
                  type="textarea"
                  :rows="10"
                  placeholder="粘贴学校配置JSON..."
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="parseImportJson">
                解析配置
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="saveSchoolConfig" :loading="saving">
          {{ editMode ? '保存修改' : '添加学校' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Edit, Delete, Download } from '@element-plus/icons-vue';
import schoolService from '../services/schoolService';
import { PresetSchools } from '../constants/api';
import { getBlankTemplate } from '../constants/schoolConfig';

// 当前学校ID
const currentSchoolId = ref('');
// 当前学校配置
const currentConfig = reactive({});
// 显示添加对话框
const showAddDialog = ref(false);
// 编辑模式
const editMode = ref(false);
// 当前Tab
const activeTab = ref('basic');
// 保存中
const saving = ref(false);
// 导入JSON
const importJson = ref('');

// 编辑中的配置
const editingConfig = reactive(getBlankTemplate());

// 预置学校列表
const presetSchools = computed(() => {
  return schoolService.availableSchools.filter(s => s.isPreset);
});

// 自定义学校列表
const customSchools = computed(() => {
  return schoolService.availableSchools.filter(s => !s.isPreset);
});

// 是否为预置学校
const isPresetSchool = computed(() => {
  return PresetSchools[currentSchoolId.value] !== undefined;
});

// 初始化
onMounted(async () => {
  await schoolService.init();
  currentSchoolId.value = schoolService.currentSchoolId;
  Object.assign(currentConfig, schoolService.currentConfig);
});

// 切换学校
const handleSchoolChange = async (schoolId) => {
  const success = await schoolService.switchSchool(schoolId);
  if (success) {
    Object.assign(currentConfig, schoolService.currentConfig);
    ElMessage.success(`已切换到 ${currentConfig.name}`);
  } else {
    ElMessage.error('切换学校失败');
    currentSchoolId.value = schoolService.currentSchoolId;
  }
};

// 编辑当前学校
const editCurrentSchool = () => {
  const config = schoolService.getSchoolConfig(currentSchoolId.value);
  if (config) {
    Object.keys(editingConfig).forEach(key => delete editingConfig[key]);
    Object.assign(editingConfig, config);
    editMode.value = true;
    activeTab.value = 'basic';
    showAddDialog.value = true;
  }
};

// 删除当前学校
const deleteCurrentSchool = async () => {
  const result = await schoolService.removeCustomSchool(currentSchoolId.value);
  if (result.success) {
    ElMessage.success('删除成功');
    currentSchoolId.value = schoolService.currentSchoolId;
    Object.assign(currentConfig, schoolService.currentConfig);
  } else {
    ElMessage.error(result.error);
  }
};

// 导出当前配置
const exportCurrentConfig = () => {
  const json = schoolService.exportConfig(currentSchoolId.value);
  if (json) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSchoolId.value}_config.json`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('配置已导出');
  }
};

// 重置编辑配置
const resetEditingConfig = () => {
  const template = getBlankTemplate();
  Object.keys(editingConfig).forEach(key => delete editingConfig[key]);
  Object.assign(editingConfig, template);
  editMode.value = false;
  importJson.value = '';
};

// 添加主机节点
const addHost = () => {
  editingConfig.eas.hosts.push('');
};

// 移除主机节点
const removeHost = (index) => {
  editingConfig.eas.hosts.splice(index, 1);
};

// 添加校区
const addCampus = () => {
  editingConfig.campuses.push({ value: '', label: '' });
};

// 移除校区
const removeCampus = (index) => {
  editingConfig.campuses.splice(index, 1);
};

// 解析导入JSON
const parseImportJson = () => {
  try {
    const config = JSON.parse(importJson.value);
    Object.keys(editingConfig).forEach(key => delete editingConfig[key]);
    Object.assign(editingConfig, config);
    activeTab.value = 'basic';
    ElMessage.success('配置解析成功，请检查各项配置');
  } catch (error) {
    ElMessage.error('JSON格式错误');
  }
};

// 保存学校配置
const saveSchoolConfig = async () => {
  saving.value = true;
  try {
    let result;
    if (editMode.value) {
      result = await schoolService.updateCustomSchool(editingConfig.id, editingConfig);
    } else {
      result = await schoolService.addCustomSchool(editingConfig);
    }

    if (result.success) {
      ElMessage.success(editMode.value ? '保存成功' : '添加成功');
      showAddDialog.value = false;
      resetEditingConfig();

      // 刷新当前配置
      if (editMode.value && editingConfig.id === currentSchoolId.value) {
        Object.assign(currentConfig, schoolService.currentConfig);
      }
    } else {
      ElMessage.error(result.error);
    }
  } catch (error) {
    ElMessage.error('操作失败: ' + error.message);
  } finally {
    saving.value = false;
  }
};

// 对话框关闭时重置
const handleDialogClose = () => {
  resetEditingConfig();
};
</script>

<style scoped>
.school-config {
  padding: 16px;
}

.config-card {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.custom-school-actions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
  display: flex;
  gap: 8px;
}

.hosts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.host-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.host-item .el-input {
  flex: 1;
}

.campuses-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.campus-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

:deep(.el-descriptions) {
  margin-top: 16px;
}
</style>