import { contextBridge, ipcRenderer } from "electron";
import type { Toolkit, TwinBridge, TwinMode } from "../shared/contracts";

const bridge: TwinBridge = {
  getStatus: () => ipcRenderer.invoke("twin:status"),
  saveCredentials: (input) => ipcRenderer.invoke("twin:save-credentials", input),
  completeOnboarding: () => ipcRenderer.invoke("twin:complete-onboarding"),
  hide: () => ipcRenderer.invoke("twin:hide"),
  setMousePassthrough: (passthrough) => ipcRenderer.invoke("twin:mouse-passthrough", passthrough),
  setOverlayHeight: (height) => ipcRenderer.invoke("twin:set-overlay-height", height),
  setMode: (mode: TwinMode) => ipcRenderer.invoke("twin:set-mode", mode),
  getConnections: () => ipcRenderer.invoke("twin:connections"),
  connect: (toolkit: Toolkit) => ipcRenderer.invoke("twin:connect", toolkit),
  transcribe: (request) => ipcRenderer.invoke("twin:transcribe", request),
  prepareAction: (command) => ipcRenderer.invoke("twin:prepare-action", command),
  cancelPrepare: () => ipcRenderer.invoke("twin:cancel-prepare"),
  executeAction: (planId) => ipcRenderer.invoke("twin:execute-action", planId),
  paste: (text) => ipcRenderer.invoke("twin:paste", text),
  onActivated: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("twin:activated", listener);
    return () => ipcRenderer.removeListener("twin:activated", listener);
  },
  onActionProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: Parameters<typeof callback>[0]) => callback(progress);
    ipcRenderer.on("twin:action-progress", listener);
    return () => ipcRenderer.removeListener("twin:action-progress", listener);
  },
  onConnectionsChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("twin:connections-changed", listener);
    return () => ipcRenderer.removeListener("twin:connections-changed", listener);
  },
};

contextBridge.exposeInMainWorld("twin", bridge);
