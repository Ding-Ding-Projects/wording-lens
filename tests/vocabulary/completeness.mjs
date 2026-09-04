const REQUIRED_SURFACES = Object.freeze([
  "payload-parser",
  "alias-index",
  "typed-sinks",
  "atomic-controller",
  "encrypted-cache",
  "clear-reset",
  "school-mode-seam",
]);

export function assertVocabularyCompleteness(inventory, required = REQUIRED_SURFACES) {
  if (!inventory || inventory.schemaVersion !== 1 || inventory.feature !== "local-wording-overlay") {
    throw new Error("Vocabulary completeness inventory has an unsupported shape");
  }
  const surfaces = inventory.surfaces;
  if (!Array.isArray(surfaces)) throw new Error("Vocabulary completeness inventory has no surfaces");
  const ids = surfaces.map((surface) => surface?.id);
  for (const id of required) {
    if (ids.filter((candidate) => candidate === id).length !== 1) {
      throw new Error(`Vocabulary completeness surface ${id} must occur exactly once`);
    }
  }
  if (ids.length !== required.length) throw new Error("Vocabulary completeness inventory contains an unknown surface");
  for (const surface of surfaces) {
    if (typeof surface.implementation !== "string" || typeof surface.tests !== "string") {
      throw new Error(`Vocabulary completeness surface ${surface.id} lacks evidence links`);
    }
  }
  return true;
}

export { REQUIRED_SURFACES };
