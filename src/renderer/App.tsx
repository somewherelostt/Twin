import { useEffect, useMemo, useState } from "react";
import { ArrowRight, AudioLines, Check, CheckCircle2, Command, Copy, KeyRound, LoaderCircle, Plug, RefreshCw, Settings2, X } from "lucide-react";
import { TOOLKITS, type ActionPlan, type ActionResult, type AppStatus, type DictationResult, type Toolkit, type ToolkitConnection, type TwinMode } from "../shared/contracts";
import { useAudioRecorder } from "./useAudioRecorder";

const toolkitNames: Record<Toolkit, string> = { slack: "Slack", jira: "Jira", gmail: "Gmail", github: "GitHub" };

function friendlyError(cause: unknown, fallback: string) {
  if (!(cause instanceof Error)) return fallback;
  return cause.message.replace(/^Error invoking remote method '[^']+': Error: /, "");
}

export function App() {
  const [mode, setMode] = useState<TwinMode>("dictate");
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [result, setResult] = useState<DictationResult | null>(null);
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [connections, setConnections] = useState<ToolkitConnection[]>(TOOLKITS.map((slug) => ({ slug, connected: false })));
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState<Toolkit | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [credentialInput, setCredentialInput] = useState({ assemblyAI: "", openAI: "", composio: "" });
  const recorder = useAudioRecorder();

  useEffect(() => {
    void window.twin.getStatus().then(setStatus);
    return window.twin.onActivated(() => {
      setResult(null);
      setPlan(null);
      setActionResult(null);
      setError("");
    });
  }, []);

  const canRecord = useMemo(
    () => Boolean(status?.configured.assemblyAI && (mode === "dictate" || status.configured.openAI)),
    [mode, status],
  );

  async function refreshConnections() {
    if (!status?.configured.composio) return;
    try {
      setConnections(await window.twin.getConnections());
    } catch (cause) {
      setError(friendlyError(cause, "Could not load connected apps"));
    }
  }

  function chooseMode(next: TwinMode) {
    setMode(next);
    setResult(null);
    setPlan(null);
    setActionResult(null);
    setError("");
    void window.twin.setMode(next);
    if (next === "act") void refreshConnections();
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
      const transcript = await window.twin.transcribe({ audio, languageCodes: ["en"] });
      if (mode === "dictate") setResult(transcript);
      else setPlan(await window.twin.prepareAction(transcript.cleanText));
    } catch (cause) {
      setError(friendlyError(cause, mode === "dictate" ? "Dictation failed" : "Could not prepare the action"));
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

  async function connect(toolkit: Toolkit) {
    setError("");
    setConnecting(toolkit);
    try {
      await window.twin.connect(toolkit);
    } catch (cause) {
      setError(friendlyError(cause, `Could not connect ${toolkitNames[toolkit]}`));
    } finally {
      setConnecting(null);
    }
  }

  async function runAction() {
    if (!plan) return;
    setBusy(true);
    setError("");
    try {
      setActionResult(await window.twin.executeAction(plan.id));
    } catch (cause) {
      setError(friendlyError(cause, "The action could not be completed"));
    } finally {
      setBusy(false);
    }
  }

  function resetAction() {
    setPlan(null);
    setActionResult(null);
    setError("");
  }

  function recordLabel() {
    if (busy) return mode === "dictate" ? "Cleaning your words…" : "Preparing your action…";
    if (recorder.recording) return "Stop and continue";
    if (!status?.configured.assemblyAI) return "Add AssemblyAI key to begin";
    if (mode === "act" && !status?.configured.openAI) return "Add OpenAI key to use actions";
    return mode === "dictate" ? "Start dictating" : "Speak an action";
  }

  async function saveCredentials(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setStatus(await window.twin.saveCredentials(credentialInput));
      setCredentialInput({ assemblyAI: "", openAI: "", composio: "" });
      setShowSettings(false);
    } catch (cause) {
      setError(friendlyError(cause, "Could not save credentials"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="titlebar">
        <div className="brand-mark">T</div><span className="brand">Twin</span>
        <span className="shortcut">{status?.shortcut ?? "Alt+Space"}</span>
        <button className="icon-button" aria-label="Settings" onClick={() => setShowSettings(true)}><Settings2 size={16} /></button>
        <button className="icon-button" aria-label="Close" onClick={() => window.twin.hide()}><X size={17} /></button>
      </header>

      {showSettings && <div className="settings-backdrop">
        <form className="settings-panel" onSubmit={saveCredentials}>
          <div className="settings-head"><div className="action-icon"><KeyRound size={18} /></div><div><span className="eyebrow">LOCAL SETUP</span><h2>Connect Twin</h2></div><button type="button" className="icon-button" onClick={() => setShowSettings(false)}><X size={16} /></button></div>
          <p>Credentials are encrypted by your operating system and stay on this computer.</p>
          <label>AssemblyAI <span className={status?.configured.assemblyAI ? "ready" : ""}>{status?.configured.assemblyAI ? "Ready" : "Required"}</span><input type="password" placeholder={status?.configured.assemblyAI ? "Replace existing key" : "Paste API key"} value={credentialInput.assemblyAI} onChange={(event) => setCredentialInput({ ...credentialInput, assemblyAI: event.target.value })} /></label>
          <label>OpenAI <span className={status?.configured.openAI ? "ready" : ""}>{status?.configured.openAI ? "Ready" : "For actions"}</span><input type="password" placeholder={status?.configured.openAI ? "Replace existing key" : "Paste API key"} value={credentialInput.openAI} onChange={(event) => setCredentialInput({ ...credentialInput, openAI: event.target.value })} /></label>
          <label>Composio <span className={status?.configured.composio ? "ready" : ""}>{status?.configured.composio ? "Ready" : "For connected apps"}</span><input type="password" placeholder={status?.configured.composio ? "Replace existing key" : "Paste API key"} value={credentialInput.composio} onChange={(event) => setCredentialInput({ ...credentialInput, composio: event.target.value })} /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary save-button" disabled={busy || !Object.values(credentialInput).some(Boolean)}>{busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Save securely</button>
        </form>
      </div>}

      <section className="workspace">
        <div className="toolbar">
          <nav className="mode-switch" aria-label="Twin mode">
            <button className={mode === "dictate" ? "active" : ""} onClick={() => chooseMode("dictate")}><AudioLines size={16} /> Dictate</button>
            <button className={mode === "act" ? "active" : ""} onClick={() => chooseMode("act")}><Command size={16} /> Act</button>
          </nav>
          {mode === "act" && status?.configured.composio && <button className="refresh-button" onClick={refreshConnections}><RefreshCw size={13} /> Refresh apps</button>}
        </div>

        {mode === "dictate" && result ? (
          <div className="result-panel">
            <span className="eyebrow">CLEAN DICTATION · {result.durationMs}MS</span>
            <textarea value={result.cleanText} onChange={(event) => setResult({ ...result, cleanText: event.target.value })} autoFocus />
            <details><summary>Original transcript</summary><p>{result.transcript}</p></details>
            <div className="result-actions">
              <button className="secondary" onClick={copyText}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}</button>
              <button className="primary" onClick={() => window.twin.paste(result.cleanText)}>Paste into app</button>
            </div>
          </div>
        ) : mode === "act" && actionResult ? (
          <div className="action-card success-card">
            <div className="action-icon success"><CheckCircle2 size={20} /></div>
            <span className="eyebrow">ACTION COMPLETE</span><h2>{plan?.title}</h2><p>{actionResult.summary}</p>
            <button className="secondary new-action" onClick={resetAction}>Start another action</button>
          </div>
        ) : mode === "act" && plan ? (
          <div className="action-card">
            <div className="action-card-head"><div className="action-icon">{plan.toolkits.length}</div><div><span className="eyebrow">REVIEW · {plan.toolkits.map((toolkit) => toolkitNames[toolkit]).join(" + ")}</span><h2>{plan.title}</h2></div></div>
            <p>{plan.description}</p>
            <div className="effect"><span>Will happen</span>{plan.confirmation}</div>
            {error && <p className="error">{error}</p>}
            <div className="result-actions">
              <button className="secondary" onClick={resetAction}>Cancel</button>
              <button className="primary" disabled={busy || !status?.configured.composio} onClick={runAction}>{busy ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={15} />}{busy ? "Running…" : status?.configured.composio ? "Run action" : "Add Composio key"}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="prompt">
              <span className="eyebrow">{recorder.recording ? "LISTENING" : mode === "dictate" ? "READY TO WRITE" : "READY TO ACT"}</span>
              <h1>{recorder.recording ? "Keep talking." : mode === "dictate" ? "Say what you mean." : "What should Twin handle?"}</h1>
              <p>{mode === "dictate" ? "Your speech becomes clean text in the app you were using." : "Speak an action, review the exact effect, then run it across your work apps."}</p>
              {recorder.recording && <div className="meter" aria-label="Microphone level"><span style={{ width: `${Math.max(8, recorder.level * 100)}%` }} /></div>}
              {error && <p className="error">{error}</p>}
            </div>

            {mode === "act" && !recorder.recording && <div className="connections" aria-label="Connected apps">
              {connections.map((connection) => <button key={connection.slug} className={connection.connected ? "connected" : ""} disabled={!status?.configured.composio || connecting !== null} onClick={() => connect(connection.slug)}>
                <span className={`app-glyph ${connection.slug}`}>{toolkitNames[connection.slug][0]}</span>
                <span>{toolkitNames[connection.slug]}<small>{connection.connected ? "Connected" : "Connect"}</small></span>
                {connection.connected ? <Check size={14} /> : connecting === connection.slug ? <LoaderCircle className="spin" size={14} /> : <Plug size={14} />}
              </button>)}
            </div>}

            <button className={`talk-button ${recorder.recording ? "recording" : ""}`} disabled={busy || !canRecord} onClick={toggleRecording}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <span className="pulse" />}{recordLabel()}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
