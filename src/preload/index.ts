import { contextBridge, ipcRenderer } from "electron";
import type { Toolkit, TwinBridge, TwinMode } from "../shared/contracts";

const bridge: TwinBridge = {
  getStatus: () => ipcRenderer.invoke("twin:status"),
  hide: () => ipcRenderer.invoke("twin:hide"),
  setMode: (mode: TwinMode) => ipcRenderer.invoke("twin:set-mode", mode),
  getConnections: () => ipcRenderer.invoke("twin:connections"),
  connect: (toolkit: Toolkit) => ipcRenderer.invoke("twin:connect", toolkit),
  onActivated: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("twin:activated", listener);
    return () => ipcRenderer.removeListener("twin:activated", listener);
  },
};

contextBridge.exposeInMainWorld("twin", bridge);
