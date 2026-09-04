import { LIMITS, PRIVATE_SINKS, SINK_BOUNDARIES } from "./constants.mjs";
import { parseVocabularyPayload, validateVocabularyPayload } from "./parse.mjs";

function assertIndexEntry(key, value) {
  if (typeof key !== "string" || key.length === 0 || typeof value !== "string") {
    throw new TypeError("Index entries must have string text");
  }
}

export function createAliasIndex(payload, options = {}) {
  const validated = validateVocabularyPayload(payload, options);
  const entries = Object.keys(validated.entries).map((key) => [key, validated.entries[key]]);
  for (const [key, value] of entries) assertIndexEntry(key, value);
  entries.sort((left, right) => right[0].length - left[0].length || left[0].localeCompare(right[0]));
  return Object.freeze({
    schemaVersion: validated.schemaVersion,
    size: entries.length,
    entries: Object.freeze(entries.map(([key, value]) => Object.freeze({ key, value }))),
    lookup(key) {
      const found = entries.find(([candidate]) => candidate === key);
      return found?.[1];
    },
  });
}

function normalizeProtectedSpans(spans, textLength) {
  const sorted = [...(spans ?? [])].map((span) => {
    if (!span || !Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.end < span.start || span.end > textLength) {
      throw new RangeError("Protected span is outside the text");
    }
    return { start: span.start, end: span.end };
  }).sort((a, b) => a.start - b.start || a.end - b.end);
  const result = [];
  for (const span of sorted) {
    const previous = result[result.length - 1];
    if (previous && span.start < previous.end) {
      previous.end = Math.max(previous.end, span.end);
    } else result.push(span);
  }
  return result;
}

export function renderProtectedSpans(text, index, protectedSpans = []) {
  if (typeof text !== "string") throw new TypeError("Text must be a string");
  if (!index || !Array.isArray(index.entries)) throw new TypeError("A compiled alias index is required");
  const protectedRanges = normalizeProtectedSpans(protectedSpans, text.length);
  let rangeIndex = 0;
  let output = "";
  let position = 0;
  while (position < text.length) {
    const active = protectedRanges[rangeIndex];
    if (active && position >= active.start) {
      output += text.slice(active.start, active.end);
      position = active.end;
      rangeIndex += 1;
      continue;
    }
    let match;
    for (const entry of index.entries) {
      if (text.startsWith(entry.key, position)) {
        match = entry;
        break;
      }
    }
    if (match) {
      output += match.value;
      position += match.key.length;
    } else {
      output += text[position];
      position += 1;
    }
  }
  return output;
}

export function renderToSink({ text, index, boundary, protectedSpans = [] }) {
  if (typeof text !== "string") throw new TypeError("Text must be a string");
  if (!Object.values(SINK_BOUNDARIES).includes(boundary)) throw new TypeError("Unknown sink boundary");
  if (!PRIVATE_SINKS.has(boundary)) return text;
  return renderProtectedSpans(text, index, protectedSpans);
}

export function createTypedSink(boundary, writer) {
  if (!Object.values(SINK_BOUNDARIES).includes(boundary)) throw new TypeError("Unknown sink boundary");
  if (typeof writer !== "function") throw new TypeError("Sink writer must be a function");
  return Object.freeze({
    boundary,
    write(text, index, protectedSpans = []) {
      if (typeof text !== "string") throw new TypeError("Sink text must be a string");
      const rendered = renderToSink({ text, index, boundary, protectedSpans });
      return writer(rendered);
    },
  });
}

export function createVocabularyController(options = {}) {
  const limits = { ...LIMITS, ...(options.limits ?? {}) };
  let loadedIndex = null;
  let schoolMode = false;
  let generation = 0;

  function status() {
    return Object.freeze({ loaded: loadedIndex !== null, active: loadedIndex !== null && !schoolMode, schoolMode, generation });
  }

  return Object.freeze({
    apply(rawPayload) {
      const parsed = parseVocabularyPayload(rawPayload, { limits });
      const nextIndex = createAliasIndex(parsed, { limits });
      loadedIndex = nextIndex;
      generation += 1;
      return status();
    },
    clear() {
      loadedIndex = null;
      generation += 1;
      return status();
    },
    reset() {
      loadedIndex = null;
      generation += 1;
      return status();
    },
    setSchoolMode(enabled) {
      if (typeof enabled !== "boolean") throw new TypeError("School mode must be boolean");
      schoolMode = enabled;
      generation += 1;
      return status();
    },
    status,
    render(text, boundary, protectedSpans = []) {
      if (schoolMode || loadedIndex === null) return text;
      return renderToSink({ text, index: loadedIndex, boundary, protectedSpans });
    },
    getIndexForPrivateUse() {
      return loadedIndex;
    },
  });
}

export { LIMITS, SINK_BOUNDARIES, parseVocabularyPayload, validateVocabularyPayload };
export { createEncryptedCache } from "./cache.mjs";
