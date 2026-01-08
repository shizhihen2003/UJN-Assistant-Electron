<template>
  <el-dialog
    v-model="visible"
    :title="currentStep === 'select' ? '欢迎使用校园助手' : '添加学校配置'"
    width="650px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    center
  >
    <!-- 步骤1: 选择学校 -->
    <div v-if="currentStep === 'select'" class="setup-content">
      <div class="setup-icon">
        <el-icon :size="64" color="#007AFF"><School /></el-icon>
      </div>
      
      <p class="setup-desc">
        首次使用，请选择您的学校，以便获取正确的教务系统配置。
      </p>
      
      <el-form label-width="80px" style="margin-top: 24px;">
        <el-form-item label="选择学校">
          <el-select 
            v-model="selectedSchoolId" 
            placeholder="请选择您的学校"
            style="width: 100%"
            size="large"
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
      </el-form>
      
      <div class="add-school-link">
        <el-button type="primary" link @click="goToAddSchool">
          <el-icon><Plus /></el-icon>
          我的学校不在列表中，添加学校配置
        </el-button>
      </div>
    </div>

    <!-- 步骤2: 添加学校 -->
    <div v-else-if="currentStep === 'add'" class="add-school-content">
      <el-tabs v-model="activeTab">
        <!-- 基本信息 -->
        <el-tab-pane label="基本信息" name="basic">
          <el-form :model="newSchoolConfig" label-width="100px">
            <el-form-item label="学校ID" required>
              <el-input 
                v-model="newSchoolConfig.id" 
                placeholder="英文简称，如 pku, tsinghua"
              />
              <div class="form-tip">唯一标识，只能使用小写字母</div>
            </el-form-item>
            <el-form-item label="学校名称" required>
              <el-input v-model="newSchoolConfig.name" placeholder="如：北京大学" />
            </el-form-item>
            <el-form-item label="学校简称">
              <el-input v-model="newSchoolConfig.shortName" placeholder="如：北大" />
            </el-form-item>
          </el-form>
        </el-tab-pane>
        
        <!-- VPN配置 -->
        <el-tab-pane label="VPN配置" name="vpn">
          <el-form :model="newSchoolConfig.vpn" label-width="100px">
            <el-form-item label="启用VPN">
              <el-switch v-model="newSchoolConfig.vpn.enabled" />
              <span class="form-tip" style="margin-left: 10px;">校外访问需要开启</span>
            </el-form-item>
            <template v-if="newSchoolConfig.vpn.enabled">
              <el-form-item label="VPN主机" required>
                <el-input 
                  v-model="newSchoolConfig.vpn.host" 
                  placeholder="如：webvpn.pku.edu.cn"
                />
              </el-form-item>
              <el-form-item label="VPN登录URL">
                <el-input 
                  v-model="newSchoolConfig.vpn.loginUrl" 
                  placeholder="如：https://webvpn.pku.edu.cn/"
                />
              </el-form-item>
              <el-form-item label="加密密钥">
                <el-input 
                  v-model="newSchoolConfig.vpn.encryptKey" 
                  placeholder="默认：wrdvpnisthebest"
                />
                <div class="form-tip">大多数学校使用默认密钥，无需修改</div>
              </el-form-item>
            </template>
          </el-form>
        </el-tab-pane>
        
        <!-- 统一认证 -->
        <el-tab-pane label="统一认证" name="sso">
          <el-form :model="newSchoolConfig.sso" label-width="100px">
            <el-form-item label="认证类型">
              <el-select v-model="newSchoolConfig.sso.type" style="width: 100%">
                <el-option label="CAS认证" value="cas" />
                <el-option label="OAuth认证" value="oauth" />
                <el-option label="天翼认证 (TPass)" value="tpass" />
                <el-option label="自定义" value="custom" />
              </el-select>
            </el-form-item>
            <el-form-item label="SSO主机" required>
              <el-input 
                v-model="newSchoolConfig.sso.host" 
                placeholder="如：sso.pku.edu.cn"
              />
            </el-form-item>
            <el-form-item label="登录URL">
              <el-input 
                v-model="newSchoolConfig.sso.loginUrl" 
                placeholder="如：https://sso.pku.edu.cn/cas/login"
              />
            </el-form-item>
          </el-form>
        </el-tab-pane>
        
        <!-- 教务系统 -->
        <el-tab-pane label="教务系统" name="eas">
          <el-form :model="newSchoolConfig.eas" label-width="100px">
            <el-form-item label="系统类型">
              <el-select v-model="newSchoolConfig.eas.type" style="width: 100%">
                <el-option label="新正方教务系统" value="zhengfang_new" />
                <el-option label="正方教务系统" value="zhengfang" />
                <el-option label="金智教务系统" value="kingosoft" />
                <el-option label="URP教务系统" value="urpclass" />
                <el-option label="自定义系统" value="custom" />
              </el-select>
            </el-form-item>
            
            <el-form-item label="教务主机" required>
              <div class="hosts-list">
                <div 
                  v-for="(host, index) in newSchoolConfig.eas.hosts" 
                  :key="index"
                  class="host-item"
                >
                  <el-input 
                    v-model="newSchoolConfig.eas.hosts[index]" 
                    placeholder="如：jwxt.pku.edu.cn"
                  />
                  <el-button 
                    type="danger" 
                    :icon="Delete" 
                    circle 
                    size="small"
                    @click="removeHost(index)"
                    :disabled="newSchoolConfig.eas.hosts.length <= 1"
                  />
                </div>
                <el-button type="primary" size="small" @click="addHost">
                  <el-icon><Plus /></el-icon>
                  添加节点
                </el-button>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 导入配置 -->
        <el-tab-pane label="导入JSON" name="import">
          <el-form label-width="100px">
            <el-alert 
              title="如果您有其他用户分享的学校配置JSON，可以在此导入" 
              type="info" 
              :closable="false"
              style="margin-bottom: 16px"
            />
            <el-form-item label="配置JSON">
              <el-input 
                v-model="importJson" 
                type="textarea" 
                :rows="8"
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
    </div>
    
    <template #footer>
      <!-- 选择学校步骤 -->
      <template v-if="currentStep === 'select'">
        <el-button 
          type="primary" 
          size="large"
          :disabled="!selectedSchoolId"
          @click="confirmSelection"
          style="width: 100%"
        >
          确认并开始使用
        </el-button>
      </template>
      
      <!-- 添加学校步骤 -->
      <template v-else>
        <el-button @click="backToSelect">返回选择</el-button>
        <el-button type="primary" @click="saveNewSchool" :loading="saving">
          保存并使用此学校
        </el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { School, InfoFilled, Plus, Delete } from '@element-plus/icons-vue';
import schoolService from '@/services/schoolService';
import { getBlankTemplate } from '@/constants/schoolConfig';
import store from '@/utils/store';

const emit = defineEmits(['completed']);

// 对话框可见性
const visible = ref(false);

// 当前步骤: 'select' | 'add'
const currentStep = ref('select');

// 选中的学校ID
const selectedSchoolId = ref('');

// 可用学校列表
const availableSchools = ref([]);

// 预置学校
const presetSchools = computed(() => {
  return availableSchools.value.filter(s => s.isPreset);
});

// 自定义学校
const customSchools = computed(() => {
  return availableSchools.value.filter(s => !s.isPreset);
});

// 当前Tab
const activeTab = ref('basic');

// 保存中
const saving = ref(false);

// 导入JSON
const importJson = ref('');

// 新学校配置
const newSchoolConfig = reactive(getBlankTemplate());

// 初始化
onMounted(async () => {
  await initSchools();
});

// 初始化学校列表
const initSchools = async () => {
  if (!schoolService._initialized) {
    await schoolService.init();
  }
  
  availableSchools.value = schoolService.availableSchools;
  
  if (availableSchools.value.length > 0) {
    selectedSchoolId.value = availableSchools.value[0].id;
  }
};

// 显示对话框
const show = () => {
  currentStep.value = 'select';
  visible.value = true;
};

// 进入添加学校步骤
const goToAddSchool = () => {
  // 重置配置
  const template = getBlankTemplate();
  Object.keys(newSchoolConfig).forEach(key => delete newSchoolConfig[key]);
  Object.assign(newSchoolConfig, template);
  activeTab.value = 'basic';
  importJson.value = '';
  currentStep.value = 'add';
};

// 返回选择步骤
const backToSelect = () => {
  currentStep.value = 'select';
};

// 添加主机节点
const addHost = () => {
  newSchoolConfig.eas.hosts.push('');
};

// 移除主机节点
const removeHost = (index) => {
  newSchoolConfig.eas.hosts.splice(index, 1);
};

// 解析导入JSON
const parseImportJson = () => {
  try {
    const config = JSON.parse(importJson.value);
    Object.keys(newSchoolConfig).forEach(key => delete newSchoolConfig[key]);
    Object.assign(newSchoolConfig, config);
    activeTab.value = 'basic';
    ElMessage.success('配置解析成功，请检查各项配置');
  } catch (error) {
    ElMessage.error('JSON格式错误');
  }
};

// 保存新学校
const saveNewSchool = async () => {
  // 验证必填项
  if (!newSchoolConfig.id) {
    ElMessage.warning('请填写学校ID');
    activeTab.value = 'basic';
    return;
  }
  if (!newSchoolConfig.name) {
    ElMessage.warning('请填写学校名称');
    activeTab.value = 'basic';
    return;
  }
  if (!newSchoolConfig.eas.hosts || newSchoolConfig.eas.hosts.filter(h => h).length === 0) {
    ElMessage.warning('请至少填写一个教务主机地址');
    activeTab.value = 'eas';
    return;
  }

  saving.value = true;
  try {
    // 过滤空的 hosts
    newSchoolConfig.eas.hosts = newSchoolConfig.eas.hosts.filter(h => h);
    
    // 添加学校
    const result = await schoolService.addCustomSchool(newSchoolConfig);
    
    if (result.success) {
      // 切换到新学校
      await schoolService.switchSchool(newSchoolConfig.id);
      
      // 刷新列表
      await initSchools();
      
      // 标记已完成首次设置
      await store.putBoolean('SCHOOL_SETUP_COMPLETED', true);
      
      visible.value = false;
      ElMessage.success(`已添加并选择 ${newSchoolConfig.name}`);
      
      emit('completed', newSchoolConfig.id);
    } else {
      ElMessage.error(result.error || '添加失败');
    }
  } catch (error) {
    console.error('添加学校失败:', error);
    ElMessage.error('添加失败: ' + error.message);
  } finally {
    saving.value = false;
  }
};

// 确认选择
const confirmSelection = async () => {
  if (!selectedSchoolId.value) {
    ElMessage.warning('请选择学校');
    return;
  }
  
  try {
    const success = await schoolService.switchSchool(selectedSchoolId.value);
    
    if (success) {
      await store.putBoolean('SCHOOL_SETUP_COMPLETED', true);
      
      visible.value = false;
      ElMessage.success(`已选择 ${schoolService.schoolName}`);
      
      emit('completed', selectedSchoolId.value);
    } else {
      ElMessage.error('设置失败，请重试');
    }
  } catch (error) {
    console.error('设置学校失败:', error);
    ElMessage.error('设置失败: ' + error.message);
  }
};

// 暴露方法
defineExpose({
  show
});
</script>

<style scoped>
.setup-content {
  text-align: center;
  padding: 20px 0;
}

.setup-icon {
  margin-bottom: 20px;
}

.setup-desc {
  font-size: 16px;
  color: #606266;
  line-height: 1.6;
}

.add-school-link {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px dashed #dcdfe6;
}

.add-school-content {
  padding: 10px 0;
}

.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.hosts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.host-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.host-item .el-input {
  flex: 1;
}
</style>
