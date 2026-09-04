import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VOCABULARY_LIMITS,
  createLocalCredential,
  decryptLocalValue,
  encryptLocalValue,
  parsePersonalVocabulary,
  unlockLocalCredential,
} from '../lib/local-private.ts';

function payload(entries: Record<string, string> = {}): string {
  return JSON.stringify({ schemaVersion: 1, entries });
}

void test('accepts the supported shape and preserves an empty replacement', () => {
  const result = parsePersonalVocabulary(payload({ alpha: 'beta', empty: '' }));
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.entries.alpha, 'beta');
  assert.equal(result.entries.empty, '');
});

void test('refuses malformed, duplicate, unsafe, deep, and unexpected input', () => {
  const refused = [
    '{',
    '{"schemaVersion":1,"schemaVersion":1,"entries":{}}',
    '{"schemaVersion":1,"entries":{"same":"one","same":"two"}}',
    '{"schemaVersion":1,"entries":{"__proto__":"value"}}',
    '{"schemaVersion":1,"entries":{"alpha":{"nested":"value"}}}',
    '{"schemaVersion":1,"entries":{},"extra":true}',
    '{"schemaVersion":2,"entries":{}}',
  ];
  for (const candidate of refused)
    assert.throws(() => parsePersonalVocabulary(candidate));
});

void test('enforces key, value, entry, and byte boundaries', () => {
  assert.equal(
    parsePersonalVocabulary(
      payload({ ['k'.repeat(VOCABULARY_LIMITS.maxKeyLength)]: 'v' }),
    ).schemaVersion,
    1,
  );
  assert.throws(() =>
    parsePersonalVocabulary(
      payload({ ['k'.repeat(VOCABULARY_LIMITS.maxKeyLength + 1)]: 'v' }),
    ),
  );
  assert.equal(
    parsePersonalVocabulary(
      payload({ key: 'v'.repeat(VOCABULARY_LIMITS.maxValueLength) }),
    ).schemaVersion,
    1,
  );
  assert.throws(() =>
    parsePersonalVocabulary(
      payload({ key: 'v'.repeat(VOCABULARY_LIMITS.maxValueLength + 1) }),
    ),
  );
  const entries: Record<string, string> = {};
  for (let index = 0; index < VOCABULARY_LIMITS.maxEntries; index += 1)
    entries[`key-${index}`] = '';
  assert.equal(
    Object.keys(parsePersonalVocabulary(payload(entries)).entries).length,
    VOCABULARY_LIMITS.maxEntries,
  );
  entries.overflow = '';
  assert.throws(() => parsePersonalVocabulary(payload(entries)));
  assert.throws(() =>
    parsePersonalVocabulary(' '.repeat(VOCABULARY_LIMITS.maxBytes + 1)),
  );
});

void test('uses fatal UTF-8 decoding for raw file bytes', () => {
  assert.throws(() => parsePersonalVocabulary(Uint8Array.from([0xc3, 0x28])));
});

void test('creates, unlocks, encrypts, and authenticates the local cache', async () => {
  const created = await createLocalCredential('local test value');
  assert.deepEqual(
    await unlockLocalCredential('local test value', created.record),
    created.key,
  );
  assert.equal(
    await unlockLocalCredential('different value', created.record),
    null,
  );
  const encrypted = await encryptLocalValue(
    payload({ alpha: 'beta' }),
    created.key,
  );
  assert.notEqual(encrypted.ciphertext, payload({ alpha: 'beta' }));
  assert.equal(
    await decryptLocalValue(encrypted, created.key),
    payload({ alpha: 'beta' }),
  );
  const wrong = await createLocalCredential('another value');
  await assert.rejects(() => decryptLocalValue(encrypted, wrong.key));
});
