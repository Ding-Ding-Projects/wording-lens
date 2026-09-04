import type { FormatCategory, SignatureDetection } from "./types";

const text = (bytes: Uint8Array): string => new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 4096));

function category(format: string): FormatCategory {
  if (format === "pdf") return "documents-pdf";
  if (["png", "jpeg", "gif", "webp", "bmp", "svg"].includes(format)) return "images";
  if (["zip", "7z", "tar", "gz"].includes(format)) return "archives";
  if (["csv", "tsv", "json", "xlsx", "ods"].includes(format)) return "structured-data-spreadsheets";
  if (["mp3", "wav", "flac"].includes(format)) return "audio";
  if (["mp4", "webm", "avi"].includes(format)) return "video";
  if (["base64", "hex"].includes(format)) return "binary-encodings";
  return "code-text";
}

function exact(format: string, mime: string, bytes: Uint8Array, details: string): SignatureDetection {
  return { format, mime, confidence: "exact", category: category(format), details };
}

/** Detect a source from bounded bytes. Extensions are deliberately ignored. */
export function detectSignature(value: Uint8Array | ArrayBuffer | string): SignatureDetection {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  const starts = (needle: number[]) => needle.every((byte, index) => bytes[index] === byte);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return exact("pdf", "application/pdf", bytes, "PDF header");
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return exact("png", "image/png", bytes, "PNG signature");
  if (starts([0xff, 0xd8, 0xff])) return exact("jpeg", "image/jpeg", bytes, "JPEG marker");
  if (starts([0x47, 0x49, 0x46, 0x38])) return exact("gif", "image/gif", bytes, "GIF header");
  if (starts([0x52, 0x49, 0x46, 0x46]) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return exact("webp", "image/webp", bytes, "RIFF WEBP header");
  if (starts([0x50, 0x4b, 0x03, 0x04]) || starts([0x50, 0x4b, 0x05, 0x06])) return exact("zip", "application/zip", bytes, "ZIP signature");
  if (starts([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return exact("7z", "application/x-7z-compressed", bytes, "7z signature");
  if (starts([0x49, 0x44, 0x33]) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return exact("mp3", "audio/mpeg", bytes, "MP3 frame or ID3 header");
  if (starts([0x66, 0x4c, 0x61, 0x43])) return exact("flac", "audio/flac", bytes, "FLAC signature");
  if (starts([0x52, 0x49, 0x46, 0x46]) && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) return exact("wav", "audio/wav", bytes, "RIFF WAVE header");
  const body = text(bytes).replace(/^\uFEFF/, "").trim();
  if (body.startsWith("{" ) || body.startsWith("[")) {
    try { JSON.parse(body); return { format: "json", mime: "application/json", confidence: "strong", category: category("json"), details: "Valid JSON text" }; } catch { /* continue to text */ }
  }
  const lines = body.split(/\r?\n/).slice(0, 20);
  if (lines.length > 0 && lines.some((line) => line.includes(",") || line.includes("\t"))) {
    const delimiter = lines.some((line) => line.includes("\t")) ? "tab" : "comma";
    return { format: delimiter === "tab" ? "tsv" : "csv", mime: "text/csv", confidence: "heuristic", category: category("csv"), details: `Delimited text detected using ${delimiter} separators` };
  }
  if (bytes.length > 0 && !bytes.subarray(0, Math.min(bytes.length, 4096)).some((byte) => byte === 0)) return { format: "text", mime: "text/plain", confidence: "heuristic", category: category("text"), details: "UTF-8-compatible text without NUL bytes" };
  return { format: "unknown", mime: "application/octet-stream", confidence: "heuristic", category: category("unknown"), details: "No supported signature matched" };
}

export function isSupportedSignature(detection: SignatureDetection, formats: readonly string[]): boolean {
  return formats.includes(detection.format);
}
