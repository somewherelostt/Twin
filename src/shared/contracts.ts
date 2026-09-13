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

export interface ToolkitConnection {
  slug: Toolkit;
  connected: boolean;
  accountId?: string;
}

export interface TwinBridge {
  getStatus(): Promise<AppStatus>;
  hide(): Promise<void>;
  setMode(mode: TwinMode): Promise<void>;
  getConnections(): Promise<ToolkitConnection[]>;
  connect(toolkit: Toolkit): Promise<{ redirectUrl: string }>;
  onActivated(callback: () => void): () => void;
}
