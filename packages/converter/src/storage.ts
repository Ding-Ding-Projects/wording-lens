import { dirname, join } from "node:path";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { OutputValidation, StoragePreflight } from "./types";
import { detectSignature } from "./signatures";

const transientRenameCodes = new Set(["EPERM", "EACCES", "EBUSY"]);

export async function preflightStorage(destination: string, requiredBytes: number, availableBytes: number | (() => Promise<number>)): Promise<StoragePreflight> {
  const available = typeof availableBytes === "number" ? availableBytes : await availableBytes();
  const sufficient = Number.isFinite(requiredBytes) && requiredBytes >= 0 && available >= requiredBytes;
  return { destination, requiredBytes, availableBytes: available, sufficient, reason: sufficient ? undefined : `Destination requires ${requiredBytes} bytes but only ${available} bytes are available.` };
}

export function validateOutput(bytes: Uint8Array, expectedFormat?: string, maxBytes = 1024 * 1024 * 1024): OutputValidation {
  if (bytes.byteLength > maxBytes) return { valid: false, sizeBytes: bytes.byteLength, reason: `Output exceeds the ${maxBytes}-byte safety limit.` };
  const detection = detectSignature(bytes);
  if (expectedFormat && detection.format !== expectedFormat) return { valid: false, sizeBytes: bytes.byteLength, format: detection.format, reason: `Output signature is ${detection.format}, expected ${expectedFormat}.` };
  if (bytes.byteLength === 0) return { valid: false, sizeBytes: 0, reason: "Output is empty." };
  return { valid: true, sizeBytes: bytes.byteLength, format: detection.format };
}

async function renameWithRetry(from: string, to: string, attempts = 6, delayMs = 50): Promise<void> {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { await rename(from, to); return; } catch (error) {
      last = error;
      const code = (error as { code?: string }).code;
      if (!transientRenameCodes.has(code ?? "") || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw last;
}

/** Write validated bytes atomically and remove the temporary file on every failure. */
export async function atomicWriteValidated(destination: string, bytes: Uint8Array, expectedFormat?: string, maxBytes?: number): Promise<OutputValidation> {
  const validation = validateOutput(bytes, expectedFormat, maxBytes);
  if (!validation.valid) return validation;
  await mkdir(dirname(destination), { recursive: true });
  const temporary = join(dirname(destination), `.${randomUUID()}.partial`);
  try {
    await writeFile(temporary, bytes);
    const written = await stat(temporary);
    if (written.size !== bytes.byteLength) throw new Error("Temporary output size changed before rename.");
    await renameWithRetry(temporary, destination);
    return validation;
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    return { valid: false, sizeBytes: bytes.byteLength, reason: error instanceof Error ? error.message : "Atomic output write failed." };
  }
}
