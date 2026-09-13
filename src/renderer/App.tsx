import { useEffect, useState } from "react";
import { AudioLines, Check, Command, Copy, LoaderCircle, Settings2, X } from "lucide-react";
import type { AppStatus, DictationResult, TwinMode } from "../shared/contracts";
import { useAudioRecorder } from "./useAudioRecorder";

export function App() {
  const [mode, setMode] = useState<TwinMode>("dictate");
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [result, setResult] = useState<DictationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const recorder = useAudioRecorder();

  useEffect(() => {
    void window.twin.getStatus().then(setStatus);
    return window.twin.onActivated(() => {
      setResult(null);
      setError("");
    });
  }, []);

  function chooseMode(next: TwinMode) {
    setMode(next);
    setResult(null);
    void window.twin.setMode(next);
  }

  async function toggleRecording() {
    setError("");
    if (!recorder.recording) {
      try {
        await recorder.start();
      } catch {
        setError("Microphone access is required to use Twin.");
      }
      return;
    }

    setBusy(true);
    try {
      const audio = await recorder.stop();
      const next = await window.twin.transcribe({ audio, languageCodes: ["en"] });
      setResult(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dictation failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyText() {
    if (!result) return;
    await navigator.clipboard.writeText(result.cleanText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const configured = status?.configured.assemblyAI;

  return (
    <main className="shell">
      <header className="titlebar">
        <div className="brand-mark">T</div>
        <span className="brand">Twin</span>
        <span className="shortcut">{status?.shortcut ?? "Alt+Space"}</span>
        <button className="icon-button" aria-label="Settings"><Settings2 size={16} /></button>
        <button className="icon-button" aria-label="Close" onClick={() => window.twin.hide()}><X size={17} /></button>
      </header>

      <section className="workspace">
        <nav className="mode-switch" aria-label="Twin mode">
          <button className={mode === "dictate" ? "active" : ""} onClick={() => chooseMode("dictate")}><AudioLines size={16} /> Dictate</button>
          <button className={mode === "act" ? "active" : ""} onClick={() => chooseMode("act")}><Command size={16} /> Act</button>
        </nav>

        {result ? (
          <div className="result-panel">
            <span className="eyebrow">CLEAN DICTATION · {result.durationMs}MS</span>
            <textarea value={result.cleanText} onChange={(event) => setResult({ ...result, cleanText: event.target.value })} autoFocus />
            <details><summary>Original transcript</summary><p>{result.transcript}</p></details>
            <div className="result-actions">
              <button className="secondary" onClick={copyText}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}</button>
              <button className="primary" onClick={() => window.twin.paste(result.cleanText)}>Paste into app</button>
            </div>
          </div>
        ) : (
          <>
            <div className="prompt">
              <span className="eyebrow">{recorder.recording ? "LISTENING" : mode === "dictate" ? "READY TO WRITE" : "READY TO ACT"}</span>
              <h1>{recorder.recording ? "Keep talking." : mode === "dictate" ? "Say what you mean." : "What should Twin handle?"}</h1>
              <p>{mode === "dictate" ? "Your speech becomes clean text in the app you were using." : "Speak an action across Slack, Jira, Gmail, or GitHub."}</p>
              {recorder.recording && <div className="meter" aria-label="Microphone level"><span style={{ width: `${Math.max(8, recorder.level * 100)}%` }} /></div>}
              {error && <p className="error">{error}</p>}
            </div>

            <button className={`talk-button ${recorder.recording ? "recording" : ""}`} disabled={busy || !configured || mode === "act"} onClick={toggleRecording}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <span className="pulse" />}
              {busy ? "Cleaning your words…" : recorder.recording ? "Stop and transcribe" : configured ? "Start dictating" : "Add AssemblyAI key to begin"}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
