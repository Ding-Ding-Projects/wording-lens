import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { access, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { executeOperation, previewOperation, DurableOperationQueue, type OperationPreview, type OperationRequest, type OperationResult, type OperationState, type ProgressEvent } from "../../operations/index.js";
import { AdapterRegistry, createDefaultAdapterRegistry, detectSignature } from "../../converter/src/index.js";
import { appendMessage, createChatSession, redactedChatExport } from "../../ollama/src/chat.js";
import { createOllamaApi, health, installedTags, runningTags, version, chatStream } from "../../ollama/src/index.js";
import type { ChatParameters, ChatSession, RuntimeHealth } from "../../ollama/src/types.js";
import { validateSchedule, resolveScheduledValues, validateExternalValues, validateHomeAssistantState, type ScheduleSchema, type ScheduledValues } from "../../scheduling/schedule.js";
import { AppendOnlyHistory, type HistoryAction, type HistoryBackend, type HistoryRevision } from "../../history/history.js";
import type { VocabularyDocument } from "../../integration/vocabulary-boundary.js";
import { ToyLockManager, buildOtpAuthUri, verifyTotpCode, type CredentialVault, type LockAttempt, type LockRecord, type NoveltyLockPolicy, type UnlockDuration, type TotpOptions } from "../../security/index.js";
import { LocalSupportTicketStore, type SupportTicket, type TicketCategory, type TicketSeverity } from "../../security/support-tickets.js";
import { UnlockLadderService, type LadderAnswer, type LadderIssue, type LadderResult, type LadderRung } from "../../security/unlock-ladder.js";
import { DownloadStateEngine, type DownloadPublicRecord, type DownloadStartRequest, type BridgeStatus } from "../../downloads/src/index.js";
// This import is the canonical bounded parser. It rejects duplicate keys before
// a document can reach the private renderer boundary.

const MAX_TEXT_BYTES = 4 * 1024 * 1024;
const MAX_NOTIFICATION_COUNT = 500;
const MAX_HISTORY_COUNT = 2_000;
const transientRenameCodes = new Set(["EPERM", "EACCES", "EBUSY"]);

export type FilePicker = (kind: "file" | "folder", options?: { filters?: readonly { name: string; extensions: readonly string[] }[] }) => Promise<string | undefined>;
export type OpenPath = (path: string) => Promise<string>;

export interface DesktopServicesOptions {
  dataDirectory: string;
  pick?: FilePicker;
  openPath?: OpenPath;
  now?: () => Date;
  registry?: AdapterRegistry;
  ollamaBaseUrl?: string;
  vocabularyCrypto?: {
    seal: (bytes: Uint8Array) => Uint8Array;
    unseal: (bytes: Uint8Array) => Uint8Array;
  };
}

export interface ProjectInspection {
  path: string;
  exists: boolean;
  kind: "file" | "directory" | "missing";
  packageName?: string;
  packageVersion?: string;
  hasGitMetadata: boolean;
  inspectedAt: string;
}

export interface NotificationRecord {
  id: string;
  level: "info" | "success" | "progress" | "error" | "warning";
  title: string;
  body: string;
  createdAt: string;
  dismissedAt?: string;
}

const PUBLIC_NOTIFICATION_EVENTS = Object.freeze({
  'settings-saved': { title: 'Settings saved', body: 'Presentation preferences were saved locally.' },
  'operation-queued': { title: 'Operation queued', body: 'A reviewed operation was added to the local queue.' },
  'operation-cancelled': { title: 'Cancellation requested', body: 'The operation received a cancellation request.' },
  'private-profile-cleared': { title: 'Private profile cleared', body: 'Private wording and its local unlock were cleared.' },
});
export type PublicNotificationEvent = keyof typeof PUBLIC_NOTIFICATION_EVENTS;

export interface AppSettings {
  displayName: string;
  languageMode: "english" | "cantonese" | "bilingual";
  theme: "light" | "dark";
  density: "comfortable" | "compact" | "spacious";
  accent: string;
  funnyEnglish: 1 | 2 | 3 | 4 | 5;
  funnyCantonese: 1 | 2 | 3 | 4 | 5;
  emojiDialogs: boolean;
  narrationEnabled: boolean;
  narrationLanguage: "english" | "cantonese" | "both";
  reducedMotion: boolean;
}

export interface VocabularyStatus {
  authenticated: boolean;
  loaded: boolean;
  entryCount: number;
}

export interface UpdaterState {
  state: "idle" | "available" | "downloading" | "ready" | "failed";
  version?: string;
  releaseNotesUrl?: string;
  unsigned: true;
  checkedAt?: string;
  error?: string;
}

export interface StatusHubState {
  available: boolean;
  reason?: "client-library-unavailable";
}

export type PrivateSinkBoundary = "private-ui" | "accessible-name";
export interface PrivateTextSpan { start: number; end: number }
export type PublicLockRecord = Omit<LockRecord, "credentialReferences"> & { credentialReferences: { present: string[] } };

export interface EditorCandidate {
  id: "vscode" | "vscode-insiders" | "notepad" | "notepad-plus-plus";
  executable: string;
  available: boolean;
}

const defaultSettings: AppSettings = {
  displayName: "Wording Lens",
  languageMode: "english",
  theme: "dark",
  density: "comfortable",
  accent: "#00d4ff",
  funnyEnglish: 5,
  funnyCantonese: 5,
  emojiDialogs: true,
  narrationEnabled: false,
  narrationLanguage: "english",
  reducedMotion: false,
};

function iso(now: () => Date): string { return now().toISOString(); }
function boundedPath(value: string, label: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 4_096 || value.includes("\0") || /[\r\n]/u.test(value)) throw new Error(`${label} is invalid`);
  return resolve(value);
}
function boundedText(value: string, label: string, max = 8_000): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max || value.includes("\0")) throw new Error(`${label} is invalid`);
  return value;
}
function jsonBytes(value: unknown): Uint8Array { return new TextEncoder().encode(JSON.stringify(value)); }
async function parseCanonicalVocabulary(bytes: Uint8Array): Promise<VocabularyDocument> {
  const module = await import("../../vocabulary/parse.mjs") as { parseVocabularyPayload: (input: unknown) => VocabularyDocument };
  return module.parseVocabularyPayload(bytes);
}

async function atomicWrite(path: string, content: string | Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, { encoding: typeof content === "string" ? "utf8" : undefined, flag: "wx" });
  try {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try { await rename(temporary, path); return; } catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
        if (!transientRenameCodes.has(code) || attempt === 5) throw error;
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 50 * (attempt + 1)));
      }
    }
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function atomicJson(path: string, value: unknown): Promise<void> { await atomicWrite(path, JSON.stringify(value, null, 2)); }

class PlatformProtectedVault implements CredentialVault {
  constructor(private readonly root: string, private readonly crypto: DesktopServicesOptions['vocabularyCrypto']) {}
  private path(reference: string): string {
    if (!/^[a-z0-9-]{1,64}:(pin|password|totp)$/i.test(reference)) throw new Error('Invalid local credential reference');
    return join(this.root, reference.replace(':', '-') + '.bin');
  }
  async setSecret(reference: string, value: Uint8Array): Promise<void> {
    if (!this.crypto) throw new Error('Platform encrypted storage is unavailable');
    if (value.length > 4096) throw new Error('Credential record exceeds its storage bound');
    await atomicWrite(this.path(reference), this.crypto.seal(value));
  }
  async getSecret(reference: string): Promise<Uint8Array | null> {
    if (!this.crypto) throw new Error('Platform encrypted storage is unavailable');
    try {
      const value = await readFile(this.path(reference));
      if (value.length > 16384) throw new Error('Credential record exceeds its storage bound');
      return this.crypto.unseal(value);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null;
      throw new Error('Unable to read the protected credential record');
    }
  }
  async deleteSecret(reference: string): Promise<void> { await rm(this.path(reference), { force: true }); }
}

class JsonStore<T> {
  public constructor(private readonly path: string, private readonly fallback: T) {}
  public async load(): Promise<T> {
    try { return JSON.parse(await readFile(this.path, "utf8")) as T; } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
      if (code === "ENOENT") return structuredClone(this.fallback);
      throw error;
    }
  }
  public async save(value: T): Promise<void> { await atomicJson(this.path, value); }
}

class JsonHistoryBackend implements HistoryBackend {
  public constructor(private readonly path: string) {}
  public async append(revision: HistoryRevision): Promise<void> {
    const current = await this.list();
    if (current.some((entry) => entry.revisionId === revision.revisionId)) throw new Error("Duplicate history revision");
    await atomicJson(this.path, [...current, revision].slice(-MAX_HISTORY_COUNT));
  }
  public async list(): Promise<HistoryRevision[]> {
    try {
      const value = JSON.parse(await readFile(this.path, "utf8")) as unknown;
      return Array.isArray(value) ? value.filter((entry): entry is HistoryRevision => Boolean(entry && typeof entry === "object" && typeof (entry as HistoryRevision).revisionId === "string")) : [];
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
      if (code === "ENOENT") return [];
      throw error;
    }
  }
}

export class DesktopServices {
  private readonly now: () => Date;
  private readonly dataDirectory: string;
  private readonly settings: JsonStore<AppSettings>;
  private readonly notifications: JsonStore<NotificationRecord[]>;
  private readonly updater: JsonStore<UpdaterState>;
  private history: AppendOnlyHistory;
  private historyKeyPersistent = false;
  private readonly locks: ToyLockManager;
  private readonly tickets = new LocalSupportTicketStore();
  private readonly ladder = new UnlockLadderService();
  private readonly downloads = new DownloadStateEngine();
  private readonly queue: DurableOperationQueue;
  private readonly registry: AdapterRegistry;
  private readonly ollamaBaseUrl: string;
  private readonly pick?: FilePicker;
  private readonly openPath?: OpenPath;
  private readonly vocabularyCrypto?: DesktopServicesOptions["vocabularyCrypto"];
  private settingsValue: AppSettings = structuredClone(defaultSettings);
  private notificationsValue: NotificationRecord[] = [];
  private updaterValue: UpdaterState = { state: "idle", unsigned: true };
  private notificationWrite: Promise<void> = Promise.resolve();
  private vocabulary: VocabularyDocument | null = null;
  private vocabularyAuthenticated = false;
  private vocabularyVerifier: string | null = null;
  private vocabularyEpoch = 0;
  private vocabularyWrite: Promise<void> = Promise.resolve();
  private configuringVocabulary = false;
  private lockStoreAvailable = true;

  public constructor(options: DesktopServicesOptions) {
    this.now = options.now ?? (() => new Date());
    this.dataDirectory = boundedPath(options.dataDirectory, "data directory");
    this.settings = new JsonStore(join(this.dataDirectory, "settings.json"), defaultSettings);
    this.notifications = new JsonStore(join(this.dataDirectory, "notifications.json"), []);
    this.updater = new JsonStore(join(this.dataDirectory, "updater.json"), { state: "idle", unsigned: true });
    this.locks = new ToyLockManager(new PlatformProtectedVault(join(this.dataDirectory, 'protected-credentials'), options.vocabularyCrypto));
    this.history = new AppendOnlyHistory(new JsonHistoryBackend(join(this.dataDirectory, "history.json")), randomBytes(32));
    this.registry = options.registry ?? createDefaultAdapterRegistry();
    this.ollamaBaseUrl = options.ollamaBaseUrl ?? "http://127.0.0.1:11434";
    this.pick = options.pick;
    this.openPath = options.openPath;
    this.vocabularyCrypto = options.vocabularyCrypto;
    this.queue = new DurableOperationQueue({ filePath: join(this.dataDirectory, "operations.json"), executor: executeOperation, onProgress: (event) => { void this.recordProgress(event); } });
  }

  public async ready(): Promise<void> {
    await mkdir(this.dataDirectory, { recursive: true });
    this.settingsValue = await this.settings.load();
    this.notificationsValue = (await this.notifications.load()).slice(-MAX_NOTIFICATION_COUNT);
    this.updaterValue = await this.updater.load();
    await this.queue.ready();
    await this.queue.recover();
    await this.initializeHistoryKey();
    await this.loadVocabularyVerifier();
    await this.loadVocabularyCache();
    try {
      const raw = await readFile(join(this.dataDirectory, 'locks.json'), 'utf8');
      if (raw.length > 2_000_000) throw new Error('Saved lock inventory is oversized');
      const records = JSON.parse(raw) as unknown;
      if (!Array.isArray(records)) throw new Error('Saved lock inventory is invalid');
      this.locks.restoreRecords(records as LockRecord[]);
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) this.lockStoreAvailable = false;
    }
  }

  public getSettings(): AppSettings { return structuredClone(this.settingsValue); }

  public async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const next = { ...this.settingsValue, ...patch };
    if (!next.displayName.trim() || next.displayName.length > 160) throw new Error("Display name must contain 1 to 160 characters");
    if (!/^#[\da-f]{6,8}$/iu.test(next.accent)) throw new Error("Accent must be a HEX color");
    if (![1, 2, 3, 4, 5].includes(next.funnyEnglish) || ![1, 2, 3, 4, 5].includes(next.funnyCantonese)) throw new Error("Funny levels must be from 1 to 5");
    this.settingsValue = next;
    await this.settings.save(this.settingsValue);
    await this.history.tryRecord({ revisionId: randomUUID(), stableRecordId: "settings", action: "settings-changed", label: "Updated local display and presentation settings" });
    return this.getSettings();
  }

  public async pickFile(): Promise<string | undefined> { return this.pick?.("file", { filters: [{ name: "Supported files", extensions: ["json", "txt", "pdf", "png", "jpg", "csv", "md"] }] }); }
  public async pickFolder(): Promise<string | undefined> { return this.pick?.("folder"); }

  public async inspectProject(value: string): Promise<ProjectInspection> {
    const path = boundedPath(value, "project path");
    const inspectedAt = iso(this.now);
    try {
      const entry = await stat(path);
      if (entry.isFile()) {
        let packageName: string | undefined;
        let packageVersion: string | undefined;
        if (path.toLowerCase().endsWith("package.json")) {
          const parsed = JSON.parse(await readFile(path, "utf8")) as { name?: unknown; version?: unknown };
          packageName = typeof parsed.name === "string" ? parsed.name : undefined;
          packageVersion = typeof parsed.version === "string" ? parsed.version : undefined;
        }
        return { path, exists: true, kind: "file", packageName, packageVersion, hasGitMetadata: false, inspectedAt };
      }
      const hasGitMetadata = await access(join(path, ".git")).then(() => true, () => false);
      const packagePath = join(path, "package.json");
      let packageName: string | undefined;
      let packageVersion: string | undefined;
      try {
        const parsed = JSON.parse(await readFile(packagePath, "utf8")) as { name?: unknown; version?: unknown };
        packageName = typeof parsed.name === "string" ? parsed.name : undefined;
        packageVersion = typeof parsed.version === "string" ? parsed.version : undefined;
      } catch { /* project package metadata is optional */ }
      return { path, exists: true, kind: "directory", packageName, packageVersion, hasGitMetadata, inspectedAt };
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
      if (code === "ENOENT") return { path, exists: false, kind: "missing", hasGitMetadata: false, inspectedAt };
      throw error;
    }
  }

  public preview(request: OperationRequest): OperationPreview { return previewOperation(request); }
  public async enqueue(request: OperationRequest): Promise<{ id: string; previewable: true }> { return this.queue.enqueue(request); }
  public async listOperations(includeTerminal = true): Promise<readonly OperationState[]> { return this.queue.list(includeTerminal); }
  public async cancelOperation(id: string): Promise<boolean> { return this.queue.cancel(boundedText(id, "operation id", 200)); }
  public async retryOperation(id: string): Promise<boolean> { return this.queue.retry(boundedText(id, "operation id", 200)); }

  public converterCatalog(): ReturnType<AdapterRegistry["catalog"]> { return this.registry.catalog(); }
  public detectFile(bytes: Uint8Array): ReturnType<typeof detectSignature> {
    if (!bytes || typeof bytes.byteLength !== "number" || bytes.byteLength > MAX_TEXT_BYTES) throw new Error("Input exceeds the bounded inspection size");
    return detectSignature(bytes);
  }
  public async safeCopyText(source: string, destination: string, overwrite = false): Promise<{ source: string; destination: string; bytes: number }> {
    const sourcePath = boundedPath(source, "source path");
    const destinationPath = boundedPath(destination, "destination path");
    const bytes = await readFile(sourcePath);
    if (bytes.byteLength > MAX_TEXT_BYTES) throw new Error("Input exceeds the bounded copy size");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!overwrite && await access(destinationPath).then(() => true, () => false)) throw new Error("Destination already exists");
    await mkdir(dirname(destinationPath), { recursive: true });
    await atomicWrite(destinationPath, text);
    return { source: sourcePath, destination: destinationPath, bytes: Buffer.byteLength(text) };
  }

  public async ollamaHealth(): Promise<RuntimeHealth> { return health(createOllamaApi(this.ollamaBaseUrl), this.ollamaBaseUrl); }
  public async ollamaVersion(): Promise<string> { return version(createOllamaApi(this.ollamaBaseUrl)); }
  public async ollamaModels(): Promise<{ installed: Awaited<ReturnType<typeof installedTags>>; running: string[] }> {
    const api = createOllamaApi(this.ollamaBaseUrl);
    return { installed: await installedTags(api), running: [...await runningTags(api)] };
  }
  public async ollamaChat(model: string, messages: readonly { role: "system" | "user" | "assistant"; content: string }[], parameters: ChatParameters, onMessage: (message: { content?: string; done?: boolean }) => void, signal?: AbortSignal): Promise<void> {
    await chatStream(createOllamaApi(this.ollamaBaseUrl), boundedText(model, "model", 200), messages, parameters as Record<string, unknown>, (message) => onMessage({ content: message.message?.content, done: message.done }), signal);
  }

  public createChat(id: string, model: string, systemPrompt = "", parameters: ChatParameters = {}): ChatSession { return createChatSession(boundedText(id, "chat id", 200), boundedText(model, "model", 200), systemPrompt, parameters); }
  public appendChat(session: ChatSession, message: { role: "system" | "user" | "assistant"; content: string }): ChatSession { return appendMessage(session, message); }
  public exportChat(session: ChatSession): string { return redactedChatExport(session); }

  public validateSchedule(input: unknown): ScheduleSchema { return validateSchedule(input); }
  public resolveSchedule(base: ScheduledValues, schedule: ScheduleSchema, instant = this.now()): ReturnType<typeof resolveScheduledValues> { return resolveScheduledValues(base, schedule, instant); }
  public validateExternalSchedule(input: unknown): ReturnType<typeof validateExternalValues> { return validateExternalValues(input); }
  public validateHomeAssistant(input: unknown): boolean { return validateHomeAssistantState(input); }

  public async recordHistory(input: { stableRecordId: string; action: HistoryAction; label: string; snapshot?: Uint8Array }): Promise<HistoryRevision> {
    if (input.snapshot && !this.historyKeyPersistent) throw new Error('Encrypted history storage is unavailable');
    const result = await this.history.tryRecord({ revisionId: randomUUID(), ...input });
    if (!result.historyRecorded) throw new Error("Local history is unavailable");
    return result.revision;
  }
  public async listHistory(): Promise<readonly HistoryRevision[]> { return (await this.history.exportRedacted()).revisions.slice(-MAX_HISTORY_COUNT); }
  public async exportHistory(): Promise<Awaited<ReturnType<AppendOnlyHistory["exportRedacted"]>>> { return this.history.exportRedacted(); }

  private async initializeHistoryKey(): Promise<void> {
    if (!this.vocabularyCrypto) return;
    const keyPath = join(this.dataDirectory, 'history-key.bin');
    let key: Uint8Array;
    try {
      const encrypted = await readFile(keyPath);
      if (encrypted.length > 4096) throw new Error('Invalid encrypted history key');
      key = this.vocabularyCrypto.unseal(encrypted);
      if (key.length !== 32) throw new Error('Invalid encrypted history key');
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) return;
      key = randomBytes(32);
      await atomicWrite(keyPath, this.vocabularyCrypto.seal(key));
    }
    this.history = new AppendOnlyHistory(new JsonHistoryBackend(join(this.dataDirectory, 'history.json')), key);
    this.historyKeyPersistent = true;
  }

  public async addNotification(level: NotificationRecord["level"], title: string, body: string): Promise<NotificationRecord> {
    const record: NotificationRecord = { id: randomUUID(), level, title: boundedText(title, "notification title", 200), body: boundedText(body, "notification body", 4_000), createdAt: iso(this.now) };
    this.notificationsValue = [...this.notificationsValue, record].slice(-MAX_NOTIFICATION_COUNT);
    this.notificationWrite = this.notificationWrite.then(() => this.notifications.save(this.notificationsValue));
    await this.notificationWrite;
    return structuredClone(record);
  }
  public listNotifications(includeDismissed = true): readonly NotificationRecord[] { return structuredClone(includeDismissed ? this.notificationsValue : this.notificationsValue.filter((entry) => !entry.dismissedAt)); }
  public async dismissNotifications(ids: readonly string[]): Promise<number> {
    const wanted = new Set(ids.map((id) => boundedText(id, "notification id", 200)));
    let changed = 0;
    this.notificationsValue = this.notificationsValue.map((entry) => {
      if (!wanted.has(entry.id) || entry.dismissedAt) return entry;
      changed += 1;
      return { ...entry, dismissedAt: iso(this.now) };
    });
    this.notificationWrite = this.notificationWrite.then(() => this.notifications.save(this.notificationsValue));
    await this.notificationWrite;
    return changed;
  }
  private async recordProgress(event: ProgressEvent): Promise<void> { await this.addNotification("progress", event.phase, event.message ?? `${event.completed} completed`); }

  public getUpdaterState(): UpdaterState { return structuredClone(this.updaterValue); }
  public async updateUpdaterState(patch: Partial<UpdaterState>): Promise<UpdaterState> {
    const next = { ...this.updaterValue, ...patch, unsigned: true as const };
    if (!Object.prototype.hasOwnProperty.call({ idle: true, available: true, downloading: true, ready: true, failed: true }, next.state)) throw new Error("Updater state is invalid");
    if (next.version !== undefined && (typeof next.version !== "string" || next.version.length > 100)) throw new Error("Updater version is invalid");
    if (next.releaseNotesUrl !== undefined && (typeof next.releaseNotesUrl !== "string" || !/^https:\/\//u.test(next.releaseNotesUrl))) throw new Error("Updater release notes URL must use HTTPS");
    this.updaterValue = next;
    await this.updater.save(this.updaterValue);
    return this.getUpdaterState();
  }

  public detectEditors(): EditorCandidate[] {
    const candidates: EditorCandidate[] = [
      { id: "vscode", executable: "code.cmd", available: false },
      { id: "vscode-insiders", executable: "code-insiders.cmd", available: false },
      { id: "notepad", executable: "notepad.exe", available: false },
      { id: "notepad-plus-plus", executable: "notepad++.exe", available: false },
    ];
    const local = process.env.LOCALAPPDATA;
    const programFiles = process.env.ProgramFiles;
    const paths: Record<EditorCandidate["id"], readonly string[]> = {
      vscode: [join(local ?? "", "Programs", "Microsoft VS Code", "bin", "code.cmd"), join(programFiles ?? "", "Microsoft VS Code", "bin", "code.cmd")],
      "vscode-insiders": [join(local ?? "", "Programs", "Microsoft VS Code Insiders", "bin", "code-insiders.cmd"), join(programFiles ?? "", "Microsoft VS Code Insiders", "bin", "code-insiders.cmd")],
      notepad: [join(process.env.WINDIR ?? "", "System32", "notepad.exe")],
      "notepad-plus-plus": [join(programFiles ?? "", "Notepad++", "notepad++.exe")],
    };
    return candidates.map((candidate) => ({ ...candidate, available: Boolean(paths[candidate.id].some((path) => path && existsSync(path)) || process.env.Path?.split(";").some((part) => part.toLowerCase().includes(candidate.executable.replace(".cmd", "").toLowerCase()))) }));
  }
  public editorLaunchPreview(editor: EditorCandidate["id"], target: string, targetKind: "file" | "folder"): { editor: EditorCandidate["id"]; target: string; targetKind: "file" | "folder"; args: readonly string[]; allowed: boolean } {
    const cleanTarget = boundedPath(target, "editor target");
    const candidate = this.detectEditors().find((entry) => entry.id === editor);
    const args = editor.startsWith("vscode") && targetKind === "folder" ? ["--new-window", cleanTarget] : [cleanTarget];
    return { editor, target: cleanTarget, targetKind, args, allowed: Boolean(candidate?.available) };
  }
  public async openRecoveryFolder(): Promise<{ path: string; opened: boolean; message?: string }> {
    const path = this.dataDirectory;
    if (!this.openPath) return { path, opened: false, message: "The platform file manager bridge is unavailable." };
    const message = await this.openPath(path);
    return { path, opened: message.length === 0, message: message || undefined };
  }

  public async configureVocabularyUnlock(secret: string): Promise<void> {
    if (this.configuringVocabulary || this.vocabularyVerifier || this.vocabulary) throw new Error("Clear the existing private profile before configuring a new unlock");
    if (!this.vocabularyCrypto) throw new Error("Private encrypted storage is unavailable");
    const value = boundedText(secret, "unlock secret", 512);
    const salt = randomBytes(16);
    const verifier = JSON.stringify({ version: 1, algorithm: "scrypt", salt: salt.toString("hex"), hash: scryptSync(value, salt, 32).toString("hex") });
    const epoch = ++this.vocabularyEpoch;
    this.configuringVocabulary = true;
    try {
      await this.writePrivateState(async () => {
        if (epoch !== this.vocabularyEpoch) throw new Error("Private operation cancelled");
        await atomicWrite(join(this.dataDirectory, "vocabulary-unlock.bin"), this.vocabularyCrypto!.seal(new TextEncoder().encode(verifier)));
        if (epoch !== this.vocabularyEpoch) throw new Error("Private operation cancelled");
        this.vocabularyVerifier = verifier;
        this.vocabularyAuthenticated = false;
      });
    } finally { this.configuringVocabulary = false; }
  }
  public publishNotification(eventId: unknown): Promise<NotificationRecord> {
    if (typeof eventId !== 'string' || !Object.hasOwn(PUBLIC_NOTIFICATION_EVENTS, eventId)) throw new Error('Unknown notification event');
    const event = PUBLIC_NOTIFICATION_EVENTS[eventId as PublicNotificationEvent];
    return this.addNotification('info', event.title, event.body);
  }
  public unlockVocabulary(secret: string): boolean {
    if (!this.vocabularyVerifier) return false;
    const record = JSON.parse(this.vocabularyVerifier) as { salt: string; hash: string };
    const candidate = scryptSync(boundedText(secret, "unlock secret", 512), Buffer.from(record.salt, "hex"), 32);
    const expected = Buffer.from(record.hash, "hex");
    this.vocabularyAuthenticated = candidate.length === expected.length && timingSafeEqual(candidate, expected);
    candidate.fill(0);
    return this.vocabularyAuthenticated;
  }
  private writePrivateState(action: () => Promise<void>): Promise<void> {
    const result = this.vocabularyWrite.then(action);
    this.vocabularyWrite = result.catch(() => undefined);
    return result;
  }
  public async saveVocabulary(bytes: Uint8Array): Promise<VocabularyStatus> {
    if (!this.vocabularyAuthenticated) throw new Error("Private wording is locked");
    if (!this.vocabularyCrypto) throw new Error("Private encrypted storage is unavailable");
    const epoch = ++this.vocabularyEpoch;
    const parsed = await parseCanonicalVocabulary(bytes);
    await this.writePrivateState(async () => {
      if (epoch !== this.vocabularyEpoch || !this.vocabularyAuthenticated) throw new Error("Private operation cancelled");
      await atomicWrite(join(this.dataDirectory, "vocabulary.bin"), this.vocabularyCrypto!.seal(jsonBytes(parsed)));
      if (epoch !== this.vocabularyEpoch || !this.vocabularyAuthenticated) throw new Error("Private operation cancelled");
      this.vocabulary = parsed;
    });
    return this.vocabularyStatus();
  }
  public async clearVocabulary(): Promise<VocabularyStatus> {
    this.vocabularyEpoch += 1;
    this.vocabulary = null;
    this.vocabularyVerifier = null;
    this.vocabularyAuthenticated = false;
    try {
      await this.writePrivateState(async () => {
        await rm(join(this.dataDirectory, "vocabulary.bin"), { force: true });
        await rm(join(this.dataDirectory, "vocabulary-unlock.bin"), { force: true });
      });
    } catch {
      throw new Error("Unable to clear private vocabulary state. Private presentation is locked; clear the local data folder to remove retained files.");
    }
    this.vocabulary = null;
    this.vocabularyVerifier = null;
    this.vocabularyAuthenticated = false;
    return this.vocabularyStatus();
  }
  private async loadVocabularyVerifier(): Promise<void> {
    if (!this.vocabularyCrypto) return;
    try {
      const encrypted = new Uint8Array(await readFile(join(this.dataDirectory, "vocabulary-unlock.bin")));
      const value = new TextDecoder("utf-8", { fatal: true }).decode(this.vocabularyCrypto.unseal(encrypted));
      const record = JSON.parse(value) as { version?: unknown; algorithm?: unknown; salt?: unknown; hash?: unknown };
      if (record.version === 1 && record.algorithm === "scrypt" && typeof record.salt === "string" && /^[\da-f]{32}$/u.test(record.salt) && typeof record.hash === "string" && /^[\da-f]{64}$/u.test(record.hash)) this.vocabularyVerifier = value;
    } catch { this.vocabularyVerifier = null; }
  }
  private async loadVocabularyCache(): Promise<void> {
    if (!this.vocabularyCrypto) return;
    try {
      const encrypted = new Uint8Array(await readFile(join(this.dataDirectory, "vocabulary.bin")));
      this.vocabulary = await parseCanonicalVocabulary(this.vocabularyCrypto.unseal(encrypted));
    } catch { this.vocabulary = null; }
  }
  public vocabularyStatus(): VocabularyStatus { return { authenticated: this.vocabularyAuthenticated, loaded: this.vocabulary !== null, entryCount: this.vocabularyAuthenticated ? Object.keys(this.vocabulary?.entries ?? {}).length : 0 }; }
  public applyPrivateText(text: string): string {
    return this.renderPrivateText(text, "private-ui");
  }

  public privateVocabularyEntries(): readonly { key: string; value: string }[] {
    if (!this.vocabularyAuthenticated || !this.vocabulary) throw new Error("Private wording is locked");
    return Object.entries(this.vocabulary.entries).map(([key, value]) => ({ key, value }));
  }
  public renderPrivateText(text: string, boundary: PrivateSinkBoundary, protectedSpans: readonly PrivateTextSpan[] = []): string {
    const source = boundedText(text, "private text", 100_000);
    if (boundary !== "private-ui" && boundary !== "accessible-name") throw new Error("Private wording sink boundary is not allowed");
    if (!this.vocabularyAuthenticated || !this.vocabulary) return source;
    const ranges = [...protectedSpans].sort((left, right) => left.start - right.start || left.end - right.end);
    let output = "";
    let cursor = 0;
    for (const range of ranges) {
      if (!Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < cursor || range.end < range.start || range.end > source.length) throw new Error("Private text span is invalid");
      output += renderAliases(source.slice(cursor, range.start), this.vocabulary);
      output += source.slice(range.start, range.end);
      cursor = range.end;
    }
    return output + renderAliases(source.slice(cursor), this.vocabulary);
  }

  public async createLock(targetId: string, policy: NoveltyLockPolicy, duration: UnlockDuration, factors: { pin?: string; password?: string; totpSecret?: Uint8Array }): Promise<PublicLockRecord> {
    if (!this.lockStoreAvailable) throw new Error('Saved lock storage is unavailable; use local recovery');
    const record = await this.locks.createLock(boundedText(targetId, "lock target", 200), policy, duration, factors);
    try { await atomicJson(join(this.dataDirectory, 'locks.json'), this.locks.listLocks()); }
    catch { await this.locks.removeLock(record.id); throw new Error('Unable to save the local lock'); }
    return publicLockRecord(record);
  }
  public listLocks(): readonly PublicLockRecord[] {
    return this.locks.listLocks().map(publicLockRecord);
  }
  public unlockLock(lockId: string, attempt: LockAttempt = {}) { return this.locks.unlock(boundedText(lockId, "lock id", 200), attempt); }
  public relock(lockId: string): void { this.locks.relock(boundedText(lockId, "lock id", 200)); }
  public async removeLock(lockId: string): Promise<void> {
    await this.locks.removeLock(boundedText(lockId, "lock id", 200));
    await atomicJson(join(this.dataDirectory, 'locks.json'), this.locks.listLocks());
  }
  public createTotpPairing(input: Parameters<typeof buildOtpAuthUri>[0]): { uri: string; issuer: string; account: string; algorithm: string; digits: number; periodSeconds: number } {
    const uri = buildOtpAuthUri(input);
    return { uri, issuer: input.issuer, account: input.account, algorithm: input.algorithm ?? "SHA1", digits: input.digits ?? 6, periodSeconds: input.periodSeconds ?? 30 };
  }
  public verifyTotp(secret: string, code: string, options: TotpOptions & { window?: number } = {}) { return verifyTotpCode(boundedText(secret, "TOTP secret", 512), boundedText(code, "TOTP code", 16), options); }
  public listSupportTickets(): readonly SupportTicket[] { return this.tickets.list(); }
  public createSupportTicket(category: TicketCategory, description: string, severity: TicketSeverity): SupportTicket { return this.tickets.create({ category, description: boundedText(description, "ticket description", 10_000), severity }); }
  public advanceSupportTicket(id: string): SupportTicket { return this.tickets.advance(boundedText(id, "ticket id", 200)); }
  public async resolveSupportTicket(id: string): Promise<{ ticket: SupportTicket; openedPath: string; networkUsed: false }> {
    const resolved = this.tickets.resolve(boundedText(id, "ticket id", 200), this.dataDirectory);
    const opened = await this.openRecoveryFolder();
    return { ...resolved, openedPath: opened.path };
  }
  public issueUnlockChallenge(subjectId: string, rung: LadderRung, options: { schoolMode?: boolean; waitMs?: number } = {}): LadderIssue | null { return this.ladder.issue(boundedText(subjectId, "ladder subject", 200), rung, options); }
  public answerUnlockChallenge(subjectId: string, answer: LadderAnswer): LadderResult { return this.ladder.answer(boundedText(subjectId, "ladder subject", 200), answer); }
  public downloadBridgeStatus(): BridgeStatus { return { available: false, reason: "native-host-not-installed" }; }
  public startDownload(value: unknown): ReturnType<DownloadStateEngine["start"]> { return this.downloads.start(value); }
  public downloadStatus(): readonly DownloadPublicRecord[] { return this.downloads.listPublic(); }
  public statusHubState(): StatusHubState { return { available: false, reason: "client-library-unavailable" }; }
}

function renderAliases(text: string, vocabulary: VocabularyDocument): string {
  let output = text;
  for (const [key, value] of Object.entries(vocabulary.entries).sort(([left], [right]) => right.length - left.length)) output = output.split(key).join(value);
  return output;
}

function publicLockRecord(record: LockRecord): PublicLockRecord {
  return { ...record, credentialReferences: { present: Object.keys(record.credentialReferences) } };
}
