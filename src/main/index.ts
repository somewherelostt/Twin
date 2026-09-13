import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, globalShortcut, ipcMain, shell } from "electron";
import Store from "electron-store";
import "dotenv/config";
import { TOOLKITS, type AppStatus, type Toolkit, type TwinMode } from "../shared/contracts";
import { transcribeDictation } from "./services/dictation";
import { pasteIntoPreviousApp } from "./services/paste";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const settings = new Store<{ shortcut: string; mode: TwinMode }>({
  defaults: { shortcut: "Alt+Space", mode: "dictate" },
});

let window: BrowserWindow | null = null;

function createWindow() {
  window = new BrowserWindow({
    width: 720,
    height: 460,
    minWidth: 620,
    minHeight: 360,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    show: false,
    resizable: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(currentDir, "index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.on("blur", () => window?.hide());

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(path.join(currentDir, "../../dist/index.html"));
  }
}

function toggleWindow() {
  if (!window) return;
  if (window.isVisible()) {
    window.hide();
    return;
  }
  window.center();
  window.show();
  window.focus();
  window.webContents.send("twin:activated");
}

function registerShortcut() {
  globalShortcut.unregisterAll();
  const shortcut = settings.get("shortcut");
  if (!globalShortcut.register(shortcut, toggleWindow)) {
    settings.set("shortcut", "CommandOrControl+Shift+Space");
    globalShortcut.register(settings.get("shortcut"), toggleWindow);
  }
}

function registerIpc() {
  ipcMain.handle("twin:status", (): AppStatus => ({
    configured: {
      assemblyAI: Boolean(process.env.ASSEMBLYAI_API_KEY),
      openAI: Boolean(process.env.OPENAI_API_KEY),
      composio: Boolean(process.env.COMPOSIO_API_KEY),
    },
    shortcut: settings.get("shortcut"),
  }));

  ipcMain.handle("twin:hide", () => window?.hide());
  ipcMain.handle("twin:set-mode", (_event, mode: TwinMode) => settings.set("mode", mode));

  ipcMain.handle("twin:transcribe", (_event, request) =>
    transcribeDictation(request, process.env.ASSEMBLYAI_API_KEY),
  );

  ipcMain.handle("twin:paste", async (_event, text: string) => {
    window?.hide();
    await pasteIntoPreviousApp(text);
  });

  ipcMain.handle("twin:connections", async () =>
    TOOLKITS.map((slug) => ({ slug, connected: false })),
  );

  ipcMain.handle("twin:connect", async (_event, toolkit: Toolkit) => {
    if (!TOOLKITS.includes(toolkit)) throw new Error("Unsupported integration");
    if (!process.env.COMPOSIO_API_KEY) throw new Error("Add COMPOSIO_API_KEY to connect apps");
    throw new Error("Connection service is not initialized yet");
  });

  ipcMain.handle("twin:open-external", async (_event, url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("Only secure links are allowed");
    await shell.openExternal(parsed.toString());
  });
}

app.whenReady().then(() => {
  createWindow();
  registerShortcut();
  registerIpc();
  toggleWindow();
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
