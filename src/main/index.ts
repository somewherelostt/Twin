import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, safeStorage, screen, shell } from "electron";
import Store from "electron-store";
import "dotenv/config";
import { TOOLKITS, type AppStatus, type CredentialInput, type Toolkit, type TwinMode } from "../shared/contracts";
import { transcribeDictation } from "./services/dictation";
import {
  connectToolkit,
  executeAction,
  getConnections,
  prepareAction,
} from "./services/integrations";
import { pasteIntoPreviousApp } from "./services/paste";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const settings = new Store<{ shortcut: string; mode: TwinMode }>({
  defaults: { shortcut: "Alt+Space", mode: "dictate" },
});
const credentials = new Store<{ assemblyAI?: string; openAI?: string; composio?: string }>({ name: "credentials" });

let window: BrowserWindow | null = null;
let screenContext: string | undefined;

function getStatus(): AppStatus {
  return {
    configured: {
      assemblyAI: Boolean(process.env.ASSEMBLYAI_API_KEY),
      openAI: Boolean(process.env.OPENAI_API_KEY),
      composio: Boolean(process.env.COMPOSIO_API_KEY),
    },
    shortcut: settings.get("shortcut"),
  };
}

function loadCredentials() {
  if (!safeStorage.isEncryptionAvailable()) return;
  const mappings = [
    ["assemblyAI", "ASSEMBLYAI_API_KEY"],
    ["openAI", "OPENAI_API_KEY"],
    ["composio", "COMPOSIO_API_KEY"],
  ] as const;
  for (const [key, environmentName] of mappings) {
    const encrypted = credentials.get(key);
    if (!process.env[environmentName] && encrypted) {
      process.env[environmentName] = safeStorage.decryptString(Buffer.from(encrypted, "base64"));
    }
  }
}

function saveCredentials(input: CredentialInput) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Secure credential storage is unavailable");
  const mappings = [
    ["assemblyAI", "ASSEMBLYAI_API_KEY"],
    ["openAI", "OPENAI_API_KEY"],
    ["composio", "COMPOSIO_API_KEY"],
  ] as const;
  for (const [key, environmentName] of mappings) {
    const value = input[key]?.trim();
    if (!value) continue;
    credentials.set(key, safeStorage.encryptString(value).toString("base64"));
    process.env[environmentName] = value;
  }
  return getStatus();
}

async function captureScreenContext() {
  try {
    const display = screen.getPrimaryDisplay();
    const ratio = Math.min(1, 1440 / display.size.width);
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: {
        width: Math.round(display.size.width * ratio),
        height: Math.round(display.size.height * ratio),
      },
    });
    const source = sources.find((item) => item.display_id === String(display.id)) ?? sources[0];
    screenContext = source?.thumbnail.isEmpty() ? undefined : source?.thumbnail.toDataURL();
  } catch {
    screenContext = undefined;
  }
}

function createWindow() {
  window = new BrowserWindow({
    width: 720,
    height: 540,
    minWidth: 620,
    minHeight: 440,
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

async function toggleWindow() {
  if (!window) return;
  if (window.isVisible()) {
    window.hide();
    return;
  }
  await captureScreenContext();
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
  ipcMain.handle("twin:status", getStatus);
  ipcMain.handle("twin:save-credentials", (_event, input: CredentialInput) => saveCredentials(input));

  ipcMain.handle("twin:hide", () => window?.hide());
  ipcMain.handle("twin:set-mode", (_event, mode: TwinMode) => settings.set("mode", mode));

  ipcMain.handle("twin:transcribe", (_event, request) =>
    transcribeDictation(request, process.env.ASSEMBLYAI_API_KEY),
  );

  ipcMain.handle("twin:paste", async (_event, text: string) => {
    window?.hide();
    await pasteIntoPreviousApp(text);
  });

  ipcMain.handle("twin:connections", () => getConnections());

  ipcMain.handle("twin:connect", async (_event, toolkit: Toolkit) => {
    if (!TOOLKITS.includes(toolkit)) throw new Error("Unsupported integration");
    const connection = await connectToolkit(toolkit);
    await shell.openExternal(connection.redirectUrl);
    return connection;
  });

  ipcMain.handle("twin:prepare-action", (_event, command: string) => prepareAction(command, screenContext));
  ipcMain.handle("twin:execute-action", (_event, planId: string) => executeAction(planId));

  ipcMain.handle("twin:open-external", async (_event, url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("Only secure links are allowed");
    await shell.openExternal(parsed.toString());
  });
}

app.whenReady().then(() => {
  loadCredentials();
  createWindow();
  registerShortcut();
  registerIpc();
  void toggleWindow();
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
