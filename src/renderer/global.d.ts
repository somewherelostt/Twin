import type { TwinBridge } from "../shared/contracts";

declare global {
  interface Window {
    twin: TwinBridge;
  }
}

export {};
