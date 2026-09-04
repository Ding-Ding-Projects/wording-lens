import { app, BrowserWindow, ipcMain, safeStorage } from "electron";
import { join } from "node:path";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { BUILD_PROVENANCE } from "../../../packages/core/src/provenance";
import { parseVocabularyBytes } from "../../../packages/integration/vocabulary-boundary";
import { resolveRendererEntry } from "./paths";

let mainWindow: BrowserWindow | null = null;

function registerWindowHandlers(): void {
  ipcMain.handle("app:get-provenance", () => BUILD_PROVENANCE);
  ipcMain.handle("app:get-platform", () => ({ platform: process.platform, arch: process.arch }));
  ipcMain.on("window:minimize", (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
  ipcMain.on("window:toggle-maximize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    window.isMaximized() ? window.unmaximize() : window.maximize();
  });
  ipcMain.on("window:close", (event) => BrowserWindow.fromWebContents(event.sender)?.close());
  ipcMain.handle("vocabulary:save", async (_event, bytes: Uint8Array) => {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > 256 * 1024) return { loaded: false };
    if (!safeStorage.isEncryptionAvailable()) return { loaded: false };
    try {
      const parsed = parseVocabularyBytes(bytes);
      const encrypted = safeStorage.encryptString(JSON.stringify(parsed));
      const root = join(app.getPath("userData"), "private-cache");
      const target = join(root, "vocabulary.bin");
      await mkdir(root, { recursive: true });
      const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(temporary, encrypted, { flag: "wx" });
      await rename(temporary, target);
      return { loaded: true };
    } catch {
      return { loaded: false };
    }
  });
  ipcMain.handle("vocabulary:clear", async () => {
    try { await rm(join(app.getPath("userData"), "private-cache", "vocabulary.bin"), { force: true }); } catch { /* absent cache is already clear */ }
    return { cleared: true };
  });
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
  registerWindowHandlers();
  await createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
}).catch((error: unknown) => { console.error("Failed to create the application window", error); app.quit(); });

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
