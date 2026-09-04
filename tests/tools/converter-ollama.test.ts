import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { it as test } from "vitest";
import { atomicWriteValidated, createDefaultAdapterRegistry, detectSignature, MemoryQueueStore, ResumableQueue, validateOutput, validatePdfOperation } from "../../packages/converter/src/index";
import { assessFit, attachmentDecision, createOllamaApi, createSnapshot, preflightHarness, refreshCatalog, validateHarnessProfile } from "../../packages/ollama/src/index";

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

test("atomic output validation preserves an existing destination on rejection", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wording-lens-converter-"));
  const destination = join(directory, "result.pdf");
  try {
    await writeFile(destination, new TextEncoder().encode("prior valid output"));
    const result = await atomicWriteValidated(destination, new TextEncoder().encode("not a pdf"), "pdf");
    assert.equal(result.valid, false);
    assert.equal(new TextDecoder().decode(await readFile(destination)), "prior valid output");
  } finally { await rm(directory, { recursive: true, force: true }); }
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

test("Ollama streams enforce pending bytes, total bytes, line count, and cancellation", async () => {
  const responseFor = (payload: string): Response => new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(payload)); controller.close(); } }), { status: 200 });
  const pendingApi = createOllamaApi("http://127.0.0.1:11434", async () => responseFor("123456789"), 1_000, 8, 100, 10);
  await assert.rejects(pendingApi.stream("/api/chat", {}, () => undefined), /line exceeds/);
  const totalApi = createOllamaApi("http://127.0.0.1:11434", async () => responseFor("x\nx\nx\nx\nx\nx\nx\nx\nx\nx\n"), 1_000, 8, 10, 100);
  await assert.rejects(totalApi.stream("/api/chat", {}, () => undefined), /stream exceeds/);
  const linesApi = createOllamaApi("http://127.0.0.1:11434", async () => responseFor("x\nx\nx\n"), 1_000, 8, 100, 2);
  await assert.rejects(linesApi.stream("/api/chat", {}, () => undefined), /line limit/);
  const controller = new AbortController(); controller.abort();
  const cancelledApi = createOllamaApi("http://127.0.0.1:11434", async () => responseFor("x\n"), 1_000, 8, 100, 100);
  await assert.rejects(cancelledApi.stream("/api/chat", {}, () => undefined, controller.signal), /cancelled/);
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
  assert.ok(validateHarnessProfile(profile).some((blocker) => blocker.includes("host-owned")));
  const proof = { source: "host-registry", executable: profile.executable, arguments: profile.arguments, workingDirectoryPolicy: "exact", workingDirectory: profile.workingDirectory, bundled: true, proofId: "bundle-proof-1", sha256: "a".repeat(64) } as const;
  assert.deepEqual(validateHarnessProfile(profile, proof), []);
  assert.equal(preflightHarness(profile, "model:latest", proof).ok, true);
  assert.ok(Object.keys(createSnapshot({ MODE: "local", API_TOKEN: "redacted", telemetry: "sensitive" }, ["MODE"]).values).includes("MODE"));
  assert.ok(!Object.keys(createSnapshot({ MODE: "local", API_TOKEN: "redacted", telemetry: "sensitive" }, ["MODE"]).values).includes("telemetry"));
  assert.ok(!Object.keys(createSnapshot({ MODE: "local", API_TOKEN: "redacted", telemetry: "sensitive" }, ["MODE"]).values).includes("API_TOKEN"));
});
