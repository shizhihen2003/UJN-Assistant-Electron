<template>
  <div class="ai-chat-container">
    <!-- 需要登录的遮罩层 -->
    <div v-if="!isAuthenticated" class="auth-overlay">
      <div class="auth-card">
        <el-icon class="auth-icon"><Lock /></el-icon>
        <h2>需要登录</h2>
        <p>使用AI助手功能需要先登录教务系统或智慧济大账号</p>
        <div class="auth-buttons">
          <router-link to="/login/eas">
            <el-button type="primary">登录教务系统</el-button>
          </router-link>
          <router-link to="/login/ipass">
            <el-button>登录智慧济大</el-button>
          </router-link>
        </div>
      </div>
    </div>

    <!-- 侧边栏(对话列表) -->
    <div class="chat-sidebar" :class="{ 'collapsed': isSidebarCollapsed }">
      <div class="sidebar-header">
        <el-button type="primary" @click="newConversation">
          <el-icon><Plus /></el-icon>
          <span v-if="!isSidebarCollapsed">新对话</span>
        </el-button>
        <el-button @click="toggleSidebar" class="toggle-button">
          <el-icon v-if="!isSidebarCollapsed"><ArrowLeft /></el-icon>
          <el-icon v-else><ArrowRight /></el-icon>
        </el-button>
      </div>

      <div class="conversations-list" v-show="!isSidebarCollapsed">
        <el-empty v-if="conversations.length === 0" description="暂无历史对话" />
        <div v-else>
          <div
              v-for="conv in conversations"
              :key="conv.id"
              class="conversation-item"
              :class="{ 'active': currentConversationId === conv.id }"
              @click="loadConversation(conv.id)"
          >
            <span class="conversation-title">{{ getConversationTitle(conv) }}</span>
            <span class="conversation-time">{{ formatTime(conv.lastUpdated) }}</span>
            <el-dropdown trigger="click" @command="handleConvAction">
              <el-button size="small" circle>
                <el-icon><More /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :command="{ action: 'rename', id: conv.id }">重命名</el-dropdown-item>
                  <el-dropdown-item :command="{ action: 'delete', id: conv.id }">删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>
    </div>

    <!-- 主聊天区域 -->
    <div class="chat-main">
      <div class="chat-header">
        <div class="chat-title">
          {{ currentConversationTitle || '新对话' }}
        </div>
        <div class="chat-actions">
          <el-tooltip content="清空对话">
            <el-button link @click="clearChat">
              <el-icon><Delete /></el-icon>
            </el-button>
          </el-tooltip>

          <!-- 添加语音设置按钮 -->
          <el-tooltip content="语音设置">
            <el-button link @click="showSpeechSettings = true">
              <el-icon><Headset /></el-icon>
            </el-button>
          </el-tooltip>

          <el-tooltip content="语音对话模式">
            <el-switch
                v-model="voiceConversationMode"
                @change="handleVoiceConversationModeChange"
                active-color="#13ce66"
                inactive-color="#909399">
            </el-switch>
          </el-tooltip>

          <el-tooltip content="设置">
            <el-button link @click="showSettings = true">
              <el-icon><Setting /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>

      <!-- 消息区域 -->
      <div class="chat-messages" ref="chatMessagesRef">
        <div v-if="messages.length === 0" class="empty-chat">
          <img src="@/assets/ai-logo.png" alt="AI Logo" class="ai-logo" />
          <h2>UJN AI助手</h2>
          <p>有什么可以帮助你的吗？我可以基于你的学习数据提供个性化建议。</p>
          <div class="ai-suggestions">
            <div class="suggestion-chip" @click="useTemplate('成绩分析')">分析我的成绩</div>
            <div class="suggestion-chip" @click="useTemplate('课表优化')">优化我的学习计划</div>
            <div class="suggestion-chip" @click="useTemplate('考试准备')">帮我准备考试</div>
            <div class="suggestion-chip" @click="useTemplate('通用问题')">我有其他问题</div>
          </div>
        </div>

        <div v-else>
          <div
              v-for="(message, index) in messages"
              :key="index"
              class="message-container"
              :class="{
                'user-message': message.role === 'user',
                'assistant-message': message.role === 'assistant',
                'streaming-message': message.role === 'assistant' && index === messages.length - 1 && isLoading
              }"
          >
            <div class="message-avatar">
              <el-avatar v-if="message.role === 'user'" :size="36">{{ userInitials }}</el-avatar>
              <el-avatar v-else :size="36" src="@/assets/ai-avatar.png">AI</el-avatar>
            </div>
            <div class="message-content">
              <div class="message-header">
                <span class="message-sender">{{ message.role === 'user' ? userName : 'AI助手' }}</span>
                <span class="message-time">{{ formatTime(message.timestamp) }}</span>
              </div>

              <!-- 思考状态指示器 -->
              <div v-if="message.role === 'assistant' && index === messages.length - 1 && isThinking" class="thinking-indicator">
                <div class="thinking-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span class="thinking-text">AI正在思考中...</span>
              </div>

              <!-- 用户消息直接显示 -->
              <div v-if="message.role === 'user'"
                   class="message-body"
                   v-html="formatMessage(message.content)">
              </div>

              <!-- AI消息：思维链显示区域 -->
              <div v-if="message.role === 'assistant' && showThinkingChain && (message.thinking || (index === messages.length - 1 && (currentThinking || isThinking || isLoading)))"
                   class="thinking-chain-container">
                <div class="thinking-chain-header" @click="thinkingCollapsed = !thinkingCollapsed">
                  <div class="thinking-chain-title">
                    <el-icon><Brain /></el-icon>
                    <span>推理过程</span>
                    <span class="thinking-count" v-if="message.thinking || currentThinking">
        ({{ (message.thinking || currentThinking).length }} 字符)
      </span>
                  </div>
                  <el-icon class="collapse-icon" :class="{ 'collapsed': thinkingCollapsed }">
                    <ArrowDown />
                  </el-icon>
                </div>

                <div v-show="!thinkingCollapsed" class="thinking-chain-content">
                  <div
                      class="thinking-chain-body"
                      :data-thinking-ref="index"
                      v-html="formatMessage(message.thinking || (index === messages.length - 1 ? currentThinking : ''))"
                  ></div>
                </div>
              </div>

              <!-- AI消息：最终答案区域 -->
              <div v-if="message.role === 'assistant'" class="final-answer-container">
                <div v-if="showThinkingChain && (message.thinking || (index === messages.length - 1 && (currentThinking || isThinking || isLoading)))" class="answer-header">
                  <el-icon><Lightbulb /></el-icon>
                  <span>最终回答</span>
                </div>

                <div
                    class="message-body final-answer-body"
                    :class="{ 'has-thinking-chain': showThinkingChain && (message.thinking || (index === messages.length - 1 && (currentThinking || isThinking || isLoading))) }"
                    :data-answer-ref="index"
                    v-show="!(index === messages.length - 1 && isThinking && !finalAnswer)"
                    v-html="formatMessage(message.content || (index === messages.length - 1 ? finalAnswer : ''))"
                ></div>
              </div>

              <div class="message-actions" v-if="message.role === 'assistant' && (message.content || (index === messages.length - 1 && finalAnswer))">
                <el-button link size="small" @click="copyMessageContent(message.content || finalAnswer)">
                  <el-icon><CopyDocument /></el-icon> 复制回答
                </el-button>
                <el-button v-if="message.thinking || (index === messages.length - 1 && currentThinking)"
                           link size="small"
                           @click="copyMessageContent(message.thinking || currentThinking)">
                  <el-icon><CopyDocument /></el-icon> 复制推理
                </el-button>
                <!-- 添加朗读按钮 -->
                <el-button
                    link
                    size="small"
                    @click="speakMessage(message.content || finalAnswer, index)"
                    :class="{ 'speaking': isSpeaking && currentSpeakingIndex === index }"
                >
                  <el-icon><Headset /></el-icon>
                  <span v-if="isSpeaking && currentSpeakingIndex === index">
                    <span class="reading-progress-text">朗读中</span>
                    <span class="reading-dots">
                      <span>.</span><span>.</span><span>.</span>
                    </span>
                    <span>(点击停止)</span>
                  </span>
                  <span v-else>朗读</span>
                </el-button>
              </div>
            </div>
          </div>

          <!-- 修改加载指示器 -->
          <div v-if="isLoading && !isThinking" class="loading-container">
            <div class="dots-loader">
              <div></div>
              <div></div>
              <div></div>
            </div>
            <span class="loading-text">正在生成回复...</span>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="chat-input">
        <el-input
            v-model="inputMessage"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 4 }"
            placeholder="输入消息，按Enter发送，Shift+Enter换行"
            @keydown.enter.prevent="handleEnterKey"
            :disabled="isLoading || isRecognizing"
        />
        <div v-if="isRecognizing" class="voice-wave-container">
          <div class="voice-wave">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div class="recognition-text">{{ recognitionResult || '正在聆听...' }}</div>
        </div>
        <div class="input-actions">
          <!-- 添加语音输入按钮 -->
          <el-button
              @click="toggleVoiceInput"
              :type="isRecognizing ? 'danger' : 'default'"
              :disabled="isVoiceButtonDisabled || isLoading"
              class="voice-btn"
              :class="{ 'recording': isRecognizing }"
          >
            <el-icon><Microphone v-if="!isRecognizing" /><Close v-else /></el-icon>
            {{ isRecognizing ? '停止录音' : '语音输入' }}
          </el-button>

          <el-button type="primary" @click="sendMessage" :loading="isLoading" :disabled="!inputMessage.trim()">
            <el-icon><Position /></el-icon>
            发送
          </el-button>
        </div>
      </div>
    </div>

    <!-- 设置对话框 -->
    <el-dialog v-model="showSettings" title="AI助手设置" width="500px">
      <el-form label-position="top">
        <el-form-item label="服务类型">
          <el-radio-group v-model="settings.serviceType">
            <el-radio value="deepseek">DeepSeek在线服务</el-radio>
            <el-radio value="ollama">本地Ollama</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- DeepSeek配置 -->
        <template v-if="settings.serviceType === 'deepseek'">
          <el-form-item label="API Key">
            <el-input v-model="settings.apiKey" placeholder="输入DeepSeek API Key" show-password />
          </el-form-item>
          <el-form-item label="API URL">
            <el-input v-model="settings.apiUrl" placeholder="DeepSeek API URL" />
          </el-form-item>
          <el-form-item label="模型">
            <el-select v-model="settings.model" style="width: 100%">
              <el-option label="DeepSeek Chat" value="deepseek-chat" />
              <el-option label="DeepSeek Reasoner" value="deepseek-reasoner" />
            </el-select>
          </el-form-item>
        </template>

        <!-- Ollama配置 -->
        <template v-if="settings.serviceType === 'ollama'">
          <el-form-item label="Ollama服务地址">
            <el-input
                v-model="settings.ollamaUrl"
                placeholder="http://localhost:11434"
            />
            <div class="setting-description">
              本地Ollama服务的地址，默认为 http://localhost:11434
            </div>
          </el-form-item>

          <el-form-item>
            <el-button @click="autoDetectModels" :loading="refreshingModels">
              <el-icon><Refresh /></el-icon>
              自动检测模型
            </el-button>
            <el-button @click="testOllamaConnection" :loading="testingConnection">
              <el-icon><Connection /></el-icon>
              测试连接
            </el-button>
          </el-form-item>

          <el-form-item label="可用模型" v-if="availableModels.length > 0">
            <el-select v-model="settings.ollamaModel" style="width: 100%" placeholder="选择模型">
              <el-option-group
                  v-for="group in groupedModels"
                  :key="group.label"
                  :label="group.label"
              >
                <el-option
                    v-for="model in group.models"
                    :key="model.name"
                    :label="model.displayName"
                    :value="model.name"
                >
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>{{ model.displayName }}</span>
                    <span style="color: #8492a6; font-size: 12px;">{{ model.size }}</span>
                  </div>
                </el-option>
              </el-option-group>
            </el-select>
            <div class="setting-description">
              当前已检测到 {{ availableModels.length }} 个模型。如果列表为空，请确保Ollama服务已启动并已下载模型。
            </div>
          </el-form-item>

          <el-form-item v-else-if="!refreshingModels">
            <el-alert
                title="未检测到模型"
                type="warning"
                :closable="false"
                show-icon
            >
              <template #default>
                <p>未检测到本地模型，请确认：</p>
                <ol style="margin: 8px 0; padding-left: 20px;">
                  <li>Ollama服务已启动 (运行: <code>ollama serve</code>)</li>
                  <li>已下载模型 (运行: <code>ollama pull &lt;模型名称&gt;</code>)</li>
                  <li>服务地址正确: {{ settings.ollamaUrl }}</li>
                </ol>
                <p style="margin-top: 8px; font-size: 13px; color: #666;">
                  可通过 <code>ollama list</code> 查看已安装的模型
                </p>
              </template>
            </el-alert>
          </el-form-item>

          <el-form-item v-if="settings.ollamaModel" label="模型信息">
            <el-descriptions :column="1" size="small" border>
              <el-descriptions-item label="模型名称">
                {{ settings.ollamaModel }}
              </el-descriptions-item>
              <el-descriptions-item label="模型大小" v-if="selectedModelInfo">
                {{ selectedModelInfo.size }}
              </el-descriptions-item>
              <el-descriptions-item label="修改时间" v-if="selectedModelInfo">
                {{ formatDate(selectedModelInfo.modified_at) }}
              </el-descriptions-item>
            </el-descriptions>
          </el-form-item>
        </template>

        <el-form-item label="系统提示词">
          <el-input
              v-model="settings.systemPrompt"
              type="textarea"
              :rows="3"
              placeholder="设置AI助手的行为指南"
          />
        </el-form-item>

        <el-form-item label="个性化设置">
          <el-switch
              v-model="settings.shareStudentData"
              active-text="分享学生数据 (获取个性化回答)"
              inactive-text="不分享学生数据"
          />
          <div class="setting-description" v-if="settings.shareStudentData">
            启用后，AI将可以访问你的课表、成绩和考试信息以提供个性化建议。所有数据仅在本地处理，不会上传或储存到外部服务器。
          </div>
        </el-form-item>

        <el-form-item label="思维链显示">
          <el-switch
              v-model="showThinkingChain"
              active-text="显示AI推理过程"
              inactive-text="仅显示最终答案"
          />
          <div class="setting-description">
            启用后，将显示AI的完整推理过程，包括思考步骤和最终答案。适用于支持推理链的模型（如deepseek-reasoner）。
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
    <span class="dialog-footer">
      <el-button @click="showSettings = false">取消</el-button>
      <el-button type="primary" @click="saveSettings">保存</el-button>
    </span>
      </template>
    </el-dialog>

    <!-- 语音设置对话框 -->
    <el-dialog v-model="showSpeechSettings" title="语音设置" width="500px">
      <el-form label-position="top">
        <el-form-item label="讯飞开放平台 AppID">
          <el-input v-model="speechSettings.appId" placeholder="输入讯飞开放平台AppID" />
        </el-form-item>
        <el-form-item label="语音识别 API Key">
          <el-input v-model="speechSettings.iatApiKey" placeholder="输入语音识别API Key" show-password />
        </el-form-item>
        <el-form-item label="语音识别 API Secret">
          <el-input v-model="speechSettings.iatApiSecret" placeholder="输入语音识别API Secret" show-password />
        </el-form-item>
        <el-form-item label="语音合成 API Key">
          <el-input v-model="speechSettings.ttsApiKey" placeholder="输入语音合成API Key" show-password />
        </el-form-item>
        <el-form-item label="语音合成 API Secret">
          <el-input v-model="speechSettings.ttsApiSecret" placeholder="输入语音合成API Secret" show-password />
        </el-form-item>
        <el-form-item label="发音人">
          <el-select v-model="speechSettings.voice" style="width: 100%">
            <el-option label="讯飞小燕" value="xiaoyan" />
            <el-option label="讯飞小宇" value="xiaoyu" />
            <el-option label="讯飞小思" value="xiaoice" />
            <el-option label="讯飞小梅" value="xiaomei" />
            <el-option label="讯飞小莉" value="xiaolin" />
            <el-option label="讯飞小蓉" value="xiaorong" />
            <el-option label="讯飞小芸" value="xiaoyun" />
            <el-option label="讯飞小坤" value="xiaokun" />
            <el-option label="讯飞小强" value="xiaoqiang" />
            <el-option label="讯飞小莹" value="xiaoying" />
          </el-select>
        </el-form-item>
        <el-form-item label="自动朗读设置">
          <el-switch
              v-model="autoReadMessages"
              active-text="自动朗读AI回复"
              inactive-text="手动朗读">
          </el-switch>
        </el-form-item>
        <el-form-item label="语速">
          <el-slider v-model="speechSettings.speed" :min="0" :max="100" />
        </el-form-item>
        <el-form-item label="音量">
          <el-slider v-model="speechSettings.volume" :min="0" :max="100" />
        </el-form-item>
        <el-form-item label="音调">
          <el-slider v-model="speechSettings.pitch" :min="0" :max="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showSpeechSettings = false">取消</el-button>
          <el-button type="primary" @click="saveSpeechSettings">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 重命名对话框 -->
    <el-dialog v-model="showRenameDialog" title="重命名对话" width="400px">
      <el-input v-model="renameTitle" placeholder="输入新标题" />
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showRenameDialog = false">取消</el-button>
          <el-button type="primary" @click="confirmRename">确认</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 删除确认对话框 -->
    <el-dialog v-model="showDeleteDialog" title="删除对话" width="400px">
      <p>确定要删除此对话吗？此操作无法撤销。</p>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showDeleteDialog = false">取消</el-button>
          <el-button type="danger" @click="confirmDelete">删除</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 语音对话模式覆盖层 -->
    <voice-chat
        ref="voiceChatRef"
        :active="voiceChatMode"
        @start-listening="startVoiceRecognition"
        @stop-listening="stopVoiceRecognition"
        @speech-result="handleVoiceCommand"
        @stop-speaking="stopAllSpeechActivities"
        @exit-voice-mode="exitVoiceChatMode"
        @prepare-next-turn="handlePrepareTurn"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick, watch, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus, ArrowLeft, ArrowRight, Delete, Setting,
  CopyDocument, Position, More, ChatRound, Lock,
  Microphone, Close, Headset,
  Refresh, Connection,
  // 更好的图标替代
  Cpu as Brain,           // CPU图标）
  Star as Lightbulb,      // 星星图标
  ArrowDown              // 向下箭头图标
} from '@element-plus/icons-vue';
import { debounce } from 'lodash';
import aiAssistantService from '@/services/aiAssistantService';
import authService from '@/services/authService';
import speechService from '@/services/speechService';
import ipc from '@/utils/ipc';
import store from '@/utils/store';

// 导入语音聊天组件
import VoiceChat from './VoiceChat.vue';

// 路由在setup顶层获取
const route = useRoute();

// 用于标记库的引用
const marked = ref(null);
const DOMPurify = ref(null);
const hljs = ref(null);

// 认证状态检查
const isAuthenticated = ref(false);

const streamingElementRef = ref(null);
const voiceChatRef = ref(null);

// 日志记录函数
function logDebug(...args) {
  console.log('[AI Chat]', ...args);
}

/**
 * 解析思维链内容
 */
const parseThinkingContent = (text) => {
  // 匹配 <think>...</think> 标签
  const thinkingRegex = /<think>([\s\S]*?)<\/think>/g;
  const matches = [];
  let match;

  while ((match = thinkingRegex.exec(text)) !== null) {
    matches.push(match[1]);
  }

  return matches.join('\n\n');
};

/**
 * 移除思维链标签，获取最终答案
 */
const extractFinalAnswer = (text) => {
  // 移除所有 <think>...</think> 标签及其内容
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
};

/**
 * 检查文本是否包含思维链开始标签
 */
const hasThinkingStart = (text) => {
  return text.includes('<think>');
};

/**
 * 检查文本是否包含完整的思维链
 */
const hasCompleteThinking = (text) => {
  return /<think>[\s\S]*?<\/think>/.test(text);
};

/**
 * 检查文本是否在思维链标签内
 */
const isInsideThinking = (text) => {
  const thinkStart = text.indexOf('<think>');
  const thinkEnd = text.indexOf('</think>');

  if (thinkStart === -1) return false;
  if (thinkEnd === -1) return true; // 有开始标签但没有结束标签

  return false; // 有完整的标签对
};

/**
 * 检查文本是否包含思维链
 */
const hasThinkingContent = (text) => {
  return /<think>[\s\S]*?<\/think>/.test(text);
};

/**
 * 实时解析流式响应中的思维链 - 修复版本
 */
const parseStreamingContent = (fullText) => {
  // 检查是否包含思维链开始标签
  const hasThinkStart = hasThinkingStart(fullText);

  if (!hasThinkStart) {
    // 没有思维链标签，全部作为答案
    return {
      thinking: '',
      answer: fullText,
      hasThinking: false,
      isThinkingComplete: false
    };
  }

  // 检查是否有完整的思维链
  const hasComplete = hasCompleteThinking(fullText);

  if (!hasComplete) {
    // 有开始标签但还没完整，这意味着正在思考中
    // 此时不应该显示任何答案内容
    const thinkStart = fullText.indexOf('<think>');
    const thinkingContent = fullText.slice(thinkStart + 7); // 跳过 '<think>'

    return {
      thinking: thinkingContent,
      answer: '',
      hasThinking: true,
      isThinkingComplete: false
    };
  }

  // 有完整的思维链，解析思维链和答案
  const thinking = parseThinkingContent(fullText);
  const answer = extractFinalAnswer(fullText);

  return {
    thinking: thinking,
    answer: answer,
    hasThinking: thinking.length > 0,
    isThinkingComplete: true
  };
};

/**
 * 创建思维链渲染器 - 修复版本
 */
const createThinkingRenderer = () => {
  let thinkingBuffer = '';
  let answerBuffer = '';
  let isInThinkingMode = false;
  let thinkingComplete = false;

  return {
    addContent: (fullText) => {
      // 解析完整文本
      const parsed = parseStreamingContent(fullText);

      // 更新思考模式状态
      if (parsed.hasThinking && !isInThinkingMode) {
        isInThinkingMode = true;
        console.log('进入思考模式');
      }

      if (parsed.isThinkingComplete && !thinkingComplete) {
        thinkingComplete = true;
        console.log('思考完成，开始答案');
      }

      // 更新缓冲区
      if (parsed.hasThinking) {
        thinkingBuffer = parsed.thinking;

        // 只有在思考完成后才更新答案
        if (parsed.isThinkingComplete) {
          answerBuffer = parsed.answer;
        } else {
          answerBuffer = ''; // 思考未完成时，答案区域保持空白
        }
      } else {
        // 没有思维链，直接作为答案
        answerBuffer = parsed.answer;
      }

      return {
        thinking: thinkingBuffer,
        answer: answerBuffer,
        hasThinking: parsed.hasThinking,
        isThinkingComplete: parsed.isThinkingComplete
      };
    },

    finalize: () => {
      return {
        thinking: thinkingBuffer,
        answer: answerBuffer
      };
    }
  };
};

// 异步加载所需库
async function loadDependencies() {
  try {
    // 动态导入所需库
    const [markedModule, purifyModule, hljsModule] = await Promise.all([
      import('marked'),
      import('dompurify'),
      import('highlight.js'),
    ]);

    // 明确导入highlight.js样式 - 确保正确加载
    await import('highlight.js/styles/atom-one-light.css');

    // 保存模块引用
    marked.value = markedModule.marked;
    DOMPurify.value = purifyModule.default;
    hljs.value = hljsModule.default;

    console.log('依赖库已成功加载');

    // 注册所有语言 - 根据文档，v11支持以下方式注册所有语言
    try {
      // 导入所有语言 - 在highlight.js v11中不需要单独注册
      // hljs.value已经包含了所有语言
      console.log('已加载的语言:', Object.keys(hljs.value.listLanguages()));
    } catch (e) {
      console.warn('语言加载失败:', e);
    }

    // 配置marked
    marked.value.setOptions({
      highlight: function(code, lang) {
        // 调试输出
        console.log('Highlight函数执行，语言:', lang);

        // 提取代码文本，考虑代码可能是对象的情况
        const codeText = typeof code === 'object' && code.text ? code.text : code;

        if (lang && hljs.value.getLanguage(lang)) {
          try {
            const result = hljs.value.highlight(codeText, { language: lang });
            console.log('高亮结果预览:', result.value.substring(0, 50));
            return result.value;
          } catch (e) {
            console.error('高亮显示错误:', e);
            return codeText; // 如果高亮失败，返回原始代码
          }
        }

        try {
          // 尝试自动检测语言
          return hljs.value.highlightAuto(codeText).value;
        } catch (e) {
          console.error('自动高亮错误:', e);
          return codeText; // 如果高亮失败，返回原始代码
        }
      },
      breaks: true
    });

    // 添加代码复制按钮的自定义渲染器
    const renderer = new marked.value.Renderer();
    const originalCodeRenderer = renderer.code.bind(renderer);

    renderer.code = function(code, language, isEscaped) {
      // 调试输出
      console.log('Renderer.code接收的code参数:', code);

      // 获取原始代码块的HTML
      const originalHtml = originalCodeRenderer(code, language, isEscaped);

      // 提取代码内容，考虑code可能是对象的情况
      const codeContent = typeof code === 'object' && code.text ? code.text : code;

      // 确保代码是字符串并进行URI编码
      const encodedCode = encodeURIComponent(codeContent);

      // 添加复制按钮
      return `<div class="code-block-wrapper">
                <div class="code-block-header">
                  <span class="code-language">${language || 'code'}</span>
                  <button class="copy-code-button" data-code="${encodedCode}">
                    复制代码
                  </button>
                </div>
                ${originalHtml}
              </div>`;
    };

    // 设置自定义渲染器
    marked.value.setOptions({ renderer });

    console.log('所有依赖已加载成功');

    // 手动应用高亮到已存在的代码块
    applyCodeHighlighting();
  } catch (error) {
    console.error('加载依赖失败:', error);
    ElMessage.error('加载依赖失败，部分功能可能无法正常使用');
  }
}

// 增加DOM更新后的代码高亮处理函数
const applyCodeHighlighting = async () => {
  await nextTick();

  if (!hljs.value) return;

  try {
    // 查找所有没有高亮处理的代码块
    document.querySelectorAll('pre code:not(.hljs)').forEach((block) => {
      try {
        // 应用高亮 - 使用新的API名称
        hljs.value.highlightElement(block);
      } catch (e) {
        console.error('应用代码高亮失败:', e);
      }
    });
  } catch (err) {
    console.error('代码高亮应用错误:', err);
  }
};

// 用户信息
const userName = ref('');
const userInitials = computed(() => {
  return userName.value ? userName.value.charAt(0).toUpperCase() : '游';
});

// 聊天状态
const messages = ref([]);
const inputMessage = ref('');
const isLoading = ref(false);
const chatMessagesRef = ref(null);

// 新增：思维链和状态控制变量
const isThinking = ref(false); // AI是否在思考中
const currentThinking = ref(''); // 当前思维链内容
const finalAnswer = ref(''); // 最终答案内容
const showThinkingChain = ref(true); // 是否显示思维链
const thinkingCollapsed = ref(false); // 思维链是否折叠

// 侧边栏状态
const isSidebarCollapsed = ref(false);
const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
  localStorage.setItem('aiChatSidebarStatus', isSidebarCollapsed.value ? '1' : '0');
};

// 对话管理
const conversations = ref([]);
const currentConversationId = ref('');
const currentConversationTitle = ref('');

// 设置相关
const showSettings = ref(false);
const settings = ref({
  serviceType: 'deepseek', // 新增：服务类型
  apiKey: '',
  apiUrl: 'https://api.deepseek.com/chat/completions',
  ollamaUrl: 'http://localhost:11434', // 新增：Ollama地址
  ollamaModel: '', // 新增：Ollama模型，空字符串让自动检测
  model: 'deepseek-chat',
  systemPrompt: '你是一个乐于助人的助手，专注于帮助济南大学的学生。请提供准确、有用的信息和建议。',
  shareStudentData: false
});

// 对话操作对话框
const showRenameDialog = ref(false);
const showDeleteDialog = ref(false);
const renameTitle = ref('');
const actionTargetId = ref('');

// 语音识别状态
const isRecognizing = ref(false);
const recognitionResult = ref('');
const isVoiceButtonDisabled = ref(false);

// 语音合成状态
const isSpeaking = ref(false);
const currentSpeakingIndex = ref(-1);

// 语音设置对话框
const showSpeechSettings = ref(false);
const speechSettings = ref({
  appId: '',
  iatApiKey: '',
  iatApiSecret: '',
  ttsApiKey: '',
  ttsApiSecret: '',
  voice: 'xiaoyan', // 默认发音人
  speed: 50, // 语速
  volume: 50, // 音量
  pitch: 50, // 音调
});

// 语音对话模式
const voiceConversationMode = ref(false);
const voiceConversationActive = ref(false);
const autoListeningTimeout = ref(null);
const autoReadMessages = ref(false);
const pauseAutoReading = ref(false);

// 语音识别增强
const silenceTimer = ref(null);
const speechTimeout = ref(null);
const lastSpeechTimestamp = ref(Date.now());
const silenceThreshold = 3000; // 3秒静音自动结束

// 新增: 语音对话模式覆盖层状态
const voiceChatMode = ref(false);
const streamingSpeech = ref(false);
const speechSynthesizer = ref(null);
const currentAudioQueue = ref([]);
const isAudioPlaying = ref(false);
const pendingAudioChunks = ref([]);

// 新增本地模型状态变量
const testingConnection = ref(false);
const refreshingModels = ref(false);
const availableModels = ref([]);

// 添加计算属性
const groupedModels = computed(() => {
  const groups = {};

  availableModels.value.forEach(model => {
    // 解析模型名称，提取基础名称
    const parts = model.name.split(':');
    const baseName = parts[0];
    const version = parts[1] || 'latest';

    if (!groups[baseName]) {
      groups[baseName] = {
        label: baseName,
        models: []
      };
    }

    groups[baseName].models.push({
      ...model,
      displayName: `${baseName}:${version}`,
      version: version
    });
  });

  // 排序：deepseek模型优先，然后按名称排序
  const sortedGroups = Object.values(groups).sort((a, b) => {
    if (a.label.includes('deepseek') && !b.label.includes('deepseek')) return -1;
    if (!a.label.includes('deepseek') && b.label.includes('deepseek')) return 1;
    return a.label.localeCompare(b.label);
  });

  // 每个组内部也按版本排序
  sortedGroups.forEach(group => {
    group.models.sort((a, b) => {
      // 优先显示数字大的版本（如14b > 7b > 1.5b）
      const aNum = parseFloat(a.version.replace(/[^\d.]/g, ''));
      const bNum = parseFloat(b.version.replace(/[^\d.]/g, ''));
      return bNum - aNum;
    });
  });

  return sortedGroups;
});

const selectedModelInfo = computed(() => {
  return availableModels.value.find(model => model.name === settings.value.ollamaModel);
});

// 语音对话管理器
const voiceConversationManager = {
  // 状态变量
  active: false,
  listening: false,
  speaking: false,
  waitingForAI: false,

  // 超时计时器
  silenceTimer: null,
  inactivityTimer: null,

  // 配置参数
  config: {
    silenceThreshold: 3000,   // 静音检测阈值（毫秒）
    inactivityTimeout: 60000, // 无活动自动关闭（毫秒）
    minTextLength: 5,         // 最小文本长度，短于此长度不发送
    endPunctuations: ['.', '。', '?', '？', '!', '！'] // 结束标点
  },

  // 初始化
  init() {
    this.resetTimers();
  },

  // 开始语音对话
  start() {
    this.active = true;
    this.resetTimers();

    // 设置无活动自动关闭定时器
    this.inactivityTimer = setTimeout(() => {
      if (this.active && !this.speaking && !this.listening && !this.waitingForAI) {
        console.log('检测到长时间无活动，自动关闭语音对话模式');
        this.stop();
        voiceConversationMode.value = false;
        ElMessage.info('检测到长时间无活动，已自动关闭语音对话模式');
      }
    }, this.config.inactivityTimeout);

    return this.startListening();
  },

  // 停止语音对话
  stop() {
    this.active = false;
    this.resetTimers();

    // 如果正在朗读，停止朗读
    if (this.speaking) {
      speechService.stopPlayback();
      this.speaking = false;
    }

    // 如果正在收听，停止收听
    if (this.listening) {
      return this.stopListening();
    }

    return Promise.resolve();
  },

  // 开始语音识别
  async startListening() {
    if (this.speaking) {
      // 如果正在朗读，先停止
      speechService.stopPlayback();
      this.speaking = false;
    }

    this.listening = true;

    // 重置识别文本
    recognitionResult.value = '';
    inputMessage.value = '';

    // 播放开始识别的音频反馈
    playAudioFeedback('start');

    try {
      // 开始语音识别
      await toggleVoiceInput();

      // 启动静音检测定时器
      this.silenceTimer = setTimeout(() => {
        if (this.listening && !this.waitingForAI) {
          console.log('检测到长时间静音，自动停止语音识别');
          this.stopListening().then(() => {
            // 如果语音识别文本太少，不发送，而是重新开始收听
            if (inputMessage.value.length < this.config.minTextLength) {
              setTimeout(() => {
                if (this.active) {
                  this.startListening();
                }
              }, 1000);
            }
          });
        }
      }, this.config.silenceThreshold);

      return true;
    } catch (error) {
      console.error('开始语音识别失败:', error);
      this.listening = false;
      return false;
    }
  },

  // 停止语音识别
  async stopListening() {
    this.listening = false;

    // 清除静音检测定时器
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    // 播放停止识别的音频反馈
    playAudioFeedback('stop');

    try {
      await toggleVoiceInput();

      // 如果有足够长的识别文本，发送消息
      if (inputMessage.value.length >= this.config.minTextLength) {
        this.waitingForAI = true;
        await sendMessage();
      }

      return true;
    } catch (error) {
      console.error('停止语音识别失败:', error);
      return false;
    }
  },

  // 开始朗读 AI 回复
  async startSpeaking(text, onComplete) {
    if (this.listening) {
      // 如果正在识别语音，先停止
      await this.stopListening();
    }

    this.speaking = true;

    try {
      // 预处理文本以获得更好的朗读效果
      const processedText = preprocessTextForTTS(text);

      // 获取动态调整的TTS参数
      const ttsParams = dynamicAdjustTtsParams(processedText);

      // 开始朗读
      await speechService.startSynthesize(
          processedText,
          // 开始回调
          () => {
            console.log('开始朗读AI回复');
          },
          // 结束回调
          () => {
            console.log('AI回复朗读完成');
            this.speaking = false;

            // 如果语音对话仍然活跃，等待一小段时间后重新开始收听
            if (this.active && !this.waitingForAI) {
              setTimeout(() => {
                if (this.active && !this.listening && !this.speaking && !this.waitingForAI) {
                  this.startListening();
                }
              }, 1000);
            }

            if (onComplete) onComplete();
          },
          // 错误回调
          (error) => {
            console.error('语音合成错误:', error);
            ElMessage.error('语音合成失败: ' + error.message);
            this.speaking = false;

            // 出错时也尝试继续对话
            if (this.active && !this.waitingForAI) {
              setTimeout(() => {
                if (this.active && !this.listening && !this.speaking && !this.waitingForAI) {
                  this.startListening();
                }
              }, 1000);
            }

            if (onComplete) onComplete();
          },
          // 合成选项
          ttsParams
      );

      return true;
    } catch (error) {
      console.error('开始AI回复朗读失败:', error);
      this.speaking = false;

      if (onComplete) onComplete();
      return false;
    }
  },

  // 处理AI回复完成事件
  handleAIResponseComplete(response) {
    this.waitingForAI = false;

    // 如果不再活跃，不做任何处理
    if (!this.active) return;

    // 如果启用了自动朗读，开始朗读回复
    if (autoReadMessages.value && !pauseAutoReading.value) {
      this.startSpeaking(response);
    } else {
      // 否则直接重新开始语音识别
      setTimeout(() => {
        if (this.active && !this.listening && !this.speaking) {
          this.startListening();
        }
      }, 1000);
    }
  },

  // 重置所有计时器
  resetTimers() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }
};

/**
 * 初始化语音合成器
 */
const initSpeechSynthesizer = async () => {
  try {
    speechSynthesizer.value = {
      // 存储加载的语音上下文
      audioContext: null,

      // 初始化
      async init() {
        if (!this.audioContext) {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
          if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
          }
        }
        return this.audioContext;
      },

      // 播放音频数据
      async play(audioBuffer) {
        const context = await this.init();
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        source.start(0);
        return new Promise(resolve => {
          source.onended = resolve;
        });
      },

      // 解码音频数据
      async decode(audioData) {
        const context = await this.init();
        return context.decodeAudioData(audioData);
      }
    };

    // 初始化音频上下文
    await speechSynthesizer.value.init();
    console.log('语音合成器初始化成功');
    return true;
  } catch (error) {
    console.error('初始化语音合成器失败:', error);
    return false;
  }
};

/**
 * 进入语音对话模式
 */
const enterVoiceChatMode = async () => {
  try {
    // 初始化语音合成器
    await initSpeechSynthesizer();

    // 激活语音对话模式
    voiceChatMode.value = true;

    console.log('已进入语音对话模式');

    // 显示欢迎消息
    ElMessage.success({
      message: '已进入语音对话模式，点击麦克风开始',
      duration: 3000
    });
  } catch (error) {
    console.error('进入语音对话模式失败:', error);
    ElMessage.error('启动语音对话模式失败: ' + error.message);
  }
};

/**
 * 退出语音对话模式
 */
const exitVoiceChatMode = () => {
  // 停止所有语音活动
  stopAllSpeechActivities();

  // 退出语音对话模式
  voiceChatMode.value = false;
  voiceConversationMode.value = false;
  streamingSpeech.value = false;
  pendingAudioChunks.value = [];

  console.log('已退出语音对话模式');
  ElMessage.success('已退出语音对话模式');
};

/**
 * 处理下一轮准备的方法
 */
const handlePrepareTurn = (wasSilence) => {
  console.log('准备开始下一轮对话', { wasSilence });

  // 如果还在语音模式，延迟后自动开始下一轮
  if (voiceChatMode.value && !isLoading.value) {
    setTimeout(() => {
      if (voiceChatMode.value && !isLoading.value && voiceChatRef.value) {
        console.log('自动开始下一轮对话');
        voiceChatRef.value.startListening();
      }
    }, 1500);
  }
};

/**
 * 停止所有语音活动
 */
const stopAllSpeechActivities = () => {
  // 停止语音识别
  if (isRecognizing.value) {
    speechService.stopRecognize();
    isRecognizing.value = false;
  }

  // 停止语音合成
  speechService.stopPlayback();

  // 清空音频队列
  currentAudioQueue.value = [];
  isAudioPlaying.value = false;

  console.log('已停止所有语音活动');
};

/**
 * 开始语音识别 (用于语音对话覆盖层)
 */
const startVoiceRecognition = async () => {
  // 确保不在处理中
  if (isRecognizing.value || isLoading.value) {
    console.log('语音识别或AI处理进行中，无法启动新识别');
    return;
  }

  try {
    // 重置识别结果
    recognitionResult.value = '';
    inputMessage.value = '';

    // 更新UI状态
    if (voiceChatRef.value) {
      voiceChatRef.value.listening = true;
      voiceChatRef.value.thinking = false;
      voiceChatRef.value.speaking = false;
    }

    // 启动语音识别
    isRecognizing.value = true;

    await speechService.startRecognize(
        // 识别结果回调
        (text, isLast) => {
          recognitionResult.value = text;
          // 更新最后说话时间
          lastSpeechTimestamp.value = Date.now();

          // 重置静音检测定时器
          if (silenceTimer.value) {
            clearTimeout(silenceTimer.value);
          }

          // 设置静音检测
          silenceTimer.value = setTimeout(() => {
            // 超过静音阈值时自动停止
            if (isRecognizing.value && Date.now() - lastSpeechTimestamp.value > silenceThreshold) {
              console.log('检测到静音，自动停止录音');
              // 使用静音停止方式
              stopVoiceRecognitionBySilence();
            }
          }, silenceThreshold);

          if (isLast && text) {
            // 处理完整的识别结果
            handleVoiceCommand(text);
          }
        },
        // 错误回调
        (error) => {
          console.error('语音识别错误:', error);
          isRecognizing.value = false;

          // 更新UI状态
          if (voiceChatRef.value) {
            voiceChatRef.value.listening = false;
            voiceChatRef.value.showError('无法识别语音');
          }
        }
    );

    console.log('语音识别已启动');
  } catch (error) {
    console.error('启动语音识别失败:', error);
    isRecognizing.value = false;

    if (voiceChatRef.value) {
      voiceChatRef.value.listening = false;
    }

    ElMessage.error('启动语音识别失败: ' + error.message);
  }
};

const stopVoiceRecognitionBySilence = async () => {
  if (!isRecognizing.value) return;

  try {
    // 清除静音检测定时器
    if (silenceTimer.value) {
      clearTimeout(silenceTimer.value);
      silenceTimer.value = null;
    }

    // 更新UI状态
    if (voiceChatRef.value) {
      // 通知组件这是静音触发的停止
      voiceChatRef.value.stopListeningByTimeout();
    }

    await speechService.stopRecognize();
    isRecognizing.value = false;

    // 如果识别到的文本很短或为空，则不处理
    if (!recognitionResult.value || recognitionResult.value.length < 3) {
      console.log('识别文本过短，不处理');
      // 重新开始语音识别
      setTimeout(() => {
        if (voiceChatMode.value && !isLoading.value) {
          startVoiceRecognition();
        }
      }, 1000);
      return;
    }

    // 否则处理识别文本
    handleVoiceCommand(recognitionResult.value);

    console.log('静音触发语音识别停止');
  } catch (error) {
    console.error('静音停止语音识别失败:', error);
    isRecognizing.value = false;
  }
};

/**
 * 停止语音识别 (用于语音对话覆盖层)
 */
const stopVoiceRecognition = async () => {
  if (!isRecognizing.value) return;

  try {
    // 清除静音检测定时器
    if (silenceTimer.value) {
      clearTimeout(silenceTimer.value);
      silenceTimer.value = null;
    }

    // 更新UI状态
    if (voiceChatRef.value) {
      voiceChatRef.value.stopListening();
    }

    await speechService.stopRecognize();
    isRecognizing.value = false;

    console.log('语音识别已停止');
  } catch (error) {
    console.error('停止语音识别失败:', error);
    isRecognizing.value = false;
  }
};

/**
 * 处理语音命令 (用于语音对话覆盖层)
 */
const handleVoiceCommand = async (text) => {
  if (!text || !text.trim()) {
    // 如果没有识别到文本，重新开始聆听
    if (voiceChatRef.value && voiceChatMode.value) {
      setTimeout(() => {
        if (voiceChatMode.value && !isLoading.value) {
          voiceChatRef.value.startListening();
        }
      }, 1000);
    }
    return;
  }

  console.log('处理语音命令:', text);

  // 检查是否是退出命令
  if (['退出', '结束', '退出语音模式', '关闭语音模式'].includes(text.toLowerCase().trim())) {
    exitVoiceChatMode();
    return;
  }

  // 添加用户消息到历史
  addMessageToHistory('user', text);

  // 设置思考状态
  if (voiceChatRef.value) {
    voiceChatRef.value.thinking = true;
  }

  // 发送到AI处理并直接流式合成语音
  await sendToAIWithStreamingSpeech(text);
};

/**
 * 向AI发送消息并流式合成语音
 */
const sendToAIWithStreamingSpeech = async (message) => {
  try {
    // 设置处理中状态
    isLoading.value = true;
    isThinking.value = true; // 开始思考
    streamingSpeech.value = true;

    // 准备接收流式响应
    let assistantMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString()
    };

    // 清空并重置所有语音相关状态
    pendingAudioChunks.value = [];

    // 确保停止任何正在播放的音频
    speechService.stopPlayback();

    // 更新UI状态
    if (voiceChatRef.value) {
      voiceChatRef.value.thinking = true;
      voiceChatRef.value.listening = false;
      voiceChatRef.value.speaking = false;
    }

    // 发送请求并处理流式响应
    await aiAssistantService.sendStreamingRequest(
        message,
        // 接收文本块的回调
        async (chunk) => {
          // 第一次收到响应时，结束思考状态
          if (isThinking.value) {
            isThinking.value = false;
            if (voiceChatRef.value) {
              voiceChatRef.value.thinking = false;
            }
          }

          // 累积响应文本
          assistantMessage.content += chunk;

          // 收集这个块用于显示
          if (streamingElementRef.value) {
            streamingElementRef.value.innerHTML = formatMessage(assistantMessage.content);
          }

          // 不在这里收集单个小文本块，等完整响应
        },
        // 完成时的回调
        async (finalResponse) => {
          console.log('AI响应完成，准备播放语音');

          // 更新UI
          if (voiceChatRef.value) {
            voiceChatRef.value.thinking = false;
            voiceChatRef.value.speaking = true;
          }

          // 更新消息历史
          addMessageToHistory('assistant', assistantMessage.content);

          // 播放完整响应的语音
          await playCompleteResponse(assistantMessage.content);

          // 重置状态
          isLoading.value = false;
          isThinking.value = false;
          streamingSpeech.value = false;

          // 完成对话轮次
          if (voiceChatRef.value) {
            // 通知语音组件完成对话轮次
            voiceChatRef.value.completeTurn();
          }
        },
        // 错误处理回调
        (error) => {
          console.error('AI处理错误:', error);
          isLoading.value = false;
          isThinking.value = false;
          streamingSpeech.value = false;

          // 显示错误
          if (voiceChatRef.value) {
            voiceChatRef.value.speaking = false;
            voiceChatRef.value.thinking = false;
            voiceChatRef.value.showError('AI处理失败');
          }
        },
        // 系统提示
        settings.value.systemPrompt
    );
  } catch (error) {
    console.error('流式处理失败:', error);
    isLoading.value = false;
    isThinking.value = false;
    streamingSpeech.value = false;

    if (voiceChatRef.value) {
      voiceChatRef.value.speaking = false;
      voiceChatRef.value.thinking = false;
      voiceChatRef.value.showError('处理失败: ' + error.message);
    }
  }
};

/**
 * 处理语音对话完整响应的语音播放
 */
const playCompleteResponse = async (text) => {
  try {
    // 预处理文本以获得更好的朗读效果
    const processedText = preprocessTextForTTS(text);

    console.log('开始朗读完整AI响应');

    // 使用与朗读功能相同的方式直接调用语音合成服务
    await speechService.startSynthesize(
        processedText,
        // 开始回调
        () => {
          console.log('AI响应朗读开始');
          if (voiceChatRef.value) {
            voiceChatRef.value.speaking = true;
          }
        },
        // 结束回调
        () => {
          console.log('AI响应朗读结束');
          if (voiceChatRef.value) {
            // 朗读结束后，需要手动触发对话完成
            voiceChatRef.value.speaking = false;

            // 短暂延迟后开始下一轮
            setTimeout(() => {
              if (voiceChatMode.value && voiceChatRef.value) {
                voiceChatRef.value.startListening();
              }
            }, 1500);
          }
        },
        // 错误回调
        (error) => {
          console.error('AI响应朗读错误:', error);
          if (voiceChatRef.value) {
            voiceChatRef.value.speaking = false;
            voiceChatRef.value.showError('语音合成失败');
          }
        },
        // 合成选项
        {
          voice: speechSettings.value.voice,
          speed: speechSettings.value.speed,
          volume: speechSettings.value.volume,
          pitch: speechSettings.value.pitch
        }
    );
  } catch (error) {
    console.error('AI响应朗读失败:', error);
    if (voiceChatRef.value) {
      voiceChatRef.value.speaking = false;
    }
  }
};

/**
 * 添加消息到历史记录
 */
const addMessageToHistory = (role, content, thinking = null) => {
  // 添加消息到历史，包含思维链数据
  const newMessage = {
    role,
    content,
    timestamp: new Date().toISOString()
  };

  // 如果有思维链数据，添加到消息中
  if (thinking) {
    newMessage.thinking = thinking;
  }

  messages.value.push(newMessage);

  // 如果是对话的第一条消息，创建新对话ID
  if (messages.value.length === 1 || !currentConversationId.value) {
    currentConversationId.value = 'conv_' + Date.now();
  }

  // 保存对话历史
  saveCurrentConversation();
};

/**
 * 检查用户认证状态
 */
const checkAuthentication = () => {
  // 检查教务系统或智慧济大是否已登录
  const loginStatus = authService.getLoginStatus();
  isAuthenticated.value = loginStatus.eas || loginStatus.ipass;

  logDebug('身份验证状态:', isAuthenticated.value);
  return isAuthenticated.value;
};

/**
 * 格式化时间
 */
const formatTime = (timestamp) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();

  // 如果是今天的消息
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  // 昨天的消息
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  // 一周内的消息
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  if (date > weekAgo) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${days[date.getDay()]} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  // 更早的消息
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

/**
 * 获取对话标题
 */
const getConversationTitle = (conversation) => {
  if (conversation.title) return conversation.title;

  // 如果没有标题，使用第一条用户消息的前20个字符
  const firstUserMessage = conversation.messages.find(m => m.role === 'user');
  if (firstUserMessage) {
    return firstUserMessage.content.substring(0, 20) + (firstUserMessage.content.length > 20 ? '...' : '');
  }

  return '新对话';
};

/**
 * 格式化消息内容（将Markdown转换为HTML）
 */
const formatMessage = (content) => {
  if (!content) return '';

  // 确保依赖已加载
  if (!marked.value || !DOMPurify.value) {
    return content.replace(/\n/g, '<br>');
  }

  // 解析Markdown并进行安全过滤
  try {
    // 调试日志
    console.log('解析前的内容:', content.substring(0, 100));

    // 使用marked处理Markdown，确保使用正确的方法
    let html;
    if (typeof marked.value === 'function') {
      html = marked.value(content); // 旧版API
    } else if (typeof marked.value.parse === 'function') {
      html = marked.value.parse(content); // 新版API
    } else {
      console.error('无法识别的marked API');
      return content.replace(/\n/g, '<br>');
    }

    console.log('解析后的HTML:', html.substring(0, 100));

    const sanitizedHtml = DOMPurify.value.sanitize(html);

    // 在返回之前尝试手动应用高亮
    setTimeout(() => {
      applyCodeHighlighting();
    }, 0);

    return sanitizedHtml;
  } catch (error) {
    console.error('解析Markdown失败:', error);
    return content.replace(/\n/g, '<br>');
  }
};

/**
 * 复制消息内容到剪贴板
 */
const copyMessageContent = async (content) => {
  try {
    await navigator.clipboard.writeText(content);
    ElMessage.success('已复制到剪贴板');
  } catch (error) {
    console.error('复制失败:', error);
    ElMessage.error('复制失败');
  }
};

/**
 * 处理代码块复制功能
 * 此函数在DOM更新后绑定事件监听器到代码块复制按钮
 */
const setupCodeCopyButtons = async () => {
  await nextTick();

  // 先应用代码高亮
  applyCodeHighlighting();

  // 查找所有代码复制按钮
  const copyButtons = document.querySelectorAll('.copy-code-button');

  // 为每个按钮添加点击事件
  copyButtons.forEach(button => {
    // 如果按钮已经有事件监听器，就不再添加
    if (button.getAttribute('data-listener') === 'true') return;

    button.addEventListener('click', async () => {
      try {
        // 获取编码后的代码并解码
        const codeAttr = button.getAttribute('data-code');
        if (!codeAttr) {
          throw new Error('没有找到代码数据');
        }

        const code = decodeURIComponent(codeAttr);

        // 确保代码是字符串
        if (typeof code !== 'string') {
          throw new Error('代码数据格式不正确');
        }

        // 复制到剪贴板
        await navigator.clipboard.writeText(code);

        // 更改按钮文本作为视觉反馈
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="el-icon-check"></i> 已复制';

        // 2秒后恢复原文本
        setTimeout(() => {
          button.innerHTML = originalText;
        }, 2000);

        ElMessage.success('代码已复制到剪贴板');
      } catch (error) {
        console.error('复制代码失败:', error);
        ElMessage.error('复制代码失败: ' + error.message);
      }
    });

    // 标记按钮已添加监听器
    button.setAttribute('data-listener', 'true');
  });
};

/**
 * 处理Enter键按下事件
 */
const handleEnterKey = (event) => {
  // 如果按下Shift+Enter，则插入换行
  if (event.shiftKey) {
    return;
  }

  // 否则发送消息
  event.preventDefault();
  sendMessage();
};

/**
 * 使用模板提示
 */
const useTemplate = (templateType) => {
  switch(templateType) {
    case '成绩分析':
      inputMessage.value = '请分析我的成绩情况，找出我的优势和不足，并给出提高的建议。';
      break;
    case '课表优化':
      inputMessage.value = '根据我的课表，帮我制定一个高效的学习和复习计划。';
      break;
    case '考试准备':
      inputMessage.value = '我有即将到来的考试，请帮我制定一个合理的考试准备计划。';
      break;
    case '通用问题':
      inputMessage.value = '';
      break;
  }

  // 自动聚焦到输入框
  document.querySelector('.el-textarea__inner')?.focus();
};

/**
 * 创建实时markdown解析器
 * @returns {{add: ((function(*): (string|*|undefined|null|undefined))|*), finalize: (function(): string|*)}}
 */
const createRealtimeMarkdownRenderer = () => {
  let buffer = '';
  let lastRendered = '';
  let lastRenderResult = null; // 缓存上次渲染结果

  return {
    add: (char) => {
      buffer += char;

      // 使用缓存避免重复渲染相同内容
      if (buffer === lastRendered) {
        return lastRenderResult;
      }

      try {
        const unclosed = checkUnclosedMarkdown(buffer);

        if (unclosed) {
          const safeContent = buffer.slice(0, unclosed.start);
          if (safeContent.length > lastRendered.length) {
            lastRendered = safeContent;
            lastRenderResult = formatMessage(safeContent) || safeContent.replace(/\n/g, '<br>');
            return lastRenderResult;
          }
          return null;
        } else {
          if (buffer !== lastRendered) {
            lastRendered = buffer;
            lastRenderResult = formatMessage(buffer);
            return lastRenderResult;
          }
          return null;
        }
      } catch (e) {
        return buffer.replace(/\n/g, '<br>');
      }
    },

    finalize: () => {
      return formatMessage(buffer);
    }
  };
};

// 检查未闭合的markdown语法
const checkUnclosedMarkdown = (text) => {
  let inCodeBlock = false;
  let codeBlockStart = -1;
  let codeBlockCount = 0;

  let backtickCount = 0;
  let lastBacktickIndex = -1;

  let asteriskCount = 0;
  let lastAsteriskIndex = -1;

  let underscoreCount = 0;
  let lastUnderscoreIndex = -1;

  let linkStack = [];
  let imageStack = [];

  let i = 0;
  while (i < text.length) {
    // 检查转义字符
    if (text[i] === '\\') {
      i += 2;
      continue;
    }

    // 检查代码块
    if (text.slice(i, i + 3) === '```') {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockStart = i;
        codeBlockCount++;
      } else {
        inCodeBlock = false;
        codeBlockCount--;
      }
      i += 3;
      continue;
    }

    // 如果在代码块中，不处理其他语法
    if (inCodeBlock) {
      i++;
      continue;
    }

    // 检查内联代码
    if (text[i] === '`') {
      backtickCount++;
      lastBacktickIndex = i;
    }

    // 检查加粗（两个星号）
    if (text.slice(i, i + 2) === '**') {
      asteriskCount++;
      lastAsteriskIndex = i;
      i += 2;
      continue;
    }

    // 检查斜体（单个星号）
    if (text[i] === '*' && text[i + 1] !== '*' && text[i - 1] !== '*') {
      underscoreCount++;
      lastUnderscoreIndex = i;
    }

    // 检查斜体（下划线）
    if (text[i] === '_') {
      underscoreCount++;
      lastUnderscoreIndex = i;
    }

    // 检查链接和图片
    if (text[i] === '[') {
      if (i > 0 && text[i - 1] === '!') {
        imageStack.push(i - 1);
      } else {
        linkStack.push(i);
      }
    }

    if (text[i] === ']') {
      // 检查是否有对应的(url)
      let nextChar = i + 1 < text.length ? text[i + 1] : '';
      if (nextChar === '(') {
        let j = i + 2;
        let parenCount = 1;
        while (j < text.length && parenCount > 0) {
          if (text[j] === '(') parenCount++;
          if (text[j] === ')') parenCount--;
          j++;
        }
        if (parenCount === 0) {
          // 正确闭合的链接或图片
          if (imageStack.length > 0 && imageStack[imageStack.length - 1] < linkStack[linkStack.length - 1]) {
            imageStack.pop();
          } else if (linkStack.length > 0) {
            linkStack.pop();
          }
          i = j - 1;
        }
      }
    }

    i++;
  }

  // 检查未闭合的标题
  const headingMatch = text.match(/#+\s*$/);
  if (headingMatch) {
    return {
      type: 'heading',
      start: text.lastIndexOf(headingMatch[0])
    };
  }

  // 返回未闭合的语法
  if (codeBlockCount > 0) {
    return {
      type: 'codeblock',
      start: codeBlockStart
    };
  }

  if (backtickCount % 2 !== 0) {
    return {
      type: 'code',
      start: lastBacktickIndex
    };
  }

  if (asteriskCount % 2 !== 0) {
    return {
      type: 'bold',
      start: lastAsteriskIndex
    };
  }

  if (underscoreCount % 2 !== 0) {
    return {
      type: 'italic',
      start: lastUnderscoreIndex
    };
  }

  if (linkStack.length > 0) {
    return {
      type: 'link',
      start: linkStack[linkStack.length - 1]
    };
  }

  if (imageStack.length > 0) {
    return {
      type: 'image',
      start: imageStack[imageStack.length - 1]
    };
  }

  return null;
};

/**
 * 语音输入相关函数
 */

// 播放音频反馈
const playAudioFeedback = (type) => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // 设置音效特性
    if (type === 'start') {
      // 启动音效 - 上升音调
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      oscillator.frequency.linearRampToValueAtTime(880, audioContext.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
    } else {
      // 停止音效 - 下降音调
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.linearRampToValueAtTime(440, audioContext.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
    }

    // 连接节点并播放
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();

    // 短暂播放后停止
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, 300);
  } catch (e) {
    console.warn('无法播放音频反馈:', e);
  }
};

// 语音命令处理 - 处理特殊的语音命令
const processVoiceCommands = (text) => {
  // 转换为小写并去除空格，用于命令匹配
  const normalizedText = text.toLowerCase().trim();

  // 定义一些特殊的语音命令
  if (normalizedText === '清空对话' || normalizedText === '清除对话') {
    ElMessageBox.confirm(
        '确定要清空当前对话吗？此操作不可撤销。',
        '语音命令确认',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
    ).then(() => {
      clearChat();
      ElMessage.success('对话已清空');
      // 如果在连续对话模式，暂停一段时间后重新开始
      if (voiceConversationMode.value) {
        setTimeout(() => {
          startVoiceConversation();
        }, 1500);
      }
    }).catch(() => {
      ElMessage.info('已取消清空操作');
      // 如果在连续对话模式，继续语音识别
      if (voiceConversationMode.value) {
        startVoiceConversation();
      }
    });
    return true;
  }

  if (normalizedText === '关闭语音模式' || normalizedText === '退出语音模式') {
    voiceConversationMode.value = false;
    handleVoiceConversationModeChange(false);
    ElMessage.success('已关闭语音对话模式');
    return true;
  }

  // 更多语音命令可以在这里添加

  // 如果没有匹配的命令，返回false
  return false;
};

// 语音合成增强函数

// 预处理文本，提高朗读质量
const preprocessTextForTTS = (text) => {
  // 移除Markdown格式符号，以避免朗读它们
  let processedText = text
      .replace(/\*\*(.*?)\*\*/g, '$1') // 移除加粗标记
      .replace(/\*(.*?)\*/g, '$1')     // 移除斜体标记
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1') // 移除链接，只读链接文本
      .replace(/`(.*?)`/g, '$1')       // 移除行内代码标记
      .replace(/```[\s\S]*?```/g, '代码块已省略') // 替换代码块
      .replace(/#+\s+(.*?)(?:\n|$)/g, '$1。') // 将标题转换为普通文本，并在末尾添加句号
      .replace(/\n+/g, '。') // 将多个换行符替换为句号，表示段落分隔
      .replace(/[*\-+] (.*?)(?:\n|$)/g, '$1。') // 处理列表项
      .replace(/\s{2,}/g, ' '); // 压缩多个空格

  // 处理常见的缩写和特殊字符，使语音更自然
  processedText = processedText
      .replace(/(\d+)([A-Za-z]+)/g, '$1 $2') // 在数字和字母之间添加空格
      .replace(/([A-Za-z]+)(\d+)/g, '$1 $2') // 在字母和数字之间添加空格
      .replace(/(\.[^\.\s])/g, '. $1') // 在句点后添加空格，如果没有
      .replace(/([^0-9])\.([^0-9\s\.])/g, '$1. $2'); // 确保句点后有空格

  // 替换一些常见的英文缩写
  const abbreviations = {
    'e.g.': '例如',
    'i.e.': '也就是',
    'etc.': '等等',
    'vs.': '对比',
    'AI': 'A I',
    'API': 'A P I',
    'JSON': 'J S O N',
    'HTML': 'H T M L',
    'CSS': 'C S S',
    'URL': 'U R L'
  };

  for (const [abbr, expanded] of Object.entries(abbreviations)) {
    const regex = new RegExp('\\b' + abbr.replace(/\./g, '\\.') + '\\b', 'g');
    processedText = processedText.replace(regex, expanded);
  }

  return processedText;
};

// 根据文本内容动态调整参数
const dynamicAdjustTtsParams = (text) => {
  // 默认使用配置的参数
  const params = {
    voice: speechSettings.value.voice,
    speed: speechSettings.value.speed,
    volume: speechSettings.value.volume,
    pitch: speechSettings.value.pitch
  };

  // 如果文本包含问号，稍微提高音调表示疑问语气
  if (text.includes('?') || text.includes('？')) {
    params.pitch = Math.min(100, params.pitch + 10);
  }

  // 如果文本包含感叹号，稍微提高音量表示强调
  if (text.includes('!') || text.includes('！')) {
    params.volume = Math.min(100, params.volume + 10);
  }

  // 如果是很长的段落，稍微加快语速
  if (text.length > 100) {
    params.speed = Math.min(100, params.speed + 5);
  }

  return params;
};

// 临时禁用自动朗读（在某些情况下避免打扰用户）
const temporarilyDisableAutoReading = (duration = 5000) => {
  pauseAutoReading.value = true;
  setTimeout(() => {
    pauseAutoReading.value = false;
  }, duration);
};

// 连续语音对话模式相关
const handleVoiceConversationModeChange = (value) => {
  if (value) {
    // 启用连续语音对话模式
    ElMessage.info('已启用语音对话模式，可以直接通过语音与AI助手对话');

    // 启动新版语音对话模式
    enterVoiceChatMode();
  } else {
    // 停止连续语音对话
    if (voiceChatMode.value) {
      exitVoiceChatMode();
    } else {
      voiceConversationManager.stop();
      voiceConversationActive.value = false;
    }
    ElMessage.info('已关闭语音对话模式');
  }
};

// 启动语音对话
const startVoiceConversation = async () => {
  // 如果正在加载（AI正在响应），则不启动语音识别
  if (isLoading.value) return;

  voiceConversationActive.value = true;

  // 清除所有超时器
  if (autoListeningTimeout.value) {
    clearTimeout(autoListeningTimeout.value);
    autoListeningTimeout.value = null;
  }

  // 启动语音识别
  try {
    await toggleVoiceInput();
    ElMessage.success({
      message: '请开始说话...',
      duration: 1500
    });
  } catch (error) {
    console.error('启动语音识别失败:', error);
    voiceConversationActive.value = false;
    ElMessage.error('启动语音识别失败，请检查麦克风权限和设置');
  }
};

// 停止语音对话
const stopVoiceConversation = () => {
  voiceConversationActive.value = false;

  // 清除所有超时器
  if (autoListeningTimeout.value) {
    clearTimeout(autoListeningTimeout.value);
    autoListeningTimeout.value = null;
  }

  // 如果正在识别，停止语音识别
  if (isRecognizing.value) {
    toggleVoiceInput();
  }
};

/**
 * 发送消息 - 修复思维链显示的版本
 */
const sendMessage = async () => {
  const message = inputMessage.value.trim();
  if (!message || isLoading.value) return;

  try {
    // 添加用户消息到聊天记录
    messages.value.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    // 清空输入框
    inputMessage.value = '';

    // 初始滚动到底部
    await scrollToBottom();

    // 设置加载状态
    isLoading.value = true;
    isThinking.value = true;

    // 重置思维链内容
    currentThinking.value = '';
    finalAnswer.value = '';

    // 准备接收流式响应
    let assistantMessage = {
      role: 'assistant',
      content: '',
      thinking: '',
      timestamp: new Date().toISOString()
    };

    // 添加空白助手消息到聊天记录
    messages.value.push(assistantMessage);

    // 等待DOM更新
    await nextTick();

    // 存储完整的AI响应
    let fullResponse = '';
    let hasDetectedThinking = false;
    let isThinkingPhase = false;

    // 创建思维链渲染器
    const thinkingRenderer = createThinkingRenderer();

    // 用于DOM操作的变量
    let thinkingElement = null;
    let answerElement = null;

    // 获取DOM元素
    const waitForElements = () => {
      return new Promise((resolve) => {
        const checkElements = () => {
          const thinkingRef = document.querySelector(`[data-thinking-ref="${messages.value.length - 1}"]`);
          const answerRef = document.querySelector(`[data-answer-ref="${messages.value.length - 1}"]`);

          if (answerRef) {
            thinkingElement = thinkingRef;
            answerElement = answerRef;
            resolve();
          } else {
            setTimeout(checkElements, 10);
          }
        };
        checkElements();
      });
    };

    await waitForElements();

    // 调试输出
    console.log('DOM elements found:', {
      thinkingElement: !!thinkingElement,
      answerElement: !!answerElement,
      isThinking: isThinking.value,
      showThinkingChain: showThinkingChain.value
    });

    // 直接更新思维链内容
    const updateThinkingContent = (content) => {
      const thinkingRef = document.querySelector(`[data-thinking-ref="${messages.value.length - 1}"]`);
      if (thinkingRef && content) {
        const formattedContent = formatMessage(content);
        thinkingRef.innerHTML = formattedContent + '<span class="thinking-cursor">●</span>';
        thinkingElement = thinkingRef;
      }
    };

    // 直接更新答案内容
    const updateAnswerContent = (content) => {
      const answerRef = document.querySelector(`[data-answer-ref="${messages.value.length - 1}"]`);
      if (answerRef && content) {
        const formattedContent = formatMessage(content);
        answerRef.innerHTML = formattedContent + '<span class="typing-cursor">|</span>';
        answerElement = answerRef;
      }
    };

    // 清空答案内容
    const clearAnswerContent = () => {
      const answerRef = document.querySelector(`[data-answer-ref="${messages.value.length - 1}"]`);
      if (answerRef) {
        answerRef.innerHTML = '';
        answerElement = answerRef;
      }
    };

    // 移除所有光标
    const removeAllCursors = () => {
      if (thinkingElement) {
        const cursor = thinkingElement.querySelector('.thinking-cursor');
        if (cursor) cursor.remove();
      }
      if (answerElement) {
        const cursor = answerElement.querySelector('.typing-cursor');
        if (cursor) cursor.remove();
      }
    };

    // 发送请求并处理流式响应
    await aiAssistantService.sendStreamingRequest(
        message,
        // 接收块的回调 - 修复版本
        (chunk) => {
          fullResponse += chunk;

          // 解析思维链和答案
          const parsed = thinkingRenderer.addContent(fullResponse);

          // 检测思维链开始
          if (parsed.hasThinking && !hasDetectedThinking) {
            hasDetectedThinking = true;
            isThinkingPhase = true;
            console.log('检测到思维链开始');

            // 立即结束初始思考状态，显示思维链容器
            isThinking.value = false;

            // 清空答案区域（如果之前有错误内容）
            clearAnswerContent();
          }

          // 更新思维链内容
          if (parsed.thinking !== currentThinking.value) {
            currentThinking.value = parsed.thinking;
            if (currentThinking.value) {
              updateThinkingContent(currentThinking.value);
            }
          }

          // 更新答案内容（只在思考完成或没有思维链时）
          if (parsed.answer !== finalAnswer.value) {
            finalAnswer.value = parsed.answer;

            // 只有在非思考阶段或思考完成时才更新答案
            if (!isThinkingPhase || parsed.isThinkingComplete) {
              if (finalAnswer.value) {
                updateAnswerContent(finalAnswer.value);
              }
            }
          }

          // 检测思考完成
          if (parsed.isThinkingComplete && isThinkingPhase) {
            isThinkingPhase = false;
            console.log('思考阶段完成，开始答案阶段');
          }

          // 没有思维链的情况下，第一次收到内容时结束思考状态
          if (!parsed.hasThinking && isThinking.value && fullResponse.trim()) {
            isThinking.value = false;
          }
        },
        // 完成时的回调
        (finalResponse) => {
          console.log('AI响应完成');

          // 解析最终内容
          const finalParsed = thinkingRenderer.finalize();

          // 如果没有思维链，直接使用原始响应作为答案
          if (!finalParsed.thinking && !finalParsed.answer) {
            finalParsed.answer = finalResponse;
          }

          // 更新消息内容
          assistantMessage.content = finalParsed.answer || finalResponse;
          assistantMessage.thinking = finalParsed.thinking;

          // 移除所有光标
          removeAllCursors();

          // 确保关闭加载状态
          isLoading.value = false;
          isThinking.value = false;

          // 显示最终格式化的内容
          nextTick(() => {
            if (thinkingElement && finalParsed.thinking) {
              thinkingElement.innerHTML = formatMessage(finalParsed.thinking);
            }
            if (answerElement && (finalParsed.answer || finalResponse)) {
              answerElement.innerHTML = formatMessage(finalParsed.answer || finalResponse);
            }

            // 只在最终完成时滚动到底部
            scrollToBottom();
            setupCodeCopyButtons();
          });

          // 保存对话历史
          saveConversationHistory();

          // 处理语音对话
          handleVoiceConversation(finalParsed.answer || finalResponse);

          // 处理自动朗读
          handleAutoReading(finalParsed.answer || finalResponse);
        },
        // 错误处理回调
        (error) => {
          console.error('流式响应错误:', error);

          // 移除所有光标
          removeAllCursors();

          // 关闭加载状态
          isLoading.value = false;
          isThinking.value = false;

          // 显示错误
          ElMessage.error('请求失败: ' + error.message);
        },
        // 系统消息
        settings.value.systemPrompt
    );

  } catch (error) {
    console.error('发送消息失败:', error);
    isLoading.value = false;
    isThinking.value = false;
    ElMessage.error('发送消息失败: ' + error.message);
  }
};

// 辅助函数
const saveConversationHistory = () => {
  if (currentConversationId.value) {
    setTimeout(async () => {
      try {
        aiAssistantService.currentConversationId = currentConversationId.value;

        // 确保保存的消息包含思维链数据
        const messagesToSave = messages.value.map(msg => ({
          role: msg.role,
          content: msg.content,
          thinking: msg.thinking, // 添加思维链字段
          timestamp: msg.timestamp || new Date().toISOString()
        }));

        aiAssistantService.setMessages(messagesToSave);
        const saved = await saveCurrentConversation();
        if (saved) {
          await loadConversations();
        }
      } catch (error) {
        console.error('保存过程出错:', error);
      }
    }, 100);
  } else {
    currentConversationId.value = 'conv_' + Date.now();
    setTimeout(async () => {
      try {
        aiAssistantService.currentConversationId = currentConversationId.value;

        // 确保保存的消息包含思维链数据
        const messagesToSave = messages.value.map(msg => ({
          role: msg.role,
          content: msg.content,
          thinking: msg.thinking, // 添加思维链字段
          timestamp: msg.timestamp || new Date().toISOString()
        }));

        aiAssistantService.setMessages(messagesToSave);
        const saved = await saveCurrentConversation();
        if (saved) {
          await loadConversations();
        }
      } catch (error) {
        console.error('保存新对话过程出错:', error);
      }
    }, 100);
  }
};

const handleVoiceConversation = (content) => {
  if (voiceConversationMode.value && voiceConversationActive.value) {
    setTimeout(() => {
      const messageIndex = messages.value.length - 1;
      if (messageIndex >= 0 && messages.value[messageIndex].role === 'assistant') {
        voiceConversationManager.handleAIResponseComplete(content);
      }
    }, 500);
  }
};

const handleAutoReading = (content) => {
  if (autoReadMessages.value && !pauseAutoReading.value && !voiceConversationMode.value) {
    const lastMessageIndex = messages.value.length - 1;
    if (lastMessageIndex >= 0 && messages.value[lastMessageIndex].role === 'assistant') {
      setTimeout(() => {
        speakMessage(content, lastMessageIndex);
      }, 500);
    }
  }
};

/**
 * 滚动到聊天窗口底部
 */
const scrollToBottom = async () => {
  await nextTick();
  if (chatMessagesRef.value) {
    chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight;
  }
};

/**
 * 清空聊天记录
 */
const clearChat = async () => {
  try {
    const result = await ElMessageBox.confirm(
        '确定要清空当前对话吗？此操作不可撤销。',
        '清空对话',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
    );

    if (result === 'confirm') {
      messages.value = [];
      aiAssistantService.clearMessages();

      // 如果有当前对话ID，保存空对话
      if (currentConversationId.value) {
        saveCurrentConversation();
      }
    }
  } catch (error) {
    // 用户取消，不做任何处理
  }
};

/**
 * 创建新对话
 */
const newConversation = () => {
  currentConversationId.value = '';
  currentConversationTitle.value = '';
  messages.value = [];
  // 重置service中的currentConversationId和messages
  aiAssistantService.currentConversationId = null;
  aiAssistantService.clearMessages();
};

/**
 * 加载指定ID的对话
 */
const loadConversation = async (conversationId) => {
  try {
    console.log(`尝试加载对话: ${conversationId}`);

    if (!conversationId) {
      throw new Error('对话ID无效');
    }

    // 设置aiAssistantService的currentConversationId
    aiAssistantService.currentConversationId = conversationId;

    // 从service加载对话
    const success = await aiAssistantService.loadConversation(conversationId);

    if (success) {
      console.log(`对话 ${conversationId} 加载成功`);

      // 更新UI
      currentConversationId.value = conversationId;

      // 查找对话详情
      const conversation = conversations.value.find(c => c.id === conversationId);
      currentConversationTitle.value = conversation?.title || '';

      // 获取消息内容
      const serviceMessages = aiAssistantService.getMessages();

      if (!serviceMessages || !serviceMessages.length) {
        console.warn('从service获取到的消息为空，尝试从localStorage加载');

        const storageKey = `ai_conversation_${conversationId}`;
        const storedData = localStorage.getItem(storageKey);

        if (storedData) {
          const parsedData = JSON.parse(storedData);
          if (parsedData && parsedData.messages && parsedData.messages.length) {
            console.log(`从localStorage恢复了${parsedData.messages.length}条消息`);

            // 加载时包含思维链数据，并添加调试信息
            messages.value = parsedData.messages.map(msg => {
              const processedMsg = {
                role: msg.role,
                content: msg.content,
                thinking: msg.thinking || null, // 确保thinking字段存在
                timestamp: msg.timestamp || new Date().toISOString()
              };

              // 调试信息
              if (processedMsg.thinking) {
                console.log(`消息 ${msg.role} 包含思维链:`, processedMsg.thinking.substring(0, 100));
              }

              return processedMsg;
            });

            // 检查加载的消息中是否有thinking数据
            const hasThinking = messages.value.some(msg => msg.thinking);
            console.log('加载的消息中包含思维链:', hasThinking);

            // 同步回service
            aiAssistantService.setMessages(messages.value);

            // 强制更新UI并等待DOM更新
            await nextTick();
            await scrollToBottom();
            setupCodeCopyButtons();

            // 强制触发响应式更新
            showThinkingChain.value = showThinkingChain.value;

            return;
          }
        }

        ElMessage.error('对话内容为空，无法加载');
        return;
      }

      // 将service中的消息转换为UI消息格式，包含思维链数据
      messages.value = serviceMessages.map(msg => {
        const processedMsg = {
          role: msg.role,
          content: msg.content,
          thinking: msg.thinking || null, // 确保thinking字段存在
          timestamp: msg.timestamp || new Date().toISOString()
        };

        // 调试信息
        if (processedMsg.thinking) {
          console.log(`消息 ${msg.role} 包含思维链:`, processedMsg.thinking.substring(0, 100));
        }

        return processedMsg;
      });

      // 检查加载的消息中是否有thinking数据
      const hasThinking = messages.value.some(msg => msg.thinking);
      console.log('加载的消息中包含思维链:', hasThinking);

      // 强制更新UI并等待DOM更新
      await nextTick();
      await scrollToBottom();
      setupCodeCopyButtons();

      // 强制触发响应式更新
      showThinkingChain.value = showThinkingChain.value;

    } else {
      console.error(`对话 ${conversationId} 加载失败，尝试直接从localStorage加载`);

      const storageKey = `ai_conversation_${conversationId}`;
      const storedData = localStorage.getItem(storageKey);

      if (storedData) {
        const parsedData = JSON.parse(storedData);
        if (parsedData && parsedData.messages && parsedData.messages.length) {
          console.log(`从localStorage直接加载了${parsedData.messages.length}条消息`);

          // 更新UI
          currentConversationId.value = conversationId;
          currentConversationTitle.value = getConversationTitle(parsedData);

          // 加载时包含思维链数据
          messages.value = parsedData.messages.map(msg => {
            const processedMsg = {
              role: msg.role,
              content: msg.content,
              thinking: msg.thinking || null, // 确保thinking字段存在
              timestamp: msg.timestamp || new Date().toISOString()
            };

            // 调试信息
            if (processedMsg.thinking) {
              console.log(`消息 ${msg.role} 包含思维链:`, processedMsg.thinking.substring(0, 100));
            }

            return processedMsg;
          });

          // 检查加载的消息中是否有thinking数据
          const hasThinking = messages.value.some(msg => msg.thinking);
          console.log('直接加载的消息中包含思维链:', hasThinking);

          // 同步回service
          aiAssistantService.setMessages(messages.value);
          aiAssistantService.currentConversationId = conversationId;

          // 强制更新UI并等待DOM更新
          await nextTick();
          await scrollToBottom();
          setupCodeCopyButtons();

          // 强制触发响应式更新
          showThinkingChain.value = showThinkingChain.value;

          return;
        }
      }

      ElMessage.error('加载对话失败，无法找到对话数据');
    }
  } catch (error) {
    console.error('加载对话失败:', error);
    ElMessage.error('加载对话失败: ' + error.message);
  }
};

/**
 * 保存当前对话
 */
const saveCurrentConversation = async () => {
  if (!currentConversationId.value) return false;

  try {
    console.log('保存对话ID:', currentConversationId.value);

    // 深拷贝消息，确保包含思维链数据
    const messagesToSave = JSON.parse(JSON.stringify(messages.value.map(msg => ({
      role: msg.role,
      content: msg.content,
      thinking: msg.thinking || null, // 确保thinking字段存在
      timestamp: msg.timestamp || new Date().toISOString()
    }))));

    // 打印调试信息
    console.log('保存的消息数据:', messagesToSave);

    // 检查是否有thinking数据
    const hasThinking = messagesToSave.some(msg => msg.thinking);
    console.log('保存的消息中包含思维链:', hasThinking);

    // 确保消息非空
    if (!messagesToSave.length) {
      console.warn('保存失败：消息为空');
      return false;
    }

    // 更新aiAssistantService的消息和当前对话ID
    aiAssistantService.currentConversationId = currentConversationId.value;
    aiAssistantService.setMessages(messagesToSave);

    // 保存对话
    const success = await aiAssistantService.saveConversation(currentConversationId.value);

    if (success) {
      console.log('保存对话成功');
      await loadConversations();

      // 如果是新对话，设置标题
      if (!currentConversationTitle.value) {
        const conversation = conversations.value.find(c => c.id === currentConversationId.value);
        if (conversation) {
          currentConversationTitle.value = getConversationTitle(conversation);
          console.log('已设置对话标题:', currentConversationTitle.value);
        }
      }

      return true;
    } else {
      console.error('保存对话失败：aiAssistantService返回失败');
      ElMessage.error('保存对话失败，请尝试重新发送消息');
      return false;
    }
  } catch (error) {
    console.error('保存对话失败:', error);
    ElMessage.error('保存对话失败: ' + error.message);
    return false;
  }
};

/**
 * 加载所有对话列表
 */
const loadConversations = async () => {
  try {
    conversations.value = await aiAssistantService.getConversations();
    conversations.value.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  } catch (error) {
    console.error('加载对话列表失败:', error);
    ElMessage.error('加载对话列表失败: ' + error.message);
  }
};

/**
 * 处理对话操作（重命名、删除）
 */
const handleConvAction = (command) => {
  actionTargetId.value = command.id;

  if (command.action === 'rename') {
    const conversation = conversations.value.find(c => c.id === command.id);
    renameTitle.value = conversation?.title || '';
    showRenameDialog.value = true;
  } else if (command.action === 'delete') {
    showDeleteDialog.value = true;
  }
};

/**
 * 确认重命名对话
 */
const confirmRename = async () => {
  if (!actionTargetId.value) {
    showRenameDialog.value = false;
    return;
  }

  try {
    // 从存储中获取对话
    const conversationKey = `ai_conversation_${actionTargetId.value}`;
    let conversation = null;

    // 先尝试从ipc获取
    try {
      if (ipc && typeof ipc.getStoreValue === 'function') {
        conversation = await ipc.getStoreValue(conversationKey);
      }
    } catch (ipcError) {
      console.warn('从ipc获取对话失败:', ipcError);
    }

    // 如果ipc失败，尝试从localStorage获取
    if (!conversation) {
      const conversationStr = localStorage.getItem(conversationKey);
      if (conversationStr) {
        try {
          conversation = JSON.parse(conversationStr);
        } catch (parseError) {
          console.error('解析localStorage对话失败:', parseError);
        }
      }
    }

    if (conversation) {
      // 更新标题
      conversation.title = renameTitle.value.trim();

      // 保存回存储
      try {
        if (ipc && typeof ipc.setStoreValue === 'function') {
          await ipc.setStoreValue(conversationKey, conversation);
        } else {
          localStorage.setItem(conversationKey, JSON.stringify(conversation));
        }
      } catch (saveError) {
        console.error('保存对话失败，尝试使用localStorage:', saveError);
        localStorage.setItem(conversationKey, JSON.stringify(conversation));
      }

      // 如果是当前对话，更新标题
      if (actionTargetId.value === currentConversationId.value) {
        currentConversationTitle.value = conversation.title;
      }

      // 刷新对话列表
      loadConversations();

      ElMessage.success('对话已重命名');
    }

    showRenameDialog.value = false;
  } catch (error) {
    console.error('重命名对话失败:', error);
    ElMessage.error('重命名失败: ' + error.message);
    showRenameDialog.value = false;
  }
};

/**
 * 确认删除对话
 */
const confirmDelete = async () => {
  if (!actionTargetId.value) {
    showDeleteDialog.value = false;
    return;
  }

  try {
    // 从存储中删除对话
    await aiAssistantService.deleteConversation(actionTargetId.value);

    // 如果删除的是当前对话，创建新对话
    if (actionTargetId.value === currentConversationId.value) {
      newConversation();
    }

    // 刷新对话列表
    loadConversations();

    ElMessage.success('对话已删除');
    showDeleteDialog.value = false;
  } catch (error) {
    console.error('删除对话失败:', error);
    ElMessage.error('删除失败: ' + error.message);
    showDeleteDialog.value = false;
  }
};

/**
 * 自动检测模型 - 改进版
 */
const autoDetectModels = async () => {
  if (refreshingModels.value) return;

  refreshingModels.value = true;

  try {
    console.log('正在检测Ollama服务和模型...');

    // 首先测试连接
    const response = await fetch(`${settings.value.ollamaUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Ollama响应数据:', data);

    if (data.models && Array.isArray(data.models) && data.models.length > 0) {
      // 处理模型数据
      availableModels.value = data.models.map(model => ({
        name: model.name,
        size: formatBytes(model.size || 0),
        digest: model.digest,
        modified_at: model.modified_at,
        details: model.details || {}
      }));

      console.log('检测到的模型:', availableModels.value);

      // 自动选择最佳模型
      autoSelectBestModel();

      ElMessage.success(`成功检测到 ${data.models.length} 个模型`);
    } else {
      availableModels.value = [];
      ElMessage.warning('Ollama服务运行正常，但未找到已安装的模型');
    }
  } catch (error) {
    console.error('自动检测模型失败:', error);
    availableModels.value = [];

    let errorMessage = '检测失败: ';
    if (error.message.includes('fetch')) {
      errorMessage += 'Ollama服务可能未启动';
      ElMessage.error(errorMessage);
      ElMessage.info('请在终端运行: ollama serve');
    } else if (error.message.includes('timeout')) {
      errorMessage += '连接超时';
      ElMessage.error(errorMessage);
    } else {
      errorMessage += error.message;
      ElMessage.error(errorMessage);
    }
  } finally {
    refreshingModels.value = false;
  }
};

/**
 * 自动选择最佳模型
 */
const autoSelectBestModel = () => {
  if (availableModels.value.length === 0) return;

  // 如果当前已选择的模型存在，保持不变
  if (settings.value.ollamaModel &&
      availableModels.value.some(model => model.name === settings.value.ollamaModel)) {
    console.log('保持当前选择的模型:', settings.value.ollamaModel);
    return;
  }

  // 优先级规则：
  // 1. deepseek-r1:14b (用户现在有的)
  // 2. deepseek-r1:* (任何deepseek-r1版本)
  // 3. 其他deepseek模型
  // 4. 其他模型中参数量最大的

  const priorities = [
    'deepseek-r1:32b',
    'deepseek-r1:14b',
    'deepseek-r1:8b',
    'deepseek-r1:7b',
    'deepseek-r1:1.5b'
  ];

  // 按优先级查找
  for (const priority of priorities) {
    const found = availableModels.value.find(model => model.name === priority);
    if (found) {
      settings.value.ollamaModel = found.name;
      console.log('自动选择模型:', found.name);
      ElMessage.success(`已自动选择模型: ${found.name}`);
      return;
    }
  }

  // 如果没有deepseek-r1，查找其他deepseek模型
  const deepseekModel = availableModels.value.find(model =>
      model.name.toLowerCase().includes('deepseek'));
  if (deepseekModel) {
    settings.value.ollamaModel = deepseekModel.name;
    console.log('自动选择deepseek模型:', deepseekModel.name);
    ElMessage.success(`已自动选择模型: ${deepseekModel.name}`);
    return;
  }

  // 最后选择第一个可用模型
  settings.value.ollamaModel = availableModels.value[0].name;
  console.log('自动选择第一个模型:', availableModels.value[0].name);
  ElMessage.info(`已选择模型: ${availableModels.value[0].name}`);
};

/**
 * 测试Ollama连接 - 改进版
 */
const testOllamaConnection = async () => {
  testingConnection.value = true;

  try {
    // 测试基本连接
    const response = await fetch(`${settings.value.ollamaUrl}/api/tags`);

    if (response.ok) {
      const data = await response.json();

      // 测试聊天API
      if (settings.value.ollamaModel) {
        try {
          const chatResponse = await fetch(`${settings.value.ollamaUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: settings.value.ollamaModel,
              messages: [
                { role: 'user', content: '测试连接' }
              ],
              stream: false,
              max_tokens: 10
            })
          });

          if (chatResponse.ok) {
            ElMessage.success(`连接测试成功！模型 ${settings.value.ollamaModel} 可正常使用`);
          } else {
            ElMessage.warning(`基础连接成功，但模型 ${settings.value.ollamaModel} 可能不可用`);
          }
        } catch (chatError) {
          ElMessage.warning('基础连接成功，但聊天API测试失败');
        }
      } else {
        ElMessage.success(`连接成功！找到 ${data.models?.length || 0} 个模型`);
      }
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('测试Ollama连接失败:', error);
    ElMessage.error(`连接失败: ${error.message}`);

    if (error.message.includes('fetch')) {
      ElMessage.warning('请确认Ollama服务已启动 (运行: ollama serve)');
    }
  } finally {
    testingConnection.value = false;
  }
};

/**
 * 格式化日期
 */
const formatDate = (dateString) => {
  if (!dateString) return '未知';

  try {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  } catch (error) {
    return '未知';
  }
};

/**
 * 格式化字节大小 - 改进版
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * 保存设置 - 修改版本
 */
const saveSettings = async () => {
  try {
    // 根据服务类型设置对应的配置
    if (settings.value.serviceType === 'ollama') {
      aiAssistantService.setConfig({
        apiKey: '',
        apiUrl: `${settings.value.ollamaUrl}/v1/chat/completions`,
        model: settings.value.ollamaModel,
        shareStudentData: settings.value.shareStudentData
      });
    } else {
      aiAssistantService.setConfig({
        apiKey: settings.value.apiKey,
        apiUrl: settings.value.apiUrl,
        model: settings.value.model,
        shareStudentData: settings.value.shareStudentData
      });
    }

    // 保存到本地存储，包含思维链显示设置
    const settingsToSave = {
      serviceType: settings.value.serviceType,
      apiKey: settings.value.apiKey,
      apiUrl: settings.value.apiUrl,
      ollamaUrl: settings.value.ollamaUrl,
      ollamaModel: settings.value.ollamaModel,
      model: settings.value.model,
      systemPrompt: settings.value.systemPrompt,
      shareStudentData: settings.value.shareStudentData,
      showThinkingChain: showThinkingChain.value // 保存思维链显示设置
    };

    try {
      if (ipc && typeof ipc.setStoreValue === 'function') {
        const serialized = JSON.stringify(settingsToSave);
        const deserialized = JSON.parse(serialized);
        await ipc.setStoreValue('ai_assistant_settings', deserialized);
      } else {
        localStorage.setItem('ai_assistant_settings', JSON.stringify(settingsToSave));
      }

      ElMessage.success('设置已保存');
      showSettings.value = false;
    } catch (storageError) {
      console.error('存储设置失败，尝试使用localStorage:', storageError);
      localStorage.setItem('ai_assistant_settings', JSON.stringify(settingsToSave));
      ElMessage.success('设置已保存(使用备选存储)');
      showSettings.value = false;
    }
  } catch (error) {
    console.error('保存设置失败:', error);
    ElMessage.error('保存设置失败: ' + error.message);
  }
};

/**
 * 加载设置 - 修改版本
 */
const loadSettings = async () => {
  try {
    let savedSettings = null;

    // 先尝试从ipc获取
    try {
      if (ipc && typeof ipc.getStoreValue === 'function') {
        savedSettings = await ipc.getStoreValue('ai_assistant_settings');
      }
    } catch (ipcError) {
      console.warn('从ipc加载设置失败，尝试localStorage:', ipcError);
    }

    // 如果ipc失败，尝试从localStorage获取
    if (!savedSettings) {
      const settingsStr = localStorage.getItem('ai_assistant_settings');
      if (settingsStr) {
        try {
          savedSettings = JSON.parse(settingsStr);
        } catch (parseError) {
          console.error('解析localStorage设置失败:', parseError);
        }
      }
    }

    if (savedSettings) {
      settings.value = {
        serviceType: savedSettings.serviceType || 'deepseek',
        apiKey: savedSettings.apiKey || '',
        apiUrl: savedSettings.apiUrl || 'https://api.deepseek.com/chat/completions',
        ollamaUrl: savedSettings.ollamaUrl || 'http://localhost:11434',
        ollamaModel: savedSettings.ollamaModel || '',
        model: savedSettings.model || 'deepseek-chat',
        systemPrompt: savedSettings.systemPrompt || '你是一个乐于助人的助手，专注于帮助济南大学的学生。请提供准确、有用的信息和建议。',
        shareStudentData: savedSettings.shareStudentData || false
      };

      // 加载思维链显示设置
      showThinkingChain.value = savedSettings.showThinkingChain !== undefined ? savedSettings.showThinkingChain : true;

      console.log('思维链显示设置:', showThinkingChain.value);

      // 根据设置更新服务配置
      if (settings.value.serviceType === 'ollama') {
        aiAssistantService.setConfig({
          apiKey: '',
          apiUrl: `${settings.value.ollamaUrl}/v1/chat/completions`,
          model: settings.value.ollamaModel,
          shareStudentData: settings.value.shareStudentData
        });
      } else {
        aiAssistantService.setConfig({
          apiKey: settings.value.apiKey,
          apiUrl: settings.value.apiUrl,
          model: settings.value.model,
          shareStudentData: settings.value.shareStudentData
        });
      }
    } else {
      // 使用默认设置
      settings.value = {
        serviceType: 'deepseek',
        apiKey: '',
        apiUrl: 'https://api.deepseek.com/chat/completions',
        ollamaUrl: 'http://localhost:11434',
        ollamaModel: '',
        model: 'deepseek-chat',
        systemPrompt: '你是一个乐于助人的助手，专注于帮助济南大学的学生。请提供准确、有用的信息和建议。',
        shareStudentData: false
      };

      // 默认显示思维链
      showThinkingChain.value = true;
      console.log('使用默认思维链显示设置:', showThinkingChain.value);
    }
  } catch (error) {
    console.error('加载设置失败:', error);
    // 使用默认设置
    showThinkingChain.value = true;
  }
};

/**
 * 加载用户信息
 */
const loadUserInfo = async () => {
  try {
    // 获取用户信息
    const userInfo = authService.getUserInfo();

    // 如果有名字，直接使用
    if (userInfo.name) {
      userName.value = userInfo.name;
    } else if (userInfo.studentId) {
      // 否则使用学号作为名字
      userName.value = userInfo.studentId;
    } else {
      // 如果没有学号，使用默认名字
      userName.value = '我';
    }
  } catch (error) {
    console.error('加载用户信息失败:', error);
    userName.value = '我';
  }
};

/**
 * 加载语音设置
 */
const loadSpeechSettings = async () => {
  try {
    // 从存储加载语音识别配置
    const iatConfig = await store.getObject('speech_iat_config');
    if (iatConfig) {
      speechSettings.value.appId = iatConfig.appId || '';
      speechSettings.value.iatApiKey = iatConfig.apiKey || '';
      speechSettings.value.iatApiSecret = iatConfig.apiSecret || '';
    }

    // 从存储加载语音合成配置
    const ttsConfig = await store.getObject('speech_tts_config');
    if (ttsConfig) {
      // 如果appId在iatConfig中没有，尝试从ttsConfig中获取
      if (!speechSettings.value.appId && ttsConfig.appId) {
        speechSettings.value.appId = ttsConfig.appId;
      }
      speechSettings.value.ttsApiKey = ttsConfig.apiKey || '';
      speechSettings.value.ttsApiSecret = ttsConfig.apiSecret || '';

      // 加载语音合成偏好设置
      const ttsPrefs = await store.getObject('speech_tts_prefs');
      if (ttsPrefs) {
        speechSettings.value.voice = ttsPrefs.voice || 'xiaoyan';
        speechSettings.value.speed = ttsPrefs.speed || 50;
        speechSettings.value.volume = ttsPrefs.volume || 50;
        speechSettings.value.pitch = ttsPrefs.pitch || 50;
      }

      // 加载自动朗读设置
      const autoReadSettings = await store.getObject('speech_auto_read');
      if (autoReadSettings) {
        autoReadMessages.value = autoReadSettings.enabled || false;
      }
    }

    console.log('语音设置加载完成');
  } catch (error) {
    console.error('加载语音设置失败:', error);
  }
};

/**
 * 保存语音设置
 */
const saveSpeechSettings = async () => {
  try {
    // 保存语音识别配置
    await speechService.setConfig('iat', {
      appId: speechSettings.value.appId,
      apiKey: speechSettings.value.iatApiKey,
      apiSecret: speechSettings.value.iatApiSecret
    });

    // 保存语音合成配置
    await speechService.setConfig('tts', {
      appId: speechSettings.value.appId,
      apiKey: speechSettings.value.ttsApiKey,
      apiSecret: speechSettings.value.ttsApiSecret
    });

    // 保存语音合成偏好设置
    await store.putObject('speech_tts_prefs', {
      voice: speechSettings.value.voice,
      speed: speechSettings.value.speed,
      volume: speechSettings.value.volume,
      pitch: speechSettings.value.pitch
    });

    // 保存自动朗读设置
    await store.putObject('speech_auto_read', {
      enabled: autoReadMessages.value
    });

    showSpeechSettings.value = false;
    ElMessage.success('语音设置已保存');
  } catch (error) {
    console.error('保存语音设置失败:', error);
    ElMessage.error('保存语音设置失败: ' + error.message);
  }
};

/**
 * 切换语音输入 - 使用锁机制防止重复触发
 */
const toggleVoiceInput = async () => {
  // 如果按钮已禁用，直接返回
  if (isVoiceButtonDisabled.value) {
    console.log('操作进行中，请等待完成');
    ElMessage.warning('操作进行中，请等待完成');
    return;
  }

  // 立即禁用按钮，防止重复点击
  isVoiceButtonDisabled.value = true;

  try {
    // 在启动语音识别前清空之前的识别结果，提供更好的用户体验
    if (!isRecognizing.value) {
      recognitionResult.value = '';
      inputMessage.value = '';

      // 播放开始识别的音频反馈
      playAudioFeedback('start');
    } else {
      // 播放停止识别的音频反馈
      playAudioFeedback('stop');
    }

    if (isRecognizing.value) {
      console.log('开始停止语音识别...');
      // 先更新UI状态
      isRecognizing.value = false;

      // 然后执行停止操作
      await speechService.stopRecognize();
      console.log('语音识别已完全停止');

      // 停止后等待额外时间，确保所有资源都释放完毕
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('等待完成，资源已完全释放');
    } else {
      // 检查语音服务状态
      if (speechService.recognitionState !== 'idle') {
        console.warn(`语音服务状态不是空闲(${speechService.recognitionState})，等待变为空闲...`);

        // 等待服务状态变为空闲
        await new Promise((resolveState) => {
          const checkState = () => {
            if (speechService.recognitionState === 'idle') {
              resolveState();
            } else {
              setTimeout(checkState, 100);
            }
          };
          checkState();
        });

        console.log('语音服务状态已变为空闲，可以开始新录音');

        // 额外等待确保资源完全释放
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('开始启动语音识别...');
      // 先更新UI状态
      isRecognizing.value = true;

      // 启动语音识别
      await speechService.startRecognize(
          // 结果回调
          (text, isLast) => {
            // 更新输入框
            recognitionResult.value = text;
            inputMessage.value = recognitionResult.value;

            // 更新最后说话时间戳，用于静音检测
            lastSpeechTimestamp.value = Date.now();

            // 如果有静音检测定时器，重置它
            if (silenceTimer.value) {
              clearTimeout(silenceTimer.value);
              silenceTimer.value = null;
            }

            // 设置新的静音检测定时器
            if (isRecognizing.value && voiceConversationMode.value) {
              silenceTimer.value = setTimeout(() => {
                // 如果已经静音超过阈值，自动结束识别
                if (Date.now() - lastSpeechTimestamp.value > silenceThreshold && isRecognizing.value) {
                  console.log('检测到长时间静音，自动结束语音识别');
                  toggleVoiceInput();
                }
              }, silenceThreshold);
            }

            // 如果使用了句点或问号等终止符，也可以考虑在短暂延迟后自动结束
            const endPunctuations = ['.', '。', '?', '？', '!', '！'];
            if (text && endPunctuations.some(p => text.trim().endsWith(p)) && voiceConversationMode.value) {
              // 只在句子比较完整时才自动结束
              if (text.length > 10) {
                if (speechTimeout.value) {
                  clearTimeout(speechTimeout.value);
                }

                speechTimeout.value = setTimeout(() => {
                  if (isRecognizing.value) {
                    console.log('检测到完整句子，自动结束语音识别');
                    toggleVoiceInput();
                  }
                }, 1500); // 1.5秒后结束，给用户思考的时间
              }
            }

            // 如果是最后一帧，结束识别
            if (isLast) {
              isRecognizing.value = false;
              // 在回调中不释放按钮禁用状态，让主函数统一处理
            }

            // 检查是否是语音命令
            const isCommand = processVoiceCommands(text);

            // 如果是命令，自动停止语音识别
            if (isCommand) {
              // 清空输入框，防止命令被发送为消息
              recognitionResult.value = '';
              inputMessage.value = '';

              // 停止语音识别
              if (isRecognizing.value) {
                toggleVoiceInput();
              }
            }
          },
          // 错误回调
          (error) => {
            console.error('语音识别错误:', error);
            ElMessage.error('语音识别失败: ' + error.message);
            isRecognizing.value = false;
            // 在回调中不释放按钮禁用状态，让主函数统一处理
          }
      );
    }
  } catch (error) {
    console.error('语音操作失败:', error);
    ElMessage.error(error.message || '操作失败');
    // 恢复正确状态
    isRecognizing.value = false;
  } finally {
    // 操作完成后延长禁用时间，确保所有状态都已同步完成
    setTimeout(() => {
      isVoiceButtonDisabled.value = false;
      console.log('操作完成，按钮已启用');

      // 处理连续对话模式下的自动重启识别
      // 如果停止了识别，且处于连续对话模式，且不是因为加载状态而停止的
      if (!isRecognizing.value && voiceConversationMode.value && voiceConversationActive.value && !isLoading.value) {
        // 语音输入结束后，如果有足够长的输入，自动发送
        if (inputMessage.value.trim().length > 3) {
          sendMessage();
        } else {
          // 如果输入太短，等待一段时间后重新开始语音识别
          autoListeningTimeout.value = setTimeout(() => {
            if (voiceConversationMode.value && voiceConversationActive.value && !isLoading.value) {
              startVoiceConversation();
            }
          }, 1000); // 1秒后重新开始
        }
      }
    }, 500); // 延迟0.5秒，确保完全同步
  }
};

/**
 * 朗读消息
 * @param {string} text 要朗读的文本
 * @param {number} index 消息索引
 * @param {Function} onComplete 完成回调
 */
const speakMessage = async (text, index, onComplete) => {
  try {
    // 如果当前正在朗读这条消息，点击停止
    if (isSpeaking.value && currentSpeakingIndex.value === index) {
      console.log('停止当前消息朗读');
      speechService.stopPlayback();

      // 确保UI状态立即更新
      isSpeaking.value = false;
      currentSpeakingIndex.value = -1;

      // 如果提供了回调，调用回调
      if (onComplete) onComplete();
      return;
    }

    // 如果正在朗读其他消息，先停止
    if (isSpeaking.value) {
      console.log('停止其他消息朗读');
      speechService.stopPlayback();

      // 确保UI状态立即更新
      isSpeaking.value = false;
      currentSpeakingIndex.value = -1;

      // 添加足够的延迟确保所有资源都被清理
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 设置状态
    isSpeaking.value = true;
    currentSpeakingIndex.value = index;

    // 预处理文本以获得更好的朗读效果
    const processedText = preprocessTextForTTS(text);

    // 获取动态调整的TTS参数
    const ttsParams = dynamicAdjustTtsParams(processedText);

    // 启动语音合成
    await speechService.startSynthesize(
        processedText,
        // 开始回调
        () => {
          console.log('开始朗读');
        },
        // 结束回调
        () => {
          console.log('朗读结束');
          isSpeaking.value = false;
          currentSpeakingIndex.value = -1;

          // 如果提供了回调，调用回调
          if (onComplete) onComplete();
        },
        // 错误回调
        (error) => {
          console.error('语音合成错误:', error);
          ElMessage.error('语音合成失败: ' + error.message);
          isSpeaking.value = false;
          currentSpeakingIndex.value = -1;

          // 如果提供了回调，调用回调
          if (onComplete) onComplete();
        },
        // 合成选项
        ttsParams
    );
  } catch (error) {
    console.error('启动语音合成失败:', error);
    ElMessage.error('启动语音合成失败: ' + error.message);
    isSpeaking.value = false;
    currentSpeakingIndex.value = -1;

    // 如果提供了回调，调用回调
    if (onComplete) onComplete();
  }
};

// 监听设置对话框打开状态
watch(showSettings, async (newValue) => {
  if (newValue && settings.value.serviceType === 'ollama') {
    // 设置对话框打开时自动检测模型
    await nextTick();
    if (availableModels.value.length === 0) {
      await autoDetectModels();
    }
  }
});

// 监听服务类型变化
watch(() => settings.value.serviceType, async (newType) => {
  if (newType === 'ollama') {
    await nextTick();
    await autoDetectModels();
  }
});

// 监听Ollama URL变化
watch(() => settings.value.ollamaUrl, async (newUrl, oldUrl) => {
  if (newUrl !== oldUrl && settings.value.serviceType === 'ollama') {
    await autoDetectModels();
  }
});

// 初始化
onMounted(async () => {
  // 检查用户认证状态
  isAuthenticated.value = checkAuthentication();

  // 如果未认证，不继续加载其他内容
  if (!isAuthenticated.value) {
    return;
  }

  // 加载依赖
  await loadDependencies();

  // 加载侧边栏状态
  const sidebarStatus = localStorage.getItem('aiChatSidebarStatus');
  isSidebarCollapsed.value = sidebarStatus === '1';

  // 加载设置
  await loadSettings();

  // 加载用户信息
  await loadUserInfo();

  // 加载对话列表
  await loadConversations();

  // 加载语音设置
  await loadSpeechSettings();

  // 初始化语音对话管理器
  voiceConversationManager.init();

  // 从URL参数加载对话
  try {
    if (route && route.query && route.query.conversationId) {
      await loadConversation(route.query.conversationId);
      // 确保应用高亮
      await nextTick();
      applyCodeHighlighting();
    }
  } catch (error) {
    console.error('路由参数获取失败:', error);
  }

  // 设置事件监听器，实现代码块复制功能
  document.addEventListener('click', async (e) => {
    const target = e.target;

    // 如果点击的是代码复制按钮或其子元素
    if (target.closest('.copy-code-button')) {
      const button = target.closest('.copy-code-button');
      const codeAttr = button.getAttribute('data-code');

      try {
        if (!codeAttr) {
          throw new Error('没有找到代码数据');
        }

        const code = decodeURIComponent(codeAttr);

        // 确保代码是字符串
        if (typeof code !== 'string') {
          throw new Error('代码数据格式不正确');
        }

        // 复制到剪贴板
        await navigator.clipboard.writeText(code);

        // 更改按钮文本作为视觉反馈
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="el-icon-check"></i> 已复制';

        // 2秒后恢复原文本
        setTimeout(() => {
          button.innerHTML = originalText;
        }, 2000);

        ElMessage.success('代码已复制到剪贴板');
      } catch (error) {
        console.error('复制代码失败:', error);
        ElMessage.error('复制代码失败: ' + error.message);
      }
    }
  });

  // 新增：如果当前设置是ollama，自动检测模型
  if (settings.value.serviceType === 'ollama') {
    console.log('检测到Ollama配置，开始自动检测模型...');
    try {
      await autoDetectModels();
    } catch (error) {
      console.error('自动检测模型失败:', error);
    }
  }
});

// 监听认证状态变化
watch(
    () => authService.getLoginStatus(),
    (newStatus) => {
      isAuthenticated.value = newStatus.eas || newStatus.ipass;

      // 如果变为已认证状态，重新初始化
      if (isAuthenticated.value && messages.value.length === 0) {
        loadUserInfo();
        loadConversations();
      }
    },
    { deep: true }
);

// 监听消息变化，以便更新代码高亮和复制按钮
watch(
    () => messages.value,
    () => {
      nextTick(() => {
        // 应用代码高亮
        applyCodeHighlighting();
        // 设置代码复制按钮
        setupCodeCopyButtons();
      });
    },
    { deep: true }
);

// 监听识别结果变化
watch(
    () => recognitionResult.value,
    (newVal, oldVal) => {
      if (newVal && newVal !== oldVal) {
        // 只要有新的识别结果，更新最后说话时间戳
        lastSpeechTimestamp.value = Date.now();

        // 如果有静音检测定时器，重置它
        if (silenceTimer.value) {
          clearTimeout(silenceTimer.value);
          silenceTimer.value = null;
        }

        // 设置新的静音检测定时器
        if (isRecognizing.value && voiceConversationMode.value) {
          silenceTimer.value = setTimeout(() => {
            // 如果已经静音超过阈值，自动结束识别
            if (Date.now() - lastSpeechTimestamp.value > silenceThreshold && isRecognizing.value) {
              console.log('检测到长时间静音，自动结束语音识别');
              toggleVoiceInput();
            }
          }, silenceThreshold);
        }
      }
    }
);

// 在组件卸载时清理语音资源
onBeforeUnmount(async () => {
  // 停止语音识别
  if (isRecognizing.value) {
    await speechService.stopRecognize();
  }

  // 停止语音合成
  if (isSpeaking.value) {
    speechService.stopPlayback();
  }

  // 停止语音对话
  if (voiceConversationMode.value) {
    if (voiceChatMode.value) {
      exitVoiceChatMode();
    } else {
      voiceConversationManager.stop();
    }
    voiceConversationMode.value = false;
    voiceConversationActive.value = false;
  }

  // 清除所有定时器
  if (silenceTimer.value) {
    clearTimeout(silenceTimer.value);
    silenceTimer.value = null;
  }

  if (speechTimeout.value) {
    clearTimeout(speechTimeout.value);
    speechTimeout.value = null;
  }

  if (autoListeningTimeout.value) {
    clearTimeout(autoListeningTimeout.value);
    autoListeningTimeout.value = null;
  }
});
</script>

<style>
/* 全局样式 - 不使用scoped以确保高亮样式正确应用 */
.hljs {
  display: block;
  overflow-x: auto;
  padding: 1em;
  color: #383a42;
  background: #fafafa !important;
}

/* 确保代码块样式正确显示 */
pre code.hljs {
  padding: 0;
  background: #f8f8f8;
}

/* 优化代码块间距 */
.assistant-message .message-body pre {
  background-color: #f8f8f8;
  border-radius: 6px;
  padding: 0.8em;
  margin: 8px 0;
  overflow: hidden;
}

.assistant-message .message-body code {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 14px;
  tab-size: 2;
}

/* 引入highlight.js基本样式，确保语法高亮正确显示 */
.hljs-comment,
.hljs-quote {
  color: #a0a1a7;
  font-style: italic;
}

.hljs-doctag,
.hljs-keyword,
.hljs-formula {
  color: #a626a4;
}

.hljs-section,
.hljs-name,
.hljs-selector-tag,
.hljs-deletion,
.hljs-subst {
  color: #e45649;
}

.hljs-literal {
  color: #0184bb;
}

.hljs-string,
.hljs-regexp,
.hljs-addition,
.hljs-attribute,
.hljs-meta .hljs-string {
  color: #50a14f;
}

.hljs-attr,
.hljs-variable,
.hljs-template-variable,
.hljs-type,
.hljs-selector-class,
.hljs-selector-attr,
.hljs-selector-pseudo,
.hljs-number {
  color: #986801;
}

.hljs-symbol,
.hljs-bullet,
.hljs-link,
.hljs-meta,
.hljs-selector-id,
.hljs-title {
  color: #4078f2;
}

.hljs-built_in,
.hljs-title.class_,
.hljs-class .hljs-title {
  color: #c18401;
}

.hljs-emphasis {
  font-style: italic;
}

.hljs-strong {
  font-weight: bold;
}

.hljs-link {
  text-decoration: underline;
}

/* 优化代码块容器样式 */
.assistant-message .message-body .code-block-wrapper {
  position: relative;
  margin: 12px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-light);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  animation: fadeIn 0.3s ease-out;
}

.assistant-message .message-body .code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: linear-gradient(to right, #f3f3f3, #f8f8f8);
  color: #333;
  font-size: 12px;
  font-weight: 500;
  border-bottom: 1px solid var(--border-light);
}

.assistant-message .message-body .code-language {
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.assistant-message .message-body .copy-code-button {
  background-color: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 20px;
  font-size: 12px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.assistant-message .message-body .copy-code-button:hover {
  background-color: rgba(0, 122, 255, 0.1);
  color: var(--primary-color);
}

/* 朗读中的按钮样式 */
.message-actions .el-button.speaking {
  color: var(--primary-color);
  font-weight: 500;
}

/* 播放中的动画效果 */
@keyframes pulse {
  0% { opacity: 0.7; }
  50% { opacity: 1; }
  100% { opacity: 0.7; }
}

.message-actions .el-button.speaking {
  animation: pulse 2s infinite;
}

/* 朗读进度动画 */
.reading-dots span {
  opacity: 0;
  animation: reading-dot 1.4s infinite;
}

.reading-dots span:nth-child(1) {
  animation-delay: 0s;
}

.reading-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.reading-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes reading-dot {
  0% { opacity: 0; }
  50% { opacity: 1; }
  100% { opacity: 0; }
}

/* 添加代码块动画效果 */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 暗黑模式主题 */
@media (prefers-color-scheme: dark) {
  .assistant-message .message-body pre {
    background-color: #1e1e1e;
  }

  .hljs {
    background: #1e1e1e !important;
    color: #d4d4d4;
  }

  pre code.hljs {
    background: #1e1e1e;
  }

  .assistant-message .message-body .code-block-header {
    background: linear-gradient(to right, #2c2c2e, #333);
    color: #eee;
    border-bottom: 1px solid #444;
  }

  .assistant-message .message-body .copy-code-button {
    color: #aaa;
  }

  .assistant-message .message-body .copy-code-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: var(--secondary-color);
  }
}
</style>

<style scoped>
/* 添加全局主题变量 */
:root {
  --primary-color: #007AFF;
  --primary-dark: #0056b3;
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-tertiary: #f0f2f5;
  --text-primary: #333333;
  --text-secondary: #666666;
  --border-color: #e5e5e5;
  --border-light: #eeeeee;
  --shadow-light: 0 2px 12px rgba(0, 0, 0, 0.05);
  --shadow-hover: 0 4px 12px rgba(0, 122, 255, 0.15);
}

.ai-chat-container {
  display: flex;
  height: 100%;
  background-color: var(--bg-primary);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: var(--shadow-light);
  position: relative;
}

/* 认证遮罩 */
.auth-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.9);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(5px);
}

.auth-card {
  background-color: white;
  border-radius: 8px;
  padding: 30px;
  width: 400px;
  max-width: 90%;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.auth-icon {
  font-size: 48px;
  color: var(--primary-color);
  margin-bottom: 20px;
}

.auth-card h2 {
  font-size: 24px;
  margin-bottom: 15px;
  color: var(--text-primary);
}

.auth-card p {
  margin-bottom: 25px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.auth-buttons {
  display: flex;
  justify-content: center;
  gap: 15px;
}

.chat-sidebar {
  width: 260px;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  z-index: 10;
}

.chat-sidebar.collapsed {
  width: 60px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 10px;
  border-bottom: 1px solid var(--border-color);
}

.toggle-button {
  min-width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-header .el-button {
  padding: 8px 15px;
}

.conversations-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.conversation-item {
  display: flex;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 5px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.conversation-item:hover {
  background-color: var(--bg-tertiary);
  transform: translateX(2px);
}

.conversation-item.active {
  background-color: rgba(0, 122, 255, 0.1);
  border-left: 3px solid var(--primary-color);
}

.conversation-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
}

.conversation-time {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: 5px;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.chat-title {
  font-size: 16px;
  font-weight: 500;
}

.chat-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

/* 语音对话状态指示器 */
.voice-conversation-indicator {
  display: flex;
  align-items: center;
  margin-left: 15px;
  padding: 4px 10px;
  background-color: rgba(0, 122, 255, 0.1);
  border-radius: 20px;
  font-size: 12px;
  color: var(--primary-color);
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #909399;
  margin-right: 8px;
}

.indicator-dot.active {
  background-color: #67c23a;
  box-shadow: 0 0 0 rgba(103, 194, 58, 0.4);
  animation: pulse-green 2s infinite;
}

@keyframes pulse-green {
  0% {
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(103, 194, 58, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0);
  }
}

/* 优化聊天消息区域间距 */
.chat-messages {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  background-color: var(--bg-primary);
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
}

.ai-logo {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
}

/* 快速提示芯片 */
.ai-suggestions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
  max-width: 600px;
}

.suggestion-chip {
  padding: 8px 16px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
}

.suggestion-chip:hover {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
}

/* 思考指示器样式 */
.thinking-indicator {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 8px;
  background-color: rgba(0, 122, 255, 0.05);
  border-radius: 16px;
  border: 1px solid rgba(0, 122, 255, 0.1);
  animation: fadeIn 0.3s ease-out;
}

.thinking-dots {
  display: flex;
  align-items: center;
  margin-right: 8px;
}

.thinking-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--primary-color);
  margin: 0 2px;
  animation: thinkingDot 1.4s infinite ease-in-out;
}

.thinking-dots span:nth-child(1) {
  animation-delay: 0s;
}

.thinking-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.thinking-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes thinkingDot {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1.2);
    opacity: 1;
  }
}

.thinking-text {
  font-size: 14px;
  color: var(--primary-color);
  font-style: italic;
}

/* 优化思维链容器显示 */
.thinking-chain-container {
  margin: 12px 0;
  border: 1px solid rgba(0, 122, 255, 0.2);
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.03) 0%, rgba(0, 122, 255, 0.08) 100%);
  overflow: hidden;
  transition: all 0.3s ease;
  animation: slideInFromLeft 0.3s ease-out;
  min-height: 60px; /* 确保有最小高度 */
}

@keyframes slideInFromLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.thinking-chain-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(0, 122, 255, 0.1);
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid rgba(0, 122, 255, 0.15);
}

.thinking-chain-header:hover {
  background: rgba(0, 122, 255, 0.15);
}

.thinking-chain-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--primary-color);
}

.thinking-count {
  font-size: 12px;
  opacity: 0.7;
  font-weight: normal;
}

.collapse-icon {
  transition: transform 0.3s ease;
  color: var(--primary-color);
}

.collapse-icon.collapsed {
  transform: rotate(-90deg);
}

.thinking-chain-content {
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 1000px;
  }
}

/* 思维链内容样式优化 */
.thinking-chain-body {
  padding: 16px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 0 0 12px 12px;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #2c3e50;
  position: relative;
  overflow-x: auto;
  min-height: 20px;
  transition: all 0.2s ease;
}

.thinking-chain-body:empty::before {
  content: "正在分析思考中...";
  color: var(--text-secondary);
  font-style: italic;
  opacity: 0.7;
  display: block;
  padding: 8px 0;
}

/* 思维链光标样式 */
.thinking-cursor {
  display: inline-block;
  animation: thinkingBlink 1.2s step-end infinite;
  margin-left: 4px;
  color: var(--primary-color);
  font-weight: bold;
  font-size: 1.2em;
}

@keyframes thinkingBlink {
  0%, 60% { opacity: 1; }
  61%, 100% { opacity: 0; }
}

/* 最终答案容器优化 */
.final-answer-container {
  margin-top: 8px;
  animation: slideInFromRight 0.3s ease-out;
  min-height: 40px; /* 确保有最小高度 */
}

.final-answer-container .answer-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 193, 7, 0.05) 100%);
  border-radius: 8px 8px 0 0;
  font-weight: 500;
  color: #f57c00;
  border: 1px solid rgba(255, 193, 7, 0.2);
  border-bottom: none;
  animation: slideInFromRight 0.3s ease-out 0.2s both;
}

.final-answer-body.has-thinking-chain {
  border: 1px solid rgba(255, 193, 7, 0.2);
  border-top: none;
  border-radius: 0 0 8px 8px;
  background: rgba(255, 193, 7, 0.02);
}

@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 答案区域渐入效果 */
.final-answer-body {
  min-height: 20px;
  transition: all 0.2s ease;
}

.final-answer-body:empty::before {
  content: "准备生成最终回答...";
  color: var(--text-secondary);
  font-style: italic;
  opacity: 0.7;
  display: block;
  padding: 8px 0;
}

/* 优化消息容器间距 */
.message-container {
  display: flex;
  margin-bottom: 12px;
  max-width: 85%;
  animation: messageAppear 0.3s ease-out;
  transform-origin: center top;
}

/* 消息出现动画 */
@keyframes messageAppear {
  from {
    opacity: 0;
    transform: translateY(15px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 用户消息靠右显示 */
.user-message {
  margin-left: auto;
  flex-direction: row-reverse;
}

/* AI助手消息靠左显示 */
.assistant-message {
  margin-right: auto;
}

.message-avatar {
  margin: 0 12px;
  transition: transform 0.2s ease;
}

.message-avatar:hover {
  transform: scale(1.05);
}

.message-content {
  flex: 1;
  max-width: calc(100% - 60px);
}

.message-header {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

/* 用户消息标题靠右 */
.user-message .message-header {
  justify-content: flex-end;
}

.message-sender {
  font-weight: 500;
  margin: 0 8px;
}

.message-time {
  font-size: 12px;
  color: var(--text-secondary);
}

/* 优化消息气泡样式 */
.message-body {
  padding: 12px 16px;
  border-radius: 16px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  transition: all 0.2s ease;
}

.user-message .message-body {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  color: white;
  border-radius: 16px 16px 0 16px;
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.2);
}

.assistant-message .message-body {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 16px 16px 16px 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

/* 让用户消息中的代码片段更加可读 */
.user-message .message-body :deep(code) {
  background-color: rgba(255, 255, 255, 0.2);
  padding: 2px 4px;
  border-radius: 3px;
}

/* 用户消息操作按钮靠右 */
.user-message .message-actions {
  justify-content: flex-end;
}

.message-actions {
  display: flex;
  justify-content: flex-start;
  margin-top: 5px;
  flex-wrap: wrap;
  gap: 8px;
}

.message-actions .el-button {
  padding: 4px 12px;
  font-size: 12px;
  border-radius: 16px;
  transition: all 0.2s ease;
}

.message-actions .el-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.2);
}

/* 思维链代码块特殊样式 */
.thinking-chain-body pre {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  padding: 12px;
  margin: 8px 0;
  border-left: 3px solid var(--primary-color);
}

.thinking-chain-body code {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

/* 优化打字机光标样式 */
.typing-cursor {
  display: inline-block;
  animation: blink 1s step-end infinite;
  margin: 0 2px;
  color: var(--primary-color);
  font-weight: bold;
  vertical-align: baseline;
  line-height: 1;
  will-change: opacity;
  background-color: var(--primary-color);
  width: 2px;
  height: 1em;
  margin-left: 2px;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* 优化输入框样式 */
.chat-input {
  padding: 12px 16px;
  background-color: var(--bg-secondary);
  border-top: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

/* 美化输入框 */
:deep(.el-textarea__inner) {
  border-radius: 20px;
  padding: 12px 16px;
  resize: none;
  transition: all 0.3s ease;
  box-shadow: none;
  font-size: 14px;
  border: 1px solid var(--border-light);
  background-color: var(--bg-primary);
}

:deep(.el-textarea__inner:focus) {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.1);
}

/* 美化按钮 */
.input-actions .el-button {
  border-radius: 20px;
  padding: 10px 20px;
  transition: all 0.3s ease;
}

.input-actions .el-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.2);
}

/* 设置项说明文本 */
.setting-description {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 1.4;
}

/* 改进加载指示器 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 16px 0;
  padding: 20px;
  background-color: rgba(0, 122, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(0, 122, 255, 0.08);
}

.loading-text {
  margin-top: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  font-style: italic;
}

.dots-loader {
  display: flex;
  align-items: center;
  justify-content: center;
}

.dots-loader div {
  width: 8px;
  height: 8px;
  margin: 0 4px;
  border-radius: 50%;
  background-color: var(--primary-color);
  opacity: 0.6;
  animation: dots-loader 1.4s infinite ease-in-out both;
}

.dots-loader div:nth-child(1) {
  animation-delay: -0.32s;
}

.dots-loader div:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes dots-loader {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.3;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Markdown表格样式 */
.assistant-message .message-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
}

.assistant-message .message-body :deep(th),
.assistant-message .message-body :deep(td) {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.assistant-message .message-body :deep(th) {
  background-color: #f2f2f7;
  font-weight: 600;
}

.assistant-message .message-body :deep(tr:nth-child(even)) {
  background-color: #f9f9f9;
}

/* 引用块样式 */
.assistant-message .message-body :deep(blockquote) {
  border-left: 4px solid var(--primary-color);
  padding: 8px 16px;
  background-color: rgba(0, 122, 255, 0.05);
  margin: 12px 0;
}

/* 列表样式 */
.assistant-message .message-body :deep(ul),
.assistant-message .message-body :deep(ol) {
  padding-left: 20px;
  margin: 10px 0;
}

.assistant-message .message-body :deep(li) {
  margin-bottom: 4px;
}

/* 语音按钮样式 */
.voice-btn {
  margin-right: 10px;
  transition: all 0.3s ease;
}

.voice-btn:hover {
  transform: translateY(-1px);
}

/* 录音中动画效果 */
.voice-btn.recording {
  animation: pulse 1.5s infinite;
  background-color: #f56c6c;
  color: white;
  box-shadow: 0 0 10px rgba(245, 108, 108, 0.5);
}

/* 朗读中动画效果 */
@keyframes wave {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}

.speaking {
  animation: wave 2s infinite;
}

/* 语音设置对话框 */
.el-dialog__body .el-slider {
  width: 100%;
}

/* 播放控制按钮 */
.playback-controls {
  display: flex;
  align-items: center;
  margin-top: 5px;
}

.playback-controls .el-button {
  padding: 4px 8px;
  margin-right: 8px;
}

/* 音量指示器 */
.volume-indicator {
  display: flex;
  height: 20px;
  align-items: flex-end;
  margin-left: 10px;
}

.volume-bar {
  width: 3px;
  background-color: var(--primary-color);
  margin: 0 1px;
  transition: height 0.1s ease;
}

/* 优化开关样式 */
.chat-actions .el-switch {
  margin: 0 8px;
}

/* 语音波形动画 */
.voice-wave-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 10px 0;
  animation: fadeIn 0.3s ease-out;
}

.voice-wave {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
}

.voice-wave span {
  display: inline-block;
  width: 5px;
  height: 5px;
  margin: 0 2px;
  background-color: var(--primary-color);
  border-radius: 50%;
  animation: wave 1.5s infinite ease-in-out;
}

.voice-wave span:nth-child(1) {
  animation-delay: 0s;
}

.voice-wave span:nth-child(2) {
  animation-delay: 0.2s;
}

.voice-wave span:nth-child(3) {
  animation-delay: 0.4s;
}

.voice-wave span:nth-child(4) {
  animation-delay: 0.6s;
}

.voice-wave span:nth-child(5) {
  animation-delay: 0.8s;
}

.recognition-text {
  margin-top: 10px;
  font-size: 14px;
  color: var(--text-secondary);
  min-height: 20px;
  max-width: 80%;
  text-align: center;
}

/* 流式消息特殊样式 */
.streaming-message .message-body {
  position: relative;
  min-height: 24px;
}

.streaming-message .message-body::after {
  content: '';
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--primary-color);
  animation: pulse 2s infinite;
}

/* 响应式优化 */
@media (max-width: 768px) {
  .chat-messages {
    padding: 12px;
  }

  .message-container {
    max-width: 90%;
    margin-bottom: 10px;
  }

  .message-body {
    font-size: 14px;
    padding: 10px 14px;
  }

  .chat-sidebar {
    position: absolute;
    height: 100%;
    left: 0;
    top: 0;
    z-index: 100;
    width: 240px;
  }

  .chat-sidebar.collapsed {
    transform: translateX(-100%);
    width: 0;
    padding: 0;
    border: none;
    overflow: hidden;
  }

  .chat-sidebar.collapsed .toggle-button {
    position: absolute;
    right: -40px;
    top: 10px;
    background: var(--bg-secondary);
    border-radius: 0 4px 4px 0;
    box-shadow: 2px 0 5px rgba(0,0,0,0.1);
  }

  .input-actions {
    flex-direction: column;
    gap: 8px;
  }

  .input-actions .el-button {
    width: 100%;
  }

  .thinking-chain-header {
    padding: 10px 12px;
  }

  .thinking-chain-body {
    padding: 12px;
    font-size: 13px;
  }

  .thinking-chain-title {
    font-size: 14px;
  }

  .message-actions {
    flex-direction: column;
    gap: 4px;
  }

  .message-actions .el-button {
    width: 100%;
    justify-content: flex-start;
  }
}

/* 暗黑模式主题 */
@media (prefers-color-scheme: dark) {
  :root {
    --primary-color: #0A84FF;
    --primary-dark: #0066cc;
    --bg-primary: #1c1c1e;
    --bg-secondary: #2c2c2e;
    --bg-tertiary: #3a3a3c;
    --text-primary: #ffffff;
    --text-secondary: #999999;
    --border-color: #38383a;
    --border-light: #48484a;
  }

  .user-message .message-body {
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  }

  .assistant-message .message-body {
    background-color: var(--bg-secondary);
    border-color: var(--border-light);
  }

  .assistant-message .message-body :deep(th) {
    background-color: #2c2c2e;
  }

  .assistant-message .message-body :deep(tr:nth-child(even)) {
    background-color: #1c1c1e;
  }

  .thinking-indicator {
    background-color: rgba(0, 132, 255, 0.1);
    border-color: rgba(0, 132, 255, 0.2);
  }

  .loading-container {
    background-color: rgba(0, 132, 255, 0.05);
    border-color: rgba(0, 132, 255, 0.1);
  }

  .typing-cursor {
    background-color: var(--primary-color);
  }

  .thinking-chain-container {
    background: linear-gradient(135deg, rgba(0, 132, 255, 0.05) 0%, rgba(0, 132, 255, 0.1) 100%);
    border-color: rgba(0, 132, 255, 0.3);
  }

  .thinking-chain-header {
    background: rgba(0, 132, 255, 0.15);
  }

  .thinking-chain-body {
    background: rgba(0, 0, 0, 0.2);
    color: #e0e0e0;
  }

  .answer-header {
    background: linear-gradient(135deg, rgba(255, 193, 7, 0.15) 0%, rgba(255, 193, 7, 0.08) 100%);
    border-color: rgba(255, 193, 7, 0.3);
  }

  .final-answer-body {
    background: rgba(255, 193, 7, 0.03);
    border-color: rgba(255, 193, 7, 0.3);
  }
}
</style>