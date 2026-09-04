import type { AppProvenance } from "@core/types";
import type { OperationPreview, OperationRequest, OperationState } from "../../../packages/operations/types";
import type { AppSettings, EditorCandidate, NotificationRecord, ProjectInspection, PublicLockRecord, StatusHubState, UpdaterState, VocabularyStatus } from "../../../packages/desktop-services/src/index";
import type { LockAttempt, NoveltyLockPolicy, UnlockDuration, TotpOptions } from "../../../packages/security/index";

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
      vocabularyEntries: () => Promise<readonly { key: string; value: string }[]>;
      renderPrivateText: (text: string, boundary: "private-ui" | "accessible-name", spans?: readonly { start: number; end: number }[]) => Promise<string>;
      saveVocabulary: (bytes: Uint8Array) => Promise<VocabularyStatus>;
      clearVocabulary: () => Promise<VocabularyStatus>;
      createLock: (targetId: string, policy: NoveltyLockPolicy, duration: UnlockDuration, factors: { pin?: string; password?: string; totpSecret?: Uint8Array }) => Promise<PublicLockRecord>;
      listLocks: () => Promise<readonly unknown[]>;
      unlockLock: (lockId: string, attempt?: LockAttempt) => Promise<unknown>;
      relock: (lockId: string) => Promise<void>;
      removeLock: (lockId: string) => Promise<void>;
      createTotpPairing: (input: { issuer: string; account: string; secret: string; algorithm?: "SHA1" | "SHA256" | "SHA512"; digits?: 6 | 7 | 8; periodSeconds?: number }) => Promise<unknown>;
      verifyTotp: (secret: string, code: string, options?: TotpOptions & { window?: number }) => Promise<unknown>;
      listSupportTickets: () => Promise<readonly unknown[]>;
      createSupportTicket: (category: string, description: string, severity: string) => Promise<unknown>;
      advanceSupportTicket: (id: string) => Promise<unknown>;
      resolveSupportTicket: (id: string) => Promise<unknown>;
      issueUnlockChallenge: (subjectId: string, rung: string, options?: { schoolMode?: boolean; waitMs?: number }) => Promise<unknown>;
      answerUnlockChallenge: (subjectId: string, answer: unknown) => Promise<unknown>;
      downloadBridgeStatus: () => Promise<unknown>;
      startDownload: (value: unknown) => Promise<unknown>;
      downloadStatus: () => Promise<readonly unknown[]>;
      statusHubState: () => Promise<StatusHubState>;
      minimize: () => void;
      toggleMaximize: () => void;
      close: () => void;
    };
  }
}

export {};
