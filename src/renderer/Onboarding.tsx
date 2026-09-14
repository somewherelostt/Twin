import type { FormEvent } from "react";
import type { AppStatus, CredentialInput, Toolkit, ToolkitConnection } from "../shared/contracts";

const appDetails: Record<Toolkit, { name: string; description: string; initials: string }> = {
  slack: { name: "Slack", description: "Send messages and follow up", initials: "SL" },
  jira: { name: "Jira", description: "Create and update issues", initials: "JI" },
  gmail: { name: "Gmail", description: "Draft and send email", initials: "GM" },
  github: { name: "GitHub", description: "Work with issues and pull requests", initials: "GH" },
};

type CredentialDraft = Required<CredentialInput>;

type OnboardingProps = {
  step: number;
  status: AppStatus | null;
  credentialInput: CredentialDraft;
  busy: boolean;
  error: string;
  connections: ToolkitConnection[];
  connecting: Toolkit | null;
  onStepChange(step: number): void;
  onCredentialChange(input: CredentialDraft): void;
  onSaveCredentials(event: FormEvent): void;
  onConnect(toolkit: Toolkit): void;
  onFinish(): void;
};

const steps = ["Welcome", "API keys", "Work apps"];

function SetupSidebar({ step, shortcut }: { step: number; shortcut?: string }) {
  return (
    <aside className="setup-sidebar">
      <div className="setup-brand">
        <img src="./twin-mark.svg" alt="" />
        <span>Twin</span>
      </div>

      <ol className="setup-steps" aria-label="Setup progress">
        {steps.map((label, index) => (
          <li key={label} className={index === step ? "current" : index < step ? "complete" : ""}>
            <span>{index < step ? "✓" : index + 1}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>

      <div className="setup-shortcut">
        <span>Open Twin anytime</span>
        <kbd>{(shortcut ?? "Alt+Space").replace("CommandOrControl", "Ctrl").replaceAll("+", " + ")}</kbd>
      </div>
    </aside>
  );
}

export function Onboarding({
  step,
  status,
  credentialInput,
  busy,
  error,
  connections,
  connecting,
  onStepChange,
  onCredentialChange,
  onSaveCredentials,
  onConnect,
  onFinish,
}: OnboardingProps) {
  const serviceReady = {
    assemblyAI: Boolean(status?.configured.assemblyAI || credentialInput.assemblyAI.trim()),
    openAI: Boolean(status?.configured.openAI || credentialInput.openAI.trim()),
    composio: Boolean(status?.configured.composio || credentialInput.composio.trim()),
  };
  const allServicesReady = Object.values(serviceReady).every(Boolean);

  return (
    <section className="onboarding-shell">
      <div className="onboarding-titlebar" aria-hidden="true" />
      <SetupSidebar step={step} shortcut={status?.shortcut} />

      <main className="setup-main">
        <div className="setup-page" key={step}>
          {step === 0 && (
            <>
              <p className="setup-kicker">GET STARTED</p>
              <h1>Set up Twin.</h1>
              <p className="setup-lead">Use your voice to write in any app or take action across your work tools.</p>

              <div className="setup-example">
                <span>TRY SAYING</span>
                <p>“Tell the team I pushed the login fix.”</p>
              </div>

              <ul className="setup-benefits">
                <li><i>01</i><span><strong>Dictate anywhere</strong><small>Turn speech into clean text in the app you are using.</small></span></li>
                <li><i>02</i><span><strong>Take action</strong><small>Draft messages, create issues, and handle routine work.</small></span></li>
                <li><i>03</i><span><strong>Stay in control</strong><small>Review actions before Twin runs them.</small></span></li>
              </ul>

              <div className="setup-actions end">
                <button type="button" className="setup-primary" onClick={() => onStepChange(1)}>Continue</button>
              </div>
            </>
          )}

          {step === 1 && (
            <form className="setup-form" onSubmit={onSaveCredentials}>
              <p className="setup-kicker">API KEYS</p>
              <h1>Connect the services.</h1>
              <p className="setup-lead">Add each key once. Twin encrypts and stores it on this computer.</p>

              <div className="credential-list">
                <label>
                  <span><strong>AssemblyAI</strong><small>Voice transcription</small></span>
                  <b className={serviceReady.assemblyAI ? "ready" : ""}>{serviceReady.assemblyAI ? "Ready" : "Required"}</b>
                  <input type="password" aria-label="AssemblyAI API key" placeholder={status?.configured.assemblyAI ? "Configured securely" : "Paste API key"} value={credentialInput.assemblyAI} onChange={(event) => onCredentialChange({ ...credentialInput, assemblyAI: event.target.value })} />
                </label>
                <label>
                  <span><strong>OpenAI</strong><small>Intent and action planning</small></span>
                  <b className={serviceReady.openAI ? "ready" : ""}>{serviceReady.openAI ? "Ready" : "Required"}</b>
                  <input type="password" aria-label="OpenAI API key" placeholder={status?.configured.openAI ? "Configured securely" : "Paste API key"} value={credentialInput.openAI} onChange={(event) => onCredentialChange({ ...credentialInput, openAI: event.target.value })} />
                </label>
                <label>
                  <span><strong>Composio</strong><small>Connections to your work apps</small></span>
                  <b className={serviceReady.composio ? "ready" : ""}>{serviceReady.composio ? "Ready" : "Required"}</b>
                  <input type="password" aria-label="Composio API key" placeholder={status?.configured.composio ? "Configured securely" : "Paste API key"} value={credentialInput.composio} onChange={(event) => onCredentialChange({ ...credentialInput, composio: event.target.value })} />
                </label>
              </div>

              {error && <div className="setup-error">{error}</div>}
              <div className="setup-actions">
                <button type="button" className="setup-secondary" onClick={() => onStepChange(0)}>Back</button>
                <button type="submit" className="setup-primary" disabled={busy || !allServicesReady}>{busy ? "Saving…" : "Save and continue"}</button>
              </div>
            </form>
          )}

          {step === 2 && (
            <>
              <p className="setup-kicker">WORK APPS</p>
              <h1>Connect your tools.</h1>
              <p className="setup-lead">This step is optional. You can connect or change apps later in Settings.</p>

              <div className="work-app-list">
                {connections.map((connection) => {
                  const detail = appDetails[connection.slug];
                  return (
                    <div className="work-app-row" key={connection.slug}>
                      <span className={`work-app-mark ${connection.slug}`}>{detail.initials}</span>
                      <span className="work-app-copy"><strong>{detail.name}</strong><small>{detail.description}</small></span>
                      <button type="button" disabled={connecting !== null || connection.connected} onClick={() => onConnect(connection.slug)}>
                        {connection.connected ? "Connected" : connecting === connection.slug ? "Opening…" : "Connect"}
                      </button>
                    </div>
                  );
                })}
              </div>

              {error && <div className="setup-error">{error}</div>}
              <div className="setup-actions">
                <button type="button" className="setup-secondary" onClick={() => onStepChange(1)}>Back</button>
                <button type="button" className="setup-primary" disabled={busy} onClick={onFinish}>{busy ? "Finishing…" : "Finish setup"}</button>
              </div>
            </>
          )}
        </div>
      </main>
    </section>
  );
}
