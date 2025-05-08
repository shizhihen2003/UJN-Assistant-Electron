// src/services/speechService.js
import store from '../utils/store';
import authService from './authService';
import CryptoJS from 'crypto-js';

/**
 * 讯飞语音服务
 * 提供语音识别和语音合成功能，优化语音对话体验
 */
class SpeechService {
    constructor() {
        // 讯飞开放平台配置
        this.config = {
            // 语音识别配置
            iat: {
                appId: '',
                apiKey: '',
                apiSecret: '',
                host: 'iat-api.xfyun.cn',
                path: '/v2/iat',
            },
            // 语音合成配置
            tts: {
                appId: '',
                apiKey: '',
                apiSecret: '',
                host: 'tts-api.xfyun.cn',
                path: '/v2/tts',
            }
        };

        // 当前状态
        this.recognizing = false;
        this.synthesizing = false;

        // WebSocket 连接
        this.iatWs = null;
        this.ttsWs = null;

        // 音频上下文
        this.audioContext = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioSource = null;
        this.audioBuffer = null;
        this.mediaStream = null;

        // 回调函数
        this.onIatResult = null;
        this.onTtsResult = null;
        this.onError = null;

        // 识别结果缓存
        this.recognitionText = '';
        this.resultTextTemp = '';

        // 音频处理相关
        this.audioProcessor = null;
        this.audioQueue = [];
        this.processingAudio = false;

        // 语音识别状态机
        this.recognitionState = 'idle'; // 'idle', 'starting', 'recording', 'stopping'

        // 添加一个防抖锁
        this.transitionLock = false;

        // 语音流式合成相关
        this.streamingMode = false;
        this.audioChunkQueue = [];
        this.isPlayingChunk = false;
        this.audioChunkCallbacks = [];
        this.streamingAudioContext = null;

        // 初始化
        this.init();
    }

    /**
     * 初始化服务
     */
    async init() {
        try {
            // 从存储加载配置
            const iatConfig = await store.getObject('speech_iat_config');
            const ttsConfig = await store.getObject('speech_tts_config');

            if (iatConfig) {
                this.config.iat = { ...this.config.iat, ...iatConfig };
                console.log('已加载语音识别配置', this.config.iat);
            }

            if (ttsConfig) {
                this.config.tts = { ...this.config.tts, ...ttsConfig };
                console.log('已加载语音合成配置', this.config.tts);
            }

            console.log('语音服务初始化完成');
        } catch (error) {
            console.error('初始化语音服务失败:', error);
        }
    }

    /**
     * 设置讯飞开放平台配置
     * @param {string} type 服务类型：'iat'或'tts'
     * @param {Object} config 配置对象
     */
    async setConfig(type, config) {
        if (type !== 'iat' && type !== 'tts') {
            throw new Error('无效的服务类型');
        }

        this.config[type] = {
            ...this.config[type],
            ...config
        };

        // 保存到存储
        await store.putObject(`speech_${type}_config`, this.config[type]);
        console.log(`已保存${type}配置`, this.config[type]);
    }

    /**
     * 计算讯飞API请求的签名
     * @param {string} type 服务类型：'iat'或'tts'
     * @returns {string} 签名URL
     */
    getSignUrl(type) {
        if (type !== 'iat' && type !== 'tts') {
            throw new Error('无效的服务类型');
        }

        const config = this.config[type];

        // 检查配置是否完整
        if (!config.appId || !config.apiKey || !config.apiSecret) {
            throw new Error(`${type}配置不完整，请设置appId、apiKey和apiSecret`);
        }

        const host = config.host;
        const path = config.path;
        const url = `wss://${host}${path}`;
        const apiKey = config.apiKey;
        const apiSecret = config.apiSecret;

        // 当前时间戳，RFC1123格式
        const date = new Date().toUTCString();

        // 拼接参与签名的字符串
        const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;

        // 使用hmac-sha256加密
        const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret);
        const signature = CryptoJS.enc.Base64.stringify(signatureSha);

        // 拼接authorization
        const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
        const authorization = btoa(authorizationOrigin);

        // 拼接url
        const signUrl = `${url}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${host}`;

        console.log(`生成${type}签名URL成功`);
        return signUrl;
    }

    /**
     * 初始化音频上下文
     * @returns {Promise<void>}
     */
    async initAudioContext() {
        if (!this.audioContext || this.audioContext.state === 'closed') {
            try {
                // 创建音频上下文，尝试使用16kHz采样率
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: 16000 // 尝试使用16kHz采样率
                });
                console.log('音频上下文初始化成功, 状态:', this.audioContext.state, '采样率:', this.audioContext.sampleRate);

                // 如果音频上下文处于suspended状态，尝试resume
                if (this.audioContext.state === 'suspended') {
                    try {
                        await this.audioContext.resume();
                        console.log('音频上下文恢复成功, 新状态:', this.audioContext.state);
                    } catch (error) {
                        console.warn('音频上下文恢复失败:', error);
                    }
                }
            } catch (error) {
                // 如果设置采样率失败，使用默认构造函数
                console.warn('创建指定采样率的音频上下文失败，使用默认配置:', error);
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('使用默认配置创建音频上下文, 状态:', this.audioContext.state, '采样率:', this.audioContext.sampleRate);
            }
        } else if (this.audioContext.state === 'suspended') {
            // 如果上下文已经存在但处于暂停状态，尝试恢复
            try {
                await this.audioContext.resume();
                console.log('恢复已存在的音频上下文, 新状态:', this.audioContext.state);
            } catch (error) {
                console.warn('恢复已存在的音频上下文失败:', error);
            }
        }
    }

    /**
     * 初始化流式合成音频上下文
     * @returns {Promise<AudioContext>} 音频上下文
     */
    async initStreamingAudioContext() {
        if (!this.streamingAudioContext || this.streamingAudioContext.state === 'closed') {
            try {
                this.streamingAudioContext = new (window.AudioContext || window.webkitAudioContext)();

                if (this.streamingAudioContext.state === 'suspended') {
                    await this.streamingAudioContext.resume();
                }
            } catch (error) {
                console.error('初始化流式音频上下文失败:', error);
                throw error;
            }
        } else if (this.streamingAudioContext.state === 'suspended') {
            await this.streamingAudioContext.resume();
        }

        return this.streamingAudioContext;
    }

    /**
     * 强制重置语音识别状态和资源
     */
    forceReset() {
        console.log('强制重置语音识别状态');

        // 重置内部状态
        this.recognizing = false;

        // 断开音频处理节点
        if (this.audioProcessor) {
            try {
                this.audioProcessor.disconnect();
            } catch (e) {
                console.warn('断开音频处理节点失败:', e);
            }
            this.audioProcessor = null;
        }

        // 关闭现有的媒体流
        if (this.mediaStream) {
            try {
                this.mediaStream.getTracks().forEach(track => {
                    track.stop();
                    console.log('媒体轨道已停止:', track.kind);
                });
                this.mediaStream = null;
            } catch (e) {
                console.warn('停止媒体轨道失败:', e);
            }
        }

        // 重置录音器
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            try {
                this.mediaRecorder.stop();
            } catch (e) {
                console.warn('停止媒体录制器失败:', e);
            }
            this.mediaRecorder = null;
        }

        // 关闭WebSocket - 无论状态如何都尝试关闭
        if (this.iatWs) {
            console.log('强制关闭WebSocket连接, 状态:', this.iatWs.readyState);
            try {
                this.iatWs.close();
            } catch (e) {
                console.warn('关闭WebSocket失败:', e);
            }
            this.iatWs = null;
        }

        // 重置变量
        this.audioChunks = [];
        this.recognitionText = '';
        this.resultTextTemp = '';
        this.audioQueue = [];
        this.processingAudio = false;
    }

    /**
     * 更新语音识别状态
     * @param {string} newState 新状态
     */
    updateRecognitionState(newState) {
        console.log(`语音识别状态变更: ${this.recognitionState} -> ${newState}`);
        this.recognitionState = newState;
    }

    /**
     * 开始语音识别 - 实时流式版本
     * @param {Function} onResult 识别结果回调
     * @param {Function} onError 错误回调
     */
    async startRecognize(onResult, onError) {
        try {
            // 检查当前状态
            if (this.recognitionState !== 'idle') {
                console.log(`当前状态为 ${this.recognitionState}，无法开始新的识别`);

                // 如果正在停止中，等待完成
                if (this.recognitionState === 'stopping') {
                    console.log('正在等待停止完成...');
                    await new Promise(resolve => {
                        const checkState = () => {
                            if (this.recognitionState === 'idle') {
                                resolve();
                            } else {
                                setTimeout(checkState, 100);
                            }
                        };
                        checkState();
                    });
                    console.log('停止已完成，现在可以开始新的识别');
                } else if (this.recognitionState === 'starting' || this.recognitionState === 'recording') {
                    throw new Error(`语音识别已在${this.recognitionState === 'starting' ? '启动' : '进行'}中`);
                }
            }

            // 设置锁，防止同时处理多个状态变更
            if (this.transitionLock) {
                throw new Error('系统正在处理另一个状态变更，请稍后再试');
            }
            this.transitionLock = true;

            try {
                // 修改这一行，直接设置状态而不是调用方法
                console.log(`语音识别状态变更: ${this.recognitionState} -> starting`);
                this.recognitionState = 'starting';

                // 强制重置状态和资源
                this.forceReset();

                // 检查配置是否完整
                if (!this.config.iat.appId || !this.config.iat.apiKey || !this.config.iat.apiSecret) {
                    throw new Error('语音识别配置不完整，请在设置中配置appId、apiKey和apiSecret');
                }

                // 设置回调
                this.onIatResult = onResult;
                this.onError = onError;

                // 重置识别文本和临时文本
                this.recognitionText = '';
                this.resultTextTemp = '';

                // 初始化音频上下文
                await this.initAudioContext();

                // 先连接WebSocket，确保连接成功后再开始录音
                console.log('连接WebSocket...');
                await this.connectIatWebSocket();
                console.log('WebSocket连接成功，准备开始录音');

                // 重置音频处理状态
                this.audioQueue = [];
                this.processingAudio = false;

                // 获取麦克风权限
                console.log('请求麦克风权限...');
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: 16000 // 尝试请求16k采样率
                    }
                });
                console.log('麦克风权限获取成功');

                // 保存流的引用以便之后关闭
                this.mediaStream = stream;

                // 准备录音
                this.audioChunks = [];

                // 检查WebSocket连接状态
                if (!this.iatWs || this.iatWs.readyState !== WebSocket.OPEN) {
                    throw new Error('WebSocket连接未就绪，无法开始录音');
                }

                // 设置音频处理
                const audioContext = this.audioContext;
                const source = audioContext.createMediaStreamSource(stream);

                // 创建音频处理节点
                const bufferSize = 4096;
                this.audioProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);

                // 设置音频处理回调 - 实时获取音频数据
                this.audioProcessor.onaudioprocess = async (e) => {
                    if (!this.recognizing) return;

                    // 获取输入音频数据
                    const inputBuffer = e.inputBuffer;
                    const inputData = inputBuffer.getChannelData(0);

                    // 创建一个新的Float32Array来存储数据副本
                    const audioData = new Float32Array(inputData.length);
                    audioData.set(inputData);

                    // 处理音频数据 - 转换为PCM并发送
                    await this.processAudioChunk(audioData);
                };

                // 连接节点
                source.connect(this.audioProcessor);
                this.audioProcessor.connect(audioContext.destination);

                // 创建MediaRecorder作为备用 - 可以帮助我们跟踪录音状态
                try {
                    const options = {
                        mimeType: 'audio/webm',
                        audioBitsPerSecond: 16000 * 16
                    };

                    this.mediaRecorder = new MediaRecorder(stream, options);
                    this.mediaRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            this.audioChunks.push(event.data);
                        }
                    };

                    this.mediaRecorder.onstop = () => {
                        console.log('媒体录制停止，收集的数据块数:', this.audioChunks.length);

                        // 断开音频处理节点
                        if (this.audioProcessor) {
                            try {
                                this.audioProcessor.disconnect();
                            } catch (e) {
                                console.warn('断开音频处理节点失败:', e);
                            }
                        }

                        // 发送结束标志
                        this.sendEndFrame().catch(err => console.error('发送结束帧失败:', err));

                        // 关闭所有轨道
                        if (this.mediaStream) {
                            this.mediaStream.getTracks().forEach(track => {
                                track.stop();
                                console.log('媒体轨道已停止:', track.kind);
                            });
                        }

                        // 在最后调用回调
                        setTimeout(() => {
                            this.recognizing = false;
                            // 更新状态为空闲
                            console.log(`语音识别状态变更: ${this.recognitionState} -> idle`);
                            this.recognitionState = 'idle';
                            if (this.onIatResult) {
                                this.onIatResult(this.resultTextTemp || this.recognitionText || '', true);
                            }
                        }, 1000);
                    };

                    // 启动MediaRecorder - 主要用于状态管理
                    this.mediaRecorder.start(1000);

                } catch (recorderError) {
                    console.warn('MediaRecorder创建失败，继续使用ScriptProcessor:', recorderError);
                }

                console.log('开始语音识别');
                this.recognizing = true;
                // 更新状态为录音中
                console.log(`语音识别状态变更: ${this.recognitionState} -> recording`);
                this.recognitionState = 'recording';

            } finally {
                // 释放锁
                this.transitionLock = false;
            }

        } catch (error) {
            // 出错时重置状态
            console.log(`语音识别状态变更: ${this.recognitionState} -> idle`);
            this.recognitionState = 'idle';
            // 确保释放锁
            this.transitionLock = false;

            console.error('启动语音识别失败:', error);
            if (onError) {
                onError(error);
            }
            this.recognizing = false;

            // 确保清理资源
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
            }
        }
    }

    /**
     * 处理音频块并发送到讯飞API
     * @param {Float32Array} audioData 原始音频数据
     */
    async processAudioChunk(audioData) {
        try {
            // 添加到队列
            this.audioQueue.push(audioData);

            // 如果已经在处理，则退出
            if (this.processingAudio) return;

            // 设置处理标志
            this.processingAudio = true;

            // 处理队列中的所有数据
            while (this.audioQueue.length > 0) {
                // 取出队列中的第一项
                const chunk = this.audioQueue.shift();

                // 转换为PCM Int16数据
                const pcmData = this.convertFloat32ToPCM16(chunk);

                // 检查WebSocket连接状态
                if (!this.iatWs || this.iatWs.readyState !== WebSocket.OPEN) {
                    console.warn('WebSocket连接已断开，尝试重新连接...');
                    try {
                        await this.connectIatWebSocket();
                        if (!this.iatWs || this.iatWs.readyState !== WebSocket.OPEN) {
                            throw new Error('WebSocket重连失败');
                        }
                    } catch (e) {
                        console.error('WebSocket重连失败:', e);
                        break; // 退出处理循环
                    }
                }

                // 发送PCM数据到讯飞API
                await this.sendAudioFrame(pcmData);
            }

            // 重置处理标志
            this.processingAudio = false;

        } catch (error) {
            console.error('处理音频块失败:', error);
            this.processingAudio = false;

            if (this.onError) {
                this.onError(error);
            }
        }
    }

    /**
     * 将Float32Array转换为PCM Int16Array数据
     * @param {Float32Array} float32Data 浮点音频数据
     * @returns {Int16Array} PCM数据
     */
    convertFloat32ToPCM16(float32Data) {
        const pcmData = new Int16Array(float32Data.length);

        // 转换Float32到Int16
        for (let i = 0; i < float32Data.length; i++) {
            // 限制在-1到1之间
            const s = Math.max(-1, Math.min(1, float32Data[i]));
            // 转换为16位整数
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        return pcmData;
    }

    /**
     * 发送单个音频帧到讯飞API
     * @param {Int16Array} pcmData PCM格式音频数据
     */
    async sendAudioFrame(pcmData) {
        // 帧大小设置 - 每帧1280字节数据
        const frameSize = 1280; // 建议讯飞每帧1280字节
        const samplesPerFrame = frameSize / 2; // Int16每个元素2字节

        // 根据帧大小分割数据
        for (let i = 0; i < pcmData.length; i += samplesPerFrame) {
            // 检查WebSocket是否已断开
            if (!this.iatWs || this.iatWs.readyState !== WebSocket.OPEN) {
                console.warn('发送过程中WebSocket已断开');
                break;
            }

            // 提取一帧数据
            const end = Math.min(i + samplesPerFrame, pcmData.length);
            const chunk = pcmData.slice(i, end);

            // 转换为ArrayBuffer
            const frameBuffer = new ArrayBuffer(chunk.length * 2);
            const view = new DataView(frameBuffer);

            // 填充数据
            for (let j = 0; j < chunk.length; j++) {
                view.setInt16(j * 2, chunk[j], true); // 小端模式
            }

            // 转换为Base64
            const base64Audio = this.arrayBufferToBase64(frameBuffer);

            // 检查大小限制
            if (base64Audio.length > 13000) {
                console.warn(`Base64数据大小(${base64Audio.length})超过限制，跳过`);
                continue;
            }

            // 构建请求
            const params = {
                data: {
                    status: 1, // 中间帧
                    format: 'audio/L16;rate=16000',
                    encoding: 'raw',
                    audio: base64Audio
                }
            };

            // 发送数据
            this.iatWs.send(JSON.stringify(params));

            // 等待一段时间，避免发送过快
            await new Promise(resolve => setTimeout(resolve, 40)); // 40ms间隔
        }
    }

    /**
     * 发送结束帧
     */
    async sendEndFrame() {
        if (!this.iatWs || this.iatWs.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket未连接，无法发送结束帧');
            return;
        }

        console.log('发送结束帧');
        const endParams = {
            data: {
                status: 2 // 最后一帧
            }
        };
        this.iatWs.send(JSON.stringify(endParams));
    }

    /**
     * 停止语音识别
     * @returns {Promise<void>} 停止完成的Promise - 只有在所有资源完全释放后才会解决
     */
    stopRecognize() {
        return new Promise((resolve) => {
            // 如果当前不在录音或启动中状态，直接返回
            if (this.recognitionState !== 'recording' && this.recognitionState !== 'starting') {
                console.log(`当前状态为 ${this.recognitionState}，无法停止`);
                resolve();
                return;
            }

            // 立即设置状态为停止中
            console.log(`语音识别状态变更: ${this.recognitionState} -> stopping`);
            this.recognitionState = 'stopping';

            if (this.recognizing) {
                console.log('停止语音识别');

                // 立即设置状态为未录音，以允许快速再次启动
                this.recognizing = false;

                // 创建一个清理完成的Promise
                const cleanup = new Promise((cleanupResolve) => {
                    // 如果有MediaRecorder，使用它停止录音
                    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                        // 保存原始的onstop处理程序
                        const originalOnstop = this.mediaRecorder.onstop;

                        // 重写onstop处理程序，在原始处理完成后解决Promise
                        this.mediaRecorder.onstop = (event) => {
                            // 调用原始处理程序
                            if (originalOnstop) {
                                originalOnstop.call(this.mediaRecorder, event);
                            }

                            // 确保延迟足够长，以便所有资源释放完成
                            setTimeout(() => {
                                console.log('媒体录制器停止回调完成，资源已清理');
                                this.recognitionState = 'idle';
                                cleanupResolve();
                            }, 1500); // 延长时间确保所有异步操作完成
                        };

                        // 停止MediaRecorder
                        this.mediaRecorder.stop();
                    } else {
                        // 手动清理资源
                        if (this.audioProcessor) {
                            try {
                                this.audioProcessor.disconnect();
                            } catch (e) {
                                console.warn('断开音频处理节点失败:', e);
                            }
                        }

                        // 发送结束标志
                        this.sendEndFrame().catch(err => console.error('发送结束帧失败:', err));

                        // 关闭所有轨道
                        if (this.mediaStream) {
                            this.mediaStream.getTracks().forEach(track => {
                                track.stop();
                                console.log('媒体轨道已停止:', track.kind);
                            });
                            this.mediaStream = null;
                        }

                        // 关闭WebSocket连接
                        if (this.iatWs) {
                            try {
                                // 发送完结束帧后立即关闭连接
                                setTimeout(() => {
                                    if (this.iatWs) {
                                        console.log('正在关闭语音识别WebSocket连接');
                                        this.iatWs.close();
                                        this.iatWs = null;
                                    }

                                    // 调用回调
                                    if (this.onIatResult) {
                                        this.onIatResult(this.resultTextTemp || this.recognitionText || '', true);
                                    }

                                    // 更新状态为空闲
                                    console.log(`语音识别状态变更: ${this.recognitionState} -> idle`);
                                    this.recognitionState = 'idle';

                                    // 确保延迟足够长，以便所有资源释放完成
                                    setTimeout(cleanupResolve, 1000);
                                }, 500);
                            } catch (e) {
                                console.warn('关闭WebSocket连接失败:', e);
                                console.log(`语音识别状态变更: ${this.recognitionState} -> idle`);
                                this.recognitionState = 'idle';
                                setTimeout(cleanupResolve, 1000);
                            }
                        } else {
                            // 如果没有WebSocket，直接完成
                            console.log(`语音识别状态变更: ${this.recognitionState} -> idle`);
                            this.recognitionState = 'idle';

                            // 调用回调
                            if (this.onIatResult) {
                                this.onIatResult(this.resultTextTemp || this.recognitionText || '', true);
                            }

                            // 确保延迟足够长
                            setTimeout(cleanupResolve, 1000);
                        }
                    }
                });

                // 清理完成后解决主Promise
                cleanup.then(() => {
                    console.log('所有资源清理完成，状态重置为空闲');
                    resolve();
                });
            } else {
                console.log('语音识别未在进行中，无需停止');
                console.log(`语音识别状态变更: ${this.recognitionState} -> idle`);
                this.recognitionState = 'idle';

                // 加一个短延迟确保状态更新
                setTimeout(resolve, 500);
            }
        });
    }

    /**
     * 连接讯飞语音识别WebSocket，包含重试机制
     * @param {number} retryCount 当前重试次数
     * @returns {Promise<void>}
     */
    async connectIatWebSocket(retryCount = 0) {
        try {
            // 最大重试次数
            const MAX_RETRIES = 3;

            // 如果已有连接且状态正常，直接返回
            if (this.iatWs && this.iatWs.readyState === WebSocket.OPEN) {
                console.log('WebSocket连接已存在且状态正常');
                return;
            }

            // 关闭已有连接
            if (this.iatWs) {
                try {
                    this.iatWs.close();
                    this.iatWs = null;
                } catch (e) {
                    console.warn('关闭旧WebSocket连接失败:', e);
                }
            }

            // 获取签名URL
            const signUrl = this.getSignUrl('iat');
            console.log('讯飞语音识别签名URL生成成功');

            // 创建WebSocket连接
            console.log(`正在连接讯飞语音识别WebSocket(尝试${retryCount + 1}/${MAX_RETRIES + 1})...`);
            this.iatWs = new WebSocket(signUrl);

            // 创建一个Promise来处理连接
            return new Promise((resolve, reject) => {
                // 设置连接超时
                const timeout = setTimeout(() => {
                    if (this.iatWs.readyState !== WebSocket.OPEN) {
                        if (retryCount < MAX_RETRIES) {
                            console.warn(`WebSocket连接超时，正在重试(${retryCount + 1}/${MAX_RETRIES})...`);
                            clearTimeout(timeout);
                            this.connectIatWebSocket(retryCount + 1).then(resolve).catch(reject);
                        } else {
                            reject(new Error('WebSocket连接超时，已达最大重试次数'));
                        }
                    }
                }, 5000);

                // 连接打开时
                this.iatWs.onopen = () => {
                    console.log('讯飞语音识别WebSocket连接成功');
                    clearTimeout(timeout);

                    // 发送首帧数据
                    const params = {
                        common: {
                            app_id: this.config.iat.appId,
                        },
                        business: {
                            language: 'zh_cn',
                            domain: 'iat',
                            accent: 'mandarin',
                            vad_eos: 5000, // 增加到5000ms以避免过早结束
                            dwa: 'wpgs', // 开启动态修正
                            ptt: 1, // 开启标点符号
                        },
                        data: {
                            status: 0, // 首帧
                            format: 'audio/L16;rate=16000',
                            encoding: 'raw',
                            audio: '' // 首帧不发送音频数据
                        }
                    };
                    console.log('发送首帧数据');
                    this.iatWs.send(JSON.stringify(params));
                    resolve();
                };

                // 连接错误处理
                this.iatWs.onerror = (event) => {
                    console.error('讯飞语音识别WebSocket错误:', event);
                    clearTimeout(timeout);

                    if (retryCount < MAX_RETRIES) {
                        console.warn(`WebSocket连接错误，正在重试(${retryCount + 1}/${MAX_RETRIES})...`);
                        this.connectIatWebSocket(retryCount + 1).then(resolve).catch(reject);
                    } else {
                        reject(new Error('WebSocket连接失败，已达最大重试次数'));
                    }
                };

                // 接收消息
                this.iatWs.onmessage = (event) => {
                    try {
                        const result = JSON.parse(event.data);
                        console.log('收到讯飞WebSocket消息:', result);

                        // 处理识别结果
                        if (result.code === 0 && result.data) {
                            this.processIatResult(result);
                        } else if (result.code !== 0) {
                            console.error('讯飞语音识别错误:', result);

                            // 错误码处理
                            let errorMessage = result.message || '识别失败';

                            switch(result.code) {
                                case 10005:
                                    errorMessage = 'AppID授权失败，请检查AppID是否正确';
                                    break;
                                case 10006:
                                case 10007:
                                    errorMessage = '参数错误，请检查参数设置';
                                    break;
                                case 10010:
                                case 10019:
                                    errorMessage = '会话超时，请重新尝试';
                                    break;
                                case 10043:
                                    errorMessage = '音频解码失败，请检查音频格式';
                                    break;
                                case 10101:
                                    errorMessage = '引擎会话已结束';
                                    break;
                                case 10114:
                                    errorMessage = '会话超时，超过60秒';
                                    break;
                                case 10139:
                                    errorMessage = '参数错误，引擎编解码错误';
                                    break;
                                case 10313:
                                    errorMessage = 'AppID不能为空';
                                    break;
                                case 11200:
                                    errorMessage = '没有权限，检查服务是否已开通';
                                    break;
                                case 11201:
                                    errorMessage = '日流控超限';
                                    break;
                            }

                            if (this.onError) {
                                this.onError(new Error(errorMessage));
                            }
                        }
                    } catch (error) {
                        console.error('处理识别结果失败:', error);
                    }
                };

                // 连接关闭处理
                this.iatWs.onclose = (event) => {
                    console.log('讯飞语音识别WebSocket已关闭', event.code, event.reason);
                };
            });
        } catch (error) {
            console.error('连接讯飞语音识别服务失败:', error);
            throw error;
        }
    }

    /**
     * 处理讯飞语音识别结果，包含动态修正处理
     * @param {Object} result 识别结果
     */
    processIatResult(result) {
        if (!result.data) {
            console.log('收到的结果数据结构不完整:', result);
            return;
        }

        // 处理动态修正返回结果
        if (result.data.result && result.data.result.ws) {
            // 提取文本结果
            let text = '';
            const ws = result.data.result.ws;

            console.log('提取的文本词组:', ws);
            for (const word of ws) {
                for (const cw of word.cw) {
                    text += cw.w;
                }
            }

            console.log('提取的文本片段:', text);

            // 处理动态修正 - 参考官方demo的处理方式
            if (result.data.result.pgs) {
                // 开启了wpgs会有此字段
                if (result.data.result.pgs === 'apd') {
                    // 将resultTextTemp同步给resultText - apd表示追加到结果
                    this.recognitionText = this.resultTextTemp || '';
                } else if (result.data.result.pgs === 'rpl') {
                    // 替换模式 - 替换指定范围的文本
                    const rg = result.data.result.rg;
                    if (rg && rg.length === 2) {
                        console.log(`替换模式，替换范围: ${rg[0]}-${rg[1]}`);
                        // 这里不需要特殊处理，只需要更新resultTextTemp即可
                    }
                }
                // 将结果存储在resultTextTemp中
                this.resultTextTemp = this.recognitionText + text;
            } else {
                // 未开启wpgs或者最终结果
                this.recognitionText = this.recognitionText + text;
            }

            console.log('当前累积文本:', this.resultTextTemp || this.recognitionText);

            // 调用结果回调 - 实时返回当前结果
            if (this.onIatResult) {
                const isLast = result.data.status === 2;
                console.log(`调用回调函数, 文本: ${this.resultTextTemp || this.recognitionText}, 是否最后: ${isLast}`);
                this.onIatResult(this.resultTextTemp || this.recognitionText, isLast);
            } else {
                console.log('未调用回调函数，可能是文本为空或回调未设置', {
                    hasCallback: !!this.onIatResult,
                    text: this.resultTextTemp || this.recognitionText,
                    status: result.data.status
                });
            }
        } else if (result.data.status === 2) {
            // 如果是最后一帧但没有内容，也通知客户端
            console.log('收到最后一帧但无内容');
            if (this.onIatResult) {
                this.onIatResult(this.resultTextTemp || this.recognitionText || '', true);
            }
        }
    }

    /**
     * 分割长文本 - 按照讯飞官方方式
     * @param {string} text 长文本
     * @param {number} maxLength 最大长度
     * @returns {string[]} 分段后的文本数组
     */
    splitLongText(text, maxLength = 300) {
        const segments = [];
        let start = 0;

        while (start < text.length) {
            // 取当前段落
            let end = Math.min(start + maxLength, text.length);

            // 如果没有到达文本末尾，尝试在标点符号处截断
            if (end < text.length) {
                // 从最大长度位置向前查找标点符号
                const punctuations = ['。', '！', '？', '；', '.', '!', '?', ';', '\n'];
                let foundPunctuation = false;

                // 向前最多查找50个字符
                for (let i = 0; i < 50 && end - i > start; i++) {
                    if (punctuations.includes(text[end - i - 1])) {
                        end = end - i;
                        foundPunctuation = true;
                        break;
                    }
                }

                // 如果没找到标点，尝试在空格处截断
                if (!foundPunctuation) {
                    for (let i = 0; i < 20 && end - i > start; i++) {
                        if (text[end - i - 1] === ' ' || text[end - i - 1] === '、' || text[end - i - 1] === '，') {
                            end = end - i;
                            break;
                        }
                    }
                }
            }

            // 添加段落
            segments.push(text.substring(start, end));
            start = end;
        }

        return segments;
    }

    /**
     * 按照句子分割文本
     * @param {string} text 输入文本
     * @returns {string[]} 句子数组
     */
    splitIntoSentences(text) {
        // 定义句子终止符
        const sentenceEndings = ['.', '?', '!', '。', '？', '！', ';', '；', '\n'];

        // 存储句子
        const sentences = [];
        let currentSentence = '';

        // 遍历字符
        for (let i = 0; i < text.length; i++) {
            currentSentence += text[i];

            // 检查是否是句子结束
            if (sentenceEndings.includes(text[i]) ||
                i === text.length - 1 ||
                currentSentence.length >= 100) { // 最大句子长度限制

                if (currentSentence.trim()) {
                    sentences.push(currentSentence.trim());
                }
                currentSentence = '';
            }
        }

        // 添加最后一个句子（如果有）
        if (currentSentence.trim()) {
            sentences.push(currentSentence.trim());
        }

        return sentences;
    }

    /**
     * 开始流式语音合成
     * @param {string} text 要合成的文本
     * @param {Function} onAudioChunk 收到音频块的回调
     * @param {Function} onComplete 完成时的回调
     * @param {Function} onError 错误回调
     * @param {Object} options 合成选项
     */
    async startStreamingSynthesize(text, onAudioChunk, onComplete, onError, options = {}) {
        try {
            // 检查配置是否完整
            if (!this.config.tts.appId || !this.config.tts.apiKey || !this.config.tts.apiSecret) {
                throw new Error('语音合成配置不完整，请在设置中配置appId、apiKey和apiSecret');
            }

            if (!text || text.trim() === '') {
                throw new Error('合成文本不能为空');
            }

            // 设置流式模式
            this.streamingMode = true;

            // 初始化音频上下文（如果需要)
            await this.initStreamingAudioContext();

            // 按句子分割文本
            const sentences = this.splitIntoSentences(text);
            console.log(`文本已分成${sentences.length}个句子，将依次合成`);

            // 保存回调
            this.audioChunkCallbacks = {
                onAudioChunk,
                onComplete,
                onError
            };

            // 重置音频队列
            this.audioChunkQueue = [];
            this.isPlayingChunk = false;

            // 逐句进行合成
            for (let i = 0; i < sentences.length; i++) {
                const sentence = sentences[i];
                if (!sentence.trim()) continue;

                try {
                    console.log(`正在合成第 ${i + 1}/${sentences.length} 个句子: ${sentence}`);

                    // 等待句子合成完成
                    const audioData = await this.synthesizeSentence(sentence, options);

                    // 如果流式模式被取消，退出循环
                    if (!this.streamingMode) {
                        console.log('流式合成已取消，不再处理后续句子');
                        break;
                    }

                    // 将音频数据添加到队列
                    this.queueAudioChunk(audioData);

                } catch (error) {
                    console.error(`第 ${i + 1} 个句子合成失败:`, error);

                    if (onError) {
                        onError(error);
                    }

                    // 继续处理下一个句子，不中断
                }
            }

            // 所有句子已加入队列
            console.log('所有句子已加入合成队列');

            // 等待所有音频播放完成
            if (this.isPlayingChunk || this.audioChunkQueue.length > 0) {
                console.log('等待所有音频播放完成...');
                // 最后一个音频块播放完成时会自动调用onComplete回调
            } else {
                // 如果没有任何音频块，立即调用完成回调
                console.log('没有音频需要播放，直接调用完成回调');
                if (onComplete) {
                    onComplete();
                }
            }

            // 重置流式模式
            this.streamingMode = false;

        } catch (error) {
            console.error('启动流式语音合成失败:', error);
            this.streamingMode = false;

            if (onError) {
                onError(error);
            }
        }
    }

    /**
     * 将音频块添加到队列并开始播放
     * @param {ArrayBuffer} audioData 音频数据
     */
    queueAudioChunk(audioData) {
        // 添加到队列
        this.audioChunkQueue.push(audioData);

        // 如果不在播放中，开始播放
        if (!this.isPlayingChunk) {
            this.playNextAudioChunk();
        }
    }

    /**
     * 播放队列中的下一个音频块
     */
    async playNextAudioChunk() {
        // 如果队列为空，结束播放
        if (this.audioChunkQueue.length === 0) {
            this.isPlayingChunk = false;

            // 如果所有音频都已播放完成，且还在流式模式中，调用完成回调
            if (this.streamingMode === false && this.audioChunkCallbacks.onComplete) {
                this.audioChunkCallbacks.onComplete();
            }

            return;
        }

        // 设置播放状态
        this.isPlayingChunk = true;

        // 获取下一个音频块
        const audioData = this.audioChunkQueue.shift();

        try {
            // 初始化上下文
            const context = await this.initStreamingAudioContext();

            // 解码音频
            const audioBuffer = await context.decodeAudioData(audioData);

            // 创建源
            const source = context.createBufferSource();
            source.buffer = audioBuffer;

            // 连接到输出
            source.connect(context.destination);

            // 设置播放结束回调
            source.onended = () => {
                // 播放下一个
                this.playNextAudioChunk();
            };

            // 通知收到音频块
            if (this.audioChunkCallbacks.onAudioChunk) {
                this.audioChunkCallbacks.onAudioChunk(audioData);
            }

            // 开始播放
            source.start(0);

        } catch (error) {
            console.error('播放音频块失败:', error);

            // 即使出错也继续播放下一个
            this.playNextAudioChunk();

            if (this.audioChunkCallbacks.onError) {
                this.audioChunkCallbacks.onError(error);
            }
        }
    }

    /**
     * 取消流式合成
     */
    cancelStreamingSynthesize() {
        this.streamingMode = false;
        this.audioChunkQueue = [];

        // 停止当前播放
        if (this.isPlayingChunk && this.streamingAudioContext) {
            try {
                this.streamingAudioContext.suspend();
            } catch (e) {
                console.warn('暂停音频上下文失败:', e);
            }
        }

        this.isPlayingChunk = false;
    }

    /**
     * 合成单个句子
     * @param {string} sentence 句子文本
     * @param {Object} options 合成选项
     * @returns {Promise<ArrayBuffer>} 音频数据
     */
    async synthesizeSentence(sentence, options) {
        return new Promise((resolve, reject) => {
            let audioData = null;

            this.startSynthesize(
                sentence,
                // 开始回调 - 可以忽略
                () => {},
                // 完成回调
                () => {
                    if (audioData) {
                        resolve(audioData);
                    } else {
                        reject(new Error('未收到音频数据'));
                    }
                },
                // 错误回调
                (error) => {
                    reject(error);
                },
                // 合成选项
                options
            );

            // 覆盖onTtsResult回调，以捕获音频数据
            this.onTtsResult = (audio) => {
                audioData = audio;
            };
        });
    }

    /**
     * 开始语音合成
     * @param {string} text 要合成的文本
     * @param {Function} onStart 开始播放回调
     * @param {Function} onEnd 播放结束回调
     * @param {Function} onError 错误回调
     * @param {Object} options 合成选项
     */
    async startSynthesize(text, onStart, onEnd, onError, options = {}) {
        try {
            // 确保先停止任何可能的语音播放
            this.stopPlayback();

            // 检查配置是否完整
            if (!this.config.tts.appId || !this.config.tts.apiKey || !this.config.tts.apiSecret) {
                throw new Error('语音合成配置不完整，请在设置中配置appId、apiKey和apiSecret');
            }

            if (!text || text.trim() === '') {
                throw new Error('合成文本不能为空');
            }

            // 设置状态变量
            this.synthesizing = true;
            this.isCanceled = false; // 添加取消标志

            // 初始化音频上下文
            await this.initAudioContext();

            // 如果文本过长，分段处理
            const MAX_TEXT_LENGTH = 300; // 讯飞官方建议单次合成文本长度不超过300字

            if (text.length > MAX_TEXT_LENGTH) {
                console.log(`文本长度(${text.length})超过${MAX_TEXT_LENGTH}，进行分段处理`);

                // 分段处理长文本
                const segments = this.splitLongText(text, MAX_TEXT_LENGTH);
                console.log(`文本已分成${segments.length}段，将依次合成`);

                // 设置分段合成状态
                this.textSegments = [...segments];
                this.currentSegmentIndex = 0;
                this.audioBuffers = [];
                this.startCalled = false;

                // 设置合成完成回调
                const processNextSegment = async () => {
                    // 检查是否已取消
                    if (this.isCanceled) {
                        console.log('语音合成已被取消，停止处理后续段落');
                        this.synthesizing = false;
                        return;
                    }

                    if (this.currentSegmentIndex < this.textSegments.length) {
                        const currentSegment = this.textSegments[this.currentSegmentIndex];
                        console.log(`处理第 ${this.currentSegmentIndex + 1}/${this.textSegments.length} 段文本，长度: ${currentSegment.length}`);

                        try {
                            // 设置回调
                            this.onTtsResult = (audio) => {
                                // 检查是否已取消
                                if (this.isCanceled) {
                                    console.log('语音合成已被取消，不播放音频');
                                    return;
                                }

                                // 第一段音频开始播放时调用onStart
                                if (!this.startCalled && onStart) {
                                    this.startCalled = true;
                                    onStart();
                                }

                                // 保存音频
                                this.audioBuffers.push(audio);

                                // 播放音频
                                this.playAudio(audio, () => {
                                    // 检查是否已取消
                                    if (this.isCanceled) {
                                        return;
                                    }

                                    // 播放完成后处理下一段
                                    this.currentSegmentIndex++;
                                    processNextSegment();
                                });
                            };

                            // 连接WebSocket并合成当前段落
                            await this.connectTtsWebSocket(currentSegment, options);
                        } catch (error) {
                            console.error(`第 ${this.currentSegmentIndex + 1} 段文本合成失败:`, error);

                            // 检查是否已取消
                            if (this.isCanceled) {
                                return;
                            }

                            // 出错后尝试下一段
                            this.currentSegmentIndex++;
                            processNextSegment();
                        }
                    } else {
                        // 所有段落都处理完成
                        console.log('所有文本段落合成完成');
                        this.synthesizing = false;
                        if (onEnd) {
                            onEnd();
                        }
                    }
                };

                // 设置错误回调
                this.onError = (error) => {
                    console.error('语音合成错误:', error);

                    // 记录错误但不停止合成，除非已被取消
                    if (this.isCanceled) {
                        this.synthesizing = false;
                    }

                    if (onError) {
                        onError(error);
                    }
                };

                // 开始处理第一段
                processNextSegment();
            } else {
                // 文本较短，直接合成
                console.log(`文本长度(${text.length})未超过限制，直接合成`);

                // 设置回调
                this.onTtsResult = (audio) => {
                    // 检查是否已取消
                    if (this.isCanceled) {
                        console.log('语音合成已被取消，不播放音频');
                        return;
                    }

                    if (onStart) {
                        onStart();
                    }
                    this.playAudio(audio, () => {
                        this.synthesizing = false;
                        if (onEnd) {
                            onEnd();
                        }
                    });
                };

                this.onError = (error) => {
                    this.synthesizing = false;
                    if (onError) {
                        onError(error);
                    }
                };

                // 连接讯飞WebSocket
                await this.connectTtsWebSocket(text, options);
            }

            console.log('开始语音合成');
        } catch (error) {
            console.error('启动语音合成失败:', error);
            this.synthesizing = false;
            if (onError) {
                onError(error);
            }
        }
    }

    /**
     * Base64编码Unicode字符串（处理中文）
     * @param {string} str 输入字符串
     * @returns {string} Base64编码后的字符串
     */
    base64EncodeUnicode(str) {
        // 首先进行UTF-8编码
        const utf8Bytes = encodeURIComponent(str).replace(
            /%([0-9A-F]{2})/g,
            (match, p1) => String.fromCharCode('0x' + p1)
        );

        // 然后进行Base64编码
        return btoa(utf8Bytes);
    }

    /**
     * 连接讯飞语音合成WebSocket
     * @param {string} text 要合成的文本
     * @param {Object} options 合成选项
     */
    async connectTtsWebSocket(text, options = {}) {
        try {
            // 获取签名URL
            const signUrl = this.getSignUrl('tts');
            console.log('讯飞语音合成签名URL生成成功');

            // 创建WebSocket连接
            console.log('正在连接讯飞语音合成WebSocket...');
            this.ttsWs = new WebSocket(signUrl);

            // 清空音频缓冲区
            this.audioBuffer = [];

            // 发送首帧数据的Promise
            const firstFrameSent = new Promise((resolve, reject) => {
                // 连接打开时
                this.ttsWs.onopen = () => {
                    console.log('讯飞语音合成WebSocket连接成功');

                    // 确保中文文本编码正确
                    let encodedText;
                    try {
                        // 使用encodeURIComponent处理中文，然后使用btoa进行base64编码
                        encodedText = btoa(unescape(encodeURIComponent(text)));
                        console.log('文本编码成功，长度:', encodedText.length);
                    } catch (e) {
                        console.error('文本编码错误:', e);
                        // 失败时使用备用方法
                        encodedText = this.base64EncodeUnicode(text);
                        console.log('使用备用方法编码文本，长度:', encodedText.length);
                    }

                    // 发送合成请求
                    const params = {
                        common: {
                            app_id: this.config.tts.appId,
                        },
                        business: {
                            aue: 'raw', // 原始PCM格式
                            sfl: 1, // 开启流式返回
                            auf: 'audio/L16;rate=16000', // 16K采样率
                            vcn: options.voice || 'xiaoyan', // 发音人
                            speed: options.speed || 50, // 语速
                            volume: options.volume || 50, // 音量
                            pitch: options.pitch || 50, // 音调
                            tte: 'UTF8', // 文本编码
                            // 修正参数类型
                            reg: '0',  // 字符串类型
                            rdn: '0',  // 字符串类型
                            bgs: 1     // 整数类型
                        },
                        data: {
                            status: 2, // 固定为2
                            text: encodedText // 使用正确编码的文本
                        }
                    };

                    console.log('发送语音合成请求:', JSON.stringify({
                        ...params,
                        data: {
                            ...params.data,
                            text: '(省略base64编码的文本)' // 不打印编码后的文本
                        }
                    }, null, 2));

                    this.ttsWs.send(JSON.stringify(params));
                    resolve();
                };

                // 连接错误处理
                this.ttsWs.onerror = (event) => {
                    console.error('讯飞语音合成WebSocket错误:', event);
                    this.synthesizing = false;
                    reject(new Error('WebSocket连接错误'));
                };

                // 设置连接超时
                setTimeout(() => {
                    if (this.ttsWs && this.ttsWs.readyState !== WebSocket.OPEN) {
                        this.synthesizing = false;
                        reject(new Error('WebSocket连接超时'));
                    }
                }, 5000);
            });

            // 等待首帧发送完成
            await firstFrameSent;
            console.log('语音合成请求发送成功');

            // 接收消息
            this.ttsWs.onmessage = (event) => {
                try {
                    const result = JSON.parse(event.data);
                    console.log('收到讯飞语音合成响应:', {
                        code: result.code,
                        message: result.message,
                        sid: result.sid,
                        status: result.data ? result.data.status : undefined,
                        audioLength: result.data && result.data.audio ? result.data.audio.length : 0
                    });

                    // 处理合成结果
                    if (result.code === 0 && result.data && result.data.audio) {
                        // 解码音频数据
                        const audioData = atob(result.data.audio);
                        const buf = new ArrayBuffer(audioData.length);
                        const view = new Uint8Array(buf);

                        // 填充数据
                        for (let i = 0; i < audioData.length; i++) {
                            view[i] = audioData.charCodeAt(i);
                        }

                        console.log(`收到音频数据片段，长度: ${buf.byteLength} 字节`);

                        // 收集音频数据
                        this.audioBuffer.push(buf);

                        // 如果是最后一帧，处理完整音频
                        if (result.data.status === 2) {
                            console.log(`收到最后音频帧，处理完整音频，总块数: ${this.audioBuffer.length}`);

                            // 创建合并后的PCM数据
                            const pcmData = this.mergeArrayBuffers(this.audioBuffer);

                            // 转换为WAV格式
                            const wavData = this.convertPCMToWAV(pcmData, 16000);

                            console.log(`合并音频数据并转换为WAV, 总长度: ${wavData.byteLength} 字节`);

                            // 调用结果回调
                            if (this.onTtsResult) {
                                this.onTtsResult(wavData);
                            }

                            // 重置缓冲区
                            this.audioBuffer = [];

                            // 关闭WebSocket连接
                            if (this.ttsWs && this.ttsWs.readyState === WebSocket.OPEN) {
                                console.log('语音合成完成，关闭WebSocket连接');
                                this.ttsWs.close();
                                this.ttsWs = null;
                            }
                        }
                    } else if (result.code !== 0) {
                        console.error('讯飞语音合成错误:', result);

                        if (this.onError) {
                            this.onError(new Error(result.message || '合成失败'));
                        }

                        // 关闭WebSocket连接
                        if (this.ttsWs && this.ttsWs.readyState === WebSocket.OPEN) {
                            this.ttsWs.close();
                            this.ttsWs = null;
                        }
                    }
                } catch (error) {
                    console.error('处理合成结果失败:', error);
                }
            };

            // 连接关闭处理
            this.ttsWs.onclose = (event) => {
                console.log('讯飞语音合成WebSocket已关闭', event.code, event.reason);
            };
        } catch (error) {
            console.error('连接讯飞语音合成服务失败:', error);
            throw error;
        }
    }

    /**
     * 将PCM数据转换为WAV格式
     * @param {ArrayBuffer} pcmData PCM音频数据
     * @param {number} sampleRate 采样率
     * @returns {ArrayBuffer} WAV格式的音频数据
     */
    convertPCMToWAV(pcmData, sampleRate = 16000) {
        // 创建WAV文件头
        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);

        // 写入WAV头
        const writeString = (view, offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        // RIFF标识
        writeString(view, 0, 'RIFF');

        // 文件长度
        view.setUint32(4, 36 + pcmData.byteLength, true);

        // WAVE标识
        writeString(view, 8, 'WAVE');

        // fmt子块
        writeString(view, 12, 'fmt ');

        // 子块长度
        view.setUint32(16, 16, true);

        // 音频格式（PCM为1）
        view.setUint16(20, 1, true);

        // 通道数（单声道为1）
        view.setUint16(22, 1, true);

        // 采样率
        view.setUint32(24, sampleRate, true);

        // 每秒字节数
        view.setUint32(28, sampleRate * 2, true);

        // 块对齐
        view.setUint16(32, 2, true);

        // 采样位数
        view.setUint16(34, 16, true);

        // data子块
        writeString(view, 36, 'data');

        // 数据长度
        view.setUint32(40, pcmData.byteLength, true);

        // 合并头部和数据
        const wavData = new Uint8Array(wavHeader.byteLength + pcmData.byteLength);
        wavData.set(new Uint8Array(wavHeader), 0);
        wavData.set(new Uint8Array(pcmData), wavHeader.byteLength);

        return wavData.buffer;
    }

    /**
     * 播放音频
     * @param {ArrayBuffer} audioData 音频数据
     * @param {Function} onEnd 播放结束回调
     */
    async playAudio(audioData, onEnd) {
        try {
            // 确保音频上下文已初始化
            await this.initAudioContext();

            console.log('开始解码音频数据，大小:', audioData.byteLength);

            // 解码音频数据
            try {
                // 停止当前正在播放的音频
                if (this.audioSource) {
                    try {
                        this.audioSource.stop();
                        this.audioSource.disconnect();
                        this.audioSource = null;
                    } catch (e) {
                        console.warn('停止之前音频失败:', e);
                    }
                }

                const audioBuffer = await this.audioContext.decodeAudioData(audioData);
                console.log('音频解码成功，时长:', audioBuffer.duration);

                // 创建音频源
                const source = this.audioContext.createBufferSource();
                source.buffer = audioBuffer;

                // 连接到输出设备
                source.connect(this.audioContext.destination);

                // 防止回调多次触发
                let callbackFired = false;

                // 设置播放结束回调
                source.onended = () => {
                    console.log('音频播放完成');
                    // 确保回调只执行一次
                    if (!callbackFired) {
                        callbackFired = true;
                        this.audioSource = null;
                        if (onEnd) {
                            onEnd();
                        }
                    }
                };

                // 开始播放
                console.log('开始播放音频');
                source.start(0);

                // 保存音频源引用，用于停止播放
                this.audioSource = source;

                // 安全超时 - 确保回调一定会被触发
                if (audioBuffer.duration > 0 && audioBuffer.duration < 300) {
                    setTimeout(() => {
                        if (!callbackFired) {
                            console.log('播放超时，手动触发回调');
                            callbackFired = true;
                            if (onEnd) onEnd();
                        }
                    }, (audioBuffer.duration * 1000) + 500); // 添加500ms缓冲
                }
            } catch (decodeError) {
                console.error('解码音频失败:', decodeError);
                if (onEnd) onEnd(); // 确保即使出错也调用回调
                throw new Error('音频解码失败: ' + decodeError.message);
            }
        } catch (error) {
            console.error('播放音频失败:', error);
            if (this.onError) {
                this.onError(error);
            }
            if (onEnd) onEnd(); // 确保即使出错也调用回调
        }
    }

    /**
     * 停止播放
     */
    stopPlayback() {
        console.log('完全停止所有语音合成和播放');

        // 设置取消标志
        this.isCanceled = true;

        // 取消流式合成
        this.cancelStreamingSynthesize();

        // 停止当前音频播放
        if (this.audioSource) {
            try {
                console.log('停止音频播放');
                this.audioSource.stop();
                this.audioSource.disconnect();
                this.audioSource = null;
            } catch (error) {
                console.error('停止播放失败:', error);
            }
        }

        // 重置分段合成状态
        this.textSegments = [];
        this.currentSegmentIndex = 0;
        this.audioBuffers = [];
        this.startCalled = false;

        // 重置合成状态
        this.synthesizing = false;

        // 关闭WebSocket连接
        if (this.ttsWs) {
            try {
                this.ttsWs.close();
                this.ttsWs = null;
            } catch (e) {
                console.warn('关闭WebSocket失败:', e);
            }
        }

        // 清空音频缓冲区
        this.audioBuffer = [];

        console.log('所有语音播放资源已清理');
    }

    /**
     * 将ArrayBuffer数组合并为一个ArrayBuffer
     * @param {Array<ArrayBuffer>} buffers ArrayBuffer数组
     * @returns {ArrayBuffer} 合并后的ArrayBuffer
     */
    mergeArrayBuffers(buffers) {
        // 计算总大小
        let totalLength = 0;
        for (const buffer of buffers) {
            totalLength += buffer.byteLength;
        }

        // 创建新的ArrayBuffer
        const result = new ArrayBuffer(totalLength);
        const view = new Uint8Array(result);

        // 填充数据
        let offset = 0;
        for (const buffer of buffers) {
            view.set(new Uint8Array(buffer), offset);
            offset += buffer.byteLength;
        }

        return result;
    }

    /**
     * 将ArrayBuffer转换为Base64字符串
     * @param {ArrayBuffer} buffer 要转换的ArrayBuffer
     * @returns {string} Base64字符串
     */
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * 清理资源
     * @returns {Promise<void>}
     */
    async dispose() {
        // 停止录音
        if (this.recognizing) {
            await this.stopRecognize();
        }

        // 断开音频处理节点
        if (this.audioProcessor) {
            try {
                this.audioProcessor.disconnect();
            } catch (e) {
                console.warn('断开音频处理节点失败:', e);
            }
            this.audioProcessor = null;
        }

        // 关闭WebSocket
        if (this.iatWs) {
            try {
                this.iatWs.close();
            } catch (e) {
                console.warn('关闭WebSocket失败:', e);
            }
            this.iatWs = null;
        }

        // 关闭音频轨道
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        // 关闭音频上下文
        if (this.audioContext && this.audioContext.state !== 'closed') {
            try {
                this.audioContext.close();
            } catch (e) {
                console.warn('关闭音频上下文失败:', e);
            }
            this.audioContext = null;
        }

        // 关闭流式音频上下文
        if (this.streamingAudioContext && this.streamingAudioContext.state !== 'closed') {
            try {
                this.streamingAudioContext.close();
            } catch (e) {
                console.warn('关闭流式音频上下文失败:', e);
            }
            this.streamingAudioContext = null;
        }

        // 重置变量
        this.audioChunks = [];
        this.recognitionText = '';
        this.resultTextTemp = '';
        this.audioQueue = [];
        this.processingAudio = false;
        this.streamingMode = false;
        this.audioChunkQueue = [];
        this.isPlayingChunk = false;

        console.log('语音服务资源已清理');
    }
}

// 创建单例实例
const speechService = new SpeechService();

export default speechService;