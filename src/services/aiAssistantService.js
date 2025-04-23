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
        if (config.apiUrl) this.apiUrl = config.apiUrl;
        if (config.model) this.model = config.model;
        if (config.shareStudentData !== undefined) this.shareStudentData = config.shareStudentData;
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
     * 收集学生数据（成绩、课表、考试信息等）
     * @returns {Promise<Object>} 脱敏后的学生数据
     */
    async collectStudentData() {
        try {
            if (!this.shareStudentData) {
                return null;
            }

            console.log('正在收集学生数据...');

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
                // 脱敏处理 - 移除学号等敏感信息
                studentData.basics = {
                    entranceYear: userInfo.entranceYear || null,
                    major: userInfo.major || null,
                    college: userInfo.college || null
                };
            }

            // 尝试获取成绩数据 - 修改后的代码
            try {
                // 尝试多个可能的键名
                let grades = await this.getStoredData('student_grades');
                if (!grades || !Array.isArray(grades) || grades.length === 0) {
                    grades = await this.getStoredData('marks'); // 尝试另一个可能的键名
                }
                if (!grades || !Array.isArray(grades) || grades.length === 0) {
                    grades = await this.getStoredData('eas_marks'); // 再尝试另一个可能的键名
                }

                // 如果成功获取到成绩数据
                if (grades && Array.isArray(grades) && grades.length > 0) {
                    // 脱敏处理
                    studentData.grades = grades.map(grade => ({
                        name: grade.name || grade.kcmc || '未知课程',
                        type: grade.type || grade.ksxz || '未知类型',
                        credit: grade.credit || grade.xf || 0,
                        mark: grade.mark || grade.cj || 0,
                        gpa: grade.gpa || 0
                    }));
                }
            } catch (e) {
                console.warn('获取成绩数据失败:', e);
            }

            // 尝试获取课表数据 - 修改后的代码
            try {
                let schedule = await this.getStoredData('student_schedule');
                if (!schedule || !Array.isArray(schedule) || schedule.length === 0) {
                    schedule = await this.getStoredData('lessons'); // 尝试另一个可能的键名
                }
                if (!schedule || !Array.isArray(schedule) || schedule.length === 0) {
                    schedule = await this.getStoredData('eas_lessons'); // 再尝试另一个可能的键名
                }

                if (schedule && Array.isArray(schedule) && schedule.length > 0) {
                    // 脱敏处理
                    studentData.schedule = schedule.map(course => ({
                        name: course.name || course.kcmc || '未知课程',
                        teacher: course.teacher || course.jsxm || '',
                        location: course.location || course.cdmc || '',
                        weekday: course.weekday || course.xqj || 0,
                        section: course.section || course.jcs || '',
                        weeks: course.weeks || course.zcd || ''
                    }));
                }
            } catch (e) {
                console.warn('获取课表数据失败:', e);
            }

            // 尝试获取考试数据 - 修改后的代码
            try {
                let exams = await this.getStoredData('student_exams');
                if (!exams || !Array.isArray(exams) || exams.length === 0) {
                    exams = await this.getStoredData('exams'); // 尝试另一个可能的键名
                }
                if (!exams || !Array.isArray(exams) || exams.length === 0) {
                    exams = await this.getStoredData('eas_exams'); // 再尝试另一个可能的键名
                }

                if (exams && Array.isArray(exams) && exams.length > 0) {
                    // 脱敏处理
                    studentData.exams = exams.map(exam => ({
                        name: exam.name || exam.kcmc || '未知课程',
                        time: exam.time || exam.kssj || '',
                        location: exam.location || exam.cdmc || ''
                    }));
                }
            } catch (e) {
                console.warn('获取考试数据失败:', e);
            }

            // 尝试获取校历数据 - 修改后的代码
            try {
                let calendar = await this.getStoredData('school_calendar');
                if (!calendar) {
                    calendar = await this.getStoredData('calendar'); // 尝试另一个可能的键名
                }

                if (calendar) {
                    // 脱敏处理
                    studentData.calendar = {
                        year: calendar.year || calendar.semesterInfo?.year || '',
                        semester: calendar.semester || calendar.semesterInfo?.semester || '',
                        importantDates: calendar.importantDates || []
                    };
                }
            } catch (e) {
                console.warn('获取校历数据失败:', e);
            }

            console.log('学生数据收集完成:', studentData);
            return studentData;
        } catch (error) {
            console.error('收集学生数据失败:', error);
            return null;
        }
    }

    /**
     * 从存储中获取数据
     * @param {string} key 键名
     * @returns {Promise<any>} 存储的数据
     */
    async getStoredData(key) {
        try {
            if (this.useLocalStorage) {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            } else if (this.ipc) {
                if (typeof this.ipc.getStoreValue === 'function') {
                    return await this.ipc.getStoreValue(key);
                } else if (typeof this.ipc.invoke === 'function') {
                    return await this.ipc.invoke('store:get', key);
                }
            }
            return null;
        } catch (error) {
            console.error(`获取存储数据 ${key} 失败:`, error);
            return null;
        }
    }

    /**
     * 发送流式请求到AI模型
     * @param {string} userMessage 用户消息
     * @param {Function} onChunk 接收块的回调函数
     * @param {Function} onComplete 完成时的回调函数
     * @param {Function} onError 错误处理回调
     * @param {string} systemMessage 系统消息
     * @returns {Promise<void>}
     */
    async sendStreamingRequest(userMessage, onChunk, onComplete, onError, systemMessage = "You are a helpful assistant.") {
        try {
            // 验证API Key是否设置
            if (!this.apiKey) {
                throw new Error('API Key未设置，请在设置中配置API Key');
            }

            // 如果要分享学生数据，先收集数据
            let enhancedSystemMessage = systemMessage;
            if (this.shareStudentData) {
                const studentData = await this.collectStudentData();
                if (studentData) {
                    // 将学生数据添加到系统消息中
                    enhancedSystemMessage += `\n\n以下是用户的学生数据，请根据这些信息提供更加个性化的回答：\n${JSON.stringify(studentData, null, 2)}`;
                }
            }

            // 如果没有系统消息，添加默认系统消息
            if (this.messages.length === 0 || this.messages[0].role !== 'system') {
                this.messages.unshift({ role: 'system', content: enhancedSystemMessage, timestamp: new Date().toISOString() });
            } else if (this.shareStudentData) {
                // 如果已有系统消息，但需要添加学生数据，则更新系统消息
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

            // 设置流式标志
            this.isStreaming = true;

            // 存储完整的AI响应
            let fullResponse = '';

            // 发送请求
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            // 检查响应状态
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API错误: ${errorData.error?.message || response.statusText}`);
            }

            // 获取响应流
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            // 处理数据流 - 修改后的代码
            while (this.isStreaming) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                // 解码接收到的数据
                buffer += decoder.decode(value, { stream: true });

                // 处理buffer中完整的SSE消息
                let lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        let data = line.slice(6);

                        // 如果数据是[DONE]，则完成
                        if (data.trim() === '[DONE]') {
                            this.isStreaming = false;
                            break;
                        }

                        // 解析JSON数据
                        try {
                            const jsonData = JSON.parse(data);
                            const chunk = jsonData.choices[0];

                            // 如果有内容，立即调用回调函数，确保UI更新
                            if (chunk.delta?.content) {
                                fullResponse += chunk.delta.content;
                                // 立即调用回调以实现流式显示
                                onChunk(chunk.delta.content);
                            }

                            // 检查是否完成
                            if (chunk.finish_reason) {
                                this.isStreaming = false;
                            }
                        } catch (e) {
                            console.warn('JSON解析错误:', e, 'Data:', data);
                        }
                    }
                }
            }

            // 添加助手回复到历史
            this.addMessage('assistant', fullResponse);

            // 触发完成回调
            onComplete(fullResponse);
        } catch (error) {
            console.error('AI流式请求失败:', error);

            // 重置流状态
            this.isStreaming = false;

            // 触发错误回调
            onError(error);
        }
    }

    /**
     * 取消流式请求
     */
    cancelStream() {
        this.isStreaming = false;
    }

    /**
     * 保存对话历史到存储
     * @param {string} conversationId 对话ID
     */
    async saveConversation(conversationId) {
        try {
            // 确保消息中不存在null或undefined值
            const safeMessages = this.messages.map(msg => ({
                role: msg.role || 'user',
                content: msg.content || '',
                timestamp: msg.timestamp || new Date().toISOString()
            }));

            const conversationData = {
                id: conversationId,
                messages: safeMessages,
                lastUpdated: new Date().toISOString()
            };

            if (this.useLocalStorage) {
                // 使用localStorage保存
                localStorage.setItem(`ai_conversation_${conversationId}`, JSON.stringify(conversationData));
                console.log('对话已保存到localStorage');
                return true;
            } else if (this.ipc) {
                // 使用ipc工具保存到本地存储
                if (typeof this.ipc.setStoreValue === 'function') {
                    await this.ipc.setStoreValue(`ai_conversation_${conversationId}`, conversationData);
                } else if (typeof this.ipc.invoke === 'function') {
                    await this.ipc.invoke('store:set', `ai_conversation_${conversationId}`, conversationData);
                }
                console.log('对话已保存到ipc存储');
                return true;
            } else {
                throw new Error('无可用存储方法');
            }
        } catch (error) {
            console.error('保存对话失败:', error);

            // 尝试备选存储方式
            try {
                const safeMessages = this.messages.map(msg => ({
                    role: msg.role || 'user',
                    content: msg.content || '',
                    timestamp: msg.timestamp || new Date().toISOString()
                }));

                localStorage.setItem(`ai_conversation_${conversationId}`, JSON.stringify({
                    id: conversationId,
                    messages: safeMessages,
                    lastUpdated: new Date().toISOString()
                }));
                console.log('对话已保存到备选存储(localStorage)');
                return true;
            } catch (backupError) {
                console.error('备选存储也失败:', backupError);
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

            // 从localStorage收集对话
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('ai_conversation_')) {
                    try {
                        const conversation = JSON.parse(localStorage.getItem(key));
                        if (conversation && conversation.id) {
                            conversations.push(conversation);
                        }
                    } catch (e) {
                        console.error('解析对话失败:', e);
                    }
                }
            }

            // 如果有可用的IPC方法，尝试获取所有对话键
            if (this.ipc && !this.useLocalStorage) {
                try {
                    // 尝试获取所有键（如果实现了此功能）
                    if (typeof this.ipc.invoke === 'function') {
                        const storeKeys = await this.ipc.invoke('store:getAllKeys');
                        if (Array.isArray(storeKeys)) {
                            for (const key of storeKeys) {
                                if (key.startsWith('ai_conversation_') && !conversations.some(c => `ai_conversation_${c.id}` === key)) {
                                    const conversation = await this.ipc.invoke('store:get', key);
                                    if (conversation && conversation.id) {
                                        conversations.push(conversation);
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.warn('从IPC获取所有对话失败:', error);
                    // 这不是致命错误，至少我们有localStorage中的对话
                }
            }

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