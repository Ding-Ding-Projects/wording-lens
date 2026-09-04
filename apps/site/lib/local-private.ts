export const VOCABULARY_LIMITS = Object.freeze({
  maxBytes: 256 * 1024,
  maxEntries: 4096,
  maxDepth: 2,
  maxKeyLength: 160,
  maxValueLength: 1000,
});

export type PersonalVocabulary = Readonly<{
  schemaVersion: 1;
  entries: Readonly<Record<string, string>>;
}>;

export type LocalCredentialRecord = Readonly<{
  version: 1;
  algorithm: 'PBKDF2-SHA-256';
  iterations: 310000;
  salt: string;
  verifier: string;
}>;

export type EncryptedLocalValue = Readonly<{
  version: 1;
  algorithm: 'AES-GCM';
  iv: string;
  ciphertext: string;
}>;

const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor']);

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 31 || codePoint === 127) return true;
  }
  return false;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

class DuplicateAwareParser {
  private offset = 0;
  private depth = 0;

  constructor(private readonly source: string) {}

  parse(): unknown {
    this.skip();
    const value = this.value();
    this.skip();
    if (this.offset !== this.source.length) this.fail('Trailing JSON content');
    return value;
  }

  private fail(message: string): never {
    throw new Error(`${message} at character ${this.offset}`);
  }
  private skip(): void {
    while (/[\t\n\r ]/u.test(this.source[this.offset] ?? '')) this.offset += 1;
  }
  private take(expected: string): void {
    if (this.source[this.offset] !== expected)
      this.fail(`Expected ${expected}`);
    this.offset += 1;
  }

  private value(): unknown {
    this.skip();
    const current = this.source[this.offset];
    if (current === '{') return this.object();
    if (current === '[') return this.array();
    if (current === '"') return this.string();
    const number =
      /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u.exec(
        this.source.slice(this.offset),
      );
    if (number) {
      this.offset += number[0].length;
      return Number(number[0]);
    }
    for (const [literal, value] of [
      ['true', true],
      ['false', false],
      ['null', null],
    ] as const) {
      if (this.source.startsWith(literal, this.offset)) {
        this.offset += literal.length;
        return value;
      }
    }
    this.fail('Invalid JSON value');
  }

  private enter(): void {
    this.depth += 1;
    if (this.depth > VOCABULARY_LIMITS.maxDepth)
      this.fail('Maximum object depth exceeded');
  }
  private leave(): void {
    this.depth -= 1;
  }

  private object(): Record<string, unknown> {
    this.take('{');
    this.enter();
    this.skip();
    const result = Object.create(null) as Record<string, unknown>;
    const seen = new Set<string>();
    if (this.source[this.offset] === '}') {
      this.offset += 1;
      this.leave();
      return result;
    }
    while (true) {
      this.skip();
      if (this.source[this.offset] !== '"')
        this.fail('Object key must be a string');
      const key = this.string();
      if (seen.has(key)) this.fail('Duplicate object key');
      seen.add(key);
      this.skip();
      this.take(':');
      result[key] = this.value();
      this.skip();
      if (this.source[this.offset] === '}') {
        this.offset += 1;
        this.leave();
        return result;
      }
      this.take(',');
    }
  }

  private array(): unknown[] {
    this.take('[');
    this.enter();
    this.skip();
    const result: unknown[] = [];
    if (this.source[this.offset] === ']') {
      this.offset += 1;
      this.leave();
      return result;
    }
    while (true) {
      result.push(this.value());
      this.skip();
      if (this.source[this.offset] === ']') {
        this.offset += 1;
        this.leave();
        return result;
      }
      this.take(',');
    }
  }

  private string(): string {
    const start = this.offset;
    this.take('"');
    let escaped = false;
    while (this.offset < this.source.length) {
      const current = this.source[this.offset++];
      if (escaped) {
        escaped = false;
        if (current === 'u') {
          const code = this.source.slice(this.offset, this.offset + 4);
          if (!/^[0-9a-f]{4}$/iu.test(code))
            this.fail('Invalid Unicode escape');
          this.offset += 4;
        } else if (!/["\\/bfnrt]/u.test(current))
          this.fail('Invalid string escape');
      } else if (current === '\\') escaped = true;
      else if (current === '"')
        return JSON.parse(this.source.slice(start, this.offset)) as string;
      else if (current < ' ') this.fail('Control character in string');
    }
    this.fail('Unterminated string');
  }
}

function decodeVocabularySource(
  input: string | Uint8Array | ArrayBuffer,
): string {
  const bytes =
    typeof input === 'string'
      ? new TextEncoder().encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  if (bytes.byteLength > VOCABULARY_LIMITS.maxBytes)
    throw new Error('The file exceeds the supported byte limit.');
  if (typeof input === 'string') return input;
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function parsePersonalVocabulary(
  input: string | Uint8Array | ArrayBuffer,
): PersonalVocabulary {
  const source = decodeVocabularySource(input);
  const value = new DuplicateAwareParser(source).parse();
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('The root must be an object.');
  const root = value as Record<string, unknown>;
  if (
    Object.keys(root).sort().join(',') !== 'entries,schemaVersion' ||
    root.schemaVersion !== 1
  )
    throw new Error('The file does not use the supported version-1 structure.');
  if (
    !root.entries ||
    typeof root.entries !== 'object' ||
    Array.isArray(root.entries)
  )
    throw new Error('Entries must be a direct object.');
  const entries = Object.entries(root.entries as Record<string, unknown>);
  if (entries.length > VOCABULARY_LIMITS.maxEntries)
    throw new Error('The file has too many entries.');
  const normalized: Record<string, string> = Object.create(null);
  for (const [key, replacement] of entries) {
    if (
      unsafeKeys.has(key) ||
      key.length < 1 ||
      key.length > VOCABULARY_LIMITS.maxKeyLength ||
      hasControlCharacter(key)
    )
      throw new Error('An entry key is invalid.');
    if (
      typeof replacement !== 'string' ||
      replacement.length > VOCABULARY_LIMITS.maxValueLength ||
      hasControlCharacter(replacement)
    )
      throw new Error('An entry value is invalid.');
    normalized[key] = replacement;
  }
  return Object.freeze({
    schemaVersion: 1,
    entries: Object.freeze(normalized),
  });
}

async function derive(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: salt as BufferSource,
        iterations: 310000,
      },
      material,
      256,
    ),
  );
}

async function digest(value: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', value as BufferSource),
  );
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function createLocalCredential(
  password: string,
): Promise<{ record: LocalCredentialRecord; key: Uint8Array }> {
  if (typeof password !== 'string' || !password || password.length > 1024)
    throw new Error('Enter a local unlock value within the supported limit.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await derive(password, salt);
  const verifier = await digest(key);
  return {
    record: {
      version: 1,
      algorithm: 'PBKDF2-SHA-256',
      iterations: 310000,
      salt: bytesToBase64(salt),
      verifier: bytesToBase64(verifier),
    },
    key,
  };
}

export async function unlockLocalCredential(
  password: string,
  record: LocalCredentialRecord,
): Promise<Uint8Array | null> {
  if (
    typeof password !== 'string' ||
    password.length > 1024 ||
    !record ||
    record.version !== 1 ||
    record.algorithm !== 'PBKDF2-SHA-256' ||
    record.iterations !== 310000 ||
    typeof record.salt !== 'string' ||
    record.salt.length !== 24 ||
    typeof record.verifier !== 'string' ||
    record.verifier.length !== 44 ||
    Object.keys(record).sort().join(',') !==
      'algorithm,iterations,salt,verifier,version'
  )
    return null;
  try {
    const salt = base64ToBytes(record.salt);
    const verifier = base64ToBytes(record.verifier);
    if (salt.length !== 16 || verifier.length !== 32) return null;
    const key = await derive(password, salt);
    if (constantTimeEqual(await digest(key), verifier)) return key;
    key.fill(0);
    return null;
  } catch {
    return null;
  }
}

export async function encryptLocalValue(
  value: string,
  keyBytes: Uint8Array,
): Promise<EncryptedLocalValue> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    'AES-GCM',
    false,
    ['encrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(value),
  );
  return {
    version: 1,
    algorithm: 'AES-GCM',
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptLocalValue(
  value: EncryptedLocalValue,
  keyBytes: Uint8Array,
): Promise<string> {
  if (
    !value ||
    value.version !== 1 ||
    value.algorithm !== 'AES-GCM' ||
    typeof value.iv !== 'string' ||
    value.iv.length !== 16 ||
    typeof value.ciphertext !== 'string' ||
    value.ciphertext.length > 360_000 ||
    Object.keys(value).sort().join(',') !== 'algorithm,ciphertext,iv,version'
  )
    throw new Error('Unsupported local cache.');
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    'AES-GCM',
    false,
    ['decrypt'],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(value.iv) as BufferSource },
    key,
    base64ToBytes(value.ciphertext) as BufferSource,
  );
  return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
}
