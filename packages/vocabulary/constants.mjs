export const SCHEMA_VERSION = 1;

// These limits are deliberately small enough for an interactive local overlay.
// They protect parsing and rendering without putting a total-file ceiling on the
// application that owns the control.
export const LIMITS = Object.freeze({
  maxBytes: 256 * 1024,
  maxEntries: 4096,
  maxKeyLength: 160,
  maxValueLength: 1000,
  maxNestingDepth: 2,
});

export const UNSAFE_KEYS = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

export const SINK_BOUNDARIES = Object.freeze({
  PRIVATE_UI: "private-ui",
  ACCESSIBLE_NAME: "accessible-name",
  PUBLIC: "public",
  LOG: "log",
  EXPORT: "export",
  HISTORY: "history",
  TELEMETRY: "telemetry",
  PROMPT: "prompt",
  CAPTURE: "capture",
  DIAGNOSTIC: "diagnostic",
});

export const PRIVATE_SINKS = new Set([
  SINK_BOUNDARIES.PRIVATE_UI,
  SINK_BOUNDARIES.ACCESSIBLE_NAME,
]);
