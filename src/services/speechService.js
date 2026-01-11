// src/services/speechService.js
// 讯飞语音服务 - 支持普通TTS和超拟人TTS
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
            // 普通TTS配置
            tts: {
                appId: '',
                apiKey: '',
                apiSecret: '',
                host: 'tts-api.xfyun.cn',
                path: '/v2/tts',
            },
            // 超拟人TTS配置
            superTts: {
                appId: '',
                apiKey: '',
                apiSecret: '',
                host: 'cbm01.cn-huabei-1.xf-yun.com',
                path: '/v1/private/mcd9m97e6',
            }
        };

        // TTS类型: 'normal' 或 'super'
        this.ttsType = 'normal';

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

        // 流式 TTS 相关
        this.ttsQueue = [];
        this.audioQueue = [];
        this.isProcessingTTS = false;
        this.isPlayingAudio = false;
        this.ttsCallbacks = { onStart: null, onEnd: null, onError: null };
        this.startCallbackCalled = false;
        this.ttsOptions = {};
        this.ttsFinished = false;

        this.init();
    }

    async init() {
        try {
            // 加载语音识别配置
            const iatConfig = await store.getObject('speech_iat_config');
            if (iatConfig) {
                this.config.iat.appId = iatConfig.appId || '';
                this.config.iat.apiKey = iatConfig.apiKey || '';
                this.config.iat.apiSecret = iatConfig.apiSecret || '';
            }

            // 加载普通TTS配置
            const ttsConfig = await store.getObject('speech_tts_config');
            if (ttsConfig) {
                this.config.tts.appId = ttsConfig.appId || this.config.iat.appId;
                this.config.tts.apiKey = ttsConfig.apiKey || '';
                this.config.tts.apiSecret = ttsConfig.apiSecret || '';
            }

            // 加载超拟人TTS配置
            const superTtsConfig = await store.getObject('speech_super_tts_config');
            if (superTtsConfig) {
                this.config.superTts.appId = superTtsConfig.appId || '';
                this.config.superTts.apiKey = superTtsConfig.apiKey || '';
                this.config.superTts.apiSecret = superTtsConfig.apiSecret || '';
            }

            // 加载TTS类型
            const savedTtsType = await store.get('speech_tts_type');
            if (savedTtsType) {
                this.ttsType = savedTtsType;
            }

            console.log('[Speech] 服务初始化完成, TTS类型:', this.ttsType);
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
        } else if (type === 'superTts') {
            this.config.superTts = { ...this.config.superTts, ...config };
            await store.putObject('speech_super_tts_config', config);
        }
    }

    async setTtsType(type) {
        this.ttsType = type;
        await store.put('speech_tts_type', type);
        console.log('[Speech] TTS类型已切换:', type);
    }

    getTtsType() {
        return this.ttsType;
    }

    // ==================== 签名生成 ====================

    getSignUrl(type) {
        let config;
        if (type === 'iat') {
            config = this.config.iat;
        } else if (type === 'tts') {
            config = this.config.tts;
        } else if (type === 'superTts') {
            config = this.config.superTts;
        }

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
        const sampleRate = this.ttsType === 'super' ? 24000 : 16000;
        if (!this.audioContext || this.audioContext.state === 'closed') {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    // ==================== 语音识别 ====================

    async startRecognize(onResult, onError) {
        if (this.recognizing) {
            await this.stopRecognize();
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        try {
            if (!this.config.iat.appId || !this.config.iat.apiKey || !this.config.iat.apiSecret) {
                throw new Error('语音识别配置不完整');
            }

            this.onIatResult = onResult;
            this.onError = onError;
            this.recognitionText = '';
            this.resultTextTemp = '';

            await this.initAudioContext();
            await this.connectIatWebSocket();

            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 }
            });

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

        if (this.iatWs && this.iatWs.readyState === WebSocket.OPEN) {
            try { this.iatWs.send(JSON.stringify({ data: { status: 2 } })); } catch (e) {}
        }
        if (this.audioProcessor) {
            try { this.audioProcessor.disconnect(); } catch (e) {}
            this.audioProcessor = null;
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        setTimeout(() => {
            if (this.iatWs) { try { this.iatWs.close(); } catch (e) {} this.iatWs = null; }
        }, 1000);

        if (this.onIatResult) {
            this.onIatResult(this.resultTextTemp || this.recognitionText, true);
        }
    }

    async connectIatWebSocket() {
        return new Promise((resolve, reject) => {
            const signUrl = this.getSignUrl('iat');
            this.iatWs = new WebSocket(signUrl);
            const timeout = setTimeout(() => reject(new Error('WebSocket 连接超时')), 5000);

            this.iatWs.onopen = () => {
                clearTimeout(timeout);
                console.log('[Speech] IAT WebSocket 已连接');
                this.iatWs.send(JSON.stringify({
                    common: { app_id: this.config.iat.appId },
                    business: { language: 'zh_cn', domain: 'iat', accent: 'mandarin', vad_eos: 3000, dwa: 'wpgs', ptt: 1 },
                    data: { status: 0, format: 'audio/L16;rate=16000', encoding: 'raw', audio: '' }
                }));
                resolve();
            };

            this.iatWs.onmessage = (event) => {
                try {
                    const result = JSON.parse(event.data);
                    if (result.code === 0 && result.data) this.processIatResult(result);
                    else if (result.code !== 0) console.error('[Speech] IAT 错误:', result);
                } catch (e) { console.error('[Speech] 解析 IAT 结果失败:', e); }
            };

            this.iatWs.onerror = (error) => { clearTimeout(timeout); reject(error); };
            this.iatWs.onclose = () => console.log('[Speech] IAT WebSocket 已关闭');
        });
    }

    processIatResult(result) {
        if (!result.data || !result.data.result) return;
        const ws = result.data.result.ws || [];
        let text = '';
        for (const item of ws) {
            for (const cw of (item.cw || [])) { text += cw.w || ''; }
        }

        if (result.data.result.pgs === 'apd') {
            this.recognitionText += text;
        } else if (result.data.result.pgs === 'rpl') {
            const rg = result.data.result.rg || [0, 0];
            const chars = [...this.recognitionText];
            chars.splice(rg[0] - 1, rg[1] - rg[0] + 1);
            this.recognitionText = chars.join('') + text;
        } else {
            this.recognitionText += text;
        }

        this.resultTextTemp = this.recognitionText;
        if (this.onIatResult) this.onIatResult(this.recognitionText, result.data.status === 2);
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
        for (let i = 0; i < pcmData.length; i++) { view.setInt16(i * 2, pcmData[i], true); }
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        this.iatWs.send(JSON.stringify({ data: { status: 1, format: 'audio/L16;rate=16000', encoding: 'raw', audio: base64Audio } }));
    }

    // ==================== 流式 TTS ====================

    startStreamingTTS(onStart, onEnd, onError, options = {}) {
        console.log('[Speech] 启动流式 TTS, 类型:', this.ttsType);
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

    addTextToTTS(text) {
        if (this.isCanceled || !text || !text.trim()) return;
        console.log('[Speech] 添加文本到 TTS:', text.substring(0, 30) + (text.length > 30 ? '...' : ''));
        this.ttsQueue.push(text.trim());
        if (!this.isProcessingTTS) this.processNextTTSItem();
    }

    finishStreamingTTS() {
        console.log('[Speech] 标记 TTS 输入完成');
        this.ttsFinished = true;
        if (this.ttsQueue.length === 0 && !this.isProcessingTTS) this.checkAllComplete();
    }

    async processNextTTSItem() {
        if (this.isCanceled) { this.isProcessingTTS = false; return; }
        if (this.ttsQueue.length === 0) { this.isProcessingTTS = false; this.checkAllComplete(); return; }

        this.isProcessingTTS = true;
        const text = this.ttsQueue.shift();

        try {
            let audioData;
            if (this.ttsType === 'super') {
                audioData = await this.synthesizeSuperTTS(text, this.ttsOptions);
            } else {
                audioData = await this.synthesizeNormalTTS(text, this.ttsOptions);
            }

            if (this.isCanceled) { this.isProcessingTTS = false; return; }
            this.audioQueue.push(audioData);
            if (!this.isPlayingAudio) this.playNextAudio();
            this.processNextTTSItem();
        } catch (error) {
            console.error('[Speech] TTS 合成失败:', error);
            if (this.ttsCallbacks.onError) this.ttsCallbacks.onError(error);
            this.processNextTTSItem();
        }
    }

    // ==================== 普通TTS ====================

    async synthesizeNormalTTS(text, options = {}) {
        return new Promise((resolve, reject) => {
            const config = this.config.tts;
            if (!config.appId || !config.apiKey || !config.apiSecret) {
                reject(new Error('普通TTS配置不完整'));
                return;
            }

            const signUrl = this.getSignUrl('tts');
            console.log('[Speech] 连接普通TTS...');
            const ws = new WebSocket(signUrl);
            const audioChunks = [];
            const timeout = setTimeout(() => { ws.close(); reject(new Error('TTS 超时')); }, 30000);

            ws.onopen = () => {
                console.log('[Speech] 普通TTS WebSocket 已连接');
                const vcn = options.voice || 'xiaoyan';
                ws.send(JSON.stringify({
                    common: { app_id: config.appId },
                    business: { aue: 'raw', auf: 'audio/L16;rate=16000', vcn, speed: options.speed || 50, volume: options.volume || 50, pitch: options.pitch || 50, tte: 'UTF8' },
                    data: { status: 2, text: btoa(unescape(encodeURIComponent(text))) }
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const result = JSON.parse(event.data);
                    if (result.code !== 0) { clearTimeout(timeout); ws.close(); reject(new Error(result.message || 'TTS 失败')); return; }
                    if (result.data && result.data.audio) {
                        const audioData = atob(result.data.audio);
                        const buffer = new ArrayBuffer(audioData.length);
                        const view = new Uint8Array(buffer);
                        for (let i = 0; i < audioData.length; i++) { view[i] = audioData.charCodeAt(i); }
                        audioChunks.push(buffer);
                        if (result.data.status === 2) {
                            clearTimeout(timeout);
                            ws.close();
                            const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
                            const merged = new ArrayBuffer(totalLength);
                            const mergedView = new Uint8Array(merged);
                            let offset = 0;
                            for (const chunk of audioChunks) { mergedView.set(new Uint8Array(chunk), offset); offset += chunk.byteLength; }
                            resolve(this.pcmToWav(merged, 16000));
                        }
                    }
                } catch (e) { console.error('[Speech] 解析普通TTS响应失败:', e); }
            };

            ws.onerror = (error) => { clearTimeout(timeout); reject(error); };
            ws.onclose = () => console.log('[Speech] 普通TTS WebSocket 已关闭');
        });
    }

    // ==================== 超拟人TTS ====================

    async synthesizeSuperTTS(text, options = {}) {
        return new Promise((resolve, reject) => {
            const config = this.config.superTts;
            if (!config.appId || !config.apiKey || !config.apiSecret) {
                reject(new Error('超拟人TTS配置不完整'));
                return;
            }

            const signUrl = this.getSignUrl('superTts');
            console.log('[Speech] 连接超拟人TTS...');
            const ws = new WebSocket(signUrl);
            const audioChunks = [];
            const timeout = setTimeout(() => { ws.close(); reject(new Error('TTS 超时')); }, 30000);

            ws.onopen = () => {
                console.log('[Speech] 超拟人TTS WebSocket 已连接');
                const vcn = options.voice || 'x5_lingfeiyi_flow';
                const request = {
                    header: { app_id: config.appId, status: 2 },
                    parameter: {
                        tts: {
                            vcn, speed: options.speed || 50, volume: options.volume || 50, pitch: options.pitch || 50,
                            bgs: 0, reg: 0, rdn: 0, rhy: 0,
                            audio: { encoding: 'lame', sample_rate: 24000, channels: 1, bit_depth: 16, frame_size: 0 }
                        }
                    },
                    payload: {
                        text: { encoding: 'utf8', compress: 'raw', format: 'plain', status: 2, seq: 0, text: btoa(unescape(encodeURIComponent(text))) }
                    }
                };
                console.log('[Speech] 发送超拟人TTS请求, vcn:', vcn);
                ws.send(JSON.stringify(request));
            };

            ws.onmessage = (event) => {
                try {
                    const result = JSON.parse(event.data);
                    if (result.header && result.header.code !== 0) {
                        clearTimeout(timeout); ws.close();
                        console.error('[Speech] 超拟人TTS错误:', result.header);
                        reject(new Error(result.header.message || `TTS错误: ${result.header.code}`));
                        return;
                    }
                    if (result.payload && result.payload.audio && result.payload.audio.audio) {
                        const audioData = atob(result.payload.audio.audio);
                        const buffer = new ArrayBuffer(audioData.length);
                        const view = new Uint8Array(buffer);
                        for (let i = 0; i < audioData.length; i++) { view[i] = audioData.charCodeAt(i); }
                        audioChunks.push(buffer);
                        if (result.payload.audio.status === 2) {
                            clearTimeout(timeout);
                            ws.close();
                            const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
                            const merged = new ArrayBuffer(totalLength);
                            const mergedView = new Uint8Array(merged);
                            let offset = 0;
                            for (const chunk of audioChunks) { mergedView.set(new Uint8Array(chunk), offset); offset += chunk.byteLength; }
                            console.log('[Speech] 超拟人TTS合成完成, 大小:', totalLength);
                            resolve(merged);
                        }
                    }
                } catch (e) { console.error('[Speech] 解析超拟人TTS响应失败:', e); }
            };

            ws.onerror = (error) => { clearTimeout(timeout); reject(error); };
            ws.onclose = () => console.log('[Speech] 超拟人TTS WebSocket 已关闭');
        });
    }

    // ==================== 播放 ====================

    async playNextAudio() {
        if (this.isCanceled) { this.isPlayingAudio = false; return; }
        if (this.audioQueue.length === 0) { this.isPlayingAudio = false; this.checkAllComplete(); return; }

        this.isPlayingAudio = true;
        if (!this.startCallbackCalled && this.ttsCallbacks.onStart) {
            this.startCallbackCalled = true;
            this.ttsCallbacks.onStart();
        }

        const audioData = this.audioQueue.shift();
        try { await this.playAudioData(audioData); } catch (error) { console.error('[Speech] 播放音频失败:', error); }
        this.playNextAudio();
    }

    checkAllComplete() {
        if (this.ttsFinished && this.ttsQueue.length === 0 && !this.isProcessingTTS && !this.isPlayingAudio && this.audioQueue.length === 0) {
            console.log('[Speech] 所有 TTS 播放完成');
            if (this.ttsCallbacks.onEnd) this.ttsCallbacks.onEnd();
        }
    }

    async playAudioData(audioData) {
        return new Promise(async (resolve, reject) => {
            try {
                await this.initAudioContext();
                const audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0));
                if (this.isCanceled) { resolve(); return; }

                this.audioSource = this.audioContext.createBufferSource();
                this.audioSource.buffer = audioBuffer;
                this.audioSource.connect(this.audioContext.destination);
                this.audioSource.onended = () => { this.audioSource = null; resolve(); };
                this.audioSource.start(0);
            } catch (error) { console.error('[Speech] 播放失败:', error); reject(error); }
        });
    }

    pcmToWav(pcmData, sampleRate) {
        const pcmLength = pcmData.byteLength;
        const wavLength = 44 + pcmLength;
        const buffer = new ArrayBuffer(wavLength);
        const view = new DataView(buffer);
        const writeString = (offset, string) => { for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i)); };

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
        for (const sentence of sentences) { this.addTextToTTS(sentence); }
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
                if (current.trim()) sentences.push(current.trim());
                current = '';
            } else if (minorBreaks.test(char) && current.length > 50) {
                if (current.trim()) sentences.push(current.trim());
                current = '';
            }
        }
        if (current.trim()) sentences.push(current.trim());

        const result = [];
        for (const sentence of sentences) {
            if (sentence.length < 5 && result.length > 0) result[result.length - 1] += sentence;
            else result.push(sentence);
        }
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
            try { this.audioSource.stop(); this.audioSource.disconnect(); } catch (e) {}
            this.audioSource = null;
        }
        if (this.ttsWs) {
            try { this.ttsWs.close(); } catch (e) {}
            this.ttsWs = null;
        }
    }

    async dispose() {
        this.stopPlayback();
        if (this.recognizing) await this.stopRecognize();
        if (this.audioContext && this.audioContext.state !== 'closed') {
            try { await this.audioContext.close(); } catch (e) {}
        }
        console.log('[Speech] 服务已清理');
    }
}

const speechService = new SpeechService();
export default speechService;