import type { AppProvenance } from "@core/types";

declare global {
  interface Window {
    desktopBridge?: {
      getProvenance: () => Promise<AppProvenance>;
      getPlatform: () => Promise<{ platform: string; arch: string }>;
      minimize: () => void;
      toggleMaximize: () => void;
      close: () => void;
    };
  }
}

export {};
