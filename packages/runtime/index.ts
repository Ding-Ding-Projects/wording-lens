/*
 * Framework-neutral runtime primitives. The desktop and web surfaces share
 * these contracts, while each surface owns its storage and rendering.
 */

export type LanguageMode = "en" | "zh-Hant" | "bilingual";
export type ThemeMode = "light" | "dark";
export type AttentionMode = "focus" | "lowStimulation" | "timeAwareness" | "oneThing" | "momentum";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const RUNTIME_SCHEMA_VERSION = 1 as const;
export const DEFAULT_DISPLAY_NAME = "Wording Lens";

export interface ToneSettings {
  english: number;
  cantonese: number;
}

export interface SchoolModeState {
  enabled: boolean;
  displayName: string;
  unlockConfigured: boolean;
  unlocked: boolean;
}

export interface ThemeSettings {
  mode: ThemeMode;
  density: "compact" | "comfortable" | "spacious";
  seedColor: string;
  fontFamily: string;
  fontScale: number;
  fontWeight: number;
}

export interface AttentionSettings {
  focus: boolean;
  lowStimulation: boolean;
  timeAwareness: boolean;
  oneThing: boolean;
  momentum: boolean;
  nextAction: string;
  momentumSnoozedUntil: number | null;
}

export interface NarratorSettings {
  enabled: boolean;
  language: "en" | "zh-Hant" | "both";
  englishVoiceId: string | null;
  cantoneseVoiceId: string | null;
  rate: number | null;
  pitch: number | null;
  quiet: boolean;
}

export interface LogoSettings {
  presetId: string;
  customImage: string | null;
  fit: "contain" | "cover" | "fill";
  focalPoint: { x: number; y: number };
  background: string;
}

export interface RuntimeSettings {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  language: LanguageMode;
  tone: ToneSettings;
  showEmojis: boolean;
  school: SchoolModeState;
  attention: AttentionSettings;
  narrator: NarratorSettings;
  theme: ThemeSettings;
  displayName: string;
  logo: LogoSettings;
  reducedMotion: boolean;
}

export const DEFAULT_SETTINGS: RuntimeSettings = {
  schemaVersion: RUNTIME_SCHEMA_VERSION,
  language: "en",
  tone: { english: 5, cantonese: 5 },
  showEmojis: true,
  school: { enabled: false, displayName: "School mode", unlockConfigured: false, unlocked: true },
  attention: {
    focus: false,
    lowStimulation: false,
    timeAwareness: false,
    oneThing: false,
    momentum: false,
    nextAction: "",
    momentumSnoozedUntil: null,
  },
  narrator: {
    enabled: false,
    language: "both",
    englishVoiceId: null,
    cantoneseVoiceId: null,
    rate: null,
    pitch: null,
    quiet: false,
  },
  theme: {
    mode: "dark",
    density: "comfortable",
    seedColor: "#43d9ff",
    fontFamily: "Segoe UI",
    fontScale: 1,
    fontWeight: 400,
  },
  displayName: DEFAULT_DISPLAY_NAME,
  logo: { presetId: "lens-cyan", customImage: null, fit: "contain", focalPoint: { x: 50, y: 50 }, background: "#10161f" },
  reducedMotion: false,
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function finite(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, number));
}

export function normalizeSettings(input: unknown): RuntimeSettings {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const school = value.school && typeof value.school === "object" ? value.school as Record<string, unknown> : {};
  const tone = value.tone && typeof value.tone === "object" ? value.tone as Record<string, unknown> : {};
  const attention = value.attention && typeof value.attention === "object" ? value.attention as Record<string, unknown> : {};
  const narrator = value.narrator && typeof value.narrator === "object" ? value.narrator as Record<string, unknown> : {};
  const theme = value.theme && typeof value.theme === "object" ? value.theme as Record<string, unknown> : {};
  const logo = value.logo && typeof value.logo === "object" ? value.logo as Record<string, unknown> : {};
  const mode = value.language === "zh-Hant" || value.language === "bilingual" ? value.language : "en";
  const density = theme.density === "compact" || theme.density === "spacious" ? theme.density : "comfortable";
  const attentionMode = (name: AttentionMode): boolean => attention[name] === true;
  const focal = logo.focalPoint && typeof logo.focalPoint === "object" ? logo.focalPoint as Record<string, unknown> : {};
  return {
    schemaVersion: RUNTIME_SCHEMA_VERSION,
    language: mode,
    tone: { english: Math.round(finite(tone.english, 5, 1, 5)), cantonese: Math.round(finite(tone.cantonese, 5, 1, 5)) },
    showEmojis: value.showEmojis !== false,
    school: {
      enabled: school.enabled === true,
      displayName: typeof school.displayName === "string" && school.displayName.trim() ? school.displayName.trim().slice(0, 80) : "School mode",
      unlockConfigured: school.unlockConfigured === true,
      unlocked: school.unlocked !== false,
    },
    attention: {
      focus: attentionMode("focus"), lowStimulation: attentionMode("lowStimulation"), timeAwareness: attentionMode("timeAwareness"),
      oneThing: attentionMode("oneThing"), momentum: attentionMode("momentum"),
      nextAction: typeof attention.nextAction === "string" ? attention.nextAction.slice(0, 240) : "",
      momentumSnoozedUntil: typeof attention.momentumSnoozedUntil === "number" && Number.isFinite(attention.momentumSnoozedUntil) ? attention.momentumSnoozedUntil : null,
    },
    narrator: {
      enabled: narrator.enabled === true,
      language: narrator.language === "en" || narrator.language === "zh-Hant" ? narrator.language : "both",
      englishVoiceId: typeof narrator.englishVoiceId === "string" ? narrator.englishVoiceId.slice(0, 240) : null,
      cantoneseVoiceId: typeof narrator.cantoneseVoiceId === "string" ? narrator.cantoneseVoiceId.slice(0, 240) : null,
      rate: narrator.rate === null || narrator.rate === undefined ? null : finite(narrator.rate, 1, 0.1, 10),
      pitch: narrator.pitch === null || narrator.pitch === undefined ? null : finite(narrator.pitch, 1, 0, 2),
      quiet: narrator.quiet === true,
    },
    theme: {
      mode: theme.mode === "light" ? "light" : "dark", density, seedColor: typeof theme.seedColor === "string" ? theme.seedColor.slice(0, 32) : "#43d9ff",
      fontFamily: typeof theme.fontFamily === "string" ? theme.fontFamily.slice(0, 160) : "Segoe UI",
      fontScale: finite(theme.fontScale, 1, 0.75, 2), fontWeight: Math.round(finite(theme.fontWeight, 400, 100, 900)),
    },
    displayName: typeof value.displayName === "string" && value.displayName.trim() ? value.displayName.trim().slice(0, 120) : DEFAULT_DISPLAY_NAME,
    logo: {
      presetId: typeof logo.presetId === "string" ? logo.presetId.slice(0, 64) : "lens-cyan",
      customImage: typeof logo.customImage === "string" ? logo.customImage : null,
      fit: logo.fit === "cover" || logo.fit === "fill" ? logo.fit : "contain",
      focalPoint: { x: finite(focal.x, 50, 0, 100), y: finite(focal.y, 50, 0, 100) },
      background: typeof logo.background === "string" ? logo.background.slice(0, 32) : "#10161f",
    },
    reducedMotion: value.reducedMotion === true,
  };
}

export class JsonStore<T> {
  private value: T;
  private readonly key: string;
  private readonly storage: StorageLike;
  private readonly normalize: (value: unknown) => T;

  constructor(key: string, storage: StorageLike, initial: T, normalizeValue: (value: unknown) => T = (value) => value as T) {
    this.key = key; this.storage = storage; this.normalize = normalizeValue;
    try { this.value = normalizeValue(JSON.parse(storage.getItem(key) ?? "null")); } catch { this.value = clone(initial); }
  }
  get(): T { return clone(this.value); }
  set(next: T): T { this.value = this.normalize(next); this.storage.setItem(this.key, JSON.stringify(this.value)); return this.get(); }
  update(mutator: (current: T) => T): T { return this.set(mutator(this.get())); }
  clear(initial: T): T { this.storage.removeItem(this.key); this.value = clone(initial); return this.get(); }
}

export interface SchoolProjection {
  language: "en";
  showEmojis: false;
  tone: { english: 1; cantonese: 1 };
  dimSumVisible: false;
  personalVocabularyVisible: false;
  displayName: string;
}

export function projectSchoolMode(settings: RuntimeSettings): RuntimeSettings | SchoolProjection {
  if (!settings.school.enabled) return clone(settings);
  return { language: "en", showEmojis: false, tone: { english: 1, cantonese: 1 }, dimSumVisible: false, personalVocabularyVisible: false, displayName: settings.school.displayName };
}

export const ATTENTION_MODES: readonly AttentionMode[] = ["focus", "lowStimulation", "timeAwareness", "oneThing", "momentum"];

export function setAttentionMode(settings: RuntimeSettings, mode: AttentionMode, enabled: boolean): RuntimeSettings {
  const next = clone(settings); next.attention[mode] = enabled; return next;
}

export interface VoiceOption { id: string; name: string; lang: string; localService?: boolean; }
export function resolveVoice(options: readonly VoiceOption[], selectedId: string | null, langPrefix: string): { selected: VoiceOption | null; fallback: boolean } {
  const matching = options.filter((voice) => voice.lang.toLowerCase().startsWith(langPrefix.toLowerCase()));
  if (selectedId) { const selected = matching.find((voice) => voice.id === selectedId); if (selected) return { selected, fallback: false }; }
  return { selected: matching[0] ?? null, fallback: Boolean(selectedId) || matching.length === 0 };
}

export interface NarrationLine { id: string; category: string; english: string; cantonese: string; }
export class NarratorQueue {
  private queue: NarrationLine[] = [];
  private active = false;
  enqueue(line: NarrationLine): void {
    this.queue = this.queue.filter((item) => item.category !== line.category);
    this.queue.push(clone(line));
  }
  takeNext(): NarrationLine | null { if (this.active || this.queue.length === 0) return null; this.active = true; return this.queue.shift() ?? null; }
  complete(): void { this.active = false; }
  clear(): void { this.queue = []; }
  isActive(): boolean { return this.active; }
  size(): number { return this.queue.length; }
}

export type NotificationKind = "info" | "success" | "progress" | "error" | "warning";
export interface NotificationRecord { id: string; kind: NotificationKind; title: string; body: string; createdAt: number; dismissed: boolean; action?: { label: string; command: string }; }
export class NotificationCenter {
  private records: NotificationRecord[] = [];
  add(record: Omit<NotificationRecord, "dismissed">): NotificationRecord { const next = { ...clone(record), dismissed: false }; this.records.push(next); return clone(next); }
  dismiss(id: string): boolean { const record = this.records.find((item) => item.id === id); if (!record) return false; record.dismissed = true; return true; }
  list(includeDismissed = true): NotificationRecord[] { return clone(includeDismissed ? this.records : this.records.filter((item) => !item.dismissed)); }
  bulkDismiss(ids: readonly string[]): number { let count = 0; for (const id of ids) if (this.dismiss(id)) count++; return count; }
}

export type UpdatePhase = "idle" | "checking" | "available" | "downloading" | "ready" | "failed";
export interface UpdaterState { phase: UpdatePhase; currentVersion: string; availableVersion: string | null; releaseNotesUrl: string | null; progress: number; unsigned: true; error: string | null; }
export const DEFAULT_UPDATER_STATE: UpdaterState = { phase: "idle", currentVersion: "0.1.0", availableVersion: null, releaseNotesUrl: null, progress: 0, unsigned: true, error: null };

export interface ExportFormat { id: string; label: string; extension: string; mime: string; supportsRoundTrip: boolean; }
export const EXPORT_FORMATS: readonly ExportFormat[] = [
  { id: "json", label: "JSON", extension: ".json", mime: "application/json", supportsRoundTrip: true },
  { id: "jsonl", label: "JSON Lines", extension: ".jsonl", mime: "application/x-ndjson", supportsRoundTrip: true },
  { id: "yaml", label: "YAML", extension: ".yaml", mime: "application/yaml", supportsRoundTrip: true },
  { id: "toml", label: "TOML", extension: ".toml", mime: "application/toml", supportsRoundTrip: true },
  { id: "xml", label: "XML", extension: ".xml", mime: "application/xml", supportsRoundTrip: true },
  { id: "csv", label: "CSV", extension: ".csv", mime: "text/csv", supportsRoundTrip: true },
  { id: "tsv", label: "TSV", extension: ".tsv", mime: "text/tab-separated-values", supportsRoundTrip: true },
  { id: "markdown", label: "Markdown", extension: ".md", mime: "text/markdown", supportsRoundTrip: false },
  { id: "html", label: "HTML", extension: ".html", mime: "text/html", supportsRoundTrip: false },
  { id: "sql", label: "SQL", extension: ".sql", mime: "application/sql", supportsRoundTrip: false },
  { id: "typescript", label: "TypeScript", extension: ".ts", mime: "text/typescript", supportsRoundTrip: false },
  { id: "javascript", label: "JavaScript", extension: ".js", mime: "text/javascript", supportsRoundTrip: false },
  { id: "python", label: "Python", extension: ".py", mime: "text/x-python", supportsRoundTrip: false },
  { id: "json-schema", label: "JSON Schema", extension: ".schema.json", mime: "application/schema+json", supportsRoundTrip: true },
  { id: "protobuf", label: "Protocol Buffers", extension: ".proto", mime: "text/plain", supportsRoundTrip: false },
];

export class BulkSelection<T extends string = string> {
  private selected = new Set<T>();
  private anchor: T | null = null;
  toggle(id: T, ordered: readonly T[], range = false): void {
    if (range && this.anchor !== null) {
      const start = ordered.indexOf(this.anchor); const end = ordered.indexOf(id);
      if (start >= 0 && end >= 0) for (const item of ordered.slice(Math.min(start, end), Math.max(start, end) + 1)) this.selected.add(item);
    } else if (this.selected.has(id)) this.selected.delete(id); else this.selected.add(id);
    this.anchor = id;
  }
  selectAll(ordered: readonly T[]): void { this.selected = new Set(ordered); }
  invert(ordered: readonly T[]): void { this.selected = new Set(ordered.filter((id) => !this.selected.has(id))); }
  clear(): void { this.selected.clear(); this.anchor = null; }
  values(): T[] { return [...this.selected]; }
  has(id: T): boolean { return this.selected.has(id); }
}

export interface CollapsibleFilterState { filtersOpen: boolean; statsOpen: boolean; }
export function toggleFilter(state: CollapsibleFilterState, filter: "filtersOpen" | "statsOpen"): CollapsibleFilterState { return { ...state, [filter]: !state[filter] }; }

export interface CommandEntry { id: string; label: string; description: string; shortcut?: string; target: string; run: () => void; }
export class CommandRegistry {
  private entries = new Map<string, CommandEntry>();
  register(entry: CommandEntry): void { if (this.entries.has(entry.id)) throw new Error(`Duplicate command: ${entry.id}`); this.entries.set(entry.id, entry); }
  unregister(id: string): boolean { return this.entries.delete(id); }
  search(query: string, regex = false, flags = "i"): CommandEntry[] {
    if (!query) return [...this.entries.values()];
    let matcher: RegExp;
    try { matcher = regex ? new RegExp(query.slice(0, 256), flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags); } catch { return []; }
    return [...this.entries.values()].filter((entry) => matcher.test(`${entry.label} ${entry.description} ${entry.target}`));
  }
  list(): CommandEntry[] { return [...this.entries.values()]; }
}

export interface StatusProjection { version: string; updatedAt: string; current: "idle" | "running" | "blocked" | "verified" | "failed"; lanes: Array<{ id: string; label: string; state: StatusProjection["current"]; evidence: string[] }>; nextGates: string[]; }
export function createStatusProjection(version: string, updatedAt: string, current: StatusProjection["current"], lanes: StatusProjection["lanes"], nextGates: string[]): StatusProjection {
  return { version, updatedAt, current, lanes: clone(lanes), nextGates: [...nextGates] };
}

export interface FeatureRegistryRow { id: string; label: string; category: string; implementation: string; documentation: string; localization: string; tests: string; evidence: string; }
export const FEATURE_REGISTRY: readonly FeatureRegistryRow[] = [
  ["language-modes", "Language modes", "experience"], ["tone-levels", "Independent tone levels", "experience"], ["emoji-toggle", "Dialog emoji preference", "experience"], ["school-mode", "School mode projection", "experience"],
  ["narration", "Narrator and voices", "experience"], ["scheduled-settings", "Scheduled settings", "settings"], ["dim-sum", "Dim sum surprise", "experience"], ["regex-builder", "Regex builder", "navigation"], ["notifications", "Notification center", "navigation"],
  ["appearance", "Appearance editor", "appearance"], ["tabs", "Tabs and groups", "navigation"], ["command-palette", "Command palette", "navigation"], ["destructive-confirmation", "Destructive confirmation", "security"], ["history", "Local version history", "history"],
  ["changelog", "Changelog viewer", "documentation"], ["external-editor", "External editor handoff", "integration"], ["exports", "Export formats", "data"], ["bulk-actions", "Bulk actions", "data"], ["accessibility", "Accessibility", "quality"], ["responsive", "Responsive sizing", "quality"],
  ["vocabulary-upload", "Personal vocabulary upload", "privacy"], ["toy-locks", "Element locks", "security"], ["support-tickets", "Support tickets", "recovery"], ["download-surfaces", "Download surfaces", "operations"], ["unlock-ladder", "Unlock ladder", "security"], ["embed-graphic", "Link embed graphic", "publishing"],
  ["attention-modes", "Attention modes", "experience"], ["app-logo", "Logo customization", "appearance"], ["file-converter", "File converter", "operations"], ["ollama-manager", "Local model manager", "operations"], ["status-hub", "Status projection", "operations"], ["offline-docs", "Offline documentation", "documentation"],
].map(([id, label, category]) => ({ id, label, category, implementation: `packages/runtime/${id}`, documentation: `docs/features/${id}.md`, localization: `ui.copy.${id}`, tests: `tests/runtime/${id}.test.ts`, evidence: `evidence/${id}` }));

export function validateFeatureRegistry(rows: readonly FeatureRegistryRow[] = FEATURE_REGISTRY): void {
  const ids = new Set<string>();
  for (const row of rows) {
    if (!row.id || ids.has(row.id) || !row.implementation || !row.documentation || !row.localization || !row.tests || !row.evidence) throw new Error(`Invalid feature registry row: ${row.id}`);
    ids.add(row.id);
  }
  if (ids.size !== FEATURE_REGISTRY.length) throw new Error("Feature registry inventory is incomplete");
}

export const RAINBOW_SENTINEL = "__RUNTIME_RAINBOW__" as const;
export type ColorValue = { space: ColorSpace; values: number[]; alpha: number } | typeof RAINBOW_SENTINEL;
export type ColorSpace = "hex" | "rgb" | "hsl" | "hsv" | "hwb" | "lab" | "lch" | "oklab" | "oklch" | "cmyk";

function clamp01(n: number): number { return Math.min(1, Math.max(0, n)); }
const NAMED_COLORS: Record<string, number[]> = { black: [0, 0, 0], white: [1, 1, 1], red: [1, 0, 0], green: [0, 0.5019608, 0], blue: [0, 0, 1], yellow: [1, 1, 0], cyan: [0, 1, 1], magenta: [1, 0, 1], transparent: [0, 0, 0, 0] };
function hexToRgb(text: string): number[] | null {
  const value = text.replace(/^#/, "");
  if (![3, 4, 6, 8].includes(value.length) || !/^[\da-f]+$/i.test(value)) return null;
  const expanded = value.length < 5 ? [...value].map((x) => x + x).join("") : value;
  const nums = [0, 2, 4].map((i) => parseInt(expanded.slice(i, i + 2), 16) / 255);
  return [...nums, expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1];
}
function parseNumbers(text: string): number[] { return text.split(/[ ,/]+/).filter(Boolean).map((part) => Number.parseFloat(part)); }

export function parseColor(input: string): ColorValue | null {
  const text = input.trim().toLowerCase();
  if (text === RAINBOW_SENTINEL.toLowerCase() || text === "rainbow") return RAINBOW_SENTINEL;
  if (NAMED_COLORS[text]) { const named = NAMED_COLORS[text]; return { space: "rgb", values: named.slice(0, 3), alpha: named[3] ?? 1 }; }
  if (text.startsWith("#")) { const rgb = hexToRgb(text); return rgb ? { space: "rgb", values: rgb.slice(0, 3), alpha: rgb[3] } : null; }
  const match = text.match(/^([a-z]+)\((.*)\)$/); if (!match) return null;
  const space = match[1] as ColorSpace; const values = parseNumbers(match[2]);
  if (space === "rgb") return values.length >= 3 ? { space, values: values.slice(0, 3).map((n) => n > 1 ? n / 255 : n), alpha: values[3] ?? 1 } : null;
  if (space === "hsl" || space === "hsv") return values.length >= 3 ? { space, values: values.slice(0, 3), alpha: values[3] ?? 1 } : null;
  if (["hwb", "lab", "lch", "oklab", "oklch", "cmyk"].includes(space)) return values.length >= 3 ? { space, values: values.slice(0, space === "cmyk" ? 4 : 3), alpha: values[space === "cmyk" ? 4 : 3] ?? 1 } : null;
  return null;
}

function hslToRgb(h: number, s: number, l: number): number[] { h = ((h % 360) + 360) % 360 / 360; s = s > 1 ? s / 100 : s; l = l > 1 ? l / 100 : l; const f = (n: number) => { const k = (n + h * 12) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; }
function hsvToRgb(h: number, s: number, v: number): number[] { h = ((h % 360) + 360) % 360; s = s > 1 ? s / 100 : s; v = v > 1 ? v / 100 : v; const c = v * s; const x = c * (1 - Math.abs((h / 60) % 2 - 1)); const m = v - c; const parts = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return parts.map((n) => n + m); }
function rgbToHsl([r, g, b]: number[]): number[] { const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2; if (!d) return [0, 0, l * 100]; const s = d / (1 - Math.abs(2 * l - 1)); const h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4); return [(h + 360) % 360, s * 100, l * 100]; }
function rgbToHsv([r, g, b]: number[]): number[] { const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; const h = !d ? 0 : max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4); return [(h + 360) % 360, max ? d / max * 100 : 0, max * 100]; }
function linearize(value: number): number { return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; }
function delinearize(value: number): number { return value <= 0.0031308 ? value * 12.92 : 1.055 * Math.max(0, value) ** (1 / 2.4) - 0.055; }
function rgbToXyz(rgb: number[]): number[] { const [r, g, b] = rgb.map(linearize); return [r * 0.4124564 + g * 0.3575761 + b * 0.1804375, r * 0.2126729 + g * 0.7151522 + b * 0.072175, r * 0.0193339 + g * 0.119192 + b * 0.9503041]; }
function xyzToRgb(xyz: number[]): number[] { const [x, y, z] = xyz; return [delinearize(x * 3.2404542 - y * 1.5371385 - z * 0.4985314), delinearize(-x * 0.969266 + y * 1.8760108 + z * 0.041556), delinearize(x * 0.0556434 - y * 0.2040259 + z * 1.0572252)].map(clamp01); }
function labPivot(value: number): number { const delta = 6 / 29; return value > delta ? value ** 3 : 3 * delta ** 2 * (value - 4 / 29); }
function labInvPivot(value: number): number { const delta = 6 / 29; return value > delta ** 3 ? Math.cbrt(value) : value / (3 * delta ** 2) + 4 / 29; }
function xyzToLab(xyz: number[]): number[] { const [x, y, z] = xyz; const fx = labInvPivot(x / 0.95047), fy = labInvPivot(y), fz = labInvPivot(z / 1.08883); return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]; }
function labToXyz(lab: number[]): number[] { const [l, a, b] = lab; const fy = (l + 16) / 116, fx = fy + a / 500, fz = fy - b / 200; return [0.95047 * labPivot(fx), labPivot(fy), 1.08883 * labPivot(fz)]; }
function xyzToOklab(xyz: number[]): number[] { const [x, y, z] = xyz; const l = Math.cbrt(0.819022437996703 * x + 0.3619062600528904 * y - 0.1288737815209879 * z); const m = Math.cbrt(0.0329836539323885 * x + 0.9292868615863434 * y + 0.0361446663506424 * z); const s = Math.cbrt(0.0481771893596242 * x + 0.2642395317527308 * y + 0.6335478284694309 * z); return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]; }
function oklabToXyz(ok: number[]): number[] { const [l0, a, b] = ok; const l = (l0 + 0.3963377774 * a + 0.2158037573 * b) ** 3; const m = (l0 - 0.1055613458 * a - 0.0638541728 * b) ** 3; const s = (l0 - 0.0894841775 * a - 1.291485548 * b) ** 3; return [1.2268798734 * l - 0.5578149966 * m - 0.2813910502 * s, -0.0405757626 * l + 1.1122868294 * m - 0.0717110667 * s, -0.0763729497 * l - 0.4214933239 * m + 1.5869240244 * s]; }
function rgbFromColor(color: ColorValue): { rgb: number[]; alpha: number } | null {
  if (color === RAINBOW_SENTINEL) return null;
  const { space, values, alpha } = color;
  if (space === "rgb") return { rgb: values.map(clamp01), alpha: clamp01(alpha) };
  if (space === "hsl") return { rgb: hslToRgb(values[0], values[1], values[2]), alpha: clamp01(alpha) };
  if (space === "hsv") return { rgb: hsvToRgb(values[0], values[1], values[2]), alpha: clamp01(alpha) };
  if (space === "hwb") { const base = hsvToRgb(values[0], 100, 100); const w = values[1] > 1 ? values[1] / 100 : values[1]; const b = values[2] > 1 ? values[2] / 100 : values[2]; const total = w + b; const scale = total >= 1 ? 0 : 1 - w - b; return { rgb: base.map((n) => n / 100 * scale + w), alpha: clamp01(alpha) }; }
  if (space === "cmyk") { const [c, m, y, k] = values.map((n) => n > 1 ? n / 100 : n); return { rgb: [1 - Math.min(1, c * (1 - k) + k), 1 - Math.min(1, m * (1 - k) + k), 1 - Math.min(1, y * (1 - k) + k)], alpha: clamp01(alpha) }; }
  if (space === "lab") return { rgb: xyzToRgb(labToXyz(values)), alpha: clamp01(alpha) };
  if (space === "lch") { const angle = values[2] * Math.PI / 180; return { rgb: xyzToRgb(labToXyz([values[0], values[1] * Math.cos(angle), values[1] * Math.sin(angle)])), alpha: clamp01(alpha) }; }
  if (space === "oklab") return { rgb: xyzToRgb(oklabToXyz(values)), alpha: clamp01(alpha) };
  if (space === "oklch") { const angle = values[2] * Math.PI / 180; return { rgb: xyzToRgb(oklabToXyz([values[0], values[1] * Math.cos(angle), values[1] * Math.sin(angle)])), alpha: clamp01(alpha) }; }
  return null;
}

function hex(n: number): string { return Math.round(clamp01(n) * 255).toString(16).padStart(2, "0"); }
export function translateColor(color: ColorValue): Record<string, string> {
  if (color === RAINBOW_SENTINEL) return { sentinel: RAINBOW_SENTINEL, mode: "continuous hue animation" };
  const rgbValue = rgbFromColor(color); if (!rgbValue) return { sentinel: RAINBOW_SENTINEL };
  const { rgb, alpha } = rgbValue; const hsl = rgbToHsl(rgb), hsv = rgbToHsv(rgb); const [r, g, b] = rgb; const lab = xyzToLab(rgbToXyz(rgb)); const oklab = xyzToOklab(rgbToXyz(rgb));
  const lchHue = (a: number, bValue: number) => (Math.atan2(bValue, a) * 180 / Math.PI + 360) % 360;
  const named = Object.entries(NAMED_COLORS).find(([, value]) => value.length >= 3 && value.slice(0, 3).every((component, index) => Math.abs(component - rgb[index]) < 0.0005) && (value[3] ?? 1) === alpha)?.[0] ?? "custom";
  const c = 1 - r, m = 1 - g, y = 1 - b, k = Math.min(c, m, y); const denom = 1 - k;
  return {
    named,
    hex: `#${hex(r)}${hex(g)}${hex(b)}${alpha < 1 ? hex(alpha) : ""}`,
    rgb: `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)} / ${Number(alpha.toFixed(4))})`,
    hsl: `hsl(${Number(hsl[0].toFixed(2))} ${Number(hsl[1].toFixed(2))}% ${Number(hsl[2].toFixed(2))}% / ${Number(alpha.toFixed(4))})`,
    hsv: `hsv(${Number(hsv[0].toFixed(2))} ${Number(hsv[1].toFixed(2))}% ${Number(hsv[2].toFixed(2))}% / ${Number(alpha.toFixed(4))})`,
    hwb: `hwb(${Number(hsv[0].toFixed(2))} ${Number((Math.min(r, g, b) * 100).toFixed(2))}% ${Number(((1 - Math.max(r, g, b)) * 100).toFixed(2))}% / ${Number(alpha.toFixed(4))})`,
    cmyk: `cmyk(${Number((denom ? (c - k) / denom : 0).toFixed(4))} ${Number((denom ? (m - k) / denom : 0).toFixed(4))} ${Number((denom ? (y - k) / denom : 0).toFixed(4))} ${Number(k.toFixed(4))} / ${Number(alpha.toFixed(4))})`,
    lab: `lab(${Number(lab[0].toFixed(3))} ${Number(lab[1].toFixed(3))} ${Number(lab[2].toFixed(3))} / ${Number(alpha.toFixed(4))})`,
    lch: `lch(${Number(lab[0].toFixed(3))} ${Number(Math.hypot(lab[1], lab[2]).toFixed(3))} ${Number(lchHue(lab[1], lab[2]).toFixed(3))} / ${Number(alpha.toFixed(4))})`,
    oklab: `oklab(${Number(oklab[0].toFixed(5))} ${Number(oklab[1].toFixed(5))} ${Number(oklab[2].toFixed(5))} / ${Number(alpha.toFixed(4))})`,
    oklch: `oklch(${Number(oklab[0].toFixed(5))} ${Number(Math.hypot(oklab[1], oklab[2]).toFixed(5))} ${Number(lchHue(oklab[1], oklab[2]).toFixed(3))} / ${Number(alpha.toFixed(4))})`,
  };
}

export function isRainbow(color: ColorValue): color is typeof RAINBOW_SENTINEL { return color === RAINBOW_SENTINEL; }
