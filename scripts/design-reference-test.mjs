#!/usr/bin/env node
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const check = join(root, "scripts", "design-reference-check.mjs");
const inventoryPath = join(root, "design", "parity-inventory.json");
const viewer = readFileSync(join(root, "apps", "design-reference", "index.html"), "utf8");
const main = readFileSync(join(root, "apps", "design-reference", "main.mjs"), "utf8");
function run(path = inventoryPath) { return spawnSync(process.execPath, [check, "--root", root, "--inventory", path], { encoding: "utf8" }); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function mutate(mutator) {
  const temp = mkdtempSync(join(tmpdir(), "wording-lens-parity-"));
  const copy = join(temp, "parity-inventory.json");
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  mutator(inventory);
  writeFileSync(copy, JSON.stringify(inventory, null, 2));
  try { return run(copy); } finally { rmSync(temp, { recursive: true, force: true }); }
}

const baseline = run();
assert(baseline.status === 0 && baseline.stdout.includes("DESIGN_REFERENCE_GUARD_PASS"), "baseline guard did not pass");
const missingRoute = mutate((inventory) => { delete inventory.rows[0].realAppRoute; });
assert(missingRoute.status !== 0 && missingRoute.stderr.includes("realAppRoute"), "missing real route did not turn the guard red");
const missingAudit = mutate((inventory) => { delete inventory.rows[1].materialDesignAudit.accessibility; });
assert(missingAudit.status !== 0 && missingAudit.stderr.includes("accessibility"), "missing design audit field did not turn the guard red");
const missingEvidence = mutate((inventory) => { delete inventory.rows[2].evidence.visualDiff; });
assert(missingEvidence.status !== 0 && missingEvidence.stderr.includes("visualDiff"), "missing evidence field did not turn the guard red");
const duplicate = mutate((inventory) => { inventory.rows[1].id = inventory.rows[0].id; });
assert(duplicate.status !== 0 && duplicate.stderr.includes("duplicate row id"), "duplicate row id did not turn the guard red");
const restored = run();
assert(restored.status === 0 && restored.stdout.includes("DESIGN_REFERENCE_GUARD_PASS"), "restored inventory did not return green");
assert(viewer.includes("../../design/wording-lens-operations-cockpit.html"), "viewer does not directly render the checked-in reference");
for (const key of ["screen", "theme", "viewport", "scale"]) assert(viewer.includes(`id=\"${key}\"`), `viewer lacks deterministic ${key} selector`);
assert(viewer.includes("URLSearchParams") && viewer.includes("frame.src ="), "viewer lacks query-addressable route behavior");
assert(main.includes('loadFile(join(here, "index.html"))'), "plain Electron viewer does not load its own entry");
console.log("DESIGN_REFERENCE_TEST_PASS: baseline green, four exact break probes red, restored green, direct-source and deterministic-route checks green");
