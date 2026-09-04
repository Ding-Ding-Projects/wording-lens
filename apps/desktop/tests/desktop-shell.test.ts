import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseRoute } from "@core/navigation";
import { resolveRendererEntry } from "../electron/paths";

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

  it("resolves the compiled main directory to the real renderer entry", () => {
    const compiledMainDirectory = resolve(root, "dist-electron/apps/desktop/electron");
    expect(resolveRendererEntry(compiledMainDirectory)).toBe(resolve(root, "dist/renderer/index.html"));
  });
});
