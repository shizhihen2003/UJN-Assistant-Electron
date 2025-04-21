// src/services/aiAssistantService.js
// 修复版本，增加localStorage备选方案

/**
 * AI助手服务
 * 提供与AI模型交互的API接口
 */
class AiAssistantService {
    constructor() {
        this.apiUrl = 'https://api.deepseek.com/chat/completions';
        this.apiKey = ''; // 实际使用时需要设置API Key
        this.model = 'deepseek-chat'; // 默认使用DeepSeek-V3模型
        this.messages = [];
        this.isStreaming = false;
        this.useLocalStorage = false; // 是否使用localStorage作为储存介质

        // 初始化时检查是否能使用ipc
        this.checkStorage();
    }

    /**
     * 检查存储方式
     */
    checkStorage() {
        try {
            // 尝试导入ipc
            let ipc = null;
            try {
                ipc = require('../utils/ipc').default;
            } catch(e) {
                console.warn('无法导入ipc模块，将使用localStorage:', e);
            }

            if (ipc && typeof ipc.setStoreValue === 'function') {
                this.ipc = ipc;
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
    }

    /**
     * 获取API配置
     * @returns {Object} 当前配置
     */
    getConfig() {
        return {
            apiKey: this.apiKey,
            apiUrl: this.apiUrl,
            model: this.model
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
     * 发送请求到AI模型 - 非流式
     * @param {string} userMessage 用户消息
     * @param {string} systemMessage 系统消息
     * @returns {Promise<Object>} AI响应
     */
    async sendRequest(userMessage, systemMessage = "You are a helpful assistant.") {
        try {
            // 验证API Key是否设置
            if (!this.apiKey) {
                throw new Error('API Key未设置，请在设置中配置API Key');
            }

            // 如果没有系统消息，添加默认系统消息
            if (this.messages.length === 0 || this.messages[0].role !== 'system') {
                this.messages.unshift({ role: 'system', content: systemMessage, timestamp: new Date().toISOString() });
            }

            // 添加用户消息
            this.addMessage('user', userMessage);

            // 创建请求体
            const requestBody = {
                model: this.model,
                messages: this.messages.map(msg => ({ role: msg.role, content: msg.content })),
                stream: false
            };

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

            // 解析响应
            const data = await response.json();
            const assistantResponse = data.choices[0].message;

            // 添加助手回复到历史
            this.addMessage('assistant', assistantResponse.content);

            return {
                content: assistantResponse.content,
                finish_reason: data.choices[0].finish_reason
            };
        } catch (error) {
            console.error('AI请求失败:', error);
            throw error;
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

            // 如果没有系统消息，添加默认系统消息
            if (this.messages.length === 0 || this.messages[0].role !== 'system') {
                this.messages.unshift({ role: 'system', content: systemMessage, timestamp: new Date().toISOString() });
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

            // 处理数据流
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

                            // 如果有内容，添加到完整响应并触发回调
                            if (chunk.delta?.content) {
                                fullResponse += chunk.delta.content;
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
            const conversationData = {
                id: conversationId,
                messages: this.messages,
                lastUpdated: new Date().toISOString()
            };

            if (this.useLocalStorage) {
                // 使用localStorage保存
                localStorage.setItem(`ai_conversation_${conversationId}`, JSON.stringify(conversationData));
                console.log('对话已保存到localStorage');
                return true;
            } else if (this.ipc) {
                // 使用ipc工具保存到本地存储
                await this.ipc.setStoreValue(`ai_conversation_${conversationId}`, conversationData);
                console.log('对话已保存到ipc存储');
                return true;
            } else {
                throw new Error('无可用存储方法');
            }
        } catch (error) {
            console.error('保存对话失败:', error);

            // 尝试备选存储方式
            try {
                localStorage.setItem(`ai_conversation_${conversationId}`, JSON.stringify({
                    id: conversationId,
                    messages: this.messages,
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
                conversation = await this.ipc.getStoreValue(`ai_conversation_${conversationId}`);
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

            // 收集对话
            if (this.useLocalStorage || (!this.ipc)) {
                // 从localStorage获取所有对话
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
            } else if (this.ipc) {
                // 这需要实现一个方法获取所有以ai_conversation_开头的键
                // 由于ipc可能不支持这种操作，所以仅使用localStorage的结果
                // TODO: 如果ipc支持获取所有键，可以添加实现
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

            if (this.useLocalStorage) {
                localStorage.removeItem(key);
            } else if (this.ipc) {
                await this.ipc.deleteStoreValue(key);
            }

            // 无论使用哪种存储，都尝试从localStorage中删除
            // 这是为了确保清理可能存在的备份
            try {
                localStorage.removeItem(key);
            } catch (e) {
                console.warn('从localStorage删除备份失败:', e);
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