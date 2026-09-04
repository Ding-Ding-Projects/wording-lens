import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultAdapterRegistry, detectSignature, MemoryQueueStore, ResumableQueue, validateOutput, validatePdfOperation } from "../../packages/converter/src/index";
import { assessFit, attachmentDecision, createSnapshot, preflightHarness, refreshCatalog, validateHarnessProfile } from "../../packages/ollama/src/index";

test("converter catalog exposes all required categories and keeps unproven adapters disabled", () => {
  const registry = createDefaultAdapterRegistry();
  const catalog = registry.catalog();
  assert.deepEqual(catalog.missingCategories, []);
  assert.ok(registry.all().every((adapter) => adapter.availability === "disabled"));
  assert.ok(registry.all().every((adapter) => adapter.packagedProof.status === "missing"));
});

test("byte signatures do not trust a misleading extension", () => {
  const pdf = detectSignature(new TextEncoder().encode("%PDF-1.7\n"));
  assert.equal(pdf.format, "pdf");
  assert.equal(pdf.category, "documents-pdf");
  const json = detectSignature(new TextEncoder().encode('{"ok":true}'));
  assert.equal(json.format, "json");
});

test("output validation rejects wrong and empty output", () => {
  assert.equal(validateOutput(new Uint8Array(), "pdf").valid, false);
  assert.equal(validateOutput(new TextEncoder().encode("not pdf"), "pdf").valid, false);
});

test("pdf operation validation covers page and merge boundaries", () => {
  assert.equal(validatePdfOperation({ kind: "reorder", pages: [1, 2, 1] }), "Reorder pages must not contain duplicates.");
  assert.equal(validatePdfOperation({ kind: "merge", inputs: [] }), "Merge requires at least one input.");
  assert.equal(validatePdfOperation({ kind: "rotate", pages: [{ page: 1, degrees: 90 }] }), undefined);
});

test("queue consumes an async stream with bounded concurrency and durable records", async () => {
  const store = new MemoryQueueStore<{ value: number }>();
  const queue = new ResumableQueue(store);
  let active = 0; let peak = 0;
  async function* input() { for (let i = 0; i < 7; i += 1) yield { id: `item-${i}`, input: { value: i } }; }
  const summary = await queue.run({ input: input(), maxConcurrent: 2, store, worker: async (item) => { active += 1; peak = Math.max(peak, active); await new Promise((resolve) => setTimeout(resolve, 2)); active -= 1; return { sourceId: String(item.value), status: item.value === 3 ? "skipped" : "converted" }; } });
  assert.equal(peak, 2);
  assert.equal(summary.totalSeen, 7);
  assert.equal(summary.converted, 6);
  assert.equal(summary.skipped, 1);
});

test("catalog refresh follows every page and retains a stale snapshot on failure", async () => {
  const healthy = await refreshCatalog(async (cursor) => cursor ? { items: [{ name: "b", capabilities: [], source: "catalog" }], revision: "r1" } : { items: [{ name: "a", capabilities: [], source: "catalog" }], next: "next", revision: "r1" });
  assert.equal(healthy.complete, true);
  assert.equal(healthy.pages, 2);
  assert.deepEqual(healthy.items.map((item) => item.name), ["a", "b"]);
  const stale = await refreshCatalog(async () => { throw new Error("offline"); }, healthy);
  assert.equal(stale.complete, false);
  assert.equal(stale.stale, true);
  assert.equal(stale.error, "offline");
  assert.equal(stale.items.length, 2);
});

test("hardware fit is evidence-backed and conservative", () => {
  const unknown = assessFit({ name: "model", capabilities: [], source: "catalog" }, { capturedAt: new Date().toISOString() });
  assert.equal(unknown.verdict, "Unknown");
  const likely = assessFit({ name: "model", sizeBytes: 100, contextWindow: 1_000, capabilities: [], source: "catalog" }, { ramBytes: 10_000_000, freeDiskBytes: 10_000_000, capturedAt: new Date().toISOString() });
  assert.equal(likely.verdict, "Runs well");
  assert.ok(likely.assumptions.length > 0);
});

test("attachment capability gaps are visible and harness launch is allowlisted", () => {
  assert.equal(attachmentDecision([], { name: "photo.png", mime: "image/png", bytes: 3 }).allowed, false);
  const profile = { id: "local", label: "Local harness", executable: "C:\\Tools\\harness.exe", arguments: ["--model"], workingDirectory: "C:\\Tools", environment: { MODE: "local" }, requiredPorts: [11434], requiredFiles: [], bundled: true, allowlisted: true } as const;
  assert.deepEqual(validateHarnessProfile(profile), []);
  assert.equal(preflightHarness(profile, "model:latest").ok, true);
  assert.ok(Object.keys(createSnapshot({ MODE: "local", API_TOKEN: "redacted" }).values).includes("MODE"));
  assert.ok(!Object.keys(createSnapshot({ MODE: "local", API_TOKEN: "redacted" }).values).includes("API_TOKEN"));
});
