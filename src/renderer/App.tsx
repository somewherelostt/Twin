import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  AlertCircle,
  AudioLines,
  Check,
  CheckCircle2,
  ChevronDown,
  Command,
  Copy,
  GripHorizontal,
  KeyRound,
  LoaderCircle,
  Mic,
  Plug,
  RotateCcw,
  Send,
  Settings2,
  X,
} from "lucide-react";
import {
  TOOLKITS,
  type ActionPlan,
  type ActionResult,
  type AppStatus,
  type DictationResult,
  type Toolkit,
  type ToolkitConnection,
  type TwinMode,
} from "../shared/contracts";
import { useAudioRecorder } from "./useAudioRecorder";

const toolkitNames: Record<Toolkit, string> = {
  slack: "Slack",
  jira: "Jira",
  gmail: "Gmail",
  github: "GitHub",
};

function friendlyError(cause: unknown, fallback: string) {
  if (!(cause instanceof Error)) return fallback;
  return cause.message.replace(/^Error invoking remote method '[^']+': Error: /, "");
}

export function App() {
  const [mode, setMode] = useState<TwinMode>("act");
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<DictationResult | null>(null);
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [connections, setConnections] = useState<ToolkitConnection[]>(
    TOOLKITS.map((slug) => ({ slug, connected: false })),
  );
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState<Toolkit | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showModes, setShowModes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [executionMessage, setExecutionMessage] = useState("");
  const [credentialInput, setCredentialInput] = useState({ assemblyAI: "", openAI: "", composio: "" });
  const inputRef = useRef<HTMLInputElement>(null);
  const recorder = useAudioRecorder();

  function updateMousePassthrough(target: EventTarget | null) {
    const element = target instanceof Element ? target : null;
    const interactive = Boolean(element?.closest(".float-stack, .settings-panel"));
    void window.twin.setMousePassthrough(!interactive);
  }

  useEffect(() => {
    void window.twin.getStatus().then(setStatus);
    const stopActivated = window.twin.onActivated(() => {
      setError("");
      setTimeout(() => inputRef.current?.focus(), 80);
    });
    const stopProgress = window.twin.onActionProgress((progress) => {
      setExecutionMessage(progress.message);
    });
    const stopConnections = window.twin.onConnectionsChanged(() => {
      void refreshConnections();
    });
    return () => {
      stopActivated();
      stopProgress();
      stopConnections();
    };
  }, []);

  const canRecord = useMemo(
    () => Boolean(status?.configured.assemblyAI && (mode === "dictate" || status.configured.openAI)),
    [mode, status],
  );
  const hasContent = Boolean(result || plan || actionResult || recorder.recording || busy || error);

  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const elements = Array.from(document.querySelectorAll<HTMLElement>(".float-stack, .settings-panel, .drag-handle, .mode-popover"));
        const rects = elements.filter((element) => element.offsetParent !== null).map((element) => element.getBoundingClientRect());
        if (rects.length === 0) return;
        const top = Math.min(...rects.map((rect) => rect.top));
        const bottom = Math.max(...rects.map((rect) => rect.bottom));
        const panel = document.querySelector<HTMLElement>(".settings-panel");
        const measuredHeight = bottom - top + 2;
        const settingsHeight = panel ? panel.scrollHeight + 69 : 0;
        void window.twin.setOverlayHeight(Math.ceil(Math.max(measuredHeight, settingsHeight)));
      });
    };
    const observer = new ResizeObserver(measure);
    document.querySelectorAll<HTMLElement>(".float-stack, .settings-panel, .mode-popover").forEach((element) => observer.observe(element));
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [hasContent, showModes, showSettings]);

  async function refreshConnections(force = false) {
    if (!force && !status?.configured.composio) return;
    try {
      setConnections(await window.twin.getConnections());
    } catch (cause) {
      setError(friendlyError(cause, "Could not load connected apps"));
    }
  }

  function chooseMode(next: TwinMode) {
    setMode(next);
    setShowModes(false);
    resetOutput();
    void window.twin.setMode(next);
  }

  function resetOutput() {
    setResult(null);
    setPlan(null);
    setActionResult(null);
    setExecutionMessage("");
    setError("");
  }

  async function prepareCommand(command: string) {
    setBusy(true);
    setExecutionMessage("Preparing your action…");
    setError("");
    setPlan(null);
    setActionResult(null);
    try {
      setPlan(await window.twin.prepareAction(command));
      setDraft("");
    } catch (cause) {
      setError(friendlyError(cause, "Could not prepare the action"));
    } finally {
      setBusy(false);
    }
  }

  async function submitDraft(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    if (mode === "act") {
      if (!status?.configured.openAI) {
        setShowSettings(true);
        return;
      }
      await prepareCommand(draft.trim());
    } else {
      setResult({ transcript: draft.trim(), cleanText: draft.trim(), durationMs: 0 });
      setDraft("");
    }
  }

  async function toggleRecording() {
    setError("");
    if (!recorder.recording) {
      if (!canRecord) {
        setShowSettings(true);
        return;
      }
      resetOutput();
      try {
        await recorder.start();
      } catch {
        setError("Microphone access is required to use Twin.");
      }
      return;
    }

    setBusy(true);
    setExecutionMessage("Starting the workflow…");
    try {
      const audio = await recorder.stop();
      const transcript = await window.twin.transcribe({ audio, languageCodes: ["en"] });
      if (mode === "dictate") setResult(transcript);
      else {
        setDraft(transcript.cleanText);
        setPlan(await window.twin.prepareAction(transcript.cleanText));
        setDraft("");
      }
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
    if (!status?.configured.composio) {
      setShowSettings(true);
      return;
    }
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

  async function saveCredentials(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const nextStatus = await window.twin.saveCredentials(credentialInput);
      setStatus(nextStatus);
      setCredentialInput({ assemblyAI: "", openAI: "", composio: "" });
      setShowSettings(false);
      if (nextStatus.configured.composio) void refreshConnections(true);
    } catch (cause) {
      setError(friendlyError(cause, "Could not save credentials"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className={`stage ${hasContent ? "expanded" : "compact"}`}
      onMouseMove={(event) => updateMousePassthrough(event.target)}
    >
      <section className="float-stack">
        {showModes && (
          <div className="mode-popover surface-enter">
            <button className={mode === "act" ? "active" : ""} onClick={() => chooseMode("act")}>
              <Command size={15} /><span><strong>Act</strong><small>Work across connected apps</small></span>{mode === "act" && <Check size={14} />}
            </button>
            <button className={mode === "dictate" ? "active" : ""} onClick={() => chooseMode("dictate")}>
              <AudioLines size={15} /><span><strong>Dictate</strong><small>Write clean text anywhere</small></span>{mode === "dictate" && <Check size={14} />}
            </button>
          </div>
        )}

        {hasContent && (
          <div className={`content-surface surface-enter ${busy && plan ? "executing" : ""}`}>
            {recorder.recording ? (
              <div className="listening-state">
                <div className="wave" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ animationDelay: `${index * 45}ms`, height: `${8 + ((index * 7) % 22)}px` }} />)}</div>
                <div><span className="kicker">LISTENING</span><p>Say it naturally. Twin will clean it up.</p></div>
              </div>
            ) : busy && !plan ? (
              <div className="thinking-state"><LoaderCircle className="spin" size={17} /><span>Understanding your request…</span></div>
            ) : mode === "dictate" && result ? (
              <div className="dictation-card">
                <div className="surface-head"><span className="kicker">CLEAN DICTATION</span><button onClick={resetOutput}><X size={15} /></button></div>
                <textarea value={result.cleanText} onChange={(event) => setResult({ ...result, cleanText: event.target.value })} autoFocus />
                <div className="surface-actions">
                  <button className="quiet-action" onClick={copyText}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button>
                  <button className="confirm-action" onClick={() => window.twin.paste(result.cleanText)}>Paste into app <ArrowRight size={14} /></button>
                </div>
              </div>
            ) : actionResult ? (
              <div className={`complete-card ${actionResult.status === "needs_attention" ? "attention" : ""}`}>
                <div className="complete-icon">{actionResult.status === "completed" ? <Check size={18} /> : <AlertCircle size={18} />}</div>
                <div><span className="kicker">{actionResult.status === "completed" ? "DONE" : "NEEDS ATTENTION"}</span><h2>{plan?.title}</h2><p>{actionResult.summary}</p>{actionResult.steps.length > 0 && <small>{actionResult.steps.length} app {actionResult.steps.length === 1 ? "step" : "steps"} attempted</small>}</div>
                <button className="icon-action" onClick={resetOutput} aria-label="Start another action"><RotateCcw size={15} /></button>
              </div>
            ) : plan ? (
              <div className="plan-card">
                <div className="plan-intent">{plan.command}</div>
                <div className="app-chips">{plan.toolkits.map((toolkit) => <span key={toolkit}><i className={toolkit}>{toolkitNames[toolkit][0]}</i>{toolkitNames[toolkit]}</span>)}</div>
                <h2>{plan.title}</h2>
                <p>{plan.description}</p>
                <div className="operation-row"><span>Action</span><strong>{plan.operation}</strong></div>
                {!plan.ready && <div className="missing-details"><AlertCircle size={14} /><span><strong>More detail needed</strong>{plan.missingDetails.join(" · ")}</span></div>}
                {busy && <div className="execution-status"><LoaderCircle className="spin" size={13} />{executionMessage || "Running the workflow…"}</div>}
                {error && <div className="plan-error">{error}</div>}
                <div className="surface-actions">
                  <button className="quiet-action" onClick={resetOutput}>Cancel</button>
                  <button className="confirm-action" disabled={busy || !plan.ready} onClick={runAction}>{busy ? <><LoaderCircle className="spin" size={14} /> Running…</> : plan.ready ? <>Run action <ArrowRight size={14} /></> : <>Add details</>}</button>
                </div>
              </div>
            ) : error ? (
              <div className="error-card"><span>{error}</span><button onClick={() => setError("")}><X size={14} /></button></div>
            ) : null}
          </div>
        )}

        <form className={`composer ${recorder.recording ? "recording" : ""}`} onSubmit={submitDraft}>
          <div
            className="drag-handle"
            title="Drag Twin"
            aria-label="Drag Twin"
          ><GripHorizontal size={18} /></div>
          <div className="twin-orb" title="Drag Twin">
            <img src="./twin-mark.svg" alt="Twin" />
            <button type="button" className="mode-toggle" onClick={() => setShowModes(!showModes)} aria-label="Choose mode"><ChevronDown size={10} /></button>
          </div>
          <span className="mode-label">{mode === "act" ? "Act" : "Dictate"}</span>
          <input ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={recorder.recording ? "Listening…" : mode === "act" ? "Tell Twin what to do" : "Speak or type anywhere"} disabled={recorder.recording || busy} />
          {draft.trim() && !recorder.recording ? <button className="send-button" aria-label="Send"><Send size={15} /></button> : <button type="button" className="mic-button" onClick={toggleRecording} aria-label={recorder.recording ? "Stop recording" : "Start recording"}><Mic size={18} /></button>}
          <button type="button" className="settings-button" onClick={() => { setShowModes(false); setShowSettings(true); void refreshConnections(); }} aria-label="Settings"><Settings2 size={15} /></button>
        </form>
      </section>

      {showSettings && (
        <div className="settings-backdrop surface-enter">
          <form className="settings-panel" onSubmit={saveCredentials}>
            <div className="settings-head"><div className="key-icon"><KeyRound size={17} /></div><div><span className="kicker">LOCAL SETUP</span><h2>Connect Twin</h2></div><button type="button" className="icon-action" onClick={() => setShowSettings(false)}><X size={16} /></button></div>
            <p>Credentials are encrypted by your operating system and stay on this computer.</p>
            <div className="key-grid">
              <label>AssemblyAI <span className={status?.configured.assemblyAI ? "ready" : ""}>{status?.configured.assemblyAI ? "Ready" : "Required"}</span><input type="password" placeholder={status?.configured.assemblyAI ? "Replace existing key" : "Paste API key"} value={credentialInput.assemblyAI} onChange={(event) => setCredentialInput({ ...credentialInput, assemblyAI: event.target.value })} /></label>
              <label>OpenAI <span className={status?.configured.openAI ? "ready" : ""}>{status?.configured.openAI ? "Ready" : "For actions"}</span><input type="password" placeholder={status?.configured.openAI ? "Replace existing key" : "Paste API key"} value={credentialInput.openAI} onChange={(event) => setCredentialInput({ ...credentialInput, openAI: event.target.value })} /></label>
              <label>Composio <span className={status?.configured.composio ? "ready" : ""}>{status?.configured.composio ? "Ready" : "For apps"}</span><input type="password" placeholder={status?.configured.composio ? "Replace existing key" : "Paste API key"} value={credentialInput.composio} onChange={(event) => setCredentialInput({ ...credentialInput, composio: event.target.value })} /></label>
            </div>
            <button className="save-button" disabled={busy || !Object.values(credentialInput).some(Boolean)}>{busy ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />} Save securely</button>
            <div className="integration-head"><span>WORK APPS</span><button type="button" onClick={() => void refreshConnections()}>Refresh</button></div>
            <div className="connections">{connections.map((connection) => <button type="button" key={connection.slug} className={connection.connected ? "connected" : ""} disabled={!status?.configured.composio || connecting !== null || connection.connected} onClick={() => connect(connection.slug)}><i className={connection.slug}>{toolkitNames[connection.slug][0]}</i><span>{toolkitNames[connection.slug]}<small>{connection.connected ? "Connected" : "Connect"}</small></span>{connection.connected ? <CheckCircle2 size={14} /> : connecting === connection.slug ? <LoaderCircle className="spin" size={14} /> : <Plug size={14} />}</button>)}</div>
            {error && <div className="settings-error">{error}</div>}
          </form>
        </div>
      )}
    </main>
  );
}
