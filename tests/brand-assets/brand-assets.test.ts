import { createHash } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const iconPath = join(root, "packaging", "wording-lens.ico");
const previewPath = join(root, "social-preview.png");
const servedPreviewPath = join(root, "apps", "site", "public", "social-preview.png");

function pngInfo(data: Buffer) {
  expect(data.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  const chunks: Buffer[] = [];
  let offset = 8;
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") chunks.push(data.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
    if (type === "IEND") break;
  }
  const inflated = inflateSync(Buffer.concat(chunks));
  expect(inflated.length).toBe((width * 4 + 1) * height);
  return { width, height };
}

function icoEntries(data: Buffer) {
  expect(data.readUInt16LE(0)).toBe(0);
  expect(data.readUInt16LE(2)).toBe(1);
  const count = data.readUInt16LE(4);
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    const offset = 6 + i * 16;
    const width = data[offset] || 256;
    const height = data[offset + 1] || 256;
    const bytes = data.readUInt32LE(offset + 8);
    const location = data.readUInt32LE(offset + 12);
    entries.push({ width, height, bytes: data.subarray(location, location + bytes) });
  }
  return entries;
}

describe("brand asset generator", () => {
  it("emits valid dimensions, signatures, and the complete ICO directory", () => {
    const preview = pngInfo(readFileSync(previewPath));
    expect(preview).toEqual({ width: 1280, height: 640 });
    const entries = icoEntries(readFileSync(iconPath));
    expect(entries.map((entry) => [entry.width, entry.height])).toEqual([[16, 16], [24, 24], [32, 32], [48, 48], [64, 64], [128, 128], [256, 256]]);
    entries.forEach((entry) => expect(pngInfo(entry.bytes)).toEqual({ width: entry.width, height: entry.height }));
  });

  it("keeps the served social preview byte-identical to the root master", () => {
    const rootPreview = readFileSync(previewPath);
    const servedPreview = readFileSync(servedPreviewPath);
    expect(Buffer.compare(rootPreview, servedPreview)).toBe(0);
    expect(createHash("sha256").update(rootPreview).digest("hex")).toHaveLength(64);
    expect(statSync(previewPath).size).toBeGreaterThan(1000);
  });

  it("is deterministic when regenerated", () => {
    const before = [previewPath, servedPreviewPath, iconPath].map((path) => readFileSync(path));
    execFileSync(process.execPath, [join(root, "scripts", "generate-brand-assets.mjs")], { cwd: root });
    const after = [previewPath, servedPreviewPath, iconPath].map((path) => readFileSync(path));
    before.forEach((bytes, index) => expect(Buffer.compare(bytes, after[index])).toBe(0));
  });
});
