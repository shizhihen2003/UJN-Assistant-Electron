<!-- VoiceChat.vue - 语音对话覆盖层组件 -->
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
            'listening-status': listening,
            'thinking-status': thinking,
            'speaking-status': speaking,
            'idle-status': !listening && !thinking && !speaking
          }"></div>

          <!-- 语音状态指示器 -->
          <div class="voice-status">
            <template v-if="listening">
              <!-- 用户说话时的波形动画 -->
              <div class="voice-wave">
                <span v-for="i in 5" :key="i"></span>
              </div>
              <div class="status-text">正在聆听...</div>
            </template>

            <template v-else-if="thinking">
              <!-- AI思考中的动画 -->
              <div class="thinking-dots">
                <span v-for="i in 3" :key="i"></span>
              </div>
              <div class="status-text">思考中...</div>
            </template>

            <template v-else-if="speaking">
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
            :class="{ 'listening': listening }"
            @click="toggleListening">
          <el-icon><Microphone /></el-icon>
        </button>

        <!-- 仅在回答时显示的停止按钮 -->
        <button
            v-if="speaking"
            class="stop-button"
            @click="stopSpeaking">
          <el-icon><VideoPause /></el-icon>
        </button>
      </div>

      <!-- 调试模式 (开发环境可开启) -->
      <div v-if="debugMode" class="debug-panel">
        <div>当前状态: {{ currentState }}</div>
        <div>识别文本: {{ recognizedText }}</div>
        <button @click="debugReset">重置状态</button>
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
  data() {
    return {
      listening: false,
      thinking: false,
      speaking: false,
      recognizedText: '',
      currentResponse: '',
      debugMode: true, // 开启调试模式帮助排查
      autoStart: true, // 是否自动开始下一轮
      silenceDetected: false // 是否检测到静音
    }
  },
  computed: {
    currentState() {
      if (this.listening) return 'listening';
      if (this.thinking) return 'thinking';
      if (this.speaking) return 'speaking';
      return 'idle';
    }
  },
  watch: {
    // 监视状态变化，方便调试
    listening(newVal) {
      console.log('[VoiceChat] listening 状态变化:', newVal);
    },
    thinking(newVal) {
      console.log('[VoiceChat] thinking 状态变化:', newVal);
    },
    speaking(newVal) {
      console.log('[VoiceChat] speaking 状态变化:', newVal);
      // 如果说话状态结束，且是因为播放完成
      if (!newVal && !this.silenceDetected) {
        // 延迟后开始下一轮
        this.onSpeakingFinished();
      }
    },
    active(newVal) {
      console.log('[VoiceChat] 组件激活状态变化:', newVal);
      if (newVal) {
        // 初始化状态
        this.resetState();
      }
    }
  },
  methods: {
    // 重置所有状态
    resetState() {
      this.listening = false;
      this.thinking = false;
      this.speaking = false;
      this.recognizedText = '';
      this.currentResponse = '';
      this.silenceDetected = false;
      console.log('[VoiceChat] 所有状态已重置');
    },

    // 切换语音输入状态
    toggleListening() {
      console.log('[VoiceChat] 触发toggleListening', {
        listening: this.listening,
        thinking: this.thinking,
        speaking: this.speaking
      });

      if (this.speaking) {
        // 如果AI正在说话，先停止
        this.stopSpeaking();
        return;
      }

      if (this.listening) {
        // 停止录音并处理
        this.stopListening();
      } else {
        // 开始录音
        this.startListening();
      }
    },

    // 开始录音
    startListening() {
      console.log('[VoiceChat] 开始录音');

      // 确保其他状态已清除
      this.thinking = false;
      this.speaking = false;
      this.silenceDetected = false;

      // 设置当前状态
      this.listening = true;

      // 调用语音识别服务
      this.$emit('start-listening');
    },

    // 用户主动停止录音
    stopListening() {
      console.log('[VoiceChat] 停止录音 (用户主动)');
      this._stopListening(false);
    },

    // 因静音检测停止录音
    stopListeningByTimeout() {
      console.log('[VoiceChat] 停止录音 (静音检测)');
      this.silenceDetected = true;
      this._stopListening(true);
    },

    // 内部停止录音实现
    _stopListening(isSilence) {
      // 更新状态
      this.listening = false;
      this.thinking = true;

      // 通知父组件停止录音和处理语音
      this.$emit('stop-listening', isSilence);
    },

    // 收到语音识别结果
    handleSpeechResult(text) {
      console.log('[VoiceChat] 收到语音识别结果:', text);
      this.recognizedText = text;

      // 通知父组件处理识别文本
      this.$emit('speech-result', text);
    },

    // 开始AI回答的播放
    startSpeaking(response) {
      console.log('[VoiceChat] 开始播放AI回答');

      // 更新状态
      this.thinking = false;
      this.speaking = true;
      this.currentResponse = response;
    },

    // 停止AI回答的播放
    stopSpeaking() {
      console.log('[VoiceChat] 停止播放AI回答');

      // 更新状态
      this.speaking = false;

      // 通知父组件停止播放
      this.$emit('stop-speaking');
    },

    // 单次对话完成 (AI回答播放完毕)
    completeTurn() {
      console.log('[VoiceChat] 对话轮次完成');

      // 不要在这里改变speaking状态，让playCompleteResponse函数处理
      // 只需重置其他状态
      this.thinking = false;
      this.listening = false;

      console.log('[VoiceChat] 对话轮次状态已重置，等待下一轮');
    },

    // AI播放完成后的处理
    onSpeakingFinished() {
      console.log('[VoiceChat] AI回答播放完成');

      // 如果配置了自动开始下一轮，延迟后开始
      if (this.autoStart) {
        console.log('[VoiceChat] 将在延迟后自动开始下一轮');
        setTimeout(() => {
          if (this.active && !this.listening && !this.thinking && !this.speaking) {
            this.startListening();
          }
        }, 2000);
      }
    },

    // 准备下一轮对话
    prepareNextTurn() {
      console.log('[VoiceChat] 准备下一轮对话');

      // 触发事件，通知父组件准备下一轮
      this.$emit('prepare-next-turn', this.silenceDetected);

      // 重置静音检测状态
      this.silenceDetected = false;
    },

    // 退出语音模式
    exitVoiceMode() {
      console.log('[VoiceChat] 退出语音模式');

      // 确保停止所有活动
      if (this.listening) {
        this.$emit('stop-listening');
      }

      if (this.speaking) {
        this.$emit('stop-speaking');
      }

      // 重置状态
      this.resetState();

      // 通知父组件退出语音模式
      this.$emit('exit-voice-mode');
    },

    // 调试用 - 重置状态
    debugReset() {
      this.resetState();
    },

    // 显示错误
    showError(message) {
      console.error('[VoiceChat] 语音对话错误:', message);
      // 重置状态
      this.resetState();
    }
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
}

/* 添加状态指示器 */
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
}

.speaking-status {
  background-color: #5AC8FA;
  box-shadow: 0 0 10px #5AC8FA;
}

.idle-status {
  background-color: #8E8E93;
}

.voice-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 80px;
}

.status-text {
  margin-top: 15px;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.8);
}

/* 波形动画 */
.voice-wave, .speaking-wave {
  display: flex;
  align-items: center;
  height: 40px;
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
  0%, 100% { height: 10px; }
  50% { height: 30px; }
}

/* 思考点动画 */
.thinking-dots {
  display: flex;
  align-items: center;
  height: 40px;
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
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

/* 空闲状态提示 */
.idle-prompt {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  font-size: 28px;
  color: rgba(255, 255, 255, 0.7);
}

/* 底部控制区 */
.voice-chat-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 30px 0;
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

.mic-button:hover {
  transform: scale(1.05);
  box-shadow: 0 0 25px rgba(0, 122, 255, 0.7);
}

.mic-button.listening {
  background-color: #FF3B30;
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
  margin-left: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stop-button:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

@keyframes pulse {
  0% { transform: scale(1); box-shadow: 0 0 20px rgba(255, 59, 48, 0.5); }
  50% { transform: scale(1.05); box-shadow: 0 0 30px rgba(255, 59, 48, 0.7); }
  100% { transform: scale(1); box-shadow: 0 0 20px rgba(255, 59, 48, 0.5); }
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
}

.debug-panel div {
  margin-bottom: 5px;
}

.debug-panel button {
  background-color: #007AFF;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 3px;
  cursor: pointer;
}
</style>