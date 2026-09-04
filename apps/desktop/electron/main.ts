import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from "electron";
import { join } from "node:path";
import { BUILD_PROVENANCE } from "../../../packages/core/src/provenance";
import { resolveRendererEntry } from "./paths";
import { DesktopServices, type FilePicker } from "../../../packages/desktop-services/src/index.js";
import type { OperationRequest } from "../../../packages/operations/types.js";

let mainWindow: BrowserWindow | null = null;
let services: DesktopServices | null = null;
// DesktopServices stores the encrypted private cache as vocabulary.bin.

function requireServices(): DesktopServices {
  if (!services) throw new Error("Desktop services are not ready");
  return services;
}

function assertTrustedSender(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent): void {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error("Untrusted IPC sender");
}

function operationRequest(value: unknown): OperationRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Operation request must be an object");
  const request = value as Partial<OperationRequest>;
  if (typeof request.kind !== "string" || !request.input || typeof request.input !== "object") throw new Error("Operation request kind and input are required");
  return structuredClone(value) as OperationRequest;
}

const picker: FilePicker = async (kind, options) => {
  const result = await dialog.showOpenDialog({ properties: kind === "folder" ? ["openDirectory", "createDirectory"] : ["openFile"], filters: options?.filters ? options.filters.map((filter) => ({ name: filter.name, extensions: [...filter.extensions] })) : undefined });
  return result.canceled ? undefined : result.filePaths[0];
};

function registerWindowHandlers(): void {
  ipcMain.handle("app:get-provenance", (event) => { assertTrustedSender(event); return BUILD_PROVENANCE; });
  ipcMain.handle("app:get-platform", (event) => { assertTrustedSender(event); return { platform: process.platform, arch: process.arch }; });
  ipcMain.handle("settings:get", (event) => { assertTrustedSender(event); return requireServices().getSettings(); });
  ipcMain.handle("settings:update", async (event, patch: unknown) => { assertTrustedSender(event); return requireServices().updateSettings(patch as Record<string, unknown>); });
  ipcMain.handle("project:pick-file", (event) => { assertTrustedSender(event); return requireServices().pickFile(); });
  ipcMain.handle("project:pick-folder", (event) => { assertTrustedSender(event); return requireServices().pickFolder(); });
  ipcMain.handle("project:inspect", (event, path: unknown) => { assertTrustedSender(event); return requireServices().inspectProject(String(path)); });
  ipcMain.handle("operations:preview", (event, value: unknown) => { assertTrustedSender(event); return requireServices().preview(operationRequest(value)); });
  ipcMain.handle("operations:enqueue", (event, value: unknown) => { assertTrustedSender(event); return requireServices().enqueue(operationRequest(value)); });
  ipcMain.handle("operations:list", (event, includeTerminal: unknown) => { assertTrustedSender(event); return requireServices().listOperations(includeTerminal !== false); });
  ipcMain.handle("operations:cancel", (event, id: unknown) => { assertTrustedSender(event); return requireServices().cancelOperation(String(id)); });
  ipcMain.handle("operations:retry", (event, id: unknown) => { assertTrustedSender(event); return requireServices().retryOperation(String(id)); });
  ipcMain.handle("converter:catalog", (event) => { assertTrustedSender(event); return requireServices().converterCatalog(); });
  ipcMain.handle("converter:detect", (event, bytes: unknown) => { assertTrustedSender(event); return requireServices().detectFile(bytes && typeof bytes === "object" && "byteLength" in bytes ? bytes as Uint8Array : new Uint8Array()); });
  ipcMain.handle("converter:copy-text", (event, source: unknown, destination: unknown, overwrite: unknown) => { assertTrustedSender(event); return requireServices().safeCopyText(String(source), String(destination), overwrite === true); });
  ipcMain.handle("ollama:health", (event) => { assertTrustedSender(event); return requireServices().ollamaHealth(); });
  ipcMain.handle("ollama:version", (event) => { assertTrustedSender(event); return requireServices().ollamaVersion(); });
  ipcMain.handle("ollama:models", (event) => { assertTrustedSender(event); return requireServices().ollamaModels(); });
  ipcMain.handle("ollama:chat", async (event, model: unknown, messages: unknown, parameters: unknown) => {
    assertTrustedSender(event);
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) throw new Error("Chat messages must contain 1 to 100 entries");
    const output: Array<{ content?: string; done?: boolean }> = [];
    await requireServices().ollamaChat(String(model), messages.map((message) => {
      if (!message || typeof message !== "object") throw new Error("Chat message is invalid");
      const item = message as { role?: unknown; content?: unknown };
      if (!["system", "user", "assistant"].includes(String(item.role)) || typeof item.content !== "string" || item.content.length > 100_000) throw new Error("Chat message is invalid");
      return { role: item.role as "system" | "user" | "assistant", content: item.content };
    }), parameters && typeof parameters === "object" ? parameters as Parameters<DesktopServices["ollamaChat"]>[2] : {}, (message) => { if (output.length < 100_000) output.push(message); });
    return output;
  });
  ipcMain.handle("updater:get", (event) => { assertTrustedSender(event); return requireServices().getUpdaterState(); });
  ipcMain.handle("updater:update", (event, patch: unknown) => { assertTrustedSender(event); return requireServices().updateUpdaterState(patch as Record<string, unknown>); });
  ipcMain.handle("schedule:validate", (event, value: unknown) => { assertTrustedSender(event); return requireServices().validateSchedule(value); });
  ipcMain.handle("schedule:resolve", (event, base: unknown, schedule: unknown, instant: unknown) => { assertTrustedSender(event); return requireServices().resolveSchedule(base as Record<string, unknown>, requireServices().validateSchedule(schedule), instant ? new Date(String(instant)) : undefined); });
  ipcMain.handle("history:list", (event) => { assertTrustedSender(event); return requireServices().listHistory(); });
  ipcMain.handle("history:export", (event) => { assertTrustedSender(event); return requireServices().exportHistory(); });
  ipcMain.handle("notifications:list", (event, includeDismissed: unknown) => { assertTrustedSender(event); return requireServices().listNotifications(includeDismissed !== false); });
  ipcMain.handle("notifications:add", (event, level: unknown, title: unknown, body: unknown) => { assertTrustedSender(event); return requireServices().addNotification(level as Parameters<DesktopServices["addNotification"]>[0], String(title), String(body)); });
  ipcMain.handle("notifications:dismiss", (event, ids: unknown) => { assertTrustedSender(event); return requireServices().dismissNotifications(Array.isArray(ids) ? ids.map(String) : []); });
  ipcMain.handle("editors:list", (event) => { assertTrustedSender(event); return requireServices().detectEditors(); });
  ipcMain.handle("editors:preview", (event, editor: unknown, target: unknown, targetKind: unknown) => { assertTrustedSender(event); return requireServices().editorLaunchPreview(editor as Parameters<DesktopServices["editorLaunchPreview"]>[0], String(target), targetKind === "folder" ? "folder" : "file"); });
  ipcMain.handle("recovery:open-folder", (event) => { assertTrustedSender(event); return requireServices().openRecoveryFolder(); });
  ipcMain.handle("vocabulary:configure-unlock", (event, secret: unknown) => { assertTrustedSender(event); return requireServices().configureVocabularyUnlock(String(secret)); });
  ipcMain.handle("vocabulary:unlock", (event, secret: unknown) => { assertTrustedSender(event); return requireServices().unlockVocabulary(String(secret)); });
  ipcMain.handle("vocabulary:status", (event) => { assertTrustedSender(event); return requireServices().vocabularyStatus(); });
  ipcMain.handle("vocabulary:save", async (event, bytes: unknown) => { assertTrustedSender(event); return requireServices().saveVocabulary(bytes instanceof Uint8Array ? bytes : new Uint8Array()); });
  ipcMain.handle("vocabulary:clear", (event) => { assertTrustedSender(event); return requireServices().clearVocabulary(); });
  ipcMain.on("window:minimize", (event) => { assertTrustedSender(event); BrowserWindow.fromWebContents(event.sender)?.minimize(); });
  ipcMain.on("window:toggle-maximize", (event) => {
    assertTrustedSender(event);
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    window.isMaximized() ? window.unmaximize() : window.maximize();
  });
  ipcMain.on("window:close", (event) => { assertTrustedSender(event); BrowserWindow.fromWebContents(event.sender)?.close(); });
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 560,
    frame: false,
    title: BUILD_PROVENANCE.displayName,
    backgroundColor: "#0e1117",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) await mainWindow.loadURL(devUrl);
  else await mainWindow.loadFile(resolveRendererEntry(__dirname));
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  services = new DesktopServices({
    dataDirectory: join(app.getPath("userData"), "services"),
    pick: picker,
    openPath: (path) => shell.openPath(path),
    vocabularyCrypto: safeStorage.isEncryptionAvailable() ? {
      seal: (bytes) => safeStorage.encryptString(Buffer.from(bytes).toString("base64")),
      unseal: (bytes) => Buffer.from(safeStorage.decryptString(Buffer.from(bytes)), "base64"),
    } : undefined,
  });
  await services.ready();
  registerWindowHandlers();
  await createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
}).catch((error: unknown) => { console.error("Failed to create the application window", error); app.quit(); });

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
