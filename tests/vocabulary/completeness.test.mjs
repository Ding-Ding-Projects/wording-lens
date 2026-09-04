import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertVocabularyCompleteness } from "./completeness.mjs";

const inventoryUrl = new URL("../../contracts/vocabulary-completeness.v1.json", import.meta.url);

test("hand-written privacy inventory names every required surface exactly once", async () => {
  const inventory = JSON.parse(await readFile(inventoryUrl, "utf8"));
  assert.doesNotThrow(() => assertVocabularyCompleteness(inventory));
});

test("red then green inventory fixture catches a removed surface", async () => {
  const inventory = JSON.parse(await readFile(inventoryUrl, "utf8"));
  const saved = inventory.surfaces;
  inventory.surfaces = saved.filter((surface) => surface.id !== "typed-sinks");
  assert.throws(() => assertVocabularyCompleteness(inventory), /typed-sinks/);
  inventory.surfaces = saved;
  assert.doesNotThrow(() => assertVocabularyCompleteness(inventory));
});
