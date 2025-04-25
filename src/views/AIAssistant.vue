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
              <!-- 修改消息体的显示逻辑 -->
              <div
                  class="message-body"
                  :ref="el => message.role === 'assistant' && index === messages.length - 1 && isLoading ? streamingElementRef = el : null"
                  v-html="(message.role === 'assistant' && isLoading && index === messages.length - 1)
    ? ''
    : formatMessage(message.content)">
              </div>
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

const streamingElementRef = ref(null);


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

    // 等待DOM更新
    await nextTick();

    // 存储完整的AI响应（用于保存）
    let fullResponse = '';

    // 用于DOM操作的变量
    let streamingElement = null;
    let pendingContent = '';
    let typingInterval = null;

    // 创建实时markdown渲染器
    const markdownRenderer = createRealtimeMarkdownRenderer();

    // 确保有DOM元素
    const waitForElement = () => {
      return new Promise((resolve) => {
        const checkElement = () => {
          if (streamingElementRef.value) {
            streamingElement = streamingElementRef.value;
            resolve();
          } else {
            setTimeout(checkElement, 10);
          }
        };
        checkElement();
      });
    };

    await waitForElement();

    // 开始打字效果
    const startTyping = () => {
      if (typingInterval) return;

      // 使用批处理来减少DOM更新频率
      typingInterval = setInterval(() => {
        if (pendingContent.length > 0) {
          // 批量处理多个字符，减少DOM操作
          const chunkSize = Math.min(3, pendingContent.length); // 每次处理3个字符
          const chunk = pendingContent.slice(0, chunkSize);
          pendingContent = pendingContent.slice(chunkSize);

          // 批量处理字符
          let renderedContent = null;
          for (let i = 0; i < chunk.length; i++) {
            renderedContent = markdownRenderer.add(chunk[i]);
          }

          // 只在有渲染内容时更新DOM
          if (renderedContent && streamingElement) {
            // 使用requestAnimationFrame来优化渲染
            requestAnimationFrame(() => {
              streamingElement.innerHTML = renderedContent;

              // 移除旧光标
              const oldCursor = streamingElement.querySelector('.typing-cursor');
              if (oldCursor) {
                oldCursor.remove();
              }

              // 添加新光标
              const cursor = document.createElement('span');
              cursor.className = 'typing-cursor';
              cursor.textContent = '|';
              streamingElement.appendChild(cursor);
            });
          }

          // 使用节流来减少滚动频率
          const throttledScroll = throttle(scrollToBottom, 100);
          throttledScroll();
        } else {
          clearInterval(typingInterval);
          typingInterval = null;

          if (streamingElement) {
            const finalContent = markdownRenderer.finalize();
            requestAnimationFrame(() => {
              streamingElement.innerHTML = finalContent;
              // 移除光标
              const cursor = streamingElement.querySelector('.typing-cursor');
              if (cursor) {
                cursor.remove();
              }
            });
          }
        }
      }, 30);
    };

    // 在组件中添加节流函数
    const throttle = (func, limit) => {
      let inThrottle;
      return function(...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    };

    // 添加辅助函数：查找最后一个文本节点
    const findLastTextNode = (element) => {
      const walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT,
          null,
          false
      );

      let lastNode = null;
      while (walker.nextNode()) {
        if (walker.currentNode.textContent.trim().length > 0) {
          lastNode = walker.currentNode;
        }
      }

      return lastNode;
    };

    // 发送请求并处理流式响应
    await aiAssistantService.sendStreamingRequest(
        message,
        // 接收块的回调
        (chunk) => {
          fullResponse += chunk;
          pendingContent += chunk;

          // 如果还没开始打字，开始
          if (!typingInterval) {
            startTyping();
          }
        },
        // 完成时的回调
        (finalResponse) => {
          logDebug('流式响应完成:', finalResponse.substring(0, 50) + '...');

          // 等待所有字符显示完成
          const waitForTypingComplete = () => {
            if (pendingContent.length === 0 && !typingInterval) {
              // 完成后更新消息内容
              assistantMessage.content = fullResponse;

              // 确保关闭加载状态
              isLoading.value = false;

              // 显示最终格式化的内容
              nextTick(() => {
                if (streamingElement) {
                  streamingElement.innerHTML = formatMessage(fullResponse);
                }

                scrollToBottom();
                setupCodeCopyButtons();
              });

              // 保存对话历史
              if (currentConversationId.value) {
                // 延迟一小段时间确保UI先更新
                setTimeout(async () => {
                  try {
                    // 将AIAssistant组件的currentConversationId传递给service
                    aiAssistantService.currentConversationId = currentConversationId.value;
                    const saved = await saveCurrentConversation();

                    if (saved) {
                      console.log('对话保存成功，刷新列表');
                      // 保存成功后立即刷新对话列表
                      await loadConversations();
                    } else {
                      console.warn('对话保存失败');
                      // 尝试再次保存
                      setTimeout(async () => {
                        const retrySaved = await saveCurrentConversation();
                        if (retrySaved) {
                          console.log('重试保存成功');
                          await loadConversations();
                        } else {
                          console.error('重试保存仍然失败');
                          ElMessage.warning('对话保存可能未成功，重启后可能无法恢复');
                        }
                      }, 1000); // 1秒后重试
                    }
                  } catch (error) {
                    console.error('保存过程出错:', error);
                  }
                }, 100);
              } else {
                // 如果是新对话，创建一个ID并保存
                currentConversationId.value = 'conv_' + Date.now();
                console.log('创建新对话ID:', currentConversationId.value);

                // 延迟一小段时间确保UI先更新
                setTimeout(async () => {
                  try {
                    // 将新的ID传递给service
                    aiAssistantService.currentConversationId = currentConversationId.value;
                    const saved = await saveCurrentConversation();

                    if (saved) {
                      console.log('新对话保存成功，刷新列表');
                      // 保存成功后立即加载对话列表以更新UI
                      await loadConversations();
                    } else {
                      console.warn('新对话保存失败');
                      // 尝试再次保存
                      setTimeout(async () => {
                        const retrySaved = await saveCurrentConversation();
                        if (retrySaved) {
                          console.log('新对话重试保存成功');
                          await loadConversations();
                        } else {
                          console.error('新对话重试保存仍然失败');
                          ElMessage.warning('对话保存可能未成功，重启后可能无法恢复');
                        }
                      }, 1000); // 1秒后重试
                    }
                  } catch (error) {
                    console.error('保存新对话过程出错:', error);
                  }
                }, 100);
              }
            } else {
              // 继续等待
              setTimeout(waitForTypingComplete, 100);
            }
          };

          // 开始等待打字完成
          waitForTypingComplete();
        },
        // 错误处理回调
        (error) => {
          logDebug('流式响应错误:', error);

          // 停止打字
          if (typingInterval) {
            clearInterval(typingInterval);
            typingInterval = null;
          }

          // 确保关闭加载状态
          isLoading.value = false;

          // 显示错误
          const errorMessage = '\n\n> ⚠️ *错误: ' + error.message + '*';
          fullResponse += errorMessage;
          assistantMessage.content = fullResponse;

          if (streamingElement) {
            streamingElement.innerHTML = formatMessage(fullResponse);
          }

          nextTick(() => {
            scrollToBottom();
            setupCodeCopyButtons();
          });

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

    // 检查conversationId是否有效
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

      // 验证消息内容有效性
      if (!serviceMessages || !serviceMessages.length) {
        console.warn('从service获取到的消息为空');
        // 从localStorage再次尝试加载
        try {
          const storageKey = `ai_conversation_${conversationId}`;
          const storedData = localStorage.getItem(storageKey);

          if (storedData) {
            const parsedData = JSON.parse(storedData);
            if (parsedData && parsedData.messages && parsedData.messages.length) {
              console.log(`从localStorage恢复了${parsedData.messages.length}条消息`);
              messages.value = parsedData.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp || new Date().toISOString()
              }));

              // 同步回service
              aiAssistantService.setMessages(messages.value);

              // 继续处理
              await scrollToBottom();
              setupCodeCopyButtons();
              return;
            }
          }
        } catch (storageError) {
          console.error('从localStorage恢复失败:', storageError);
        }

        // 如果仍然失败，显示错误
        ElMessage.error('对话内容为空，无法加载');
        return;
      }

      // 将service中的消息转换为UI消息格式
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
      console.error(`对话 ${conversationId} 加载失败`);

      // 尝试从localStorage直接加载
      try {
        const storageKey = `ai_conversation_${conversationId}`;
        const storedData = localStorage.getItem(storageKey);

        if (storedData) {
          const parsedData = JSON.parse(storedData);
          if (parsedData && parsedData.messages && parsedData.messages.length) {
            console.log(`从localStorage直接加载了${parsedData.messages.length}条消息`);

            // 更新UI
            currentConversationId.value = conversationId;
            currentConversationTitle.value = getConversationTitle(parsedData);

            messages.value = parsedData.messages.map(msg => ({
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp || new Date().toISOString()
            }));

            // 同步回service
            aiAssistantService.setMessages(messages.value);
            aiAssistantService.currentConversationId = conversationId;

            // 继续处理
            await scrollToBottom();
            setupCodeCopyButtons();
            return;
          }
        }

        // 如果仍然无法加载
        ElMessage.error('加载对话失败，无法找到对话数据');
      } catch (directLoadError) {
        console.error('从localStorage直接加载失败:', directLoadError);
        ElMessage.error('加载对话失败: ' + directLoadError.message);
      }
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

    // 深拷贝消息，避免引用问题
    const messagesToSave = JSON.parse(JSON.stringify(messages.value.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp || new Date().toISOString()
    }))));

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

      // 刷新对话列表
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

/* 其他代码块样式保持不变 */
.assistant-message .message-body pre {
  background-color: #f8f8f8;
  border-radius: 6px;
  padding: 0;
  margin: 10px 0;
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

/* 代码块容器样式 */
.assistant-message .message-body .code-block-wrapper {
  position: relative;
  margin: 16px 0;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.assistant-message .message-body .code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #e8e8e8;
  color: #333;
  font-size: 12px;
  font-weight: 500;
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
  border-radius: 4px;
  font-size: 12px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.assistant-message .message-body .copy-code-button:hover {
  background-color: rgba(0, 0, 0, 0.1);
  color: var(--primary-color);
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
    background-color: #333;
    color: #eee;
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
  .assistant-message .message-body :deep(th) {
    background-color: #2c2c2e;
  }

  .assistant-message .message-body :deep(tr:nth-child(even)) {
    background-color: #1c1c1e;
  }
}

.message-body {
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
  position: relative;
  overflow-wrap: break-word;
}


/* 确保message-body本身的样式正确 */
.streaming-message .message-body {
  display: inline-block;
  min-width: 0;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 1.5em;
  contain: content; /* 限制重绘范围 */
  transform: translateZ(0); /* 创建新的渲染层，避免影响其他元素 */
}

.typing-cursor {
  display: inline-block;
  animation: blink 1s step-end infinite;
  margin: 0 2px;
  color: var(--text-primary);
  font-weight: bold;
  vertical-align: baseline;
  line-height: 1;
  will-change: opacity; /* 优化动画性能 */
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>