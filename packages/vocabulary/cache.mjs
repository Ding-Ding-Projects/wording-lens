import { parseVocabularyPayload } from "./parse.mjs";
import { createAliasIndex } from "./index.mjs";

// The host supplies encryption and storage. Keeping those operations behind this
// interface makes it impossible for the vocabulary package to invent a plaintext
// filesystem format or to silently fall back to one.
export function createEncryptedCache({ read, writeAtomic, remove, seal, unseal, limits } = {}) {
  for (const [name, operation] of Object.entries({ read, writeAtomic, remove, seal, unseal })) {
    if (typeof operation !== "function") throw new TypeError(`Cache operation ${name} is required`);
  }
  let cleared = false;
  return Object.freeze({
    async save(rawPayload) {
      const parsed = parseVocabularyPayload(rawPayload, { limits });
      const canonical = new TextEncoder().encode(JSON.stringify(parsed));
      const ciphertext = await seal(canonical);
      if (!(ciphertext instanceof Uint8Array) && !ArrayBuffer.isView(ciphertext)) throw new TypeError("seal must return bytes");
      await writeAtomic(ciphertext);
      cleared = false;
      return Object.freeze({ saved: true });
    },
    async load() {
      if (cleared) return null;
      const ciphertext = await read();
      if (ciphertext == null) return null;
      try {
        const plaintext = await unseal(ciphertext);
        const parsed = parseVocabularyPayload(plaintext, { limits });
        return createAliasIndex(parsed, { limits });
      } catch {
        // A corrupt, stale, or unsupported cache fails closed. No partial mapping
        // escapes this boundary and the caller remains on original wording.
        return null;
      }
    },
    async clear() {
      await remove();
      cleared = true;
      return Object.freeze({ cleared: true });
    },
  });
}
