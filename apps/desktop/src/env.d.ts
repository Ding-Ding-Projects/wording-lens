import type { AppProvenance } from "@core/types";
import type { OperationPreview, OperationRequest, OperationState } from "../../../packages/operations/types";
import type { AppSettings, EditorCandidate, NotificationRecord, ProjectInspection, UpdaterState, VocabularyStatus } from "../../../packages/desktop-services/src/index";

declare global {
  interface Window {
    desktopBridge?: {
      getProvenance: () => Promise<AppProvenance>;
      getPlatform: () => Promise<{ platform: string; arch: string }>;
      getSettings: () => Promise<AppSettings>;
      updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
      pickFile: () => Promise<string | undefined>;
      pickFolder: () => Promise<string | undefined>;
      inspectProject: (path: string) => Promise<ProjectInspection>;
      previewOperation: (request: OperationRequest) => Promise<OperationPreview>;
      enqueueOperation: (request: OperationRequest) => Promise<{ id: string; previewable: true }>;
      listOperations: (includeTerminal?: boolean) => Promise<readonly OperationState[]>;
      cancelOperation: (id: string) => Promise<boolean>;
      retryOperation: (id: string) => Promise<boolean>;
      converterCatalog: () => Promise<unknown>;
      detectFile: (bytes: Uint8Array) => Promise<unknown>;
      ollamaHealth: () => Promise<unknown>;
      ollamaVersion: () => Promise<string>;
      ollamaModels: () => Promise<unknown>;
      ollamaChat: (model: string, messages: readonly { role: "system" | "user" | "assistant"; content: string }[], parameters: Record<string, unknown>) => Promise<readonly { content?: string; done?: boolean }[]>;
      getUpdaterState: () => Promise<UpdaterState>;
      updateUpdaterState: (patch: Partial<UpdaterState>) => Promise<UpdaterState>;
      validateSchedule: (value: unknown) => Promise<unknown>;
      resolveSchedule: (base: unknown, schedule: unknown, instant?: string) => Promise<unknown>;
      listHistory: () => Promise<unknown>;
      exportHistory: () => Promise<unknown>;
      listNotifications: (includeDismissed?: boolean) => Promise<readonly NotificationRecord[]>;
      addNotification: (level: NotificationRecord["level"], title: string, body: string) => Promise<NotificationRecord>;
      dismissNotifications: (ids: readonly string[]) => Promise<number>;
      listEditors: () => Promise<readonly EditorCandidate[]>;
      previewEditor: (editor: EditorCandidate["id"], target: string, targetKind: "file" | "folder") => Promise<unknown>;
      openRecoveryFolder: () => Promise<unknown>;
      configureVocabularyUnlock: (secret: string) => Promise<void>;
      unlockVocabulary: (secret: string) => Promise<boolean>;
      vocabularyStatus: () => Promise<VocabularyStatus>;
      saveVocabulary: (bytes: Uint8Array) => Promise<VocabularyStatus>;
      clearVocabulary: () => Promise<VocabularyStatus>;
      minimize: () => void;
      toggleMaximize: () => void;
      close: () => void;
    };
  }
}

export {};
