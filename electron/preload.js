// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electron', {
    // 窗口控制
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),

    // 版本信息
    getVersion: () => ipcRenderer.invoke('app:version'),

    // 简单事件
    send: (channel, data) => {
        // 白名单channels
        const validChannels = ['toMain'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },

    on: (channel, func) => {
        const validChannels = ['fromMain', 'update-available', 'update-downloaded'];
        if (validChannels.includes(channel)) {
            // 防止内存泄漏，保存引用
            const subscription = (event, ...args) => func(...args);
            ipcRenderer.on(channel, subscription);

            // 返回清理函数
            return () => {
                ipcRenderer.removeListener(channel, subscription);
            };
        }
    },

    // 移除所有监听器
    removeAllListeners: (channel) => {
        const validChannels = ['fromMain', 'update-available', 'update-downloaded'];
        if (validChannels.includes(channel)) {
            ipcRenderer.removeAllListeners(channel);
        }
    }
});

// 暴露存储API
contextBridge.exposeInMainWorld('electronStore', {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    has: (key) => ipcRenderer.invoke('store:has', key),
    delete: (key) => ipcRenderer.invoke('store:delete', key),
    clear: () => ipcRenderer.invoke('store:clear')
});

// 暴露 IPC 功能给渲染进程
contextBridge.exposeInMainWorld('ipcRenderer', {
    invoke: (channel, data) => {
        // 白名单 channels - 添加了两个新通道
        const validChannels = [
            'eas:request', 'ipass:request',
            'store:get', 'store:set', 'store:has', 'store:delete', 'store:clear', 'store:getAllKeys',
            'app:version',
            'open-external-url',     // 用于在系统默认浏览器中打开链接
            'check-github-release'   // 用于检查GitHub上的最新版本
        ];

        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }

        throw new Error(`不允许使用未经授权的 IPC 通道: ${channel}`);
    },

    on: (channel, callback) => {
        // 白名单channels
        const validChannels = ['update-available', 'update-downloaded'];
        if (validChannels.includes(channel)) {
            const newCallback = (_, ...args) => callback(...args);
            ipcRenderer.on(channel, newCallback);
            return () => ipcRenderer.removeListener(channel, newCallback);
        }
    },

    removeAllListeners: (channel) => {
        const validChannels = ['update-available', 'update-downloaded'];
        if (validChannels.includes(channel)) {
            ipcRenderer.removeAllListeners(channel);
        }
    }
});