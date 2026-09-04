/** Trusted main-process validation for the private local wording cache. */
export type VocabularyDocument = { schemaVersion: 1; entries: Record<string, string> };

const MAX_BYTES = 256 * 1024;
const MAX_ENTRIES = 4096;
const MAX_KEY_LENGTH = 160;
const MAX_VALUE_LENGTH = 1000;
const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function parseVocabularyBytes(bytes: Uint8Array): VocabularyDocument {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_BYTES) throw new RangeError("Vocabulary payload exceeds the byte limit");
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const parsed: unknown = JSON.parse(source);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new TypeError("Root must be an object");
  const root = parsed as Record<string, unknown>;
  const rootKeys = Object.keys(root);
  if (rootKeys.length !== 2 || !rootKeys.includes("schemaVersion") || !rootKeys.includes("entries") || root.schemaVersion !== 1) throw new TypeError("Unsupported vocabulary schema");
  if (!root.entries || typeof root.entries !== "object" || Array.isArray(root.entries)) throw new TypeError("entries must be an object");
  const entries: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [key, value] of Object.entries(root.entries as Record<string, unknown>)) {
    if (!key || key.length > MAX_KEY_LENGTH || UNSAFE_KEYS.has(key) || /[\u0000-\u001f\u007f]/u.test(key)) throw new TypeError("Entry key is unsafe or outside its bounds");
    if (typeof value !== "string" || value.length > MAX_VALUE_LENGTH || /[\u0000-\u001f\u007f]/u.test(value)) throw new TypeError("Entry replacement is unsafe or outside its bounds");
    entries[key] = value;
  }
  if (Object.keys(entries).length > MAX_ENTRIES) throw new RangeError("Entry count exceeds the limit");
  return Object.freeze({ schemaVersion: 1, entries: Object.freeze(entries) });
}
