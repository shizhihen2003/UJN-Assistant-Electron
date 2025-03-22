import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
  getStoreValue: (key) => ipcRenderer.invoke("get-store-value", key),
  setStoreValue: (key, value) => ipcRenderer.invoke("set-store-value", key, value)
});
