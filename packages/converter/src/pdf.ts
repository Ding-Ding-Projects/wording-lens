import type { PdfDocumentInfo, PdfEngine, PdfOperation } from "./types";
import { validateOutput } from "./storage";

const validPage = (page: number): boolean => Number.isInteger(page) && page > 0;

export function validatePdfOperation(operation: PdfOperation): string | undefined {
  if (operation.kind === "split" || operation.kind === "extract" || operation.kind === "reorder") {
    if (operation.pages.length === 0 || operation.pages.some((page) => !validPage(page))) return "Page numbers must be positive integers.";
    if (operation.kind === "reorder" && new Set(operation.pages).size !== operation.pages.length) return "Reorder pages must not contain duplicates.";
  }
  if (operation.kind === "merge" && operation.inputs.length === 0) return "Merge requires at least one input.";
  if (operation.kind === "rotate" && operation.pages.some((entry) => !validPage(entry.page) || ![0, 90, 180, 270].includes(entry.degrees))) return "Rotation must use valid pages and 0, 90, 180, or 270 degrees.";
  return undefined;
}

export function inspectPdfBytes(bytes: Uint8Array): PdfDocumentInfo {
  const source = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 2 * 1024 * 1024)));
  const pageCount = (source.match(/\/Type\s*\/Page\b/g) ?? []).length || null;
  return {
    pageCount,
    encrypted: /\/Encrypt\b/.test(source),
    signed: /\/ByteRange\b|\/SubFilter\s*\/adbe\./.test(source),
    metadata: {},
  };
}

export async function executePdfOperation(engine: PdfEngine, operation: PdfOperation, input: Uint8Array): Promise<{ info?: PdfDocumentInfo; output?: Uint8Array; error?: string }> {
  const invalid = validatePdfOperation(operation);
  if (invalid) return { error: invalid };
  if (!(input[0] === 0x25 && input[1] === 0x50 && input[2] === 0x44 && input[3] === 0x46)) return { error: "Input does not have a PDF signature." };
  const value = await engine.execute(operation, input);
  if (value instanceof Uint8Array) {
    const validation = validateOutput(value, "pdf");
    return validation.valid ? { output: value } : { error: validation.reason };
  }
  return { info: value };
}

export function lossDisclosure(sourceFormat: string, targetFormat: string, metadataBehavior: string, lossiness: "lossless" | "lossy" | "metadata-change" | "unknown"): { required: boolean; title: string; changes: string[]; acknowledged: boolean } {
  const required = lossiness !== "lossless" || sourceFormat !== targetFormat;
  return { required, title: required ? "Review conversion changes" : "No declared data loss", changes: required ? [`${sourceFormat} to ${targetFormat} may change content or encoding.`, metadataBehavior] : ["Source format and target format are identical; the adapter declares a lossless path."], acknowledged: false };
}
