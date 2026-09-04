import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = join(root, "assets");
const packagingDir = join(root, "packaging");
const publicDir = join(root, "apps", "site", "public");
mkdirSync(assetsDir, { recursive: true });
mkdirSync(packagingDir, { recursive: true });
mkdirSync(publicDir, { recursive: true });

const COLORS = Object.freeze({
  graphite: [21, 25, 32, 255],
  graphiteDeep: [13, 17, 23, 255],
  cyan: [104, 196, 255, 255],
  cyanBright: [178, 232, 255, 255],
  mint: [112, 224, 180, 255],
  white: [241, 247, 250, 255],
  muted: [169, 190, 202, 255],
});

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function rgbaPng(width, height, pixels) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    scanlines[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const source = (y * width + x) * 4;
      const target = row + 1 + x * 4;
      scanlines[target] = pixels[source];
      scanlines[target + 1] = pixels[source + 1];
      scanlines[target + 2] = pixels[source + 2];
      scanlines[target + 3] = pixels[source + 3];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9, strategy: 3 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function canvas(width, height, background = COLORS.graphiteDeep) {
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set(background, i);
  return pixels;
}

function blendPixel(pixels, width, x, y, color) {
  if (x < 0 || y < 0 || x >= width) return;
  const height = pixels.length / 4 / width;
  if (y >= height) return;
  const offset = (Math.floor(y) * width + Math.floor(x)) * 4;
  const alpha = color[3] / 255;
  const inverse = 1 - alpha;
  pixels[offset] = Math.round(color[0] * alpha + pixels[offset] * inverse);
  pixels[offset + 1] = Math.round(color[1] * alpha + pixels[offset + 1] * inverse);
  pixels[offset + 2] = Math.round(color[2] * alpha + pixels[offset + 2] * inverse);
  pixels[offset + 3] = Math.round(255 * (alpha + (pixels[offset + 3] / 255) * inverse));
}

function rect(pixels, width, x, y, w, h, color, radius = 0) {
  const minX = Math.floor(x);
  const maxX = Math.ceil(x + w);
  const minY = Math.floor(y);
  const maxY = Math.ceil(y + h);
  for (let py = minY; py < maxY; py += 1) {
    for (let px = minX; px < maxX; px += 1) {
      const dx = Math.max(minX + radius - px, 0, px - (maxX - radius - 1));
      const dy = Math.max(minY + radius - py, 0, py - (maxY - radius - 1));
      if (radius === 0 || dx * dx + dy * dy <= radius * radius) blendPixel(pixels, width, px, py, color);
    }
  }
}

function circle(pixels, width, cx, cy, radius, color) {
  const startX = Math.floor(cx - radius);
  const endX = Math.ceil(cx + radius);
  const startY = Math.floor(cy - radius);
  const endY = Math.ceil(cy + radius);
  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) blendPixel(pixels, width, x, y, color);
    }
  }
}

function line(pixels, width, x1, y1, x2, y2, thickness, color) {
  const distance = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  const steps = Math.max(1, Math.ceil(distance * 2));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    circle(pixels, width, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, thickness / 2, color);
  }
}

function drawMark(pixels, width, height, ox = 0, oy = 0, size = Math.min(width, height)) {
  const scale = size / 256;
  const x = (value) => ox + value * scale;
  const y = (value) => oy + value * scale;
  const s = (value) => value * scale;
  rect(pixels, width, x(24), y(24), s(208), s(208), COLORS.graphite, s(48));
  rect(pixels, width, x(56), y(56), s(144), s(144), COLORS.graphiteDeep, s(28));
  line(pixels, width, x(78), y(174), x(178), y(74), s(20), COLORS.cyan);
  line(pixels, width, x(78), y(174), x(132), y(174), s(20), COLORS.cyanBright);
  circle(pixels, width, x(176), y(76), s(24), COLORS.mint);
  circle(pixels, width, x(176), y(76), s(9), COLORS.graphiteDeep);
  line(pixels, width, x(78), y(202), x(166), y(202), s(8), COLORS.muted);
}

const FONT = Object.freeze({
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
});

function drawText(pixels, width, text, startX, startY, scale, color, spacing = 2) {
  let cursor = startX;
  for (const character of text) {
    if (character === " ") {
      cursor += 4 * scale;
      continue;
    }
    const glyph = FONT[character] ?? FONT["."];
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((cell, columnIndex) => {
        if (cell === "1") rect(pixels, width, cursor + columnIndex * scale, startY + rowIndex * scale, scale, scale, color);
      });
    });
    cursor += (5 + spacing) * scale;
  }
}

function makeSocialPreview() {
  const width = 1280;
  const height = 640;
  const pixels = canvas(width, height, COLORS.graphiteDeep);
  rect(pixels, width, 40, 40, 1200, 560, COLORS.graphite, 40);
  rect(pixels, width, 720, 80, 440, 480, [29, 37, 48, 255], 28);
  rect(pixels, width, 760, 120, 360, 44, [34, 48, 61, 255], 18);
  rect(pixels, width, 760, 190, 290, 24, [34, 48, 61, 255], 12);
  rect(pixels, width, 760, 242, 330, 24, [34, 48, 61, 255], 12);
  rect(pixels, width, 760, 320, 150, 100, [23, 31, 40, 255], 18);
  rect(pixels, width, 930, 320, 170, 100, [23, 31, 40, 255], 18);
  rect(pixels, width, 760, 460, 340, 28, COLORS.cyan, 14);
  drawMark(pixels, width, height, 120, 126, 300);
  drawText(pixels, width, "WORDING LENS", 105, 470, 10, COLORS.white, 2);
  drawText(pixels, width, "LOCAL OPERATIONS COCKPIT", 105, 530, 5, COLORS.muted, 2);
  return rgbaPng(width, height, pixels);
}

function makeIconPng(size) {
  const pixels = canvas(size, size, COLORS.graphiteDeep);
  drawMark(pixels, size, size, 0, 0, size);
  return rgbaPng(size, size, pixels);
}

function makeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const directory = Buffer.alloc(entries.length * 16);
  let offset = 6 + directory.length;
  entries.forEach(({ size, png }, index) => {
    const location = index * 16;
    directory[location] = size === 256 ? 0 : size;
    directory[location + 1] = size === 256 ? 0 : size;
    directory[location + 2] = 0;
    directory[location + 3] = 0;
    directory.writeUInt16LE(1, location + 4);
    directory.writeUInt16LE(32, location + 6);
    directory.writeUInt32LE(png.length, location + 8);
    directory.writeUInt32LE(offset, location + 12);
    offset += png.length;
  });
  return Buffer.concat([header, directory, ...entries.map((entry) => entry.png)]);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-labelledby="title desc"><title id="title">Wording Lens</title><desc id="desc">Graphite lens mark with electric cyan path and mint status point.</desc><rect x="24" y="24" width="208" height="208" rx="48" fill="#151920"/><rect x="56" y="56" width="144" height="144" rx="28" fill="#0d1117"/><path d="M78 174h54M78 174 178 74" stroke="#68c4ff" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/><path d="M78 174h54" stroke="#b2e8ff" stroke-width="20" stroke-linecap="round"/><circle cx="176" cy="76" r="24" fill="#70e0b4"/><circle cx="176" cy="76" r="9" fill="#0d1117"/><path d="M78 202h88" stroke="#a9beca" stroke-width="8" stroke-linecap="round"/></svg>\n`;
writeFileSync(join(assetsDir, "wording-lens.svg"), svg, "utf8");
writeFileSync(join(publicDir, "favicon.svg"), svg, "utf8");

const socialPreview = makeSocialPreview();
writeFileSync(join(root, "social-preview.png"), socialPreview);
writeFileSync(join(publicDir, "social-preview.png"), socialPreview);

const sizes = [16, 24, 32, 48, 64, 128, 256];
const entries = sizes.map((size) => ({ size, png: makeIconPng(size) }));
writeFileSync(join(packagingDir, "wording-lens.ico"), makeIco(entries));

const manifest = {
  generator: "scripts/generate-brand-assets.mjs",
  mark: "assets/wording-lens.svg",
  icon: "packaging/wording-lens.ico",
  socialPreview: "social-preview.png",
  servedSocialPreview: "apps/site/public/social-preview.png",
  dimensions: { socialPreview: [1280, 640], iconSizes: sizes },
  sha256: {
    svg: createHash("sha256").update(svg).digest("hex"),
    socialPreview: createHash("sha256").update(socialPreview).digest("hex"),
    ico: createHash("sha256").update(readFileSync(join(packagingDir, "wording-lens.ico"))).digest("hex"),
  },
};
writeFileSync(join(assetsDir, "brand-assets-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Generated Wording Lens brand assets: ${sizes.length} ICO entries, 1280x640 social preview.`);
