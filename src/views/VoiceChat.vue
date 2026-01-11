<!-- VoiceChat.vue - 语音对话覆盖层组件 (优化版) -->
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
          <div class="status-indicator" :class="statusClass"></div>

          <!-- 语音状态指示器 -->
          <div class="voice-status">
            <template v-if="currentState === 'listening'">
              <div class="voice-wave">
                <span v-for="i in 5" :key="i"></span>
              </div>
              <div class="status-text">正在聆听...</div>
              <div class="recognized-text" v-if="recognizedText">{{ recognizedText }}</div>
            </template>

            <template v-else-if="currentState === 'thinking'">
              <div class="thinking-dots">
                <span v-for="i in 3" :key="i"></span>
              </div>
              <div class="status-text">思考中...</div>
            </template>

            <template v-else-if="currentState === 'speaking'">
              <div class="speaking-wave">
                <span v-for="i in 5" :key="i"></span>
              </div>
              <div class="status-text">正在回答...</div>
            </template>

            <template v-else>
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
            :class="{
              'listening': currentState === 'listening',
              'thinking': currentState === 'thinking'
            }"
            @click="handleMicClick">
          <el-icon><Microphone /></el-icon>
        </button>

        <!-- 停止按钮 - 在回答时显示 -->
        <button
            v-if="currentState === 'speaking'"
            class="stop-button"
            @click="handleStopClick">
          <el-icon><VideoPause /></el-icon>
        </button>
      </div>
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
  emits: ['start-listening', 'stop-listening', 'stop-speaking', 'exit-voice-mode'],
  data() {
    return {
      // 简化状态：idle | listening | thinking | speaking
      currentState: 'idle',
      recognizedText: '',

      // 静音检测
      silenceTimer: null,
      silenceThreshold: 3000, // 3秒静音自动停止

      // 自动开始下一轮
      nextTurnTimer: null,
      nextTurnDelay: 1500, // 1.5秒后自动开始下一轮
    }
  },
  computed: {
    statusClass() {
      return {
        'listening-status': this.currentState === 'listening',
        'thinking-status': this.currentState === 'thinking',
        'speaking-status': this.currentState === 'speaking',
        'idle-status': this.currentState === 'idle'
      };
    }
  },
  watch: {
    active(newVal) {
      console.log('[VoiceChat] active changed:', newVal);
      if (newVal) {
        this.reset();
      } else {
        this.cleanup();
      }
    },

    currentState(newState, oldState) {
      console.log(`[VoiceChat] 状态: ${oldState} -> ${newState}`);
      this.onStateChange(newState, oldState);
    }
  },
  methods: {
    // ==================== 状态管理 ====================

    /**
     * 直接设置状态（不做复杂验证，提高响应速度）
     */
    setState(newState) {
      if (this.currentState === newState) return;
      this.currentState = newState;
    },

    /**
     * 状态变化处理
     */
    onStateChange(newState, oldState) {
      // 清理定时器
      this.clearTimers();

      switch (newState) {
        case 'listening':
          this.startSilenceDetection();
          break;
        case 'idle':
          // 如果是从 speaking 结束，自动开始下一轮
          if (oldState === 'speaking' && this.active) {
            this.scheduleNextTurn();
          }
          break;
      }
    },

    // ==================== 用户交互 ====================

    /**
     * 麦克风按钮点击
     */
    handleMicClick() {
      console.log('[VoiceChat] 麦克风点击，当前状态:', this.currentState);

      switch (this.currentState) {
        case 'idle':
          this.startListening();
          break;
        case 'listening':
          this.stopListening(false);
          break;
        case 'speaking':
          // 回答时点击麦克风 = 打断回答，然后开始新录音
          this.$emit('stop-speaking');
          this.setState('idle');
          // 延迟一下再开始录音，确保播放完全停止
          setTimeout(() => {
            if (this.active && this.currentState === 'idle') {
              this.startListening();
            }
          }, 300);
          break;
        case 'thinking':
          // 思考中点击，取消当前操作，回到 idle
          this.$emit('stop-speaking');
          this.setState('idle');
          break;
      }
    },

    /**
     * 停止按钮点击
     */
    handleStopClick() {
      console.log('[VoiceChat] 停止按钮点击');
      this.$emit('stop-speaking');
      this.setState('idle');
    },

    /**
     * 退出语音模式
     */
    exitVoiceMode() {
      console.log('[VoiceChat] 退出语音模式');
      this.cleanup();
      this.$emit('exit-voice-mode');
    },

    // ==================== 语音识别控制 ====================

    /**
     * 开始聆听
     */
    startListening() {
      console.log('[VoiceChat] 开始聆听');
      this.recognizedText = '';
      this.setState('listening');
      this.$emit('start-listening');
    },

    /**
     * 停止聆听
     */
    stopListening(isSilence = false) {
      if (this.currentState !== 'listening') return;

      console.log('[VoiceChat] 停止聆听, 静音触发:', isSilence);

      // 立即切换到 idle 或 thinking 状态，不要等待父组件回调
      // 如果有识别文本，切换到 thinking；否则切换到 idle
      if (this.recognizedText && this.recognizedText.trim().length >= 2) {
        this.setState('thinking');
      } else {
        this.setState('idle');
      }

      this.$emit('stop-listening', isSilence, this.recognizedText);
    },

    // ==================== 父组件调用的方法 ====================

    /**
     * 收到语音识别结果
     */
    handleSpeechResult(text) {
      console.log('[VoiceChat] 识别结果:', text);
      this.recognizedText = text;

      // 重置静音检测
      if (this.currentState === 'listening') {
        this.resetSilenceDetection();
      }
    },

    /**
     * 开始 AI 思考
     */
    startThinking() {
      console.log('[VoiceChat] -> thinking');
      this.setState('thinking');
    },

    /**
     * 开始 AI 回答（语音播放）
     */
    startSpeaking(response) {
      console.log('[VoiceChat] -> speaking');
      this.setState('speaking');
    },

    /**
     * AI 回答完成
     */
    completeSpeaking() {
      console.log('[VoiceChat] -> idle (speaking complete)');
      this.setState('idle');
    },

    /**
     * AI 被停止
     */
    handleAIStop() {
      console.log('[VoiceChat] AI stopped');
      this.setState('idle');
    },

    /**
     * 处理错误
     */
    handleError(message) {
      console.error('[VoiceChat] Error:', message);
      this.setState('idle');
    },

    // ==================== 静音检测 ====================

    startSilenceDetection() {
      this.silenceTimer = setTimeout(() => {
        if (this.currentState === 'listening') {
          console.log('[VoiceChat] 静音超时，自动停止');
          this.stopListening(true);
        }
      }, this.silenceThreshold);
    },

    resetSilenceDetection() {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
      }
      this.startSilenceDetection();
    },

    // ==================== 自动下一轮 ====================

    scheduleNextTurn() {
      console.log('[VoiceChat] 安排下一轮对话');
      this.nextTurnTimer = setTimeout(() => {
        if (this.active && this.currentState === 'idle') {
          console.log('[VoiceChat] 自动开始下一轮');
          this.startListening();
        }
      }, this.nextTurnDelay);
    },

    // ==================== 工具方法 ====================

    clearTimers() {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      if (this.nextTurnTimer) {
        clearTimeout(this.nextTurnTimer);
        this.nextTurnTimer = null;
      }
    },

    reset() {
      console.log('[VoiceChat] 重置');
      this.clearTimers();
      this.currentState = 'idle';
      this.recognizedText = '';
    },

    cleanup() {
      console.log('[VoiceChat] 清理');
      this.clearTimers();
      this.currentState = 'idle';
      this.recognizedText = '';
    }
  },

  mounted() {
    console.log('[VoiceChat] mounted');
    if (this.active) {
      this.reset();
    }
  },

  beforeUnmount() {
    console.log('[VoiceChat] beforeUnmount');
    this.cleanup();
  }
}
</script>

<style scoped>
.voice-chat-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.voice-chat-container {
  width: 100%;
  max-width: 500px;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.voice-chat-header {
  display: flex;
  justify-content: flex-end;
  padding: 10px;
}

.close-button {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: background 0.2s;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.voice-chat-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-avatar-container {
  text-align: center;
  position: relative;
}

.ai-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(255, 255, 255, 0.2);
}

.status-indicator {
  position: absolute;
  bottom: 5px;
  right: 5px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid white;
}

.idle-status { background: #909399; }
.listening-status { background: #67C23A; animation: pulse 1.5s infinite; }
.thinking-status { background: #E6A23C; animation: pulse 1s infinite; }
.speaking-status { background: #409EFF; animation: pulse 1.2s infinite; }

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.7; }
}

.voice-status {
  margin-top: 30px;
  min-height: 100px;
}

.status-text {
  color: white;
  font-size: 18px;
  margin-top: 15px;
}

.recognized-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  margin-top: 10px;
  max-width: 300px;
  word-break: break-word;
}

/* 波形动画 */
.voice-wave, .speaking-wave {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  gap: 4px;
}

.voice-wave span, .speaking-wave span {
  display: block;
  width: 4px;
  height: 20px;
  background: #67C23A;
  border-radius: 2px;
  animation: wave 1s ease-in-out infinite;
}

.speaking-wave span {
  background: #409EFF;
}

.voice-wave span:nth-child(1) { animation-delay: 0s; }
.voice-wave span:nth-child(2) { animation-delay: 0.1s; }
.voice-wave span:nth-child(3) { animation-delay: 0.2s; }
.voice-wave span:nth-child(4) { animation-delay: 0.3s; }
.voice-wave span:nth-child(5) { animation-delay: 0.4s; }

.speaking-wave span:nth-child(1) { animation-delay: 0s; }
.speaking-wave span:nth-child(2) { animation-delay: 0.15s; }
.speaking-wave span:nth-child(3) { animation-delay: 0.3s; }
.speaking-wave span:nth-child(4) { animation-delay: 0.45s; }
.speaking-wave span:nth-child(5) { animation-delay: 0.6s; }

@keyframes wave {
  0%, 100% { height: 10px; }
  50% { height: 35px; }
}

/* 思考动画 */
.thinking-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  gap: 8px;
}

.thinking-dots span {
  width: 12px;
  height: 12px;
  background: #E6A23C;
  border-radius: 50%;
  animation: thinking 1.4s ease-in-out infinite;
}

.thinking-dots span:nth-child(1) { animation-delay: 0s; }
.thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes thinking {
  0%, 100% { transform: translateY(0); opacity: 0.4; }
  50% { transform: translateY(-10px); opacity: 1; }
}

/* 空闲提示 */
.idle-prompt {
  font-size: 48px;
  color: rgba(255, 255, 255, 0.5);
}

/* 控制区 */
.voice-chat-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  padding: 30px;
}

.mic-button {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #409EFF, #66b1ff);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(64, 158, 255, 0.4);
}

.mic-button:hover:not(.disabled) {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(64, 158, 255, 0.5);
}

.mic-button.listening {
  background: linear-gradient(135deg, #67C23A, #85ce61);
  box-shadow: 0 4px 15px rgba(103, 194, 58, 0.4);
  animation: mic-pulse 1.5s infinite;
}

.mic-button.thinking {
  background: linear-gradient(135deg, #E6A23C, #ebb563);
  box-shadow: 0 4px 15px rgba(230, 162, 60, 0.4);
  animation: mic-pulse 1s infinite;
}

.mic-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.4); }
  50% { box-shadow: 0 0 0 20px rgba(103, 194, 58, 0); }
}

.stop-button {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #F56C6C, #f78989);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(245, 108, 108, 0.4);
}

.stop-button:hover {
  transform: scale(1.05);
}
</style>