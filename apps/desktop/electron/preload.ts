import { contextBridge, ipcRenderer } from "electron";
import { BUILD_PROVENANCE } from "../../../packages/core/src/provenance";

contextBridge.exposeInMainWorld("desktopBridge", {
  getProvenance: () => ipcRenderer.invoke("app:get-provenance"),
  getPlatform: () => ipcRenderer.invoke("app:get-platform"),
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
  close: () => ipcRenderer.send("window:close"),
});

void BUILD_PROVENANCE;
