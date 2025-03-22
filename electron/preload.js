import { contextBridge, ipcRenderer } from 'electron'

// 向渲染进程暴露API
contextBridge.exposeInMainWorld('electronAPI', {
    getStoreValue: (key) => ipcRenderer.invoke('get-store-value', key),
    setStoreValue: (key, value) => ipcRenderer.invoke('set-store-value', key, value)
})