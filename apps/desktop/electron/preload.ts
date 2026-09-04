import { contextBridge, ipcRenderer } from "electron";
import { BUILD_PROVENANCE } from "../../../packages/core/src/provenance";
import type { OperationPreview, OperationRequest, OperationState } from "../../../packages/operations/types.js";
import type { AppSettings, EditorCandidate, NotificationRecord, ProjectInspection, UpdaterState, VocabularyStatus } from "../../../packages/desktop-services/src/index.js";

contextBridge.exposeInMainWorld("desktopBridge", {
  getProvenance: () => ipcRenderer.invoke("app:get-provenance"),
      getPlatform: () => ipcRenderer.invoke("app:get-platform"),
      getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
      updateSettings: (patch: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke("settings:update", patch),
      pickFile: (): Promise<string | undefined> => ipcRenderer.invoke("project:pick-file"),
      pickFolder: (): Promise<string | undefined> => ipcRenderer.invoke("project:pick-folder"),
      inspectProject: (path: string): Promise<ProjectInspection> => ipcRenderer.invoke("project:inspect", path),
      previewOperation: (request: OperationRequest): Promise<OperationPreview> => ipcRenderer.invoke("operations:preview", request),
      enqueueOperation: (request: OperationRequest): Promise<{ id: string; previewable: true }> => ipcRenderer.invoke("operations:enqueue", request),
      listOperations: (includeTerminal?: boolean): Promise<readonly OperationState[]> => ipcRenderer.invoke("operations:list", includeTerminal),
      cancelOperation: (id: string): Promise<boolean> => ipcRenderer.invoke("operations:cancel", id),
      retryOperation: (id: string): Promise<boolean> => ipcRenderer.invoke("operations:retry", id),
      converterCatalog: (): Promise<unknown> => ipcRenderer.invoke("converter:catalog"),
      detectFile: (bytes: Uint8Array): Promise<unknown> => ipcRenderer.invoke("converter:detect", bytes),
      ollamaHealth: (): Promise<unknown> => ipcRenderer.invoke("ollama:health"),
      ollamaVersion: (): Promise<string> => ipcRenderer.invoke("ollama:version"),
      ollamaModels: (): Promise<unknown> => ipcRenderer.invoke("ollama:models"),
      ollamaChat: (model: string, messages: readonly { role: "system" | "user" | "assistant"; content: string }[], parameters: Record<string, unknown>): Promise<readonly { content?: string; done?: boolean }[]> => ipcRenderer.invoke("ollama:chat", model, messages, parameters),
      getUpdaterState: (): Promise<UpdaterState> => ipcRenderer.invoke("updater:get"),
      updateUpdaterState: (patch: Partial<UpdaterState>): Promise<UpdaterState> => ipcRenderer.invoke("updater:update", patch),
      validateSchedule: (value: unknown): Promise<unknown> => ipcRenderer.invoke("schedule:validate", value),
      resolveSchedule: (base: unknown, schedule: unknown, instant?: string): Promise<unknown> => ipcRenderer.invoke("schedule:resolve", base, schedule, instant),
      listHistory: (): Promise<unknown> => ipcRenderer.invoke("history:list"),
      exportHistory: (): Promise<unknown> => ipcRenderer.invoke("history:export"),
      listNotifications: (includeDismissed?: boolean): Promise<readonly NotificationRecord[]> => ipcRenderer.invoke("notifications:list", includeDismissed),
      addNotification: (level: NotificationRecord["level"], title: string, body: string): Promise<NotificationRecord> => ipcRenderer.invoke("notifications:add", level, title, body),
      dismissNotifications: (ids: readonly string[]): Promise<number> => ipcRenderer.invoke("notifications:dismiss", ids),
      listEditors: (): Promise<readonly EditorCandidate[]> => ipcRenderer.invoke("editors:list"),
      previewEditor: (editor: EditorCandidate["id"], target: string, targetKind: "file" | "folder"): Promise<unknown> => ipcRenderer.invoke("editors:preview", editor, target, targetKind),
      openRecoveryFolder: (): Promise<unknown> => ipcRenderer.invoke("recovery:open-folder"),
      configureVocabularyUnlock: (secret: string): Promise<void> => ipcRenderer.invoke("vocabulary:configure-unlock", secret),
      unlockVocabulary: (secret: string): Promise<boolean> => ipcRenderer.invoke("vocabulary:unlock", secret),
      vocabularyStatus: (): Promise<VocabularyStatus> => ipcRenderer.invoke("vocabulary:status"),
      saveVocabulary: (bytes: Uint8Array): Promise<VocabularyStatus> => ipcRenderer.invoke("vocabulary:save", bytes),
      clearVocabulary: (): Promise<VocabularyStatus> => ipcRenderer.invoke("vocabulary:clear"),
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
  close: () => ipcRenderer.send("window:close"),
});

void BUILD_PROVENANCE;
