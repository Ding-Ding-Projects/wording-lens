#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
const root = resolve(arg("--root", defaultRoot));
const inventoryPath = resolve(arg("--inventory", join(root, "design", "parity-inventory.json")));

function fail(message) {
  console.error(`DESIGN_REFERENCE_GUARD_FAIL: ${message}`);
  process.exitCode = 1;
}
function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
}
function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
}
function routeParams(value, label) {
  requireString(value, label);
  const route = new URL(value, "file:///");
  const query = route.hash.includes("?") ? route.hash.slice(route.hash.indexOf("?") + 1) : route.search.slice(1);
  const params = new URLSearchParams(query);
  if (!params.get("screen") && route.hash) {
    const fragmentPath = route.hash.slice(1).split("?")[0].replace(/^\//, "");
    if (fragmentPath) params.set("screen", fragmentPath);
  }
  for (const key of ["screen", "theme", "viewport", "scale"]) requireString(params.get(key), `${label} query ${key}`);
  return { pathname: route.pathname, params };
}

try {
  if (!existsSync(inventoryPath)) throw new Error(`inventory is missing: ${inventoryPath}`);
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  requireObject(inventory, "inventory");
  if (inventory.schemaVersion !== 1) throw new Error("inventory schemaVersion must be 1");
  requireString(inventory.sourceCommit, "inventory sourceCommit");
  requireString(inventory.referenceFile, "inventory referenceFile");
  requireString(inventory.referenceApp, "inventory referenceApp");
  requireString(inventory.realApp, "inventory realApp");
  if (!Array.isArray(inventory.rows) || inventory.rows.length === 0) throw new Error("inventory rows must be a non-empty hand-written list");
  const seen = new Set();
  const referencePath = resolve(root, inventory.referenceFile);
  if (!existsSync(referencePath)) throw new Error(`checked-in reference is missing: ${inventory.referenceFile}`);
  const referenceSource = readFileSync(referencePath, "utf8");

  const rowKeys = ["id", "label", "referenceSelector", "referenceAppRoute", "realAppRoute", "realAppRouteStatus", "state", "theme", "viewport", "displayScale", "materialDesignAudit", "evidence"];
  const auditKeys = ["components", "typography", "colorRoles", "shape", "elevation", "motion", "accessibility"];
  const evidenceKeys = ["status", "referenceRawCapture", "builtRawCapture", "sideBySide", "visualDiff", "intentionalDeviation"];
  for (const [index, row] of inventory.rows.entries()) {
    requireObject(row, `rows[${index}]`);
    for (const key of rowKeys) if (!(key in row)) throw new Error(`rows[${index}] is missing ${key}`);
    requireString(row.id, `rows[${index}].id`);
    if (seen.has(row.id)) throw new Error(`duplicate row id: ${row.id}`);
    seen.add(row.id);
    requireString(row.label, `${row.id}.label`);
    requireString(row.referenceSelector, `${row.id}.referenceSelector`);
    const referenceRoute = routeParams(row.referenceAppRoute, `${row.id}.referenceAppRoute`);
    const realRoute = routeParams(row.realAppRoute, `${row.id}.realAppRoute`);
    if (referenceRoute.pathname !== "/apps/design-reference/index.html") throw new Error(`${row.id}.referenceAppRoute must point to the design-reference viewer`);
    if (realRoute.pathname !== "/apps/desktop/") throw new Error(`${row.id}.realAppRoute must point to the production desktop route`);
    const referenceScreen = referenceRoute.params.get("screen");
    const realScreen = realRoute.params.get("screen");
    if (referenceScreen !== realScreen && !realRoute.params.get("overlay") && !realRoute.params.get("focus") && row.viewport.width >= 700) throw new Error(`${row.id} routes select different screens without an explicit overlay or focus target`);
    if (referenceRoute.params.get("theme") !== row.theme || realRoute.params.get("theme") !== row.theme) throw new Error(`${row.id} theme differs from its routes`);
    const expectedViewport = `${row.viewport.width}x${row.viewport.height}`;
    if (!Number.isInteger(row.viewport.width) || !Number.isInteger(row.viewport.height) || row.viewport.width < 320 || row.viewport.height < 240) throw new Error(`${row.id}.viewport must contain positive supported dimensions`);
    if (referenceRoute.params.get("viewport") !== expectedViewport || realRoute.params.get("viewport") !== expectedViewport) throw new Error(`${row.id} viewport differs from its routes`);
    if (String(row.displayScale) !== referenceRoute.params.get("scale") || String(row.displayScale) !== realRoute.params.get("scale")) throw new Error(`${row.id} displayScale differs from its routes`);
    if (!['dark', 'light'].includes(row.theme)) throw new Error(`${row.id}.theme must be dark or light`);
    for (const key of auditKeys) requireString(row.materialDesignAudit[key], `${row.id}.materialDesignAudit.${key}`);
    requireObject(row.evidence, `${row.id}.evidence`);
    for (const key of evidenceKeys) if (!(key in row.evidence)) throw new Error(`${row.id}.evidence is missing ${key}`);
    if (!['Pending', 'Verified'].includes(row.evidence.status)) throw new Error(`${row.id}.evidence.status must be Pending or Verified`);
    if (row.evidence.status === 'Pending') {
      for (const key of ["referenceRawCapture", "builtRawCapture", "sideBySide", "visualDiff"]) if (row.evidence[key] !== null) throw new Error(`${row.id}.${key} must be null while evidence is Pending`);
    } else {
      for (const key of ["referenceRawCapture", "builtRawCapture", "sideBySide", "visualDiff"]) {
        requireString(row.evidence[key], `${row.id}.evidence.${key}`);
        const evidencePath = isAbsolute(row.evidence[key]) ? row.evidence[key] : resolve(root, row.evidence[key]);
        if (!existsSync(evidencePath)) throw new Error(`${row.id}.evidence.${key} is stale or missing: ${row.evidence[key]}`);
      }
    }
    if (row.referenceSelector.startsWith("#") && !referenceSource.includes(`id="${row.referenceSelector.slice(1)}"`)) throw new Error(`${row.id} selector is absent from the checked-in reference`);
    if (row.referenceSelector.startsWith("[data-import-zone]") && !referenceSource.includes("data-import-zone")) throw new Error(`${row.id} selector is absent from the checked-in reference`);
    if (row.referenceSelector.startsWith("[data-od-id=")) {
      const value = row.referenceSelector.slice("[data-od-id=".length, -1).replace(/^['"]|['"]$/g, "");
      if (!new RegExp(`data-od-id=["']${value}["']`).test(referenceSource)) throw new Error(`${row.id} selector is absent from the checked-in reference`);
    }
  }
  console.log(`DESIGN_REFERENCE_GUARD_PASS: ${inventory.rows.length} hand-written rows, ${seen.size} unique ids, ${inventory.rows.filter((row) => row.evidence.status === "Pending").length} Pending evidence rows`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
