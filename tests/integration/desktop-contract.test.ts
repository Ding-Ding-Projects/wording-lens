import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../apps/desktop/src/main";
import { screenOrder } from "../../apps/desktop/src/components";

const root = process.cwd();
const renderer = readFileSync(resolve(root, "apps/desktop/src/main.tsx"), "utf8");
const bridge = readFileSync(resolve(root, "apps/desktop/electron/main.ts"), "utf8");
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("integrated desktop surface contract", () => {
  it("keeps every destination in the hand-written navigation inventory", async () => {
    const ids = ["overview", "projects", "operations", "queue", "files", "models", "authenticator", "history", "documentation", "changelog", "notifications", "status", "settings"];
    expect(screenOrder).toEqual(ids);
    const previousBridge = window.desktopBridge;
    const previousUrl = window.location.href;
    window.desktopBridge = undefined;
    window.history.replaceState(null, "", "#/overview");
    const host = document.createElement("div");
    document.body.append(host);
    const appRoot = createRoot(host);
    try {
      await act(async () => appRoot.render(React.createElement(App)));
      const tabs = [...host.querySelectorAll<HTMLButtonElement>("[data-tab-id]")];
      expect(tabs.map((tab) => tab.dataset.tabId)).toEqual(ids);
      const settings = tabs.find((tab) => tab.dataset.tabId === "settings")!;
      await act(async () => {
        settings.click();
        await new Promise((done) => setTimeout(done, 0));
      });
      expect(window.location.hash).toBe("#/settings");
      expect(settings.getAttribute("aria-selected")).toBe("true");
      expect(host.querySelector("main h1")?.textContent).toBe("Settings");
      expect(host.querySelector("#tabpanel-settings .settings-layout")).not.toBeNull();
    } finally {
      act(() => appRoot.unmount());
      host.remove();
      window.desktopBridge = previousBridge;
      window.history.replaceState(null, "", previousUrl);
    }
  });

  it("keeps the command palette and per-surface regex builder wired", () => {
    expect(renderer).toContain("event.ctrlKey && event.shiftKey");
    expect(renderer).toContain("SearchField");
    expect(renderer).toContain("RegexBuilder");
    expect(renderer).toContain("Context menu search");
  });

  it("keeps vocabulary bytes inside a trusted encrypted boundary", () => {
    expect(bridge).toContain('ipcMain.handle("vocabulary:save"');
    expect(bridge).toContain("safeStorage.isEncryptionAvailable()");
    expect(bridge).toContain("safeStorage.encryptString");
    expect(bridge).toContain("vocabulary.bin");
    expect(bridge).not.toContain("console.log(bytes");
  });
});
