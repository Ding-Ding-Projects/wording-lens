import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import { BUILD_PROVENANCE } from "../../../packages/core/src/provenance";

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
  else await mainWindow.loadFile(join(__dirname, "../../../dist/renderer/index.html"));
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  registerWindowHandlers();
  await createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
}).catch((error: unknown) => { console.error("Failed to create the application window", error); app.quit(); });

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
