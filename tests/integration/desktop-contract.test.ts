import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const renderer = readFileSync(resolve(root, "apps/desktop/src/main.tsx"), "utf8");
const bridge = readFileSync(resolve(root, "apps/desktop/electron/main.ts"), "utf8");

describe("integrated desktop surface contract", () => {
  it("keeps every destination in the hand-written navigation inventory", () => {
    const ids = ["overview", "projects", "operations", "queue", "files", "models", "authenticator", "history", "documentation", "changelog", "notifications", "status", "settings"];
    for (const id of ids) expect(renderer).toContain(`"${id}"`);
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
