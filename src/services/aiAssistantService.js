// src/services/aiAssistantService.js
import ipc from '../utils/ipc';
import authService from './authService';

/**
 * AI助手服务
 * 提供与AI模型交互的API接口，支持流式响应，学生数据整合
 */
class AiAssistantService {
    constructor() {
        this.apiUrl = 'https://api.deepseek.com/chat/completions';
        this.apiKey = ''; // 实际使用时需要设置API Key
        this.model = 'deepseek-chat'; // 默认使用DeepSeek模型
        this.messages = [];
        this.isStreaming = false;
        this.shareStudentData = false; // 是否分享学生数据
        this.currentConversationId = null; // 新增：记录当前对话ID

        // 新增：停止控制
        this.abortController = null; // 用于停止fetch请求
        this.streamReader = null; // 保存流读取器引用
        this.stopRequested = false; // 停止请求标志

        // 新增：本地Ollama支持
        this.isLocalOllama = false;
        this.ollamaUrl = 'http://localhost:11434';

        // 存储介质相关
        this.useLocalStorage = false;
        this.ipc = null;

        // 初始化时检查是否能使用ipc
        this.checkStorage();
    }

    /**
     * 检查存储方式
     */
    checkStorage() {
        try {
            // 尝试从window全局对象获取ipc
            try {
                if (window.ipcRenderer) {
                    this.ipc = window.ipcRenderer;
                } else if (window.electron && window.electron.ipcRenderer) {
                    this.ipc = window.electron.ipcRenderer;
                } else if (window.ipc) {
                    this.ipc = window.ipc;
                }
            } catch(e) {
                console.warn('无法从window获取ipc模块，将使用localStorage:', e);
            }

            if (this.ipc && typeof this.ipc.invoke === 'function') {
                this.useLocalStorage = false;
                console.log('将使用ipc进行存储');
            } else {
                this.useLocalStorage = true;
                console.log('将使用localStorage进行存储');
            }
        } catch (error) {
            console.error('检查存储方式失败，默认使用localStorage:', error);
            this.useLocalStorage = true;
        }
    }

    /**
     * 设置API配置
     * @param {Object} config 配置对象
     */
    setConfig(config) {
        if (config.apiKey) this.apiKey = config.apiKey;
        if (config.apiUrl) {
            this.apiUrl = config.apiUrl;
            // 检测是否是本地Ollama
            this.isLocalOllama = config.apiUrl.includes('localhost:11434') || config.apiUrl.includes('127.0.0.1:11434');
            if (this.isLocalOllama) {
                // 确保使用正确的Ollama端点
                if (config.apiUrl.endsWith('/v1')) {
                    this.apiUrl = config.apiUrl.replace('/v1', '/v1/chat/completions');
                } else if (!config.apiUrl.includes('/api/') && !config.apiUrl.includes('/v1/')) {
                    this.apiUrl = config.apiUrl + '/v1/chat/completions';
                }
                this.ollamaUrl = config.apiUrl.replace(/\/v1.*$/, '').replace(/\/api.*$/, '');
            }
        }
        if (config.model) this.model = config.model;
        if (config.shareStudentData !== undefined) this.shareStudentData = config.shareStudentData;
    }

    /**
     * 检测本地Ollama是否可用
     */
    async checkOllamaStatus() {
        if (!this.isLocalOllama) return false;

        try {
            const response = await fetch(`${this.ollamaUrl}/api/tags`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Ollama可用，已安装的模型:', data.models?.map(m => m.name) || []);
                return true;
            }
            return false;
        } catch (error) {
            console.error('检查Ollama状态失败:', error);
            return false;
        }
    }

    /**
     * 获取API配置
     * @returns {Object} 当前配置
     */
    getConfig() {
        return {
            apiKey: this.apiKey,
            apiUrl: this.apiUrl,
            model: this.model,
            shareStudentData: this.shareStudentData
        };
    }

    /**
     * 获取历史消息
     * @returns {Array} 消息历史
     */
    getMessages() {
        return [...this.messages];
    }

    /**
     * 清空历史消息
     */
    clearMessages() {
        this.messages = [];
    }

    /**
     * 设置历史消息
     * @param {Array} messages 消息数组
     */
    setMessages(messages) {
        this.messages = [...messages];
    }

    /**
     * 添加消息
     * @param {string} role 角色 (system, user, assistant)
     * @param {string} content 内容
     */
    addMessage(role, content) {
        this.messages.push({ role, content, timestamp: new Date().toISOString() });
    }

    /**
     * 停止当前的AI响应
     * @returns {Promise<void>}
     */
    async stopCurrentResponse() {
        console.log('[AI Service] 请求停止当前AI响应');

        try {
            // 设置停止标志
            this.stopRequested = true;
            this.isStreaming = false;

            // 停止fetch请求
            if (this.abortController) {
                console.log('[AI Service] 中断fetch请求');
                this.abortController.abort();
            }

            // 关闭流读取器
            if (this.streamReader) {
                try {
                    console.log('[AI Service] 关闭流读取器');
                    await this.streamReader.cancel();
                } catch (readerError) {
                    console.warn('[AI Service] 关闭流读取器失败:', readerError);
                }
            }

            console.log('[AI Service] AI响应已停止');
        } catch (error) {
            console.error('[AI Service] 停止AI响应时出错:', error);
        }
    }


    /**
     * 检查是否应该停止处理
     * @returns {boolean}
     */
    shouldStop() {
        return this.stopRequested;
    }

    /**
     * 重置停止状态
     */
    resetStopState() {
        this.stopRequested = false;
        this.abortController = null;
        this.streamReader = null;
    }

    /**
     * 收集学生数据（成绩、课表、考试信息等）
     * @returns {Promise<Object>} 脱敏后的学生数据
     */
    async collectStudentData() {
        try {
            if (!this.shareStudentData) {
                return null;
            }

            console.log('正在收集学生数据...');
            console.log('当前存储类型:', this.useLocalStorage ? 'localStorage' : 'ipc');

            // 列出所有存储的键名以帮助调试(Debug)
            await this.listAllStoredKeys();

            // 初始化数据对象
            const studentData = {
                basics: {},
                grades: [],
                schedule: [],
                exams: [],
                calendar: {}
            };

            // 获取基本信息
            const userInfo = authService.getUserInfo();
            if (userInfo) {
                studentData.basics = {
                    entranceYear: userInfo.entranceYear || null,
                    major: userInfo.major || null,
                    college: userInfo.college || null
                };
            }

            // 收集成绩数据 - 从分散的键中获取
            try {
                let i = 0;
                while (true) {
                    const marks = await this.getStoredData(`marks_${i}`);
                    if (!marks) break;

                    if (Array.isArray(marks)) {
                        studentData.grades.push(...marks.map(grade => ({
                            name: grade.name || grade.kcmc || '未知课程',
                            type: grade.type || grade.ksxz || '未知类型',
                            credit: grade.credit || grade.xf || 0,
                            mark: grade.mark || grade.cj || 0,
                            gpa: grade.gpa || 0
                        })));
                    }
                    i++;
                }
            } catch (e) {
                console.warn('获取成绩数据失败:', e);
            }

            // 收集考试数据 - 从分散的键中获取
            try {
                let i = 0;
                while (true) {
                    const exams = await this.getStoredData(`exams_${i}`);
                    if (!exams) break;

                    if (Array.isArray(exams)) {
                        studentData.exams.push(...exams.map(exam => ({
                            name: exam.name || exam.kcmc || '未知课程',
                            time: exam.time || exam.kssj || '',
                            location: exam.location || exam.cdmc || ''
                        })));
                    }
                    i++;
                }
            } catch (e) {
                console.warn('获取考试数据失败:', e);
            }

            // 获取课表数据
            try {
                // 尝试获取常规课表
                let lessonTable = await this.getStoredData('lesson_table');
                if (lessonTable && Array.isArray(lessonTable)) {
                    studentData.schedule.push(...lessonTable.map(course => ({
                        name: course.name || course.kcmc || '未知课程',
                        teacher: course.teacher || course.jsxm || '',
                        location: course.location || course.cdmc || '',
                        weekday: course.weekday || course.xqj || 0,
                        section: course.section || course.jcs || '',
                        weeks: course.weeks || course.zcd || ''
                    })));
                }

                // 尝试获取学期小组课表
                const academicGroups = await this.getStoredData('academic_groups');
                if (academicGroups && Array.isArray(academicGroups)) {
                    for (const group of academicGroups) {
                        const groupLessons = await this.getStoredData(`academic_group_${group.id}_lessons`);
                        if (groupLessons && Array.isArray(groupLessons)) {
                            studentData.schedule.push(...groupLessons.map(course => ({
                                name: course.name || course.kcmc || '未知课程',
                                teacher: course.teacher || course.jsxm || '',
                                location: course.location || course.cdmc || '',
                                weekday: course.weekday || course.xqj || 0,
                                section: course.section || course.jcs || '',
                                weeks: course.weeks || course.zcd || ''
                            })));
                        }
                    }
                }
            } catch (e) {
                console.warn('获取课表数据失败:', e);
            }

            // 尝试获取校历数据
            try {
                let calendar = await this.getStoredData('SCHOOL_CALENDAR_DATA');
                if (!calendar) {
                    calendar = await this.getStoredData('calendar');
                }

                if (calendar) {
                    studentData.calendar = {
                        year: calendar.year || calendar.semesterInfo?.year || '',
                        semester: calendar.semester || calendar.semesterInfo?.semester || '',
                        importantDates: calendar.importantDates || []
                    };
                }
            } catch (e) {
                console.warn('获取校历数据失败:', e);
            }

            // 添加调试信息
            console.log('成绩数据数量:', studentData.grades.length);
            console.log('课表数据数量:', studentData.schedule.length);
            console.log('考试数据数量:', studentData.exams.length);
            console.log('校历数据:', studentData.calendar);

            console.log('学生数据收集完成:', studentData);
            return studentData;
        } catch (error) {
            console.error('收集学生数据失败:', error);
            return null;
        }
    }

    // 列出所有存储的键名(Debug专用)
    async listAllStoredKeys() {
        try {
            console.log('列出所有存储的键名:');

            if (this.useLocalStorage) {
                // 列出 localStorage 中的所有键
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith('ujn_assistant_')) {
                        console.log('找到存储键:', key);
                    }
                }
            } else if (this.ipc) {
                // 如果使用 IPC，需要一个专门的方法来获取所有键
                if (typeof this.ipc.invoke === 'function') {
                    try {
                        const keys = await this.ipc.invoke('store:getAllKeys', 'ujn_assistant_');
                        console.log('从 IPC 获取的键:', keys);
                    } catch (e) {
                        console.error('获取 IPC 键列表失败:', e);
                    }
                }
            }
        } catch (error) {
            console.error('列出存储键失败:', error);
        }
    }

    /**
     * 从存储中获取数据
     * @param {string} key 键名
     * @returns {Promise<any>} 存储的数据
     */
    async getStoredData(key) {
        try {
            const prefixedKey = `ujn_assistant_${key}`;
            console.log(`尝试获取数据: ${key} -> ${prefixedKey}`);

            if (this.useLocalStorage) {
                const data = localStorage.getItem(prefixedKey);
                console.log(`localStorage获取结果 (${prefixedKey}):`, data ? '有数据' : '无数据');
                return data ? JSON.parse(data) : null;
            } else if (this.ipc) {
                let result = null;
                if (typeof this.ipc.getStoreValue === 'function') {
                    result = await this.ipc.getStoreValue(prefixedKey);
                } else if (typeof this.ipc.invoke === 'function') {
                    result = await this.ipc.invoke('store:get', prefixedKey);
                }
                console.log(`IPC获取结果 (${prefixedKey}):`, result ? '有数据' : '无数据');
                return result;
            }
            return null;
        } catch (error) {
            console.error(`获取存储数据 ${key} 失败:`, error);
            return null;
        }
    }

    /**
     * 发送流式请求到AI模型 - 支持DeepSeek官方API和本地模型
     * @param {string} userMessage 用户消息
     * @param {Function} onChunk 接收块的回调函数 (contentChunk, reasoningChunk, type)
     * @param {Function} onComplete 完成时的回调函数 (finalContent, finalReasoning)
     * @param {Function} onError 错误处理回调
     * @param {string} systemMessage 系统消息
     * @returns {Promise<void>}
     */
    async sendStreamingRequest(userMessage, onChunk, onComplete, onError, systemMessage = "You are a helpful assistant.") {
        try {
            // 重置停止状态
            this.resetStopState();

            // 如果是本地Ollama，先检查状态
            if (this.isLocalOllama) {
                const isOllamaAvailable = await this.checkOllamaStatus();
                if (!isOllamaAvailable) {
                    throw new Error('本地Ollama服务不可用，请确保Ollama已启动并且模型已下载');
                }
            }

            // 验证API Key（仅非本地Ollama需要）
            if (!this.isLocalOllama && !this.apiKey) {
                throw new Error('API Key未设置，请在设置中配置API Key');
            }

            // 如果要分享学生数据，先收集数据
            let enhancedSystemMessage = systemMessage;
            if (this.shareStudentData) {
                const studentData = await this.collectStudentData();
                if (studentData) {
                    enhancedSystemMessage += `\n\n以下是用户的学生数据，请根据这些信息提供更加个性化的回答：\n${JSON.stringify(studentData, null, 2)}`;
                }
            }

            // 如果没有系统消息，添加默认系统消息
            if (this.messages.length === 0 || this.messages[0].role !== 'system') {
                this.messages.unshift({ role: 'system', content: enhancedSystemMessage, timestamp: new Date().toISOString() });
            } else if (this.shareStudentData) {
                this.messages[0].content = enhancedSystemMessage;
            }

            // 添加用户消息
            this.addMessage('user', userMessage);

            // 创建请求体
            const requestBody = {
                model: this.model,
                messages: this.messages.map(msg => ({ role: msg.role, content: msg.content })),
                stream: true
            };

            // 准备请求头
            const headers = {
                'Content-Type': 'application/json'
            };

            // 仅非本地Ollama需要Authorization
            if (!this.isLocalOllama) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            console.log('发送请求到:', this.apiUrl);

            // 创建AbortController用于停止请求 - 只用于停止，不影响正常流程
            this.abortController = new AbortController();

            // 设置流式标志
            this.isStreaming = true;

            // 存储完整的AI响应和思维链
            let fullResponse = '';
            let fullReasoning = '';

            // 检测API类型：DeepSeek官方API 还是 本地模型
            let isDeepSeekOfficial = false;
            let useThinkTagParser = false;

            // 创建思维链解析器（用于本地模型的<think>标签格式）
            const createThinkingRenderer = () => {
                let thinkingBuffer = '';
                let answerBuffer = '';
                let isInThinkingMode = false;
                let thinkingComplete = false;

                return {
                    addContent: (fullText) => {
                        const parsed = this.parseStreamingContent(fullText);

                        if (parsed.hasThinking && !isInThinkingMode) {
                            isInThinkingMode = true;
                            console.log('进入思考模式');
                        }

                        if (parsed.isThinkingComplete && !thinkingComplete) {
                            thinkingComplete = true;
                            console.log('思考完成，开始答案');
                        }

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

            const thinkingRenderer = createThinkingRenderer();

            // 发送请求
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody),
                signal: this.abortController.signal // 添加停止信号
            });

            console.log('响应状态:', response.status, response.statusText);

            // 检查响应状态
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

                try {
                    const errorText = await response.text();
                    console.log('错误响应内容:', errorText);

                    try {
                        const errorData = JSON.parse(errorText);
                        errorMessage = errorData.error?.message || errorData.message || errorMessage;
                    } catch (e) {
                        if (errorText.trim()) {
                            errorMessage = errorText;
                        }
                    }
                } catch (e) {
                    console.error('读取错误响应失败:', e);
                }

                // 针对不同错误提供更好的提示
                if (response.status === 404) {
                    if (this.isLocalOllama) {
                        errorMessage = `找不到API端点。请确认：
1. Ollama已启动 (运行 'ollama serve')
2. 模型已下载 (运行 'ollama pull ${this.model}')
3. API端点正确: ${this.apiUrl}`;
                    } else {
                        errorMessage = 'API端点不存在，请检查API URL设置';
                    }
                } else if (response.status === 401) {
                    errorMessage = 'API Key无效或已过期，请检查API Key设置';
                } else if (response.status === 500) {
                    if (this.isLocalOllama) {
                        errorMessage = `服务器内部错误，可能的原因：
1. 模型 '${this.model}' 未下载
2. Ollama服务异常
3. 内存不足`;
                    } else {
                        errorMessage = '服务器内部错误: ' + errorMessage;
                    }
                }

                throw new Error(errorMessage);
            }

            // 获取响应流
            const reader = response.body.getReader();
            this.streamReader = reader; // 保存读取器引用
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            // 用于累积完整的响应内容（本地模型需要）
            let accumulatedContent = '';

            // 处理数据流 - 恢复原有的简单逻辑
            while (this.isStreaming) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                let lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        let data = line.slice(6);

                        if (data.trim() === '[DONE]') {
                            this.isStreaming = false;
                            break;
                        }

                        try {
                            const jsonData = JSON.parse(data);
                            const chunk = jsonData.choices?.[0];

                            if (chunk) {
                                // 检测是否是DeepSeek官方API格式（有reasoning_content字段）
                                if (chunk.delta?.reasoning_content !== undefined) {
                                    isDeepSeekOfficial = true;

                                    // 处理DeepSeek官方API的思维链
                                    if (chunk.delta.reasoning_content) {
                                        fullReasoning += chunk.delta.reasoning_content;
                                        onChunk('', chunk.delta.reasoning_content, 'thinking');
                                    }

                                    // 处理DeepSeek官方API的最终答案
                                    if (chunk.delta.content) {
                                        fullResponse += chunk.delta.content;
                                        onChunk(chunk.delta.content, '', 'answer');
                                    }
                                } else {
                                    // 处理本地模型或其他API格式（使用<think>标签）
                                    useThinkTagParser = true;

                                    let content = '';
                                    if (chunk.delta?.content) {
                                        content = chunk.delta.content;
                                    } else if (chunk.message?.content) {
                                        content = chunk.message.content;
                                    }

                                    if (content) {
                                        accumulatedContent += content;

                                        // 使用思维链解析器处理累积的内容
                                        const parsed = thinkingRenderer.addContent(accumulatedContent);

                                        // 检查思维链更新
                                        if (parsed.thinking !== fullReasoning) {
                                            const newThinking = parsed.thinking.slice(fullReasoning.length);
                                            if (newThinking) {
                                                fullReasoning = parsed.thinking;
                                                onChunk('', newThinking, 'thinking');
                                            }
                                        }

                                        // 检查答案更新
                                        if (parsed.answer !== fullResponse) {
                                            const newAnswer = parsed.answer.slice(fullResponse.length);
                                            if (newAnswer) {
                                                fullResponse = parsed.answer;
                                                onChunk(newAnswer, '', 'answer');
                                            }
                                        }
                                    }
                                }

                                // 检查是否完成
                                if (chunk.finish_reason) {
                                    this.isStreaming = false;
                                    break;
                                }
                            }
                        } catch (parseError) {
                            console.warn('JSON解析错误:', parseError.message);
                            console.warn('原始数据:', data);

                            // 如果解析失败，可能是纯文本响应（某些本地模型）
                            if (data.trim() && !data.includes('{')) {
                                accumulatedContent += data;

                                // 使用思维链解析器处理
                                const parsed = thinkingRenderer.addContent(accumulatedContent);

                                if (parsed.thinking !== fullReasoning) {
                                    const newThinking = parsed.thinking.slice(fullReasoning.length);
                                    if (newThinking) {
                                        fullReasoning = parsed.thinking;
                                        onChunk('', newThinking, 'thinking');
                                    }
                                }

                                if (parsed.answer !== fullResponse) {
                                    const newAnswer = parsed.answer.slice(fullResponse.length);
                                    if (newAnswer) {
                                        fullResponse = parsed.answer;
                                        onChunk(newAnswer, '', 'answer');
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 如果使用了<think>标签解析器，获取最终结果
            if (useThinkTagParser && !isDeepSeekOfficial) {
                const finalParsed = thinkingRenderer.finalize();
                fullResponse = finalParsed.answer;
                fullReasoning = finalParsed.thinking;
            }

            // 添加助手回复到历史，包含思维链
            const assistantMessage = {
                role: 'assistant',
                content: fullResponse,
                thinking: fullReasoning || null,
                timestamp: new Date().toISOString()
            };

            this.messages.push(assistantMessage);

            // 触发完成回调
            onComplete(fullResponse, fullReasoning);

            console.log('响应完成:', {
                isDeepSeekOfficial,
                useThinkTagParser,
                hasThinking: !!fullReasoning,
                contentLength: fullResponse.length,
                thinkingLength: fullReasoning.length
            });

        } catch (error) {
            console.error('AI流式请求失败:', error);

            // 如果是abort错误，说明是用户主动停止
            if (error.name === 'AbortError' || this.stopRequested) {
                console.log('[AI Service] 请求被用户停止');
                return;
            }

            // 提供更详细的错误信息
            let errorMessage = error.message;

            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                if (this.isLocalOllama) {
                    errorMessage = `无法连接到本地Ollama服务。请确认：
1. Ollama已启动 (在终端运行: ollama serve)
2. 服务地址正确: ${this.ollamaUrl}
3. 防火墙未阻止连接`;
                } else {
                    errorMessage = '网络连接失败，请检查网络设置和API地址';
                }
            }

            // 触发错误回调
            onError(new Error(errorMessage));
        } finally {
            // 清理资源 - 简化版本
            this.isStreaming = false;
            this.stopRequested = false;
            this.abortController = null;
            this.streamReader = null;
        }
    }


    /**
     * 解析流式响应中的思维链 - 用于本地模型的<think>标签格式
     */
    parseStreamingContent(fullText) {
        const hasThinkStart = fullText.includes('<think>');

        if (!hasThinkStart) {
            return {
                thinking: '',
                answer: fullText,
                hasThinking: false,
                isThinkingComplete: false
            };
        }

        const hasComplete = /<think>[\s\S]*?<\/think>/.test(fullText);

        if (!hasComplete) {
            const thinkStart = fullText.indexOf('<think>');
            const thinkingContent = fullText.slice(thinkStart + 7);

            return {
                thinking: thinkingContent,
                answer: '',
                hasThinking: true,
                isThinkingComplete: false
            };
        }

        const thinking = this.parseThinkingContent(fullText);
        const answer = this.extractFinalAnswer(fullText);

        return {
            thinking: thinking,
            answer: answer,
            hasThinking: thinking.length > 0,
            isThinkingComplete: true
        };
    }

    /**
     * 解析思维链内容
     */
    parseThinkingContent(text) {
        const thinkingRegex = /<think>([\s\S]*?)<\/think>/g;
        const matches = [];
        let match;

        while ((match = thinkingRegex.exec(text)) !== null) {
            matches.push(match[1]);
        }

        return matches.join('\n\n');
    }

    /**
     * 移除思维链标签，获取最终答案
     */
    extractFinalAnswer(text) {
        return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    }

    /**
     * 取消流式请求 - 保持向后兼容
     */
    cancelStream() {
        return this.stopCurrentResponse();
    }

    /**
     * 保存对话历史到存储
     * @param {string} conversationId 对话ID
     * @returns {Promise<boolean>} 是否成功保存
     */
    async saveConversation(conversationId) {
        try {
            // 记录当前对话ID
            this.currentConversationId = conversationId;
            console.log(`开始保存对话: ${conversationId}`);

            // 存储时间戳，确保排序准确
            const timestamp = new Date().toISOString();

            // 确保消息数据有效
            const safeMessages = this.messages.map(msg => ({
                role: msg.role || 'user',
                content: msg.content || '',
                thinking: msg.thinking || null,
                timestamp: msg.timestamp || timestamp
            }));

            // 验证消息数据有效性
            if (!safeMessages.length) {
                console.warn('保存对话失败：消息为空');
                return false;
            }

            console.log(`准备保存的消息数量: ${safeMessages.length}`);

            // 创建对话数据对象 - 保持简单结构
            const conversationData = {
                id: conversationId,
                messages: safeMessages,
                lastUpdated: timestamp
            };

            // 首先保存到localStorage作为备份
            try {
                console.log(`首先保存到localStorage备份: ${conversationId}`);
                localStorage.setItem(`ai_conversation_${conversationId}`, JSON.stringify(conversationData));
            } catch (localStorageError) {
                console.error(`localStorage备份失败: ${localStorageError.message}`);
            }

            // IPC保存
            let ipcSaveSuccess = false;

            if (!this.useLocalStorage && window.electronStore) {
                try {
                    console.log(`尝试通过IPC保存对话: ${conversationId}`);

                    // 序列化数据，确保可以安全传输
                    const serialized = JSON.stringify(conversationData);
                    console.log(`序列化后数据长度: ${serialized.length}`);

                    // 如果数据过大，使用分片存储
                    const MAX_CHUNK_SIZE = 500000; // 设置最大分片大小

                    if (serialized.length > MAX_CHUNK_SIZE) {
                        console.log(`数据过大(${serialized.length}字节)，使用分片存储`);

                        // 存储元数据
                        const metaData = {
                            id: conversationId,
                            messageCount: safeMessages.length,
                            lastUpdated: timestamp,
                            isChunked: true,
                            chunkCount: Math.ceil(serialized.length / MAX_CHUNK_SIZE)
                        };

                        // 保存元数据
                        const metaSuccess = await window.electronStore.set(`ai_conversation_${conversationId}_meta`, metaData);
                        if (!metaSuccess) {
                            throw new Error('元数据保存失败');
                        }

                        // 分片保存消息 - 完整的数据验证
                        for (let i = 0; i < safeMessages.length; i++) {
                            const message = safeMessages[i];
                            const messageToSave = {
                                role: message.role || 'user',
                                content: message.content || '',
                                timestamp: message.timestamp || new Date().toISOString()
                            };

                            // 只在thinking存在且不为空时添加
                            if (message.thinking) {
                                messageToSave.thinking = message.thinking;
                            }

                            const msgSuccess = await window.electronStore.set(
                                `ai_conversation_${conversationId}_msg_${i}`,
                                messageToSave
                            );

                            if (!msgSuccess) {
                                console.warn(`消息 ${i} 保存失败`);
                            } else {
                                console.log(`消息 ${i} 保存成功，包含thinking: ${!!messageToSave.thinking}`);
                            }
                        }

                        // 验证元数据
                        const savedMeta = await window.electronStore.get(`ai_conversation_${conversationId}_meta`);
                        if (!savedMeta || savedMeta.id !== conversationId) {
                            throw new Error('元数据验证失败');
                        }

                        console.log(`分片存储成功: ${savedMeta.messageCount} 条消息`);
                        ipcSaveSuccess = true;
                    } else {
                        // 数据不大，直接保存
                        console.log(`直接保存对话数据: ${serialized.length} 字节`);

                        // 使用JSON解析确保数据格式正确
                        const safeData = JSON.parse(serialized);

                        // 保存数据
                        const saveResult = await window.electronStore.set(`ai_conversation_${conversationId}`, safeData);
                        console.log(`保存结果: ${saveResult}`);

                        if (!saveResult) {
                            throw new Error('保存失败');
                        }

                        // 验证数据 - 使用简单检查
                        const savedData = await window.electronStore.get(`ai_conversation_${conversationId}`);
                        if (!savedData || !savedData.id || savedData.id !== conversationId) {
                            throw new Error('验证失败: 数据不完整或ID不匹配');
                        }

                        console.log(`IPC保存验证成功: ${savedData.messages?.length || 0} 条消息`);
                        ipcSaveSuccess = true;
                    }

                    // 更新最近对话列表
                    if (ipcSaveSuccess) {
                        try {
                            let recentIds = await window.electronStore.get('ai_recent_conversations') || [];
                            if (!Array.isArray(recentIds)) recentIds = [];

                            // 更新列表
                            recentIds = recentIds.filter(id => id !== conversationId);
                            recentIds.unshift(conversationId);

                            if (recentIds.length > 50) recentIds = recentIds.slice(0, 50);

                            const listSaveResult = await window.electronStore.set('ai_recent_conversations', recentIds);
                            console.log(`最近对话列表更新结果: ${listSaveResult}`);

                            if (listSaveResult) {
                                console.log(`已更新最近对话列表，当前共${recentIds.length}个对话`);
                            }
                        } catch (e) {
                            console.error('更新最近对话列表失败:', e);
                        }
                    }
                } catch (ipcError) {
                    console.error(`IPC保存失败: ${ipcError.message}`);
                    ipcSaveSuccess = false;
                }
            }

            // 如果IPC失败，使用localStorage
            if (!ipcSaveSuccess) {
                console.log('IPC保存失败，使用localStorage作为主要存储');
                this.useLocalStorage = true; // 切换到localStorage模式

                // 验证localStorage保存情况
                try {
                    const savedDataStr = localStorage.getItem(`ai_conversation_${conversationId}`);
                    if (!savedDataStr) {
                        // 重新保存
                        localStorage.setItem(`ai_conversation_${conversationId}`, JSON.stringify(conversationData));
                    }

                    // 更新localStorage中的最近对话列表
                    try {
                        let recentIds = JSON.parse(localStorage.getItem('ai_recent_conversations') || '[]');
                        if (!Array.isArray(recentIds)) recentIds = [];

                        // 更新列表
                        recentIds = recentIds.filter(id => id !== conversationId);
                        recentIds.unshift(conversationId);

                        if (recentIds.length > 50) recentIds = recentIds.slice(0, 50);
                        localStorage.setItem('ai_recent_conversations', JSON.stringify(recentIds));

                        console.log(`已更新localStorage最近对话列表，当前共${recentIds.length}个对话`);
                    } catch (e) {
                        console.error('更新localStorage最近对话列表失败:', e);
                    }
                } catch (localStorageError) {
                    console.error('最终localStorage验证/保存失败:', localStorageError);
                }
            }

            console.log(`对话 ${conversationId} 保存完成: IPC=${ipcSaveSuccess}, localStorage=true`);
            return true; // 至少有一种方法成功
        } catch (error) {
            console.error('保存对话失败:', error);

            // 紧急备份
            try {
                const timestamp = new Date().toISOString();
                const emergencyData = {
                    id: conversationId,
                    messages: this.messages.map(msg => ({
                        role: msg.role || 'user',
                        content: msg.content || '',
                        timestamp: msg.timestamp || timestamp
                    })),
                    lastUpdated: timestamp
                };
                localStorage.setItem(`ai_conversation_${conversationId}`, JSON.stringify(emergencyData));
                console.log('紧急备份到localStorage成功');
                return true;
            } catch (backupError) {
                console.error('最终备份失败:', backupError);
                return false;
            }
        }
    }

    /**
     * 加载对话历史
     * @param {string} conversationId 对话ID
     * @returns {Promise<boolean>} 是否成功
     */
    async loadConversation(conversationId) {
        try {
            let conversation = null;

            if (this.useLocalStorage) {
                // 从localStorage加载
                const conversationStr = localStorage.getItem(`ai_conversation_${conversationId}`);
                if (conversationStr) {
                    conversation = JSON.parse(conversationStr);
                }
            } else if (this.ipc) {
                // 从ipc存储加载
                if (typeof this.ipc.getStoreValue === 'function') {
                    conversation = await this.ipc.getStoreValue(`ai_conversation_${conversationId}`);
                } else if (typeof this.ipc.invoke === 'function') {
                    conversation = await this.ipc.invoke('store:get', `ai_conversation_${conversationId}`);
                }
            }

            if (conversation && conversation.messages) {
                this.messages = conversation.messages;
                return true;
            }

            // 如果主要方法失败，尝试备选方法
            if (!conversation && !this.useLocalStorage) {
                const conversationStr = localStorage.getItem(`ai_conversation_${conversationId}`);
                if (conversationStr) {
                    conversation = JSON.parse(conversationStr);
                    if (conversation && conversation.messages) {
                        this.messages = conversation.messages;
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            console.error('加载对话失败:', error);
            return false;
        }
    }

    /**
     * 获取所有保存的对话
     * @returns {Promise<Array>} 对话列表
     */
    async getConversations() {
        try {
            const conversations = [];
            const processedIds = new Set(); // 跟踪已处理的对话ID

            // 从localStorage收集对话
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('ai_conversation_')) {
                    try {
                        const conversation = JSON.parse(localStorage.getItem(key));
                        if (conversation && conversation.id) {
                            conversations.push(conversation);
                            processedIds.add(conversation.id);
                        }
                    } catch (e) {
                        console.error('解析对话失败:', e);
                    }
                }
            }

            // 如果有当前对话但未处理，确保添加它
            if (this.messages.length > 0 && this.currentConversationId && !processedIds.has(this.currentConversationId)) {
                conversations.push({
                    id: this.currentConversationId,
                    messages: this.messages,
                    lastUpdated: new Date().toISOString()
                });
                processedIds.add(this.currentConversationId);
            }

            // 从IPC获取对话
            if (this.ipc && !this.useLocalStorage) {
                try {
                    // 先获取最近对话ID列表
                    let recentIds = [];

                    try {
                        if (typeof this.ipc.getStoreValue === 'function') {
                            recentIds = await this.ipc.getStoreValue('ai_recent_conversations', []);
                        } else if (typeof this.ipc.invoke === 'function') {
                            recentIds = await this.ipc.invoke('store:get', 'ai_recent_conversations') || [];
                        }

                        if (!Array.isArray(recentIds)) recentIds = [];
                        console.log('从存储获取最近对话列表:', recentIds);
                    } catch (e) {
                        console.warn('获取最近对话列表失败:', e);
                        recentIds = [];
                    }

                    // 确保当前对话ID在列表中
                    if (this.currentConversationId && !recentIds.includes(this.currentConversationId)) {
                        recentIds.unshift(this.currentConversationId);
                    }

                    // 从ID列表获取对话
                    for (const id of recentIds) {
                        if (processedIds.has(id)) continue;

                        try {
                            let conversation;
                            const convKey = `ai_conversation_${id}`;

                            if (typeof this.ipc.getStoreValue === 'function') {
                                conversation = await this.ipc.getStoreValue(convKey);
                            } else if (typeof this.ipc.invoke === 'function') {
                                conversation = await this.ipc.invoke('store:get', convKey);
                            }

                            if (conversation && conversation.id) {
                                conversations.push(conversation);
                                processedIds.add(id);
                            }
                        } catch (e) {
                            console.warn(`获取对话 ${id} 失败:`, e);
                        }
                    }
                } catch (error) {
                    console.warn('从IPC获取对话失败:', error);
                }
            }

            // 对对话按最后更新时间排序
            conversations.sort((a, b) => {
                const timeA = new Date(a.lastUpdated || 0).getTime();
                const timeB = new Date(b.lastUpdated || 0).getTime();
                return timeB - timeA; // 降序排序
            });

            return conversations;
        } catch (error) {
            console.error('获取对话列表失败:', error);
            return [];
        }
    }

    /**
     * 删除对话
     * @param {string} conversationId 对话ID
     * @returns {Promise<boolean>} 是否成功删除
     */
    async deleteConversation(conversationId) {
        try {
            const key = `ai_conversation_${conversationId}`;

            // 删除localStorage中的对话
            localStorage.removeItem(key);

            // 如果有可用的IPC，也尝试删除IPC存储中的对话
            if (this.ipc && !this.useLocalStorage) {
                try {
                    if (typeof this.ipc.deleteStoreValue === 'function') {
                        await this.ipc.deleteStoreValue(key);
                    } else if (typeof this.ipc.invoke === 'function') {
                        await this.ipc.invoke('store:delete', key);
                    }
                } catch (error) {
                    console.warn('从IPC存储删除对话失败:', error);
                    // 不是致命错误，因为我们已经从localStorage中删除了
                }
            }

            return true;
        } catch (error) {
            console.error('删除对话失败:', error);
            return false;
        }
    }
}

// 创建单例实例
const aiAssistantService = new AiAssistantService();

export default aiAssistantService;