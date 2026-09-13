export const TOOLKITS = ["slack", "jira", "gmail", "github"] as const;

export type Toolkit = (typeof TOOLKITS)[number];
export type TwinMode = "dictate" | "act";

export interface AppStatus {
  configured: {
    assemblyAI: boolean;
    openAI: boolean;
    composio: boolean;
  };
  shortcut: string;
}

export interface CredentialInput {
  assemblyAI?: string;
  openAI?: string;
  composio?: string;
}

export interface ToolkitConnection {
  slug: Toolkit;
  connected: boolean;
  accountId?: string;
}

export interface DictationRequest {
  audio: Uint8Array;
  languageCodes: string[];
  keyterms?: string[];
}

export interface DictationResult {
  transcript: string;
  cleanText: string;
  durationMs: number;
}

export interface ActionPlan {
  id: string;
  command: string;
  title: string;
  description: string;
  toolkits: Toolkit[];
  operation: string;
  confirmation: string;
  ready: boolean;
  missingDetails: string[];
}

export interface ActionStep {
  label: string;
  toolkit?: Toolkit;
}

export interface ActionResult {
  planId: string;
  summary: string;
  status: "completed" | "needs_attention";
  steps: ActionStep[];
}

export interface ActionProgress {
  planId: string;
  message: string;
  step: number;
}

export interface TwinBridge {
  getStatus(): Promise<AppStatus>;
  saveCredentials(input: CredentialInput): Promise<AppStatus>;
  hide(): Promise<void>;
  setMousePassthrough(passthrough: boolean): Promise<void>;
  setOverlayHeight(height: number): Promise<void>;
  setMode(mode: TwinMode): Promise<void>;
  getConnections(): Promise<ToolkitConnection[]>;
  connect(toolkit: Toolkit): Promise<{ redirectUrl: string }>;
  transcribe(request: DictationRequest): Promise<DictationResult>;
  prepareAction(command: string): Promise<ActionPlan>;
  executeAction(planId: string): Promise<ActionResult>;
  paste(text: string): Promise<void>;
  onActivated(callback: () => void): () => void;
  onActionProgress(callback: (progress: ActionProgress) => void): () => void;
  onConnectionsChanged(callback: () => void): () => void;
}
