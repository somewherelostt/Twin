import { contextBridge, ipcRenderer } from "electron";
const bridge = {
    getStatus: () => ipcRenderer.invoke("twin:status"),
    hide: () => ipcRenderer.invoke("twin:hide"),
    setMode: (mode) => ipcRenderer.invoke("twin:set-mode", mode),
    getConnections: () => ipcRenderer.invoke("twin:connections"),
    connect: (toolkit) => ipcRenderer.invoke("twin:connect", toolkit),
    onActivated: (callback) => {
        const listener = () => callback();
        ipcRenderer.on("twin:activated", listener);
        return () => ipcRenderer.removeListener("twin:activated", listener);
    },
};
contextBridge.exposeInMainWorld("twin", bridge);
