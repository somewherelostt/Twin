import { useEffect, useState } from "react";
import { AudioLines, Command, Settings2, X } from "lucide-react";
import type { AppStatus, TwinMode } from "../shared/contracts";

export function App() {
  const [mode, setMode] = useState<TwinMode>("dictate");
  const [status, setStatus] = useState<AppStatus | null>(null);

  useEffect(() => {
    void window.twin.getStatus().then(setStatus);
  }, []);

  function chooseMode(next: TwinMode) {
    setMode(next);
    void window.twin.setMode(next);
  }

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
          <button className={mode === "dictate" ? "active" : ""} onClick={() => chooseMode("dictate")}>
            <AudioLines size={16} /> Dictate
          </button>
          <button className={mode === "act" ? "active" : ""} onClick={() => chooseMode("act")}>
            <Command size={16} /> Act
          </button>
        </nav>

        <div className="prompt">
          <span className="eyebrow">{mode === "dictate" ? "READY TO WRITE" : "READY TO ACT"}</span>
          <h1>{mode === "dictate" ? "Say what you mean." : "What should Twin handle?"}</h1>
          <p>{mode === "dictate" ? "Your speech will become clean text in the app you were using." : "Speak an action across Slack, Jira, Gmail, or GitHub."}</p>
        </div>

        <button className="talk-button" disabled>
          <span className="pulse" />
          Add keys to begin
        </button>
      </section>
    </main>
  );
}
