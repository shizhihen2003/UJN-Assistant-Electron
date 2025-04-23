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
              <!-- 使用v-html并应用消息格式化 -->
              <div class="message-body" v-html="formatMessage(message.content)"></div>
              <div class="message-actions" v-if="message.role === 'assistant'">
                <el-button link size="small" @click="copyMessageContent(message.content)">
                  <el-icon><CopyDocument /></el-icon> 复制全部
                </el-button>
              </div>
            </div>
          </div>

          <!-- 加载指示器 -->
          <div v-if="isLoading" class="loading-container">
            <div class="dots-loader">
              <div></div>
              <div></div>
              <div></div>
            </div>
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

    <!-- 设置对话框 -->
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
            <el-option label="DeepSeek Chat" value="deepseek-chat" />
            <el-option label="DeepSeek Reasoner" value="deepseek-reasoner" />
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
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showSettings = false">取消</el-button>
          <el-button type="primary" @click="saveSettings">保存</el-button>
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

    // 明确导入highlight.js样式
    await import('highlight.js/styles/atom-one-light.css');

    // 保存模块引用
    marked.value = markedModule.marked;
    DOMPurify.value = purifyModule.default;
    hljs.value = hljsModule.default;

    console.log('依赖库已成功加载');

    // 注册常用语言（可以根据需要添加更多）
    try {
      hljs.value.registerLanguage('javascript', (await import('highlight.js/lib/languages/javascript')).default);
      hljs.value.registerLanguage('python', (await import('highlight.js/lib/languages/python')).default);
      hljs.value.registerLanguage('java', (await import('highlight.js/lib/languages/java')).default);
      hljs.value.registerLanguage('cpp', (await import('highlight.js/lib/languages/cpp')).default);
      hljs.value.registerLanguage('csharp', (await import('highlight.js/lib/languages/csharp')).default);
      hljs.value.registerLanguage('html', (await import('highlight.js/lib/languages/xml')).default);
      hljs.value.registerLanguage('css', (await import('highlight.js/lib/languages/css')).default);
    } catch (e) {
      console.warn('注册语言失败:', e);
    }

    // 配置marked
    marked.value.setOptions({
      highlight: function(code, lang) {
        if (lang && hljs.value.getLanguage(lang)) {
          try {
            return hljs.value.highlight(code, { language: lang }).value;
          } catch (e) {
            console.error('高亮显示错误:', e);
          }
        }
        return hljs.value.highlightAuto(code).value;
      },
      breaks: true
    });

    // 添加代码复制按钮的自定义渲染器
    const renderer = new marked.value.Renderer();
    const originalCodeRenderer = renderer.code.bind(renderer);

    renderer.code = function(code, language, isEscaped) {
      // 获取原始代码块的HTML
      const originalHtml = originalCodeRenderer(code, language, isEscaped);

      // 确保代码是字符串并进行URI编码
      const encodedCode = encodeURIComponent(code);

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
  systemPrompt: '你是一个乐于助人的助手，专注于帮助济南大学的学生。请提供准确、有用的信息和建议。',
  shareStudentData: false
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
    // 使用marked处理Markdown
    const html = marked.value.parse(content);
    const sanitizedHtml = DOMPurify.value.sanitize(html);

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

        // 确保代码是字符串而不是对象
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

          // 强制触发DOM更新
          nextTick(() => {
            // 滚动到底部
            scrollToBottom();
            // 设置代码复制按钮
            setupCodeCopyButtons();
          });
        },
        // 完成时的回调
        (fullResponse) => {
          logDebug('流式响应完成:', fullResponse.substring(0, 50) + '...');
          isLoading.value = false;
          scrollToBottom();
          setupCodeCopyButtons();

          // 保存对话历史 - 修复的部分
          if (currentConversationId.value) {
            saveCurrentConversation();
          } else {
            // 如果是新对话，创建一个ID并保存
            currentConversationId.value = 'conv_' + Date.now();
            saveCurrentConversation().then(() => {
              // 保存成功后立即加载对话列表以更新UI
              loadConversations();
            });
          }
        },
        // 错误处理回调
        (error) => {
          logDebug('流式响应错误:', error);
          assistantMessage.content += '\n\n> ⚠️ *错误: ' + error.message + '*';
          isLoading.value = false;
          scrollToBottom();
          setupCodeCopyButtons();
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

      // 设置代码复制按钮
      setupCodeCopyButtons();
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
    const success = await aiAssistantService.saveConversation(currentConversationId.value);

    if (success) {
      // 确保对话列表刷新
      await loadConversations();

      // 如果是新对话，设置标题
      if (!currentConversationTitle.value) {
        const conversation = conversations.value.find(c => c.id === currentConversationId.value);
        if (conversation) {
          currentConversationTitle.value = getConversationTitle(conversation);
        }
      }
    }
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
 * 保存设置
 */
const saveSettings = async () => {
  try {
    // 保存设置到服务
    aiAssistantService.setConfig({
      apiKey: settings.value.apiKey,
      apiUrl: settings.value.apiUrl,
      model: settings.value.model,
      shareStudentData: settings.value.shareStudentData
    });

    // 创建一个简单的可序列化对象
    const settingsToSave = {
      apiKey: settings.value.apiKey,
      apiUrl: settings.value.apiUrl,
      model: settings.value.model,
      systemPrompt: settings.value.systemPrompt,
      shareStudentData: settings.value.shareStudentData
    };

    // 保存到本地存储
    try {
      if (ipc && typeof ipc.setStoreValue === 'function') {
        // 使用JSON序列化再反序列化来避免克隆问题
        const serialized = JSON.stringify(settingsToSave);
        const deserialized = JSON.parse(serialized);
        await ipc.setStoreValue('ai_assistant_settings', deserialized);
      } else {
        // 如果ipc不可用，使用localStorage
        localStorage.setItem('ai_assistant_settings', JSON.stringify(settingsToSave));
      }

      ElMessage.success('设置已保存');
      showSettings.value = false;
    } catch (storageError) {
      console.error('存储设置失败，尝试使用localStorage:', storageError);

      // 备选：使用localStorage
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
        systemPrompt: savedSettings.systemPrompt || '你是一个乐于助人的助手，专注于帮助济南大学的学生。请提供准确、有用的信息和建议。',
        shareStudentData: savedSettings.shareStudentData || false
      };

      // 更新服务配置
      aiAssistantService.setConfig({
        apiKey: settings.value.apiKey,
        apiUrl: settings.value.apiUrl,
        model: settings.value.model,
        shareStudentData: settings.value.shareStudentData
      });
    }
  } catch (error) {
    console.error('加载设置失败:', error);
    // 使用默认设置
    settings.value = {
      apiKey: '',
      apiUrl: 'https://api.deepseek.com/chat/completions',
      model: 'deepseek-chat',
      systemPrompt: '你是一个乐于助人的助手，专注于帮助济南大学的学生。请提供准确、有用的信息和建议。',
      shareStudentData: false
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

  // 设置事件监听器，实现代码块复制功能
  document.addEventListener('click', async (e) => {
    const target = e.target;

    // 如果点击的是代码复制按钮或其子元素
    if (target.closest('.copy-code-button')) {
      const button = target.closest('.copy-code-button');
      const code = decodeURIComponent(button.getAttribute('data-code'));

      try {
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
        ElMessage.error('复制代码失败');
      }
    }
  });
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

// 监听消息变化，以便更新代码复制按钮
watch(
    () => messages.value,
    () => {
      // 当消息更新时，重新设置代码复制按钮
      nextTick(() => {
        setupCodeCopyButtons();
      });
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
  border: 1px solid var(--border-color);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.suggestion-chip:hover {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
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

/* 代码块样式 */
.assistant-message .message-body :deep(pre) {
  background-color: #f8f8f8;
  border-radius: 6px;
  padding: 0;
  margin: 10px 0;
  overflow: hidden;
}

.assistant-message .message-body :deep(code) {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 14px;
  tab-size: 2;
}

.assistant-message .message-body :deep(.code-block-wrapper) {
  position: relative;
  margin: 16px 0;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.assistant-message .message-body :deep(.code-block-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #e8e8e8;
  color: #333;
  font-size: 12px;
  font-weight: 500;
}

.assistant-message .message-body :deep(.code-language) {
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.assistant-message .message-body :deep(.copy-code-button) {
  background-color: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.assistant-message .message-body :deep(.copy-code-button:hover) {
  background-color: rgba(0, 0, 0, 0.1);
  color: var(--primary-color);
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

/* 设置项说明文本 */
.setting-description {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 1.4;
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

/* Markdown表格样式 */
.assistant-message .message-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 15px 0;
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

/* 响应式调整 */
@media (max-width: 768px) {
  .chat-sidebar {
    position: absolute;
    height: 100%;
    left: 0;
    top: 0;
    z-index: 100;
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

  .message-container {
    max-width: 95%;
  }
}

/* 暗黑模式主题 */
@media (prefers-color-scheme: dark) {
  .assistant-message .message-body :deep(pre) {
    background-color: #1e1e1e;
  }

  .assistant-message .message-body :deep(.code-block-header) {
    background-color: #333;
    color: #eee;
  }

  .assistant-message .message-body :deep(.copy-code-button) {
    color: #aaa;
  }

  .assistant-message .message-body :deep(.copy-code-button:hover) {
    background-color: rgba(255, 255, 255, 0.1);
    color: var(--secondary-color);
  }

  .assistant-message .message-body :deep(th) {
    background-color: #2c2c2e;
  }

  .assistant-message .message-body :deep(tr:nth-child(even)) {
    background-color: #1c1c1e;
  }
}
</style>