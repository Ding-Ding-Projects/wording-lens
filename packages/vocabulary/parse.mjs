import { LIMITS, SCHEMA_VERSION, UNSAFE_KEYS } from "./constants.mjs";

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u;

class BoundedJsonParser {
  constructor(source, limits) {
    this.source = source;
    this.limits = limits;
    this.offset = 0;
    this.depth = 0;
  }

  error(message) {
    throw new SyntaxError(`${message} at byte ${this.offset}`);
  }

  skipWhitespace() {
    while (this.offset < this.source.length && /[\t\n\r ]/u.test(this.source[this.offset])) this.offset += 1;
  }

  expect(character) {
    if (this.source[this.offset] !== character) this.error(`Expected ${character}`);
    this.offset += 1;
  }

  parse() {
    this.skipWhitespace();
    const value = this.parseValue();
    this.skipWhitespace();
    if (this.offset !== this.source.length) this.error("Trailing JSON content");
    return value;
  }

  parseValue() {
    this.skipWhitespace();
    const character = this.source[this.offset];
    if (character === "{") return this.parseObject();
    if (character === "[") return this.parseArray();
    if (character === '"') return this.parseString();
    if (character === "-" || /[0-9]/u.test(character ?? "")) return this.parseNumber();
    for (const [literal, value] of [["true", true], ["false", false], ["null", null]]) {
      if (this.source.startsWith(literal, this.offset)) {
        this.offset += literal.length;
        return value;
      }
    }
    this.error("Invalid JSON value");
  }

  enterObject() {
    this.depth += 1;
    if (this.depth > this.limits.maxNestingDepth) this.error("Maximum nesting depth exceeded");
  }

  leaveObject() { this.depth -= 1; }

  parseObject() {
    this.expect("{");
    this.enterObject();
    const result = Object.create(null);
    const keys = new Set();
    this.skipWhitespace();
    if (this.source[this.offset] === "}") {
      this.offset += 1;
      this.leaveObject();
      return result;
    }
    while (true) {
      this.skipWhitespace();
      if (this.source[this.offset] !== '"') this.error("Object key must be a string");
      const key = this.parseString();
      this.validateKey(key);
      if (keys.has(key)) this.error("Duplicate object key");
      keys.add(key);
      this.skipWhitespace();
      this.expect(":");
      result[key] = this.parseValue();
      this.skipWhitespace();
      if (this.source[this.offset] === "}") {
        this.offset += 1;
        this.leaveObject();
        return result;
      }
      this.expect(",");
    }
  }

  parseArray() {
    this.expect("[");
    this.enterObject();
    const result = [];
    this.skipWhitespace();
    if (this.source[this.offset] === "]") {
      this.offset += 1;
      this.leaveObject();
      return result;
    }
    while (true) {
      result.push(this.parseValue());
      this.skipWhitespace();
      if (this.source[this.offset] === "]") {
        this.offset += 1;
        this.leaveObject();
        return result;
      }
      this.expect(",");
    }
  }

  parseString() {
    const start = this.offset;
    this.expect('"');
    let escaped = false;
    while (this.offset < this.source.length) {
      const character = this.source[this.offset];
      this.offset += 1;
      if (escaped) {
        escaped = false;
        if (character === "u") {
          const code = this.source.slice(this.offset, this.offset + 4);
          if (!/^[0-9a-f]{4}$/iu.test(code)) this.error("Invalid unicode escape");
          this.offset += 4;
        } else if (!/["\\/bfnrt]/u.test(character)) {
          this.error("Invalid string escape");
        }
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        const value = JSON.parse(this.source.slice(start, this.offset));
        this.validateString(value, "string");
        return value;
      } else if (character < " ") {
        this.error("Control character in string");
      }
    }
    this.error("Unterminated string");
  }

  parseNumber() {
    const match = this.source.slice(this.offset).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u);
    if (!match) this.error("Invalid number");
    this.offset += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) this.error("Non-finite number");
    return value;
  }

  validateString(value, label) {
    const max = label === "key" ? this.limits.maxKeyLength : this.limits.maxValueLength;
    if (value.length > max) this.error(`${label} exceeds maximum length`);
    if (CONTROL_CHARACTER.test(value)) this.error(`Control character in ${label}`);
  }

  validateKey(key) {
    this.validateString(key, "key");
    if (UNSAFE_KEYS.has(key)) this.error("Unsafe object key");
  }
}

function toUtf8String(input, limits) {
  let bytes;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else if (input instanceof Uint8Array) bytes = input;
  else if (ArrayBuffer.isView(input)) bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  else if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
  else throw new TypeError("Vocabulary payload must be text or bytes");
  if (bytes.byteLength > limits.maxBytes) throw new RangeError("Vocabulary payload exceeds the byte limit");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  return decoder.decode(bytes);
}

function validateShape(value, limits) {
  if (!value || Array.isArray(value) || typeof value !== "object") throw new TypeError("Root must be an object");
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes("schemaVersion") || !keys.includes("entries")) {
    throw new TypeError("Only schemaVersion and entries are allowed at the root");
  }
  if (value.schemaVersion !== SCHEMA_VERSION) throw new RangeError("Unsupported schema version");
  if (!value.entries || Array.isArray(value.entries) || typeof value.entries !== "object") {
    throw new TypeError("entries must be an object");
  }
  const entries = Object.create(null);
  const sourceKeys = Object.keys(value.entries);
  if (sourceKeys.length > limits.maxEntries) throw new RangeError("Entry count exceeds the limit");
  for (const key of sourceKeys) {
    if (UNSAFE_KEYS.has(key) || CONTROL_CHARACTER.test(key) || key.length === 0 || key.length > limits.maxKeyLength) {
      throw new TypeError("Entry key is unsafe or outside its bounds");
    }
    const replacement = value.entries[key];
    if (typeof replacement !== "string" || replacement.length > limits.maxValueLength) {
      throw new TypeError("Entry replacement must be a bounded string");
    }
    if (CONTROL_CHARACTER.test(replacement)) throw new TypeError("Entry replacement contains a control character");
    entries[key] = replacement;
  }
  return Object.freeze({ schemaVersion: SCHEMA_VERSION, entries: Object.freeze(entries) });
}

export function parseVocabularyPayload(input, options = {}) {
  const limits = { ...LIMITS, ...(options.limits ?? {}) };
  const source = toUtf8String(input, limits);
  const parsed = new BoundedJsonParser(source, limits).parse();
  return validateShape(parsed, limits);
}

export function validateVocabularyPayload(payload, options = {}) {
  return validateShape(payload, { ...LIMITS, ...(options.limits ?? {}) });
}

export { CONTROL_CHARACTER };
