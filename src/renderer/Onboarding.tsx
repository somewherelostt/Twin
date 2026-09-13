import type { FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  GitPullRequest,
  GripHorizontal,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MessageSquare,
  Plug,
  Sparkles,
  TicketCheck,
  WandSparkles,
} from "lucide-react";
import type {
  AppStatus,
  CredentialInput,
  Toolkit,
  ToolkitConnection,
} from "../shared/contracts";

const appDetails: Record<Toolkit, { name: string; description: string; icon: typeof GitPullRequest }> = {
  slack: { name: "Slack", description: "Send messages and follow up", icon: MessageSquare },
  jira: { name: "Jira", description: "Create and update issues", icon: TicketCheck },
  gmail: { name: "Gmail", description: "Draft and send email", icon: Mail },
  github: { name: "GitHub", description: "Work with issues and pull requests", icon: GitPullRequest },
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

function StepProgress({ step }: { step: number }) {
  const labels = ["Welcome", "Services", "Work apps"];
  return (
    <nav className="onboarding-progress" aria-label="Setup progress">
      <span className="progress-count">0{step + 1}<i>/03</i></span>
      <div className="progress-track" aria-hidden="true">
        {labels.map((label, index) => <i key={label} className={index <= step ? "active" : ""} />)}
      </div>
      <span className="progress-label">{labels[step]}</span>
    </nav>
  );
}

function OnboardingAside({ step }: { step: number }) {
  return (
    <aside className="onboarding-aside">
      <div className="onboarding-brand"><img src="./twin-mark.svg" alt="Twin" /><span>Twin</span></div>
      <div className="signal-scene" aria-hidden="true">
        <div className="signal-orbit orbit-one" />
        <div className="signal-orbit orbit-two" />
        <div className="signal-core"><WandSparkles size={24} /></div>
        <div className="signal-wave">{Array.from({ length: 13 }, (_, index) => <i key={index} style={{ animationDelay: `${index * 70}ms` }} />)}</div>
      </div>
      <div className="aside-copy">
        <span className="eyebrow">VOICE TO ACTION</span>
        <h2>{step === 0 ? "Speak once.\nKeep moving." : step === 1 ? "Your keys stay\non this device." : "One voice.\nFour workspaces."}</h2>
        <p>{step === 0 ? "Twin turns natural speech into polished writing and real work across your apps." : step === 1 ? "Credentials are encrypted with your operating system before they are stored." : "Choose where Twin can act. You remain in control before anything is sent."}</p>
      </div>
      <div className="privacy-note"><LockKeyhole size={13} /><span>Encrypted locally</span></div>
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
    assemblyAI: Boolean(status?.configured.assemblyAI || credentialInput.assemblyAI?.trim()),
    openAI: Boolean(status?.configured.openAI || credentialInput.openAI?.trim()),
    composio: Boolean(status?.configured.composio || credentialInput.composio?.trim()),
  };
  const allServicesReady = Object.values(serviceReady).every(Boolean);
  const connectedCount = connections.filter((connection) => connection.connected).length;

  return (
    <section className="onboarding-shell">
      <div className="onboarding-dragbar" title="Drag Twin" aria-label="Drag Twin"><GripHorizontal size={16} /></div>
      <OnboardingAside step={step} />
      <main className="onboarding-main">
        <StepProgress step={step} />

        {step === 0 && (
          <div className="onboarding-content welcome-content onboarding-enter">
            <span className="eyebrow">SET UP IN TWO MINUTES</span>
            <h1>Meet the fastest way to work with your voice.</h1>
            <p className="lead">Dictate clean text anywhere, or ask Twin to handle work across the apps you already use.</p>
            <div className="command-preview">
              <div className="preview-orb"><img src="./twin-mark.svg" alt="" /></div>
              <div><span>Try saying</span><strong>“Tell the team I pushed the login fix.”</strong></div>
              <div className="preview-bars">{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div>
            </div>
            <div className="value-row">
              <span><Check size={13} /> Clean dictation</span>
              <span><Check size={13} /> App actions</span>
              <span><Check size={13} /> Your approval first</span>
            </div>
            <button type="button" className="onboarding-primary" onClick={() => onStepChange(1)}>Start setup <ArrowRight size={16} /></button>
          </div>
        )}

        {step === 1 && (
          <form className="onboarding-content onboarding-enter" onSubmit={onSaveCredentials}>
            <span className="eyebrow">CORE SERVICES</span>
            <h1>Connect the engine.</h1>
            <p className="lead compact-lead">Add each key once. Twin encrypts and remembers them on this computer.</p>
            <div className="service-list">
              <label className={serviceReady.assemblyAI ? "service-card ready" : "service-card"}>
                <span className="service-icon assembly"><Sparkles size={17} /></span>
                <span className="service-copy"><strong>AssemblyAI</strong><small>Voice transcription</small></span>
                <span className="service-status">{serviceReady.assemblyAI ? <><CheckCircle2 size={13} /> Ready</> : "Required"}</span>
                <input type="password" aria-label="AssemblyAI API key" placeholder={status?.configured.assemblyAI ? "Configured securely" : "Paste API key"} value={credentialInput.assemblyAI ?? ""} onChange={(event) => onCredentialChange({ ...credentialInput, assemblyAI: event.target.value })} />
              </label>
              <label className={serviceReady.openAI ? "service-card ready" : "service-card"}>
                <span className="service-icon openai"><WandSparkles size={17} /></span>
                <span className="service-copy"><strong>OpenAI</strong><small>Intent and action planning</small></span>
                <span className="service-status">{serviceReady.openAI ? <><CheckCircle2 size={13} /> Ready</> : "Required"}</span>
                <input type="password" aria-label="OpenAI API key" placeholder={status?.configured.openAI ? "Configured securely" : "Paste API key"} value={credentialInput.openAI ?? ""} onChange={(event) => onCredentialChange({ ...credentialInput, openAI: event.target.value })} />
              </label>
              <label className={serviceReady.composio ? "service-card ready" : "service-card"}>
                <span className="service-icon composio"><Plug size={17} /></span>
                <span className="service-copy"><strong>Composio</strong><small>Secure app connections</small></span>
                <span className="service-status">{serviceReady.composio ? <><CheckCircle2 size={13} /> Ready</> : "Required"}</span>
                <input type="password" aria-label="Composio API key" placeholder={status?.configured.composio ? "Configured securely" : "Paste API key"} value={credentialInput.composio ?? ""} onChange={(event) => onCredentialChange({ ...credentialInput, composio: event.target.value })} />
              </label>
            </div>
            {error && <div className="onboarding-error">{error}</div>}
            <div className="onboarding-footer">
              <button type="button" className="onboarding-back" onClick={() => onStepChange(0)}><ArrowLeft size={15} /> Back</button>
              <button className="onboarding-primary" disabled={busy || !allServicesReady}>{busy ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />} Save and continue</button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="onboarding-content onboarding-enter">
            <span className="eyebrow">WORK APPS</span>
            <h1>Choose where Twin works.</h1>
            <p className="lead compact-lead">Connect now or return from Settings later. Twin always shows the action before it runs.</p>
            <div className="app-connect-grid">
              {connections.map((connection) => {
                const detail = appDetails[connection.slug];
                const Icon = detail.icon;
                return (
                  <button type="button" key={connection.slug} className={connection.connected ? "app-connect-card connected" : "app-connect-card"} disabled={connecting !== null || connection.connected} onClick={() => onConnect(connection.slug)}>
                    <span className={`app-connect-icon ${connection.slug}`}><Icon size={19} /></span>
                    <span><strong>{detail.name}</strong><small>{connection.connected ? "Connected and ready" : detail.description}</small></span>
                    <span className="connect-action">{connection.connected ? <CheckCircle2 size={17} /> : connecting === connection.slug ? <LoaderCircle className="spin" size={16} /> : "Connect"}</span>
                  </button>
                );
              })}
            </div>
            <div className="connection-summary"><span>{connectedCount} of 4 connected</span><i><b style={{ width: `${connectedCount * 25}%` }} /></i></div>
            {error && <div className="onboarding-error">{error}</div>}
            <div className="onboarding-footer">
              <button type="button" className="onboarding-back" onClick={() => onStepChange(1)}><ArrowLeft size={15} /> Back</button>
              <button type="button" className="onboarding-primary" disabled={busy} onClick={onFinish}>{busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Finish setup</button>
            </div>
          </div>
        )}
      </main>
    </section>
  );
}
