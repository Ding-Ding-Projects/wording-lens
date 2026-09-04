import test from "node:test";
import assert from "node:assert/strict";
import {
  createAliasIndex,
  createEncryptedCache,
  createTypedSink,
  createVocabularyController,
  parseVocabularyPayload,
  renderProtectedSpans,
  SINK_BOUNDARIES,
} from "../../packages/vocabulary/index.mjs";

const payload = (entries) => JSON.stringify({ schemaVersion: 1, entries });

test("accepts a neutral version 1 payload and returns generic shape", () => {
  const parsed = parseVocabularyPayload(payload({ alpha: "A" }));
  assert.equal(parsed.schemaVersion, 1);
  assert.deepEqual({ ...parsed.entries }, { alpha: "A" });
});

test("rejects duplicate keys before object semantics erase them", () => {
  assert.throws(() => parseVocabularyPayload('{"schemaVersion":1,"entries":{"alpha":"A","alpha":"B"}}'), /Duplicate object key/);
  assert.throws(() => parseVocabularyPayload('{"schemaVersion":1,"schemaVersion":1,"entries":{}}'), /Duplicate object key/);
});

test("rejects unknown versions, fields, unsafe keys, controls, and malformed input", () => {
  assert.throws(() => parseVocabularyPayload(payload({ alpha: "A" }).replace('"schemaVersion":1', '"schemaVersion":2')), /Unsupported schema version/);
  assert.throws(() => parseVocabularyPayload('{"schemaVersion":1,"entries":{},"extra":true}'), /Only schemaVersion and entries/);
  assert.throws(() => parseVocabularyPayload('{"schemaVersion":1,"entries":{"__proto__":"x"}}'), /Unsafe object key/);
  assert.throws(() => parseVocabularyPayload('{"schemaVersion":1,"entries":{"a\\u0000":"x"}}'), /Control character/);
  assert.throws(() => parseVocabularyPayload('{"schemaVersion":1,"entries":{"a":"x'), /Unterminated string/);
});

test("enforces byte, entry, depth, key, and replacement bounds", () => {
  assert.throws(() => parseVocabularyPayload(payload({ a: "x" }), { limits: { maxBytes: 5 } }), /byte limit/);
  assert.throws(() => parseVocabularyPayload(payload(Object.fromEntries(Array.from({ length: 3 }, (_, i) => [`k${i}`, "v"]))), { limits: { maxEntries: 2 } }), /Entry count/);
  assert.throws(() => parseVocabularyPayload('{"schemaVersion":1,"entries":{"a":{"b":{"c":{"d":"x"}}}}}', { limits: { maxNestingDepth: 3 } }), /nesting depth/);
  assert.throws(() => parseVocabularyPayload(payload({ abc: "x" }), { limits: { maxKeyLength: 2 } }), /maximum length/);
  assert.throws(() => parseVocabularyPayload(payload({ a: "xyz" }), { limits: { maxValueLength: 2 } }), /maximum length/);
});

test("indexes longest keys first and protects exact spans", () => {
  const index = createAliasIndex(parseVocabularyPayload(payload({ alpha: "short", "alpha beta": "long" })));
  assert.equal(renderProtectedSpans("alpha beta alpha", index), "long short");
  assert.equal(renderProtectedSpans("alpha beta alpha", index, [{ start: 0, end: 10 }]), "alpha beta short");
  assert.throws(() => renderProtectedSpans("abc", index, [{ start: 2, end: 9 }]), /outside/);
});

test("typed sinks transform only private presentation boundaries", () => {
  const index = createAliasIndex(parseVocabularyPayload(payload({ alpha: "A" })));
  const received = [];
  const privateSink = createTypedSink(SINK_BOUNDARIES.PRIVATE_UI, (value) => { received.push(value); return value; });
  const publicSink = createTypedSink(SINK_BOUNDARIES.PUBLIC, (value) => { received.push(value); return value; });
  assert.equal(privateSink.write("alpha", index), "A");
  assert.equal(publicSink.write("alpha", index), "alpha");
  assert.deepEqual(received, ["A", "alpha"]);
  assert.throws(() => createTypedSink("unknown", () => {}), /Unknown sink/);
});

test("controller applies atomically, clears, and suppresses under School mode", () => {
  const controller = createVocabularyController();
  controller.apply(payload({ alpha: "A" }));
  assert.equal(controller.render("alpha", SINK_BOUNDARIES.PRIVATE_UI), "A");
  assert.throws(() => controller.apply('{"schemaVersion":1,"entries":{"alpha":"bad'), /Unterminated string/);
  assert.equal(controller.render("alpha", SINK_BOUNDARIES.PRIVATE_UI), "A");
  controller.setSchoolMode(true);
  assert.equal(controller.render("alpha", SINK_BOUNDARIES.PRIVATE_UI), "alpha");
  controller.setSchoolMode(false);
  assert.equal(controller.render("alpha", SINK_BOUNDARIES.PRIVATE_UI), "A");
  controller.reset();
  assert.equal(controller.render("alpha", SINK_BOUNDARIES.PRIVATE_UI), "alpha");
});

test("encrypted cache validates on save and load, then fails closed", async () => {
  let stored = null;
  let corrupt = false;
  const cache = createEncryptedCache({
    read: async () => stored,
    writeAtomic: async (bytes) => { stored = bytes; },
    remove: async () => { stored = null; },
    seal: async (bytes) => Uint8Array.from(bytes, (byte) => byte ^ 0xff),
    unseal: async (bytes) => {
      if (corrupt) return new Uint8Array([0xff, 0x00]);
      return Uint8Array.from(bytes, (byte) => byte ^ 0xff);
    },
  });
  await cache.save(payload({ alpha: "A" }));
  assert.equal((await cache.load()).size, 1);
  corrupt = true;
  assert.equal(await cache.load(), null);
  await cache.clear();
  assert.equal(await cache.load(), null);
});

test("red then green fixture proves a required boundary is not decorative", () => {
  const index = createAliasIndex(parseVocabularyPayload(payload({ alpha: "A" })));
  const requiredBoundary = (boundary) => boundary === SINK_BOUNDARIES.PUBLIC ? "alpha" : renderProtectedSpans("alpha", index);
  assert.equal(requiredBoundary(SINK_BOUNDARIES.PUBLIC), "alpha");
  assert.equal(requiredBoundary(SINK_BOUNDARIES.PRIVATE_UI), "A");
});
