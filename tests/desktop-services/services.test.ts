import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DesktopServices } from "../../packages/desktop-services/src/index.js";

const roots: string[] = [];

async function service(): Promise<{ root: string; services: DesktopServices }> {
  const root = await mkdtemp(join(tmpdir(), "wording-lens-services-"));
  roots.push(root);
  const services = new DesktopServices({
    dataDirectory: root,
    vocabularyCrypto: {
      seal: (bytes) => new Uint8Array(bytes).map((byte) => byte ^ 0xa5),
      unseal: (bytes) => new Uint8Array(bytes).map((byte) => byte ^ 0xa5),
    },
  });
  await services.ready();
  return { root, services };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("desktop services", () => {
  it("persists validated settings and inspects a project", async () => {
    const { root, services } = await service();
    const settings = await services.updateSettings({ displayName: "My Lens", accent: "#123456" });
    expect(settings.displayName).toBe("My Lens");
    const inspection = await services.inspectProject(root);
    expect(inspection.kind).toBe("directory");
    expect((await readFile(join(root, "settings.json"), "utf8"))).toContain("My Lens");
  });

  it("keeps text copying atomic and detects source bytes", async () => {
    const { root, services } = await service();
    const source = join(root, "source.txt");
    const destination = join(root, "out.txt");
    await writeFile(source, "local text\n", "utf8");
    const result = await services.safeCopyText(source, destination);
    expect(result.bytes).toBe(11);
    expect(await readFile(destination, "utf8")).toBe("local text\n");
    expect(services.detectFile(new TextEncoder().encode("a,b\n1,2\n")).format).toBe("csv");
  });

  it("requires an explicit unlock before private vocabulary can apply", async () => {
    const { services } = await service();
    await services.configureVocabularyUnlock("local-only-unlock");
    const payload = new TextEncoder().encode(JSON.stringify({ schemaVersion: 1, entries: { Alpha: "Beta" } }));
    await expect(services.saveVocabulary(payload)).rejects.toThrow("locked");
    expect(services.unlockVocabulary("local-only-unlock")).toBe(true);
    expect((await services.saveVocabulary(payload)).entryCount).toBe(1);
    expect(services.applyPrivateText("Alpha stays local")).toBe("Beta stays local");
    expect((await services.clearVocabulary()).loaded).toBe(false);
    expect(services.applyPrivateText("Alpha stays original")).toBe("Alpha stays original");
  });

  it("rejects duplicate vocabulary keys through the canonical parser", async () => {
    const { services } = await service();
    await services.configureVocabularyUnlock("local-only-unlock");
    expect(services.unlockVocabulary("local-only-unlock")).toBe(true);
    const duplicate = new TextEncoder().encode('{"schemaVersion":1,"entries":{"A":"one","A":"two"}}');
    await expect(services.saveVocabulary(duplicate)).rejects.toThrow();
    expect(services.vocabularyStatus().loaded).toBe(false);
  });

  it("queues a real typed file operation and persists notifications", async () => {
    const { root, services } = await service();
    const source = join(root, "queued.txt");
    await writeFile(source, "queued", "utf8");
    const request = { kind: "file" as const, input: { action: "read" as const, path: source }, timeoutMs: 5_000 };
    expect(services.preview(request).destructive).toBe("safe");
    const queued = await services.enqueue(request);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const item = (await services.listOperations()).find((entry) => entry.id === queued.id);
      if (item?.state === "succeeded") break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect((await services.listOperations()).find((entry) => entry.id === queued.id)?.state).toBe("succeeded");
    await services.addNotification("success", "Operation complete", "The file was read locally.");
    expect(services.listNotifications(false)).toHaveLength(1);
  });

  it("validates schedules and keeps editor previews allowlisted", async () => {
    const { services } = await service();
    const schedule = services.validateSchedule({ schemaVersion: 1, timezone: "America/Toronto", rules: [{ id: "evening", label: "Evening", enabled: true, priority: 1, startTime: "18:00", endTime: "20:00", weekdays: "every-day", source: { kind: "local" }, values: { theme: "dark" }, updatedAt: new Date().toISOString() }] });
    expect(services.resolveSchedule({ theme: "light" }, schedule, new Date("2026-09-04T23:00:00Z")).values.theme).toBe("dark");
    expect(services.editorLaunchPreview("vscode", "C:\\Projects", "folder").args).toEqual(["--new-window", "C:\\Projects"]);
  });

  it("persists an honest unsigned updater state", async () => {
    const { root, services } = await service();
    const state = await services.updateUpdaterState({ state: "ready", version: "0.1.0", releaseNotesUrl: "https://example.invalid/releases/0.1.0" });
    expect(state.unsigned).toBe(true);
    const restarted = new DesktopServices({ dataDirectory: root });
    await restarted.ready();
    expect(restarted.getUpdaterState()).toMatchObject({ state: "ready", version: "0.1.0", unsigned: true });
  });
});
