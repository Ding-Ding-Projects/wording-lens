import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseRoute } from "@core/navigation";

const root = process.cwd();

describe("desktop shell contracts", () => {
  it("keeps the secure Electron bridge settings explicit", () => {
    const source = readFileSync(resolve(root, "apps/desktop/electron/main.ts"), "utf8");
    expect(source).toContain("contextIsolation: true");
    expect(source).toContain("nodeIntegration: false");
    expect(source).toContain("frame: false");
  });

  it("provides deterministic route fallback for the renderer", () => {
    expect(parseRoute("#/overview")).toBe("overview");
    expect(parseRoute("#/missing")).toBe("overview");
  });
});
