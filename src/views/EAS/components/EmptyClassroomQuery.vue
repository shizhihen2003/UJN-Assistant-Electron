<template>
  <div class="empty-classroom-container">
    <el-card class="query-card" v-loading="loading">
      <el-form
          :model="queryForm"
          :rules="rules"
          ref="queryFormRef"
          label-width="100px"
          @submit.prevent="handleSearch">

        <!-- 学年学期选择 -->
        <el-form-item label="学年学期" prop="dm">
          <el-select v-model="queryForm.dm" placeholder="请选择学年学期" @change="handleTermChange">
            <el-option
                v-for="item in termOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value">
            </el-option>
          </el-select>
        </el-form-item>

        <!-- 校区选择 -->
        <el-form-item label="校区" prop="xqh_id">
          <el-select v-model="queryForm.xqh_id" placeholder="请选择校区" @change="handleCampusChange">
            <el-option
                v-for="item in campusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value">
            </el-option>
          </el-select>
        </el-form-item>

        <!-- 教学楼选择 -->
        <el-form-item label="教学楼" prop="lh">
          <el-select v-model="queryForm.lh" placeholder="请选择教学楼" clearable>
            <el-option
                v-for="item in buildingOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value">
            </el-option>
          </el-select>
        </el-form-item>

        <!-- 场地类别选择 -->
        <el-form-item label="场地类别" prop="cdlb_id">
          <el-select v-model="queryForm.cdlb_id" placeholder="请选择场地类别" clearable>
            <el-option
                v-for="item in roomTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value">
            </el-option>
          </el-select>
        </el-form-item>

        <!-- 座位数范围 -->
        <el-form-item label="座位数范围">
          <el-row :gutter="10">
            <el-col :span="11">
              <el-input-number v-model="queryForm.qszws" placeholder="最小座位数" :min="0"></el-input-number>
            </el-col>
            <el-col :span="2" class="text-center">至</el-col>
            <el-col :span="11">
              <el-input-number v-model="queryForm.jszws" placeholder="最大座位数" :min="0"></el-input-number>
            </el-col>
          </el-row>
        </el-form-item>

        <!-- 周次选择 -->
        <el-form-item label="周次" prop="weeks">
          <div class="weeks-selector">
            <div class="weeks-container">
              <el-button
                  v-for="week in 23"
                  :key="`week-${week}`"
                  size="small"
                  :type="selectedWeeks.includes(week) ? 'primary' : 'default'"
                  @click="toggleWeekSelection(week)">
                {{ week }}
              </el-button>
            </div>
            <el-button size="small" @click="clearWeekSelection">清空</el-button>
          </div>
        </el-form-item>

        <!-- 星期选择 -->
        <el-form-item label="星期" prop="days">
          <div class="days-selector">
            <div class="days-container">
              <el-button
                  v-for="day in 7"
                  :key="`day-${day}`"
                  size="small"
                  :type="selectedDays.includes(day) ? 'primary' : 'default'"
                  @click="toggleDaySelection(day)">
                {{ dayLabel(day) }}
              </el-button>
            </div>
            <el-button size="small" @click="clearDaySelection">清空</el-button>
          </div>
        </el-form-item>

        <!-- 节次选择 -->
        <el-form-item label="节次" prop="periods">
          <div class="periods-selector">
            <div class="periods-container">
              <el-button
                  v-for="period in 12"
                  :key="`period-${period}`"
                  size="small"
                  :type="selectedPeriods.includes(period) ? 'primary' : 'default'"
                  @click="togglePeriodSelection(period)">
                {{ period }}
              </el-button>
            </div>
            <el-button size="small" @click="clearPeriodSelection">清空</el-button>
          </div>
        </el-form-item>

        <!-- 提交按钮 -->
        <el-form-item>
          <el-button type="primary" @click="handleSearch" :loading="loading">查询</el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 查询结果列表 -->
    <el-card class="result-card" v-if="searchResults.length > 0">
      <template #header>
        <div class="result-header">
          <span>查询结果 (共 {{ total }} 条)</span>
        </div>
      </template>
      <el-table :data="searchResults" border stripe style="width: 100%">
        <el-table-column prop="cdmc" label="教室名称" min-width="120"></el-table-column>
        <el-table-column prop="jxlmc" label="教学楼" min-width="120"></el-table-column>
        <el-table-column prop="zws" label="座位数" width="80"></el-table-column>
        <el-table-column prop="cdlb" label="类型" width="120"></el-table-column>
        <el-table-column prop="sydxmc" label="状态" width="120"></el-table-column>
      </el-table>
      <div class="pagination-container">
        <el-pagination
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
            :current-page="currentPage"
            :page-sizes="[10, 20, 50, 100]"
            :page-size="pageSize"
            layout="total, sizes, prev, pager, next, jumper"
            :total="total">
        </el-pagination>
      </div>
    </el-card>

    <el-empty v-if="searched && searchResults.length === 0" description="没有找到符合条件的空教室"></el-empty>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import ipc from '@/utils/ipc';
import authService from '@/services/authService';
import classroomService from '@/services/classroomService';

export default {
  name: 'EmptyClassroomQuery',

  setup() {
    // 表单数据
    const queryFormRef = ref(null);
    const loading = ref(false);
    const searched = ref(false);

    // 分页数据
    const currentPage = ref(1);
    const pageSize = ref(20);
    const total = ref(0);

    // 选择数据
    const selectedWeeks = ref([]);
    const selectedDays = ref([]);
    const selectedPeriods = ref([]);

    // 查询结果
    const searchResults = ref([]);

    // 表单数据
    const queryForm = reactive({
      dm: '2024-12', // 默认2024-2025学年第二学期
      xqh_id: '1',   // 默认主校区
      lh: '',        // 教学楼，默认为空表示全部
      cdlb_id: '008', // 默认多媒体教室
      qszws: 0,      // 最小座位数
      jszws: 0,      // 最大座位数
      xnm: '2024',   // 学年，从dm解析出来的
      xqm: '12'      // 学期，从dm解析出来的
    });

    // 表单校验规则
    const rules = {
      dm: [
        { required: true, message: '请选择学年学期', trigger: 'change' }
      ],
      xqh_id: [
        { required: true, message: '请选择校区', trigger: 'change' }
      ]
    };

    // 下拉选项数据
    const termOptions = ref([]);
    const campusOptions = ref([]);
    const buildingOptions = ref([]);
    const roomTypeOptions = ref([]);

    // 方法
    const handleTermChange = () => {
      // 从学年学期中解析出学年和学期值
      const [xnm, xqm] = queryForm.dm.split('-');
      queryForm.xnm = xnm;
      queryForm.xqm = xqm;
    };

    // 监听校区变化并加载对应的教学楼数据
    const handleCampusChange = async (campusId) => {
      console.log(`校区变更为: ${campusId}`);
      // 清空当前教学楼选择
      queryForm.lh = '';
      // 加载新校区的教学楼数据
      await loadBuildingOptions(campusId);
    };

    const toggleWeekSelection = (week) => {
      const index = selectedWeeks.value.indexOf(week);
      if (index === -1) {
        selectedWeeks.value.push(week);
      } else {
        selectedWeeks.value.splice(index, 1);
      }
    };

    const toggleDaySelection = (day) => {
      const index = selectedDays.value.indexOf(day);
      if (index === -1) {
        selectedDays.value.push(day);
      } else {
        selectedDays.value.splice(index, 1);
      }
    };

    const togglePeriodSelection = (period) => {
      const index = selectedPeriods.value.indexOf(period);
      if (index === -1) {
        selectedPeriods.value.push(period);
      } else {
        selectedPeriods.value.splice(index, 1);
      }
    };

    const clearWeekSelection = () => {
      selectedWeeks.value = [];
    };

    const clearDaySelection = () => {
      selectedDays.value = [];
    };

    const clearPeriodSelection = () => {
      selectedPeriods.value = [];
    };

    const dayLabel = (day) => {
      // 星期几的中文标签
      return ['一', '二', '三', '四', '五', '六', '日'][day - 1] || day;
    };

    // 加载学年学期数据
    const loadTermOptions = async () => {
      loading.value = true;
      try {
        const response = await classroomService.getTermOptions();
        if (response.success) {
          termOptions.value = response.data;
          // 默认选择第一个选项
          if (termOptions.value.length > 0) {
            queryForm.dm = termOptions.value[0].value;
            handleTermChange();
          }
        } else {
          ElMessage.warning('加载学年学期数据失败');
        }
      } catch (error) {
        console.error('加载学年学期数据失败:', error);
        ElMessage.error('加载学年学期数据失败');
      } finally {
        loading.value = false;
      }
    };

    // 加载校区数据
    const loadCampusOptions = async () => {
      loading.value = true;
      try {
        const response = await classroomService.getCampusOptions();
        if (response.success) {
          campusOptions.value = response.data;
          // 默认选择第一个选项
          if (campusOptions.value.length > 0) {
            queryForm.xqh_id = campusOptions.value[0].value;
          }
        } else {
          ElMessage.warning('加载校区数据失败');
        }
      } catch (error) {
        console.error('加载校区数据失败:', error);
        ElMessage.error('加载校区数据失败');
      } finally {
        loading.value = false;
      }
    };

    // 加载教学楼数据
    const loadBuildingOptions = async (campusId) => {
      loading.value = true;
      try {
        const response = await classroomService.getBuildingOptions(campusId);
        if (response.success) {
          buildingOptions.value = response.data;
          console.log(`已加载 ${buildingOptions.value.length} 个教学楼选项`);
        } else {
          if (response.needLogin) {
            ElMessage.warning('未登录或会话已过期，请先登录教务系统');
          } else {
            ElMessage.warning('加载教学楼数据失败: ' + (response.error || '未知错误'));
          }
        }
      } catch (error) {
        console.error('加载教学楼数据失败:', error);
        ElMessage.error('加载教学楼数据失败');
      } finally {
        loading.value = false;
      }
    };

    // 加载场地类别数据
    const loadRoomTypeOptions = async () => {
      loading.value = true;
      try {
        const response = await classroomService.getRoomTypeOptions();
        if (response.success) {
          roomTypeOptions.value = response.data;
          // 默认选择多媒体教室
          if (roomTypeOptions.value.length > 0) {
            const multimedia = roomTypeOptions.value.find(item => item.value === '008');
            if (multimedia) {
              queryForm.cdlb_id = multimedia.value;
            } else {
              queryForm.cdlb_id = roomTypeOptions.value[0].value;
            }
          }
        } else {
          ElMessage.warning('加载场地类别数据失败');
        }
      } catch (error) {
        console.error('加载场地类别数据失败:', error);
        ElMessage.error('加载场地类别数据失败');
      } finally {
        loading.value = false;
      }
    };

    // 提交搜索请求
    const handleSearch = async () => {
      if (!queryFormRef.value) return;

      await queryFormRef.value.validate(async (valid) => {
        if (!valid) {
          ElMessage.warning('请检查输入内容');
          return false;
        }

        // 验证是否选择了必要的项目
        if (selectedWeeks.value.length === 0) {
          ElMessage.warning('请至少选择一个周次');
          return false;
        }

        if (selectedDays.value.length === 0) {
          ElMessage.warning('请至少选择一个星期');
          return false;
        }

        if (selectedPeriods.value.length === 0) {
          ElMessage.warning('请至少选择一个节次');
          return false;
        }

        // 开始查询
        loading.value = true;
        searched.value = true;

        try {
          // 构建查询参数
          const params = {
            fwzt: 'cx',  // 服务状态：查询
            xnm: queryForm.xnm,
            xqm: queryForm.xqm,
            xqh_id: queryForm.xqh_id,
            lh: queryForm.lh,
            cdlb_id: queryForm.cdlb_id,
            qszws: queryForm.qszws || '',
            jszws: queryForm.jszws || '',
            jyfs: '0',  // 借用方式：按周次借用
            zcd: calculateZcd(selectedWeeks.value),
            xqj: selectedDays.value.join(','),
            jcd: calculateJcd(selectedPeriods.value),
            'queryModel.showCount': pageSize.value,
            'queryModel.currentPage': currentPage.value,
            'queryModel.sortName': 'cdbh',
            'queryModel.sortOrder': 'asc'
          };

          const result = await classroomService.queryEmptyClassrooms(params);

          if (result.success) {
            searchResults.value = result.items;
            total.value = result.totalCount;

            if (searchResults.value.length === 0) {
              ElMessage.info('未找到符合条件的空教室');
            }
          } else {
            if (result.needLogin) {
              ElMessage.error('用户未登录或会话已过期，请重新登录');
            } else {
              ElMessage.error(result.error || '查询失败');
            }
            searchResults.value = [];
            total.value = 0;
          }
        } catch (error) {
          console.error('查询空教室失败:', error);
          ElMessage.error('查询空教室失败: ' + (error.message || '未知错误'));
          searchResults.value = [];
          total.value = 0;
        } finally {
          loading.value = false;
        }
      });
    };

    // 重置表单
    const resetForm = () => {
      if (queryFormRef.value) {
        queryFormRef.value.resetFields();
        selectedWeeks.value = [];
        selectedDays.value = [];
        selectedPeriods.value = [];
        searchResults.value = [];
        searched.value = false;
      }
    };

    // 分页处理
    const handleSizeChange = (size) => {
      pageSize.value = size;
      handleSearch();
    };

    const handleCurrentChange = (page) => {
      currentPage.value = page;
      handleSearch();
    };

    // 计算周次的二进制表示
    const calculateZcd = (weeks) => {
      let zcd = 0;
      for (const week of weeks) {
        zcd += Math.pow(2, week - 1);
      }
      return zcd;
    };

    // 计算节次的二进制表示
    const calculateJcd = (periods) => {
      let jcd = 0;
      for (const period of periods) {
        jcd += Math.pow(2, period - 1);
      }
      return jcd;
    };

    // 初始化
    onMounted(async () => {
      // 加载所有选项数据
      await Promise.all([
        loadTermOptions(),
        loadCampusOptions(),
        loadRoomTypeOptions()
      ]);

      // 如果已经获取到校区数据，加载默认校区的教学楼
      if (campusOptions.value.length > 0 && queryForm.xqh_id) {
        await loadBuildingOptions(queryForm.xqh_id);
      }

      // 检查是否已登录
      try {
        const isLoggedIn = await authService.checkEasLogin();
        if (!isLoggedIn) {
          ElMessage.warning('请先登录教务系统，以便查询空教室');
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
      }
    });

    return {
      queryFormRef,
      queryForm,
      rules,
      loading,
      searched,
      searchResults,
      selectedWeeks,
      selectedDays,
      selectedPeriods,
      termOptions,
      campusOptions,
      buildingOptions,
      roomTypeOptions,
      currentPage,
      pageSize,
      total,
      handleTermChange,
      handleCampusChange,
      toggleWeekSelection,
      toggleDaySelection,
      togglePeriodSelection,
      clearWeekSelection,
      clearDaySelection,
      clearPeriodSelection,
      dayLabel,
      handleSearch,
      resetForm,
      handleSizeChange,
      handleCurrentChange
    };
  }
};
</script>

<style scoped>
.empty-classroom-container {
  padding: 20px;
}

.query-card {
  margin-bottom: 20px;
}

.result-card {
  margin-top: 20px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pagination-container {
  margin-top: 20px;
  text-align: right;
}

.text-center {
  text-align: center;
  line-height: 40px;
}

.weeks-selector, .days-selector, .periods-selector {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.weeks-container, .days-container, .periods-container {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-right: 10px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .weeks-container .el-button,
  .days-container .el-button,
  .periods-container .el-button {
    margin: 2px;
    padding: 6px 10px;
  }
}
</style>