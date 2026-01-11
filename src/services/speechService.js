// src/services/speechService.js
// 讯飞语音服务 - 支持超拟人流式TTS
import store from '../utils/store';
import CryptoJS from 'crypto-js';

class SpeechService {
    constructor() {
        // 讯飞开放平台配置
        this.config = {
            iat: {
                appId: '',
                apiKey: '',
                apiSecret: '',
                host: 'iat-api.xfyun.cn',
                path: '/v2/iat',
            },
            tts: {
                appId: '',
                apiKey: '',
                apiSecret: '',
                // 超拟人语音合成接口
                host: 'cbm01.cn-huabei-1.xf-yun.com',
                path: '/v1/private/mcd9m97e6',
            }
        };

        // 状态
        this.recognizing = false;
        this.synthesizing = false;
        this.isCanceled = false;

        // WebSocket
        this.iatWs = null;
        this.ttsWs = null;

        // 音频
        this.audioContext = null;
        this.mediaStream = null;
        this.mediaRecorder = null;
        this.audioProcessor = null;
        this.audioSource = null;

        // 识别结果
        this.recognitionText = '';
        this.resultTextTemp = '';
        this.onIatResult = null;
        this.onError = null;

        // ========== 流式 TTS 相关 ==========
        this.ttsQueue = [];           // 待合成的句子队列
        this.audioQueue = [];         // 待播放的音频队列
        this.isProcessingTTS = false; // 是否正在处理TTS
        this.isPlayingAudio = false;  // 是否正在播放音频
        this.ttsCallbacks = {
            onStart: null,
            onEnd: null,
            onError: null
        };
        this.startCallbackCalled = false;
        this.ttsOptions = {};
        this.ttsFinished = false;

        // 初始化
        this.init();
    }

    async init() {
        try {
            const iatConfig = await store.getObject('speech_iat_config');
            if (iatConfig) {
                this.config.iat.appId = iatConfig.appId || '';
                this.config.iat.apiKey = iatConfig.apiKey || '';
                this.config.iat.apiSecret = iatConfig.apiSecret || '';
            }

            const ttsConfig = await store.getObject('speech_tts_config');
            if (ttsConfig) {
                this.config.tts.appId = ttsConfig.appId || this.config.iat.appId;
                this.config.tts.apiKey = ttsConfig.apiKey || '';
                this.config.tts.apiSecret = ttsConfig.apiSecret || '';
            }

            console.log('[Speech] 服务初始化完成');
        } catch (error) {
            console.error('[Speech] 初始化失败:', error);
        }
    }

    // ==================== 配置管理 ====================

    async setConfig(type, config) {
        if (type === 'iat') {
            this.config.iat = { ...this.config.iat, ...config };
            await store.putObject('speech_iat_config', config);
        } else if (type === 'tts') {
            this.config.tts = { ...this.config.tts, ...config };
            await store.putObject('speech_tts_config', config);
        }
    }

    // ==================== 签名生成 ====================

    /**
     * 生成 WebSocket 鉴权 URL
     */
    getSignUrl(type) {
        const config = type === 'iat' ? this.config.iat : this.config.tts;
        const { apiKey, apiSecret, host, path } = config;

        const date = new Date().toUTCString();
        const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
        const signature = CryptoJS.enc.Base64.stringify(
            CryptoJS.HmacSHA256(signatureOrigin, apiSecret)
        );

        const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
        const authorization = btoa(authorizationOrigin);

        return `wss://${host}${path}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=${host}`;
    }

    // ==================== 音频上下文 ====================

    async initAudioContext() {
        if (!this.audioContext || this.audioContext.state === 'closed') {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 24000  // 超拟人TTS使用24000采样率
            });
        }

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    // ==================== 语音识别 ====================

    async startRecognize(onResult, onError) {
        // 如果已在识别中，先停止
        if (this.recognizing) {
            console.log('[Speech] 已在识别中，先停止');
            await this.stopRecognize();
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        try {
            // 检查配置
            if (!this.config.iat.appId || !this.config.iat.apiKey || !this.config.iat.apiSecret) {
                throw new Error('语音识别配置不完整');
            }

            this.onIatResult = onResult;
            this.onError = onError;
            this.recognitionText = '';
            this.resultTextTemp = '';

            await this.initAudioContext();

            // 连接 WebSocket
            await this.connectIatWebSocket();

            // 获取麦克风
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000
                }
            });

            // 创建音频处理节点
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

            this.audioProcessor.onaudioprocess = (e) => {
                if (!this.recognizing || !this.iatWs || this.iatWs.readyState !== WebSocket.OPEN) return;

                const inputData = e.inputBuffer.getChannelData(0);
                const pcmData = this.floatTo16BitPCM(inputData);
                this.sendAudioFrame(pcmData);
            };

            source.connect(this.audioProcessor);
            this.audioProcessor.connect(this.audioContext.destination);

            this.recognizing = true;
            console.log('[Speech] 语音识别已启动');

        } catch (error) {
            console.error('[Speech] 启动识别失败:', error);
            this.recognizing = false;
            if (onError) onError(error);
        }
    }

    async stopRecognize() {
        if (!this.recognizing) return;

        console.log('[Speech] 停止语音识别');
        this.recognizing = false;

        // 发送结束帧
        if (this.iatWs && this.iatWs.readyState === WebSocket.OPEN) {
            try {
                this.iatWs.send(JSON.stringify({ data: { status: 2 } }));
            } catch (e) {
                console.warn('[Speech] 发送结束帧失败:', e);
            }
        }

        // 清理资源
        if (this.audioProcessor) {
            try { this.audioProcessor.disconnect(); } catch (e) {}
            this.audioProcessor = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        // 延迟关闭 WebSocket
        setTimeout(() => {
            if (this.iatWs) {
                try { this.iatWs.close(); } catch (e) {}
                this.iatWs = null;
            }
        }, 1000);

        if (this.onIatResult) {
            this.onIatResult(this.resultTextTemp || this.recognitionText, true);
        }
    }

    async connectIatWebSocket() {
        return new Promise((resolve, reject) => {
            const signUrl = this.getSignUrl('iat');
            this.iatWs = new WebSocket(signUrl);

            const timeout = setTimeout(() => {
                reject(new Error('WebSocket 连接超时'));
            }, 5000);

            this.iatWs.onopen = () => {
                clearTimeout(timeout);
                console.log('[Speech] IAT WebSocket 已连接');

                this.iatWs.send(JSON.stringify({
                    common: { app_id: this.config.iat.appId },
                    business: {
                        language: 'zh_cn',
                        domain: 'iat',
                        accent: 'mandarin',
                        vad_eos: 3000,
                        dwa: 'wpgs',
                        ptt: 1
                    },
                    data: {
                        status: 0,
                        format: 'audio/L16;rate=16000',
                        encoding: 'raw',
                        audio: ''
                    }
                }));

                resolve();
            };

            this.iatWs.onmessage = (event) => {
                try {
                    const result = JSON.parse(event.data);
                    if (result.code === 0 && result.data) {
                        this.processIatResult(result);
                    } else if (result.code !== 0) {
                        console.error('[Speech] IAT 错误:', result);
                    }
                } catch (e) {
                    console.error('[Speech] 解析 IAT 结果失败:', e);
                }
            };

            this.iatWs.onerror = (error) => {
                clearTimeout(timeout);
                console.error('[Speech] IAT WebSocket 错误:', error);
                reject(error);
            };

            this.iatWs.onclose = () => {
                console.log('[Speech] IAT WebSocket 已关闭');
            };
        });
    }

    processIatResult(result) {
        if (!result.data || !result.data.result) return;

        const ws = result.data.result.ws || [];
        let text = '';

        for (const item of ws) {
            for (const cw of (item.cw || [])) {
                text += cw.w || '';
            }
        }

        if (result.data.result.pgs === 'apd') {
            this.recognitionText += text;
        } else if (result.data.result.pgs === 'rpl') {
            const rg = result.data.result.rg || [0, 0];
            const start = rg[0] - 1;
            const chars = [...this.recognitionText];
            chars.splice(start, rg[1] - start);
            this.recognitionText = chars.join('') + text;
        } else {
            this.recognitionText += text;
        }

        this.resultTextTemp = this.recognitionText;

        if (this.onIatResult) {
            this.onIatResult(this.recognitionText, result.data.status === 2);
        }
    }

    floatTo16BitPCM(input) {
        const output = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return output;
    }

    sendAudioFrame(pcmData) {
        if (!this.iatWs || this.iatWs.readyState !== WebSocket.OPEN) return;

        const buffer = new ArrayBuffer(pcmData.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcmData.length; i++) {
            view.setInt16(i * 2, pcmData[i], true);
        }

        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(buffer)));

        this.iatWs.send(JSON.stringify({
            data: {
                status: 1,
                format: 'audio/L16;rate=16000',
                encoding: 'raw',
                audio: base64Audio
            }
        }));
    }

    // ==================== 流式 TTS（超拟人版） ====================

    /**
     * 启动流式 TTS
     */
    startStreamingTTS(onStart, onEnd, onError, options = {}) {
        console.log('[Speech] 启动超拟人流式 TTS');
        console.log('[Speech] TTS配置 - appId:', this.config.tts.appId, 'apiKey:', this.config.tts.apiKey?.substring(0, 8) + '...');

        this.isCanceled = false;
        this.ttsQueue = [];
        this.audioQueue = [];
        this.isProcessingTTS = false;
        this.isPlayingAudio = false;
        this.startCallbackCalled = false;
        this.ttsOptions = options;
        this.ttsFinished = false;

        this.ttsCallbacks = { onStart, onEnd, onError };
    }

    /**
     * 添加文本到 TTS 队列
     */
    addTextToTTS(text) {
        if (this.isCanceled || !text || !text.trim()) return;

        console.log('[Speech] 添加文本到 TTS:', text.substring(0, 30) + (text.length > 30 ? '...' : ''));
        this.ttsQueue.push(text.trim());

        if (!this.isProcessingTTS) {
            this.processNextTTSItem();
        }
    }

    /**
     * 结束流式 TTS
     */
    finishStreamingTTS() {
        console.log('[Speech] 标记 TTS 输入完成');
        this.ttsFinished = true;

        if (this.ttsQueue.length === 0 && !this.isProcessingTTS) {
            this.checkAllComplete();
        }
    }

    /**
     * 处理下一个 TTS 项目
     */
    async processNextTTSItem() {
        if (this.isCanceled) {
            console.log('[Speech] TTS 已取消');
            this.isProcessingTTS = false;
            return;
        }

        if (this.ttsQueue.length === 0) {
            this.isProcessingTTS = false;
            this.checkAllComplete();
            return;
        }

        this.isProcessingTTS = true;
        const text = this.ttsQueue.shift();

        try {
            // 使用超拟人TTS合成
            const audioData = await this.synthesizeSuperTTS(text, this.ttsOptions);

            if (this.isCanceled) {
                this.isProcessingTTS = false;
                return;
            }

            this.audioQueue.push(audioData);

            if (!this.isPlayingAudio) {
                this.playNextAudio();
            }

            this.processNextTTSItem();

        } catch (error) {
            console.error('[Speech] TTS 合成失败:', error);
            if (this.ttsCallbacks.onError) {
                this.ttsCallbacks.onError(error);
            }
            this.processNextTTSItem();
        }
    }

    /**
     * 超拟人语音合成 - 单句
     */
    async synthesizeSuperTTS(text, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.config.tts.appId || !this.config.tts.apiKey || !this.config.tts.apiSecret) {
                console.error('[Speech] TTS配置不完整:', {
                    appId: !!this.config.tts.appId,
                    apiKey: !!this.config.tts.apiKey,
                    apiSecret: !!this.config.tts.apiSecret
                });
                reject(new Error('TTS 配置不完整'));
                return;
            }

            console.log('[Speech] TTS合成配置 - appId:', this.config.tts.appId);
            const signUrl = this.getSignUrl('tts');
            console.log('[Speech] 连接超拟人TTS, URL长度:', signUrl.length);

            const ws = new WebSocket(signUrl);
            const audioChunks = [];

            const timeout = setTimeout(() => {
                console.error('[Speech] TTS 超时，未收到响应');
                ws.close();
                reject(new Error('TTS 超时'));
            }, 30000);

            ws.onopen = () => {
                console.log('[Speech] 超拟人TTS WebSocket 已连接');

                // 获取发音人
                const vcn = options.voice || 'x5_lingfeiyi_flow';

                // 构建超拟人TTS请求 - 使用lame(mp3)编码
                const request = {
                    header: {
                        app_id: this.config.tts.appId,
                        status: 2  // 一次性合成
                    },
                    parameter: {
                        tts: {
                            vcn: vcn,
                            speed: options.speed || 50,
                            volume: options.volume || 50,
                            pitch: options.pitch || 50,
                            bgs: 0,
                            reg: 0,
                            rdn: 0,
                            rhy: 0,
                            audio: {
                                encoding: 'lame',  // MP3格式
                                sample_rate: 24000,
                                channels: 1,
                                bit_depth: 16,
                                frame_size: 0
                            }
                        }
                    },
                    payload: {
                        text: {
                            encoding: 'utf8',
                            compress: 'raw',
                            format: 'plain',
                            status: 2,
                            seq: 0,
                            text: btoa(unescape(encodeURIComponent(text)))
                        }
                    }
                };

                console.log('[Speech] 发送超拟人TTS请求, vcn:', vcn, 'text:', text.substring(0, 30));
                console.log('[Speech] 请求详情:', JSON.stringify(request));
                ws.send(JSON.stringify(request));
            };

            ws.onmessage = (event) => {
                console.log('[Speech] 收到TTS响应');
                try {
                    const result = JSON.parse(event.data);
                    console.log('[Speech] TTS响应header:', JSON.stringify(result.header));

                    // 检查错误
                    if (result.header && result.header.code !== 0) {
                        clearTimeout(timeout);
                        ws.close();
                        console.error('[Speech] 超拟人TTS错误:', result.header);
                        reject(new Error(result.header.message || `TTS错误: ${result.header.code}`));
                        return;
                    }

                    // 处理音频数据
                    if (result.payload && result.payload.audio && result.payload.audio.audio) {
                        const audioBase64 = result.payload.audio.audio;
                        const audioData = atob(audioBase64);
                        const buffer = new ArrayBuffer(audioData.length);
                        const view = new Uint8Array(buffer);
                        for (let i = 0; i < audioData.length; i++) {
                            view[i] = audioData.charCodeAt(i);
                        }
                        audioChunks.push(buffer);
                        console.log('[Speech] 收到音频块, 大小:', buffer.byteLength, 'status:', result.payload.audio.status);

                        // 最后一帧
                        if (result.payload.audio.status === 2) {
                            clearTimeout(timeout);
                            ws.close();

                            // 合并音频 (MP3格式)
                            const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
                            const merged = new ArrayBuffer(totalLength);
                            const mergedView = new Uint8Array(merged);
                            let offset = 0;
                            for (const chunk of audioChunks) {
                                mergedView.set(new Uint8Array(chunk), offset);
                                offset += chunk.byteLength;
                            }

                            console.log('[Speech] 超拟人TTS合成完成, 音频大小:', totalLength);
                            resolve(merged);  // 直接返回MP3数据
                        }
                    }
                } catch (e) {
                    console.error('[Speech] 解析超拟人TTS响应失败:', e, event.data.substring(0, 200));
                }
            };

            ws.onerror = (error) => {
                clearTimeout(timeout);
                console.error('[Speech] 超拟人TTS WebSocket错误:', error);
                reject(error);
            };

            ws.onclose = (event) => {
                console.log('[Speech] 超拟人TTS WebSocket已关闭, code:', event.code, 'reason:', event.reason);
            };
        });
    }

    /**
     * 播放下一个音频
     */
    async playNextAudio() {
        if (this.isCanceled) {
            this.isPlayingAudio = false;
            return;
        }

        if (this.audioQueue.length === 0) {
            this.isPlayingAudio = false;
            this.checkAllComplete();
            return;
        }

        this.isPlayingAudio = true;

        if (!this.startCallbackCalled && this.ttsCallbacks.onStart) {
            this.startCallbackCalled = true;
            this.ttsCallbacks.onStart();
        }

        const audioData = this.audioQueue.shift();

        try {
            await this.playAudioData(audioData);
        } catch (error) {
            console.error('[Speech] 播放音频失败:', error);
        }

        this.playNextAudio();
    }

    /**
     * 检查是否全部完成
     */
    checkAllComplete() {
        if (this.ttsFinished &&
            this.ttsQueue.length === 0 &&
            !this.isProcessingTTS &&
            !this.isPlayingAudio &&
            this.audioQueue.length === 0) {
            console.log('[Speech] 所有 TTS 播放完成');
            if (this.ttsCallbacks.onEnd) {
                this.ttsCallbacks.onEnd();
            }
        }
    }

    /**
     * 播放音频数据
     */
    async playAudioData(audioData) {
        return new Promise(async (resolve, reject) => {
            try {
                await this.initAudioContext();

                console.log('[Speech] 开始解码音频, 大小:', audioData.byteLength);
                const audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0));
                console.log('[Speech] 音频解码成功, 时长:', audioBuffer.duration.toFixed(2), '秒');

                if (this.isCanceled) {
                    resolve();
                    return;
                }

                this.audioSource = this.audioContext.createBufferSource();
                this.audioSource.buffer = audioBuffer;
                this.audioSource.connect(this.audioContext.destination);

                this.audioSource.onended = () => {
                    this.audioSource = null;
                    resolve();
                };

                this.audioSource.start(0);

            } catch (error) {
                console.error('[Speech] 播放失败:', error);
                reject(error);
            }
        });
    }

    /**
     * PCM 转 WAV
     */
    pcmToWav(pcmData, sampleRate) {
        const pcmLength = pcmData.byteLength;
        const wavLength = 44 + pcmLength;
        const buffer = new ArrayBuffer(wavLength);
        const view = new DataView(buffer);

        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, wavLength - 8, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, pcmLength, true);

        new Uint8Array(buffer, 44).set(new Uint8Array(pcmData));

        return buffer;
    }

    // ==================== 传统接口兼容 ====================

    async startSynthesize(text, onStart, onEnd, onError, options = {}) {
        this.startStreamingTTS(onStart, onEnd, onError, options);

        const sentences = this.splitIntoSentences(text);
        for (const sentence of sentences) {
            this.addTextToTTS(sentence);
        }

        this.finishStreamingTTS();
    }

    splitIntoSentences(text) {
        if (!text) return [];

        const sentences = [];
        let current = '';
        const sentenceEnders = /[。！？；\n]/;
        const minorBreaks = /[，、：]/;

        for (const char of text) {
            current += char;

            if (sentenceEnders.test(char)) {
                if (current.trim()) {
                    sentences.push(current.trim());
                }
                current = '';
            } else if (minorBreaks.test(char) && current.length > 50) {
                if (current.trim()) {
                    sentences.push(current.trim());
                }
                current = '';
            }
        }

        if (current.trim()) {
            sentences.push(current.trim());
        }

        const result = [];
        for (const sentence of sentences) {
            if (sentence.length < 5 && result.length > 0) {
                result[result.length - 1] += sentence;
            } else {
                result.push(sentence);
            }
        }

        console.log('[Speech] 分句结果:', result.length, '句');
        return result;
    }

    // ==================== 停止播放 ====================

    stopPlayback() {
        console.log('[Speech] 停止所有播放');

        this.isCanceled = true;
        this.ttsQueue = [];
        this.audioQueue = [];
        this.isProcessingTTS = false;
        this.isPlayingAudio = false;
        this.ttsFinished = false;

        if (this.audioSource) {
            try {
                this.audioSource.stop();
                this.audioSource.disconnect();
            } catch (e) {}
            this.audioSource = null;
        }

        if (this.ttsWs) {
            try { this.ttsWs.close(); } catch (e) {}
            this.ttsWs = null;
        }
    }

    // ==================== 清理 ====================

    async dispose() {
        this.stopPlayback();

        if (this.recognizing) {
            await this.stopRecognize();
        }

        if (this.audioContext && this.audioContext.state !== 'closed') {
            try { await this.audioContext.close(); } catch (e) {}
        }

        console.log('[Speech] 服务已清理');
    }
}

const speechService = new SpeechService();
export default speechService;