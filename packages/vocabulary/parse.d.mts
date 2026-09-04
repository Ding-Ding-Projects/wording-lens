export interface VocabularyPayload {
  readonly schemaVersion: 1;
  readonly entries: Readonly<Record<string, string>>;
}
export interface VocabularyParseOptions {
  limits?: Partial<{
    maxBytes: number;
    maxEntries: number;
    maxKeyLength: number;
    maxValueLength: number;
    maxNestingDepth: number;
  }>;
}
export function parseVocabularyPayload(input: string | Uint8Array | ArrayBuffer, options?: VocabularyParseOptions): VocabularyPayload;
export function validateVocabularyPayload(input: unknown, options?: VocabularyParseOptions): VocabularyPayload;
export const CONTROL_CHARACTER: RegExp;
