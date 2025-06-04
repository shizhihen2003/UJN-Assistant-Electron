<!-- VoiceChat.vue - 语音对话覆盖层组件 -->
<template>
  <div class="voice-chat-overlay" v-if="active">
    <div class="voice-chat-container">
      <!-- 顶部操作区 -->
      <div class="voice-chat-header">
        <button class="close-button" @click="exitVoiceMode">
          <el-icon><Close /></el-icon>
        </button>
      </div>

      <!-- 中央状态显示区 -->
      <div class="voice-chat-content">
        <!-- AI形象/头像 -->
        <div class="ai-avatar-container">
          <img src="@/assets/ai-avatar.png" alt="AI助手" class="ai-avatar">

          <!-- 状态指示器 -->
          <div class="status-indicator" :class="{
            'listening-status': currentState === 'listening',
            'thinking-status': currentState === 'thinking',
            'speaking-status': currentState === 'speaking',
            'idle-status': currentState === 'idle'
          }"></div>

          <!-- 语音状态指示器 -->
          <div class="voice-status">
            <template v-if="currentState === 'listening'">
              <!-- 用户说话时的波形动画 -->
              <div class="voice-wave">
                <span v-for="i in 5" :key="i"></span>
              </div>
              <div class="status-text">正在聆听...</div>
            </template>

            <template v-else-if="currentState === 'thinking'">
              <!-- AI思考中的动画 -->
              <div class="thinking-dots">
                <span v-for="i in 3" :key="i"></span>
              </div>
              <div class="status-text">思考中...</div>
            </template>

            <template v-else-if="currentState === 'speaking'">
              <!-- AI说话时的波形动画 -->
              <div class="speaking-wave">
                <span v-for="i in 5" :key="i"></span>
              </div>
              <div class="status-text">正在回答...</div>
            </template>

            <template v-else>
              <!-- 空闲状态 - 提示用户说话 -->
              <div class="idle-prompt">
                <el-icon><Microphone /></el-icon>
              </div>
              <div class="status-text">点击麦克风开始对话</div>
            </template>
          </div>
        </div>
      </div>

      <!-- 底部控制区 -->
      <div class="voice-chat-controls">
        <button
            class="mic-button"
            :class="{ 'listening': currentState === 'listening' }"
            @click="toggleListening"
            :disabled="isTransitioning">
          <el-icon><Microphone /></el-icon>
        </button>

        <!-- 仅在回答时显示的停止按钮 -->
        <button
            v-if="currentState === 'speaking'"
            class="stop-button"
            @click="stopSpeaking">
          <el-icon><VideoPause /></el-icon>
        </button>
      </div>

      <!-- 调试模式 (开发环境可开启) -->
<!--      <div v-if="debugMode" class="debug-panel">-->
<!--        <div>当前状态: {{ currentState }}</div>-->
<!--        <div>识别文本: {{ recognizedText }}</div>-->
<!--        <div>转换中: {{ isTransitioning }}</div>-->
<!--        <button @click="debugReset">重置状态</button>-->
<!--      </div>-->
    </div>
  </div>
</template>

<script>
import { Close, Microphone, VideoPause } from '@element-plus/icons-vue';

export default {
  name: 'VoiceChat',
  components: {
    Close,
    Microphone,
    VideoPause
  },
  props: {
    active: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      // 统一状态管理 - 只用一个状态变量
      currentState: 'idle', // 'idle' | 'listening' | 'thinking' | 'speaking'

      // 防止状态转换冲突
      isTransitioning: false,

      // 辅助数据
      recognizedText: '',
      debugMode: true,

      // 内部计时器
      silenceTimer: null,
      nextTurnTimer: null,

      // 配置
      silenceThreshold: 3000, // 3秒静音自动停止
      nextTurnDelay: 2000,    // 下一轮延迟时间
    }
  },
  watch: {
    currentState(newState, oldState) {
      console.log(`[VoiceChat] 状态变化: ${oldState} -> ${newState}`);

      // 状态变化时清理定时器
      this.clearAllTimers();

      // 根据新状态设置相应的定时器或逻辑
      this.handleStateChange(newState, oldState);
    },

    active(newVal) {
      console.log('[VoiceChat] 组件激活状态变化:', newVal);
      if (newVal) {
        this.initializeComponent();
      } else {
        this.cleanup();
      }
    }
  },
  methods: {
    // =============================================================================
    // 核心状态管理方法
    // =============================================================================

    /**
     * 安全地改变状态
     */
    changeState(newState, force = false) {
      if (this.isTransitioning && !force) {
        console.warn(`[VoiceChat] 状态转换中，忽略改变到 ${newState}`);
        return false;
      }

      if (this.currentState === newState) {
        console.log(`[VoiceChat] 状态已经是 ${newState}，跳过`);
        return true;
      }

      // 验证状态转换是否合法
      if (!this.isValidStateTransition(this.currentState, newState)) {
        console.error(`[VoiceChat] 非法状态转换: ${this.currentState} -> ${newState}`);
        return false;
      }

      console.log(`[VoiceChat] 执行状态转换: ${this.currentState} -> ${newState}`);

      this.isTransitioning = true;
      const oldState = this.currentState;
      this.currentState = newState;

      // 状态转换完成后解除锁定
      this.$nextTick(() => {
        this.isTransitioning = false;
      });

      return true;
    },

    /**
     * 验证状态转换是否合法
     */
    isValidStateTransition(fromState, toState) {
      const validTransitions = {
        'idle': ['listening'],
        'listening': ['thinking', 'idle'],
        'thinking': ['speaking', 'idle'],
        'speaking': ['idle']
      };

      return validTransitions[fromState]?.includes(toState) || toState === 'idle';
    },

    /**
     * 处理状态变化
     */
    handleStateChange(newState, oldState) {
      switch (newState) {
        case 'listening':
          this.onEnterListening();
          break;
        case 'thinking':
          this.onEnterThinking();
          break;
        case 'speaking':
          this.onEnterSpeaking();
          break;
        case 'idle':
          this.onEnterIdle(oldState);
          break;
      }
    },

    // =============================================================================
    // 状态进入处理方法
    // =============================================================================

    onEnterListening() {
      console.log('[VoiceChat] 进入聆听状态');
      // 启动静音检测
      this.startSilenceDetection();
    },

    onEnterThinking() {
      console.log('[VoiceChat] 进入思考状态');
      // 思考状态不需要特殊处理，等待父组件完成AI处理
    },

    onEnterSpeaking() {
      console.log('[VoiceChat] 进入回答状态');
      // 回答状态由父组件控制语音播放
    },

    onEnterIdle(fromState) {
      console.log('[VoiceChat] 进入空闲状态，来自:', fromState);

      // 如果是从speaking状态进入idle，且组件仍然激活，则安排下一轮
      if (fromState === 'speaking' && this.active) {
        this.scheduleNextTurn();
      }
    },

    // =============================================================================
    // 用户操作方法
    // =============================================================================

    /**
     * 切换聆听状态（用户点击麦克风）
     */
    toggleListening() {
      console.log('[VoiceChat] 用户点击麦克风，当前状态:', this.currentState);

      if (this.isTransitioning) {
        console.log('[VoiceChat] 状态转换中，忽略点击');
        return;
      }

      switch (this.currentState) {
        case 'idle':
          this.startListening();
          break;
        case 'listening':
          this.stopListening(false); // 用户主动停止
          break;
        case 'speaking':
          this.stopSpeaking();
          break;
        case 'thinking':
          // 思考中不允许操作
          console.log('[VoiceChat] 思考中，忽略点击');
          break;
      }
    },

    /**
     * 开始聆听
     */
    startListening() {
      if (!this.changeState('listening')) {
        return;
      }

      // 清空之前的识别结果
      this.recognizedText = '';

      // 通知父组件开始语音识别
      this.$emit('start-listening');
    },

    /**
     * 停止聆听
     */
    stopListening(isSilence = false) {
      if (this.currentState !== 'listening') {
        console.log('[VoiceChat] 当前不在聆听状态，忽略停止请求');
        return;
      }

      console.log('[VoiceChat] 停止聆听，静音触发:', isSilence);

      // 通知父组件停止语音识别
      this.$emit('stop-listening', isSilence, this.recognizedText);
    },

    /**
     * 停止回答
     */
    stopSpeaking() {
      if (this.currentState !== 'speaking') {
        return;
      }

      console.log('[VoiceChat] 用户停止回答');

      // 通知父组件停止语音播放
      this.$emit('stop-speaking');

      // 立即转换到空闲状态
      this.changeState('idle', true);
    },

    // =============================================================================
    // 父组件调用的方法
    // =============================================================================

    /**
     * 父组件调用：收到语音识别结果
     */
    handleSpeechResult(text) {
      console.log('[VoiceChat] 收到语音识别结果:', text);
      this.recognizedText = text;

      // 如果正在聆听，重置静音检测
      if (this.currentState === 'listening') {
        this.resetSilenceDetection();
      }
    },

    /**
     * 父组件调用：开始AI思考
     */
    startThinking() {
      console.log('[VoiceChat] 父组件通知开始思考');
      this.changeState('thinking');
    },

    /**
     * 父组件调用：开始AI回答
     */
    startSpeaking(response) {
      console.log('[VoiceChat] 父组件通知开始回答');
      this.changeState('speaking');
    },

    /**
     * 父组件调用：AI回答完成
     */
    completeSpeaking() {
      console.log('[VoiceChat] 父组件通知回答完成');
      this.changeState('idle');
    },

    /**
     * 父组件调用：发生错误
     */
    handleError(message) {
      console.error('[VoiceChat] 收到错误:', message);
      this.changeState('idle', true);
    },

    // =============================================================================
    // 内部辅助方法
    // =============================================================================

    /**
     * 启动静音检测
     */
    startSilenceDetection() {
      this.silenceTimer = setTimeout(() => {
        if (this.currentState === 'listening') {
          console.log('[VoiceChat] 检测到静音，自动停止');
          this.stopListening(true);
        }
      }, this.silenceThreshold);
    },

    /**
     * 重置静音检测
     */
    resetSilenceDetection() {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      this.startSilenceDetection();
    },

    /**
     * 安排下一轮对话
     */
    scheduleNextTurn() {
      console.log('[VoiceChat] 安排下一轮对话');

      this.nextTurnTimer = setTimeout(() => {
        if (this.active && this.currentState === 'idle') {
          console.log('[VoiceChat] 自动开始下一轮');
          this.startListening();
        }
      }, this.nextTurnDelay);
    },

    /**
     * 清理所有定时器
     */
    clearAllTimers() {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      if (this.nextTurnTimer) {
        clearTimeout(this.nextTurnTimer);
        this.nextTurnTimer = null;
      }
    },

    /**
     * 初始化组件
     */
    initializeComponent() {
      console.log('[VoiceChat] 初始化组件');
      this.currentState = 'idle';
      this.isTransitioning = false;
      this.recognizedText = '';
      this.clearAllTimers();
    },

    /**
     * 清理资源
     */
    cleanup() {
      console.log('[VoiceChat] 清理资源');
      this.clearAllTimers();
      this.currentState = 'idle';
      this.isTransitioning = false;
    },

    /**
     * 退出语音模式
     */
    exitVoiceMode() {
      console.log('[VoiceChat] 退出语音模式');

      // 清理所有状态
      this.cleanup();

      // 通知父组件退出
      this.$emit('exit-voice-mode');
    },

    /**
     * 调试重置
     */
    debugReset() {
      console.log('[VoiceChat] 调试重置');
      this.cleanup();
      this.initializeComponent();
    }
  },

  mounted() {
    console.log('[VoiceChat] 组件挂载');
    this.initializeComponent();
  },

  beforeUnmount() {
    console.log('[VoiceChat] 组件即将卸载');
    this.cleanup();
  }
}
</script>

<style scoped>
.voice-chat-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.85);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.voice-chat-container {
  width: 100%;
  height: 100%;
  max-width: 500px;
  max-height: 700px;
  display: flex;
  flex-direction: column;
  color: white;
}

.voice-chat-header {
  display: flex;
  justify-content: flex-end;
  padding: 20px;
}

.close-button {
  background: transparent;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.voice-chat-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.ai-avatar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ai-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  margin-bottom: 30px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 0 30px rgba(0, 122, 255, 0.3);
  transition: all 0.3s ease;
}

/* 状态指示器 */
.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin: 0 auto 10px;
  background-color: #999;
  transition: all 0.3s ease;
}

.listening-status {
  background-color: #FF3B30;
  box-shadow: 0 0 10px #FF3B30;
  animation: pulse 1.5s infinite;
}

.thinking-status {
  background-color: #FFCC00;
  box-shadow: 0 0 10px #FFCC00;
  animation: glow 2s infinite ease-in-out;
}

.speaking-status {
  background-color: #5AC8FA;
  box-shadow: 0 0 10px #5AC8FA;
  animation: pulse 1.5s infinite;
}

.idle-status {
  background-color: #8E8E93;
}

.voice-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 80px;
  justify-content: center;
}

.status-text {
  margin-top: 15px;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
}

/* 波形动画 */
.voice-wave, .speaking-wave {
  display: flex;
  align-items: center;
  height: 40px;
  justify-content: center;
}

.voice-wave span, .speaking-wave span {
  display: inline-block;
  width: 4px;
  height: 20px;
  margin: 0 3px;
  background-color: #007AFF;
  border-radius: 2px;
  animation: wave 1.2s infinite ease-in-out;
}

.voice-wave span:nth-child(1) { animation-delay: 0s; }
.voice-wave span:nth-child(2) { animation-delay: 0.2s; }
.voice-wave span:nth-child(3) { animation-delay: 0.4s; }
.voice-wave span:nth-child(4) { animation-delay: 0.6s; }
.voice-wave span:nth-child(5) { animation-delay: 0.8s; }

.speaking-wave span {
  background-color: #5AC8FA;
}

@keyframes wave {
  0%, 100% {
    height: 10px;
    opacity: 0.7;
  }
  50% {
    height: 30px;
    opacity: 1;
  }
}

/* 思考点动画 */
.thinking-dots {
  display: flex;
  align-items: center;
  height: 40px;
  justify-content: center;
}

.thinking-dots span {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin: 0 5px;
  background-color: #5AC8FA;
  border-radius: 50%;
  animation: thinking 1.4s infinite ease-in-out;
}

.thinking-dots span:nth-child(1) { animation-delay: 0s; }
.thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes thinking {
  0%, 100% {
    opacity: 0.2;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

/* 空闲状态提示 */
.idle-prompt {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  font-size: 28px;
  color: rgba(255, 255, 255, 0.7);
  animation: breathe 3s infinite ease-in-out;
}

@keyframes breathe {
  0%, 100% {
    opacity: 0.7;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* 底部控制区 */
.voice-chat-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 30px 0;
  gap: 20px;
}

.mic-button {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  border: none;
  background-color: #007AFF;
  color: white;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px rgba(0, 122, 255, 0.5);
}

.mic-button:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 0 25px rgba(0, 122, 255, 0.7);
}

.mic-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: scale(0.95);
}

.mic-button.listening {
  background-color: #FF3B30;
  box-shadow: 0 0 20px rgba(255, 59, 48, 0.5);
  animation: pulse 1.5s infinite;
}

.stop-button {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: none;
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.stop-button:hover {
  background-color: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 20px rgba(255, 59, 48, 0.5);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 30px rgba(255, 59, 48, 0.7);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 20px rgba(255, 59, 48, 0.5);
  }
}

@keyframes glow {
  0%, 100% {
    box-shadow: 0 0 10px #FFCC00;
  }
  50% {
    box-shadow: 0 0 20px #FFCC00, 0 0 30px rgba(255, 204, 0, 0.5);
  }
}

/* 调试面板 */
.debug-panel {
  position: absolute;
  top: 10px;
  left: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border-radius: 5px;
  font-size: 12px;
  z-index: 10000;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.debug-panel div {
  margin-bottom: 5px;
  font-family: monospace;
}

.debug-panel button {
  background-color: #007AFF;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  transition: background-color 0.2s ease;
}

.debug-panel button:hover {
  background-color: #0056b3;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .voice-chat-container {
    max-width: 100%;
    padding: 0 10px;
  }

  .ai-avatar {
    width: 100px;
    height: 100px;
  }

  .mic-button {
    width: 60px;
    height: 60px;
    font-size: 20px;
  }

  .stop-button {
    width: 45px;
    height: 45px;
    font-size: 16px;
  }

  .status-text {
    font-size: 16px;
  }

  .debug-panel {
    font-size: 10px;
    padding: 8px;
  }
}

/* 状态转换动画 */
.voice-chat-container * {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 可访问性支持 */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* 高对比度支持 */
@media (prefers-contrast: high) {
  .voice-chat-overlay {
    background-color: rgba(0, 0, 0, 0.95);
  }

  .status-indicator {
    border: 2px solid currentColor;
  }

  .mic-button, .stop-button {
    border: 2px solid rgba(255, 255, 255, 0.5);
  }
}
</style>