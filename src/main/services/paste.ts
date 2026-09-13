import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { clipboard } from "electron";

const execFileAsync = promisify(execFile);

export async function pasteIntoPreviousApp(text: string) {
  if (!text.trim()) throw new Error("There is no text to paste");
  clipboard.writeText(text);
  await new Promise((resolve) => setTimeout(resolve, 140));

  if (process.platform === "win32") {
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-WindowStyle",
      "Hidden",
      "-Command",
      "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')",
    ], { windowsHide: true });
    return;
  }

  if (process.platform === "darwin") {
    await execFileAsync("osascript", ["-e", 'tell application "System Events" to keystroke "v" using command down']);
    return;
  }

  await execFileAsync("xdotool", ["key", "ctrl+v"]);
}
