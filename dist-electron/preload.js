import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electron", {
  // 窗口控制
  minimize: () => ipcRenderer.invoke("window-minimize"),
  maximize: () => ipcRenderer.invoke("window-maximize"),
  close: () => ipcRenderer.invoke("window-close"),
  // 发送异步消息
  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  // 接收消息
  on: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
  // 移除监听器
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
contextBridge.exposeInMainWorld("electronStore", {
  get: (key) => ipcRenderer.invoke("store-get", key),
  set: (key, value) => ipcRenderer.invoke("store-set", key, value),
  has: (key) => ipcRenderer.invoke("store-has", key),
  delete: (key) => ipcRenderer.invoke("store-delete", key),
  clear: () => ipcRenderer.invoke("store-clear")
});
