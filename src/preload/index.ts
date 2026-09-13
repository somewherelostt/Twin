import { contextBridge, ipcRenderer } from "electron";
import type { Toolkit, TwinBridge, TwinMode } from "../shared/contracts";

const bridge: TwinBridge = {
  getStatus: () => ipcRenderer.invoke("twin:status"),
  hide: () => ipcRenderer.invoke("twin:hide"),
  setMode: (mode: TwinMode) => ipcRenderer.invoke("twin:set-mode", mode),
  getConnections: () => ipcRenderer.invoke("twin:connections"),
  connect: (toolkit: Toolkit) => ipcRenderer.invoke("twin:connect", toolkit),
  transcribe: (request) => ipcRenderer.invoke("twin:transcribe", request),
  prepareAction: (command) => ipcRenderer.invoke("twin:prepare-action", command),
  executeAction: (planId) => ipcRenderer.invoke("twin:execute-action", planId),
  paste: (text) => ipcRenderer.invoke("twin:paste", text),
  onActivated: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("twin:activated", listener);
    return () => ipcRenderer.removeListener("twin:activated", listener);
  },
};

contextBridge.exposeInMainWorld("twin", bridge);
