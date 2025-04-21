<template>
  <div class="ai-chat-container">
    <!-- Login overlay if not authenticated -->
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

    <!-- Sidebar with conversation list -->
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

    <!-- Main chat area -->
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
          <el-tooltip content="设置">
            <el-button link @click="showSettings = true">
              <el-icon><Setting /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>

      <div class="chat-messages" ref="chatMessagesRef">
        <div v-if="messages.length === 0" class="empty-chat">
          <img src="@/assets/ai-logo.png" alt="AI Logo" class="ai-logo" />
          <h2>AI助手</h2>
          <p>有什么可以帮助你的吗？</p>
        </div>

        <div v-else>
          <div
              v-for="(message, index) in messages"
              :key="index"
              class="message-container"
              :class="{ 'user-message': message.role === 'user', 'assistant-message': message.role === 'assistant' }"
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
              <div class="message-body" v-html="formatMessage(message.content)"></div>
              <div class="message-actions" v-if="message.role === 'assistant'">
                <el-button link size="small" @click="copyMessageContent(message.content)">
                  <el-icon><CopyDocument /></el-icon> 复制
                </el-button>
              </div>
            </div>
          </div>

          <!-- Loading indicator -->
          <div v-if="isLoading" class="loading-container">
            <div class="dots-loader">
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
        </div>
      </div>

      <div class="chat-input">
        <el-input
            v-model="inputMessage"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 4 }"
            placeholder="输入消息，按Enter发送，Shift+Enter换行"
            @keydown.enter.prevent="handleEnterKey"
            :disabled="isLoading"
        />
        <div class="input-actions">
          <el-button type="primary" @click="sendMessage" :loading="isLoading" :disabled="!inputMessage.trim()">
            <el-icon><Position /></el-icon>
            发送
          </el-button>
        </div>
      </div>
    </div>

    <!-- Settings dialog -->
    <el-dialog v-model="showSettings" title="AI助手设置" width="500px">
      <el-form label-position="top">
        <el-form-item label="API Key">
          <el-input v-model="settings.apiKey" placeholder="输入DeepSeek API Key" show-password />
        </el-form-item>
        <el-form-item label="API URL">
          <el-input v-model="settings.apiUrl" placeholder="DeepSeek API URL" />
        </el-form-item>
        <el-form-item label="模型">
          <el-select v-model="settings.model" style="width: 100%">
            <el-option label="DeepSeek-V3" value="deepseek-chat" />
            <el-option label="DeepSeek-R1" value="deepseek-reasoner" />
          </el-select>
        </el-form-item>
        <el-form-item label="系统提示词">
          <el-input
              v-model="settings.systemPrompt"
              type="textarea"
              :rows="3"
              placeholder="设置AI助手的行为指南"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showSettings = false">取消</el-button>
          <el-button type="primary" @click="saveSettings">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Rename dialog -->
    <el-dialog v-model="showRenameDialog" title="重命名对话" width="400px">
      <el-input v-model="renameTitle" placeholder="输入新标题" />
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showRenameDialog = false">取消</el-button>
          <el-button type="primary" @click="confirmRename">确认</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Delete confirmation dialog -->
    <el-dialog v-model="showDeleteDialog" title="删除对话" width="400px">
      <p>确定要删除此对话吗？此操作无法撤销。</p>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showDeleteDialog = false">取消</el-button>
          <el-button type="danger" @click="confirmDelete">删除</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus, ArrowLeft, ArrowRight, Delete, Setting,
  CopyDocument, Position, More, ChatRound, Lock
} from '@element-plus/icons-vue';
import aiAssistantService from '@/services/aiAssistantService';
import authService from '@/services/authService';
import ipc from '@/utils/ipc';

// 路由在setup顶层获取
const route = useRoute();

// 用于标记库的引用
const marked = ref(null);
const DOMPurify = ref(null);
const hljs = ref(null);

// 认证状态检查
const isAuthenticated = ref(false);

// 日志记录函数
function logDebug(...args) {
  console.log('[AI Chat]', ...args);
}

// 异步加载所需库
async function loadDependencies() {
  try {
    // 动态导入所需库
    const [markedModule, purifyModule, hljsModule] = await Promise.all([
      import('marked'),
      import('dompurify'),
      import('highlight.js'),
    ]);

    // 导入highlight.js样式
    await import('highlight.js/styles/atom-one-light.css');

    // 保存模块引用
    marked.value = markedModule.marked;
    DOMPurify.value = purifyModule.default;
    hljs.value = hljsModule.default;

    // 配置marked
    marked.value.setOptions({
      highlight: function(code, lang) {
        if (lang && hljs.value.getLanguage(lang)) {
          try {
            return hljs.value.highlight(code, { language: lang }).value;
          } catch (e) {
            console.error(e);
          }
        }
        return hljs.value.highlightAuto(code).value;
      },
      breaks: true
    });

    console.log('所有依赖已加载成功');
  } catch (error) {
    console.error('加载依赖失败:', error);
    ElMessage.error('加载依赖失败，部分功能可能无法正常使用');
  }
}

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
  apiKey: '',
  apiUrl: 'https://api.deepseek.com/chat/completions',
  model: 'deepseek-chat',
  systemPrompt: '你是一个乐于助人的助手。'
});

// 对话操作对话框
const showRenameDialog = ref(false);
const showDeleteDialog = ref(false);
const renameTitle = ref('');
const actionTargetId = ref('');

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
    const html = marked.value.parse(content);
    return DOMPurify.value.sanitize(html);
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
 * 发送消息
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

    // 滚动到底部
    await scrollToBottom();

    // 设置加载状态
    isLoading.value = true;

    // 准备接收流式响应
    let assistantMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString()
    };

    // 添加空白助手消息到聊天记录
    messages.value.push(assistantMessage);

    // 发送请求并处理流式响应
    await aiAssistantService.sendStreamingRequest(
        message,
        // 接收块的回调
        (chunk) => {
          assistantMessage.content += chunk;
          scrollToBottom();
        },
        // 完成时的回调
        (fullResponse) => {
          logDebug('流式响应完成:', fullResponse.substring(0, 50) + '...');
          isLoading.value = false;
          scrollToBottom();

          // 保存对话历史
          if (currentConversationId.value) {
            saveCurrentConversation();
          } else {
            // 如果是新对话，创建一个ID并保存
            currentConversationId.value = 'conv_' + Date.now();
            saveCurrentConversation();
            loadConversations();
          }
        },
        // 错误处理回调
        (error) => {
          logDebug('流式响应错误:', error);
          assistantMessage.content += '\n\n> ⚠️ *错误: ' + error.message + '*';
          isLoading.value = false;
          scrollToBottom();
          ElMessage.error('请求失败: ' + error.message);
        },
        // 系统消息
        settings.value.systemPrompt
    );
  } catch (error) {
    console.error('发送消息失败:', error);
    isLoading.value = false;
    ElMessage.error('发送消息失败: ' + error.message);
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
  aiAssistantService.clearMessages();
};

/**
 * 加载指定ID的对话
 */
const loadConversation = async (conversationId) => {
  try {
    const success = await aiAssistantService.loadConversation(conversationId);

    if (success) {
      // 更新UI
      currentConversationId.value = conversationId;
      const conversation = conversations.value.find(c => c.id === conversationId);
      currentConversationTitle.value = conversation?.title || '';

      // 将aiAssistantService中的消息转换为UI消息格式
      const serviceMessages = aiAssistantService.getMessages();
      messages.value = serviceMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || new Date().toISOString()
      }));

      // 滚动到底部
      await scrollToBottom();
    } else {
      ElMessage.error('加载对话失败');
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
  if (!currentConversationId.value) return;

  try {
    // 更新aiAssistantService的消息
    aiAssistantService.setMessages(messages.value.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp
    })));

    // 保存对话
    await aiAssistantService.saveConversation(currentConversationId.value);

    // 刷新对话列表
    loadConversations();
  } catch (error) {
    console.error('保存对话失败:', error);
    ElMessage.error('保存对话失败: ' + error.message);
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
    const conversationKey = `ai_conversation_${actionTargetId.value}`;

    try {
      if (ipc && typeof ipc.deleteStoreValue === 'function') {
        await ipc.deleteStoreValue(conversationKey);
      }
    } catch (deleteError) {
      console.warn('从ipc删除对话失败:', deleteError);
    }

    // 无论ipc是否成功，都尝试从localStorage删除
    try {
      localStorage.removeItem(conversationKey);
    } catch (localStorageError) {
      console.warn('从localStorage删除对话失败:', localStorageError);
    }

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
 * 保存设置
 */
const saveSettings = async () => {
  try {
    // 保存设置到服务
    aiAssistantService.setConfig({
      apiKey: settings.value.apiKey,
      apiUrl: settings.value.apiUrl,
      model: settings.value.model
    });

    // 保存到本地存储 - 使用localStorage作为备选
    try {
      if (ipc && typeof ipc.setStoreValue === 'function') {
        await ipc.setStoreValue('ai_assistant_settings', {
          apiKey: settings.value.apiKey,
          apiUrl: settings.value.apiUrl,
          model: settings.value.model,
          systemPrompt: settings.value.systemPrompt
        });
      } else {
        // 如果ipc不可用，使用localStorage
        localStorage.setItem('ai_assistant_settings', JSON.stringify({
          apiKey: settings.value.apiKey,
          apiUrl: settings.value.apiUrl,
          model: settings.value.model,
          systemPrompt: settings.value.systemPrompt
        }));
      }

      ElMessage.success('设置已保存');
      showSettings.value = false;
    } catch (storageError) {
      console.error('存储设置失败，尝试使用localStorage:', storageError);

      // 备选：使用localStorage
      localStorage.setItem('ai_assistant_settings', JSON.stringify({
        apiKey: settings.value.apiKey,
        apiUrl: settings.value.apiUrl,
        model: settings.value.model,
        systemPrompt: settings.value.systemPrompt
      }));

      ElMessage.success('设置已保存(使用备选存储)');
      showSettings.value = false;
    }
  } catch (error) {
    console.error('保存设置失败:', error);
    ElMessage.error('保存设置失败: ' + error.message);
  }
};

/**
 * 加载设置
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
        apiKey: savedSettings.apiKey || '',
        apiUrl: savedSettings.apiUrl || 'https://api.deepseek.com/chat/completions',
        model: savedSettings.model || 'deepseek-chat',
        systemPrompt: savedSettings.systemPrompt || '你是一个乐于助人的助手。'
      };

      // 更新服务配置
      aiAssistantService.setConfig({
        apiKey: settings.value.apiKey,
        apiUrl: settings.value.apiUrl,
        model: settings.value.model
      });
    }
  } catch (error) {
    console.error('加载设置失败:', error);
    // 使用默认设置
    settings.value = {
      apiKey: '',
      apiUrl: 'https://api.deepseek.com/chat/completions',
      model: 'deepseek-chat',
      systemPrompt: '你是一个乐于助人的助手。'
    };
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

  // 从URL参数加载对话
  try {
    if (route && route.query && route.query.conversationId) {
      await loadConversation(route.query.conversationId);
    }
  } catch (error) {
    console.error('路由参数获取失败:', error);
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
</script>

<style scoped>
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
  border-right: 1px solid var(--border-color);
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
  border-radius: 6px;
  margin-bottom: 5px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.conversation-item:hover {
  background-color: var(--bg-tertiary);
}

.conversation-item.active {
  background-color: rgba(0, 122, 255, 0.1);
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
}

.chat-messages {
  flex: 1;
  padding: 20px;
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

.message-container {
  display: flex;
  margin-bottom: 20px;
  max-width: 85%;
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

.message-body {
  padding: 12px;
  border-radius: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.user-message .message-body {
  background-color: var(--primary-color);
  color: white;
  border-top-right-radius: 2px;
}

.assistant-message .message-body {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-top-left-radius: 2px;
}

/* 用户消息操作按钮靠右 */
.user-message .message-actions {
  justify-content: flex-start;
}

.message-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 5px;
}

.chat-input {
  padding: 15px;
  background-color: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
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
  border-radius: 18px;
  padding: 10px 15px;
  resize: none;
  transition: all 0.3s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  font-size: 14px;
}

:deep(.el-textarea__inner:focus) {
  box-shadow: 0 2px 6px rgba(0, 120, 255, 0.2);
}

/* 美化按钮 */
.input-actions .el-button {
  border-radius: 20px;
  padding: 10px 20px;
}

/* Loading indicator */
.loading-container {
  display: flex;
  justify-content: center;
  margin: 10px 0;
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
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

/* Markdown styling */
:deep(.message-body) {
  color: inherit;
}

:deep(.message-body h1) {
  font-size: 1.5em;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

:deep(.message-body h2) {
  font-size: 1.3em;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

:deep(.message-body h3) {
  font-size: 1.1em;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

:deep(.message-body p) {
  margin-bottom: 1em;
}

:deep(.message-body pre) {
  background-color: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
  margin-bottom: 1em;
}

:deep(.message-body code) {
  background-color: #f5f5f5;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.9em;
}

:deep(.message-body table) {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 1em;
}

:deep(.message-body th),
:deep(.message-body td) {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

:deep(.message-body th) {
  background-color: #f2f2f2;
}

:deep(.message-body ul),
:deep(.message-body ol) {
  padding-left: 1.5em;
  margin-bottom: 1em;
}

:deep(.message-body blockquote) {
  border-left: 4px solid #ddd;
  padding-left: 10px;
  color: #666;
  margin-left: 0;
  margin-right: 0;
}

/* Dark theme overrides - to be implemented if needed */
@media (prefers-color-scheme: dark) {
  /* Dark theme styling can be added here */
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .chat-sidebar {
    position: absolute;
    height: 100%;
    left: 0;
    top: 0;
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
}
</style>