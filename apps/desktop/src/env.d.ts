import type { AppProvenance } from "@core/types";

declare global {
  interface Window {
    desktopBridge?: {
      getProvenance: () => Promise<AppProvenance>;
      getPlatform: () => Promise<{ platform: string; arch: string }>;
      saveVocabulary: (bytes: Uint8Array) => Promise<{ loaded: boolean }>;
      clearVocabulary: () => Promise<{ cleared: boolean }>;
      minimize: () => void;
      toggleMaximize: () => void;
      close: () => void;
    };
  }
}

export {};
