import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DesktopServices } from "../../packages/desktop-services/src/index.js";
import { generateTotpCode } from "../../packages/security/totp.js";
import { decryptSnapshot } from "../../packages/history/history.js";

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
    await services.clearVocabulary();
    expect(services.unlockVocabulary("local-only-unlock")).toBe(false);
  });

  it("restores an encrypted cache but keeps its entry inventory locked until unlock", async () => {
    const { root, services } = await service();
    await services.configureVocabularyUnlock("restart-unlock");
    expect(services.unlockVocabulary("restart-unlock")).toBe(true);
    await services.saveVocabulary(new TextEncoder().encode(JSON.stringify({ schemaVersion: 1, entries: { Alpha: "Beta", Gamma: "Delta" } })));
    const restarted = new DesktopServices({ dataDirectory: root, vocabularyCrypto: { seal: (bytes) => new Uint8Array(bytes).map((byte) => byte ^ 0xa5), unseal: (bytes) => new Uint8Array(bytes).map((byte) => byte ^ 0xa5) } });
    await restarted.ready();
    expect(restarted.vocabularyStatus()).toMatchObject({ authenticated: false, loaded: true, entryCount: 0 });
    expect(() => restarted.privateVocabularyEntries()).toThrow("locked");
    expect(restarted.unlockVocabulary("restart-unlock")).toBe(true);
    expect(restarted.privateVocabularyEntries()).toEqual([{ key: "Alpha", value: "Beta" }, { key: "Gamma", value: "Delta" }]);
    expect(restarted.renderPrivateText("Alpha code 123", "private-ui", [{ start: 6, end: 10 }])).toBe("Beta code 123");
  });

  it("locks presentation immediately even when cache removal fails", async () => {
    const { root, services } = await service();
    await services.configureVocabularyUnlock("clear-unlock");
    expect(services.unlockVocabulary("clear-unlock")).toBe(true);
    await services.saveVocabulary(new TextEncoder().encode(JSON.stringify({ schemaVersion: 1, entries: { Alpha: "Beta" } })));
    await rm(join(root, "vocabulary.bin"), { force: true });
    await mkdir(join(root, "vocabulary.bin"));
    await expect(services.clearVocabulary()).rejects.toThrow("Unable to clear private vocabulary state");
    expect(services.vocabularyStatus()).toMatchObject({ authenticated: false, loaded: false, entryCount: 0 });
    expect(() => services.privateVocabularyEntries()).toThrow("locked");
  });

  it("does not allow an existing private unlock to be replaced", async () => {
    const { services } = await service();
    await services.configureVocabularyUnlock("first-local-value");
    await expect(services.configureVocabularyUnlock("different-local-value")).rejects.toThrow("Clear the existing");
    expect(services.unlockVocabulary("different-local-value")).toBe(false);
    expect(services.unlockVocabulary("first-local-value")).toBe(true);
  });

  it("serializes clear after pending saves without resurrecting the cache", async () => {
    const { root, services } = await service();
    await services.configureVocabularyUnlock("race-value");
    expect(services.unlockVocabulary("race-value")).toBe(true);
    const saving = services.saveVocabulary(new TextEncoder().encode('{"schemaVersion":1,"entries":{"Alpha":"Beta"}}'));
    const results = await Promise.allSettled([saving, services.clearVocabulary()]);
    expect(results[1].status).toBe("fulfilled");
    expect(services.vocabularyStatus().loaded).toBe(false);
    await expect(readFile(join(root, "vocabulary.bin"))).rejects.toThrow();
    await expect(readFile(join(root, "vocabulary-unlock.bin"))).rejects.toThrow();
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

  it("only accepts fixed notification identifiers from the renderer", async () => {
    const { services } = await service();
    expect(() => services.publishNotification('neutral private fixture')).toThrow('Unknown notification');
    const event = await services.publishNotification('settings-saved');
    expect(event.title).toBe('Settings saved');
    expect(services.listNotifications()).toHaveLength(1);
  });

  it("uses an installation key for history and rejects the known zero key", async () => {
    const { root, services } = await service();
    const revision = await services.recordHistory({ stableRecordId: 'neutral-record', action: 'created', label: 'Created local record', snapshot: new TextEncoder().encode('neutral data') });
    expect(() => decryptSnapshot(revision.snapshot!, new Uint8Array(32), 'neutral-record')).toThrow();
    const before = await readFile(join(root, 'history-key.bin'));
    const restarted = new DesktopServices({ dataDirectory: root, vocabularyCrypto: { seal: (bytes) => new Uint8Array(bytes).map((byte) => byte ^ 0xa5), unseal: (bytes) => new Uint8Array(bytes).map((byte) => byte ^ 0xa5) } });
    await restarted.ready();
    expect(await readFile(join(root, 'history-key.bin'))).toEqual(before);
    const key = new Uint8Array(before).map((byte) => byte ^ 0xa5);
    expect(new TextDecoder().decode(decryptSnapshot(revision.snapshot!, key, 'neutral-record'))).toBe('neutral data');
  });

  it("refuses sensitive snapshots when protected storage is unavailable", async () => {
    const root = await mkdtemp(join(tmpdir(), 'wording-lens-no-vault-')); roots.push(root);
    const services = new DesktopServices({ dataDirectory: root });
    await services.ready();
    await expect(services.recordHistory({ stableRecordId: 'neutral-record', action: 'created', label: 'Created local record', snapshot: new Uint8Array([1]) })).rejects.toThrow('unavailable');
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

  it("exposes security, download, and honest unavailable status routes", async () => {
    const { services } = await service();
    const lock = await services.createLock("settings.accent", "PIN", { kind: "minutes", minutes: 5 }, { pin: "1234" });
    expect(services.listLocks()[0].credentialReferences.present).toEqual(["pin"]);
    expect((await services.unlockLock(lock.id, { pin: "1234" })).unlocked).toBe(true);
    const pairing = services.createTotpPairing({ issuer: "Wording Lens", account: "local", secret: "JBSWY3DPEHPK3PXP" });
    expect(pairing.uri).toMatch(/^otpauth:\/\/totp\//u);
    expect(services.verifyTotp("JBSWY3DPEHPK3PXP", generateTotpCode("JBSWY3DPEHPK3PXP")).valid).toBe(true);
    expect(services.createSupportTicket("lock-recovery", "Need local recovery", "normal").status).toBe("received");
    expect(services.statusHubState()).toEqual({ available: false, reason: "client-library-unavailable" });
    expect(services.downloadBridgeStatus()).toEqual({ available: false, reason: "native-host-not-installed" });
    const started = services.startDownload({ schemaVersion: 1, captureId: "capture-1", fileName: "report.txt", sourceUrl: "https://example.invalid/report.txt", destination: "downloads", requestedAt: new Date().toISOString(), userInvoked: true, alwaysOnTop: true });
    expect(started.ok).toBe(true);
    expect(services.downloadStatus()[0]).toMatchObject({ captureId: "capture-1", fileName: "[redacted]", source: "[redacted]" });
    expect(JSON.stringify(await services.exportHistory())).not.toContain("JBSWY3DPEHPK3PXP");
  });

  it("restores a saved lock in the locked state after restart", async () => {
    const { root, services } = await service();
    const lock = await services.createLock('settings.theme', 'PIN', { kind: 'until-app-closes' }, { pin: '2468' });
    expect((await services.unlockLock(lock.id, { pin: '2468' })).unlocked).toBe(true);
    const restarted = new DesktopServices({ dataDirectory: root, vocabularyCrypto: { seal: (bytes) => new Uint8Array(bytes).map((byte) => byte ^ 0xa5), unseal: (bytes) => new Uint8Array(bytes).map((byte) => byte ^ 0xa5) } });
    await restarted.ready();
    expect(restarted.listLocks()).toHaveLength(1);
    expect((await restarted.unlockLock(lock.id, { pin: '0000' })).unlocked).toBe(false);
    expect((await restarted.unlockLock(lock.id, { pin: '2468' })).unlocked).toBe(true);
    expect(await readFile(join(root, 'locks.json'), 'utf8')).not.toContain('2468');
  });
});
