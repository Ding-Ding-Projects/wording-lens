/**
 * Framework-agnostic interaction state for Wording Lens.
 *
 * The module deliberately contains no DOM, React, Electron, or persistence
 * implementation. Product adapters can render these models in any UI while
 * retaining the same keyboard, accessibility, and serialization behaviour.
 */

export type DockEdge = "left" | "right" | "top" | "bottom";
export type LanguageMode = "english" | "cantonese" | "bilingual";
export type MatchMode = "text" | "regex";
export type BulkCloseMode = "contains" | "not-contains";
export type LockPolicy =
  | "pin"
  | "password"
  | "pin-password"
  | "password-totp"
  | "pin-totp"
  | "password-pin-totp";

export const LOCK_POLICIES: readonly LockPolicy[] = [
  "pin",
  "password",
  "pin-password",
  "password-totp",
  "pin-totp",
  "password-pin-totp",
];

export interface SearchState {
  id: string;
  query: string;
  pattern: string;
  flags: string;
  mode: MatchMode;
  lastError?: string;
}

export interface SearchMatch {
  readonly index: number;
  readonly text: string;
  readonly groups: readonly string[];
  readonly namedGroups: Readonly<Record<string, string>>;
}

export interface RegexToken {
  readonly token: string;
  readonly kind:
    | "literal"
    | "escape"
    | "class"
    | "group"
    | "anchor"
    | "quantifier"
    | "alternation"
    | "lookaround"
    | "modifier"
    | "unknown";
  readonly start: number;
  readonly end: number;
}

export interface RegexAnalysis {
  readonly engine: "ECMAScript RegExp";
  readonly supportedFlags: readonly string[];
  readonly pattern: string;
  readonly valid: boolean;
  readonly error?: string;
  readonly tokens: readonly RegexToken[];
  readonly captureCount: number;
  readonly namedCaptures: readonly string[];
  readonly warnings: readonly string[];
  readonly capabilities: Readonly<Record<string, boolean>>;
}

export interface RegexEvaluation {
  readonly state: SearchState;
  readonly matches: readonly SearchMatch[];
  readonly durationMs: number;
  readonly analysis: RegexAnalysis;
}

const REGEX_FLAGS = ["d", "g", "i", "m", "s", "u", "v", "y"] as const;

function copySearch(state: SearchState): SearchState {
  return { ...state };
}

function safeFlags(flags: string): string {
  return [...new Set(flags.split("").filter((flag) => REGEX_FLAGS.includes(flag as (typeof REGEX_FLAGS)[number])))]
    .join("");
}

function compilePattern(pattern: string, flags: string): RegExp {
  return new RegExp(pattern, safeFlags(flags));
}

function scanRegex(pattern: string): RegexToken[] {
  const tokens: RegexToken[] = [];
  let index = 0;
  while (index < pattern.length) {
    const start = index;
    const char = pattern[index];
    if (char === "\\") {
      index = Math.min(pattern.length, index + 2);
      tokens.push({ token: pattern.slice(start, index), kind: "escape", start, end: index });
    } else if (char === "[") {
      index += 1;
      while (index < pattern.length && pattern[index] !== "]") index += pattern[index] === "\\" ? 2 : 1;
      index = Math.min(pattern.length, index + 1);
      tokens.push({ token: pattern.slice(start, index), kind: "class", start, end: index });
    } else if (char === "(") {
      const end = pattern.indexOf(")", index + 1);
      index = end < 0 ? pattern.length : end + 1;
      const token = pattern.slice(start, index);
      const kind = token.startsWith("(?=") || token.startsWith("(?!") || token.startsWith("(?<=") || token.startsWith("(?<!")
        ? "lookaround"
        : "group";
      tokens.push({ token, kind, start, end: index });
    } else if ("^$\\b".includes(char)) {
      index += 1;
      tokens.push({ token: char, kind: "anchor", start, end: index });
    } else if ("*+?{".includes(char)) {
      index += 1;
      while (index < pattern.length && "0123456789,}".includes(pattern[index])) index += 1;
      if (pattern[index] === "?") index += 1;
      tokens.push({ token: pattern.slice(start, index), kind: "quantifier", start, end: index });
    } else if (char === "|") {
      index += 1;
      tokens.push({ token: char, kind: "alternation", start, end: index });
    } else if (char === "(?") {
      index += 1;
      tokens.push({ token: char, kind: "modifier", start, end: index });
    } else {
      index += 1;
      tokens.push({ token: char, kind: char === "." ? "unknown" : "literal", start, end: index });
    }
  }
  return tokens;
}

export class RegexWorkbench {
  readonly state: SearchState;

  constructor(id: string, initial: Partial<Omit<SearchState, "id">> = {}) {
    this.state = {
      id,
      query: initial.query ?? "",
      pattern: initial.pattern ?? initial.query ?? "",
      flags: safeFlags(initial.flags ?? "gi"),
      mode: initial.mode ?? "text",
      lastError: initial.lastError,
    };
  }

  setQuery(query: string): this {
    this.state.query = query;
    if (this.state.mode === "text") this.state.pattern = query;
    this.state.lastError = undefined;
    return this;
  }

  setPattern(pattern: string): this {
    this.state.pattern = pattern;
    this.state.query = pattern;
    this.state.lastError = undefined;
    return this;
  }

  setFlags(flags: string): this {
    this.state.flags = safeFlags(flags);
    this.state.lastError = undefined;
    return this;
  }

  setMode(mode: MatchMode): this {
    this.state.mode = mode;
    this.state.pattern = mode === "text" ? this.state.query : this.state.pattern || this.state.query;
    this.state.lastError = undefined;
    return this;
  }

  analysis(): RegexAnalysis {
    const pattern = this.state.mode === "text" ? escapeRegex(this.state.query) : this.state.pattern;
    try {
      const regex = compilePattern(pattern, this.state.flags);
      const namedCaptures = [...pattern.matchAll(/\(\?<([A-Za-z_$][\w$]*)>/g)].map((match) => match[1]);
      const warnings: string[] = [];
      if (/(\+|\*|\{\d+,\})[^|)]*(\+|\*|\{\d+,\})/.test(pattern)) warnings.push("Nested unbounded quantifiers may backtrack heavily.");
      if (regex.sticky && !regex.global) warnings.push("Sticky matching requires an explicit starting index.");
      return {
        engine: "ECMAScript RegExp",
        supportedFlags: REGEX_FLAGS,
        pattern,
        valid: true,
        tokens: scanRegex(pattern),
        captureCount: (pattern.match(/\((?!\?)/g) ?? []).length,
        namedCaptures,
        warnings,
        capabilities: {
          literals: true,
          escapes: true,
          unicodeClasses: true,
          characterClassIntersection: false,
          characterClassSubtraction: false,
          namedGroups: true,
          numberedGroups: true,
          nonCapturingGroups: true,
          atomicGroups: false,
          possessiveQuantifiers: false,
          lookahead: pattern.includes("(?=") || pattern.includes("(?!"),
          lookbehind: pattern.includes("(?<=") || pattern.includes("(?<!"),
          backreferences: /\\\d+/.test(pattern),
          conditionals: false,
          subroutines: false,
          inlineModifiers: false,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        engine: "ECMAScript RegExp",
        supportedFlags: REGEX_FLAGS,
        pattern,
        valid: false,
        error: message,
        tokens: scanRegex(pattern),
        captureCount: 0,
        namedCaptures: [],
        warnings: [],
        capabilities: {},
      };
    }
  }

  evaluate(input: string): RegexEvaluation {
    const analysis = this.analysis();
    if (!analysis.valid) {
      this.state.lastError = analysis.error;
      return { state: copySearch(this.state), matches: [], durationMs: 0, analysis };
    }
    const started = performance.now();
    const regex = compilePattern(analysis.pattern, this.state.flags.includes("g") ? this.state.flags : `${this.state.flags}g`);
    const matches: SearchMatch[] = [];
    let match: RegExpExecArray | null;
    let iterations = 0;
    while ((match = regex.exec(input)) && iterations++ < 10000) {
      matches.push({ index: match.index, text: match[0], groups: [...match].slice(1), namedGroups: { ...(match.groups ?? {}) } });
      if (match[0] === "") regex.lastIndex += 1;
    }
    return { state: copySearch(this.state), matches, durationMs: performance.now() - started, analysis };
  }

  replacementPreview(input: string, replacement: string): string {
    const analysis = this.analysis();
    if (!analysis.valid) return input;
    return input.replace(compilePattern(analysis.pattern, this.state.flags), replacement);
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface TabRecord {
  readonly id: string;
  label: string;
  title?: string;
  groupId?: string;
  pinned: boolean;
  locked: boolean;
  dirty: boolean;
  destination: string;
  appearanceId?: string;
}

export interface TabGroup {
  readonly id: string;
  name: string;
  color?: string;
  collapsed: boolean;
  tabIds: string[];
}

export interface TabSearchResult {
  readonly tabId?: string;
  readonly groupId?: string;
  readonly stripEdge: DockEdge;
  readonly label: string;
  readonly pinned: boolean;
  readonly locked: boolean;
  readonly location: string;
}

export interface TabStripState {
  edge: DockEdge;
  activeTabId?: string;
  tabs: TabRecord[];
  groups: TabGroup[];
  searches: Record<"strip" | "group" | "groups" | "master", SearchState>;
}

export interface BulkClosePreview {
  readonly mode: BulkCloseMode;
  readonly query: string;
  readonly matchedTabIds: readonly string[];
  readonly excludedPinnedIds: readonly string[];
  readonly excludedLockedIds: readonly string[];
  readonly dirtyTabIds: readonly string[];
  readonly requiresConfirmation: boolean;
  readonly valid: boolean;
  readonly invalidReason?: "empty-query" | "invalid-pattern";
}

function tabMatches(tab: TabRecord, workbench: RegexWorkbench): boolean {
  return workbench.evaluate(`${tab.label}\n${tab.title ?? ""}`).matches.length > 0;
}

export class TabStripEngine {
  readonly state: TabStripState;
  readonly workbenches: Readonly<Record<"strip" | "group" | "groups" | "master", RegexWorkbench>>;

  constructor(initial?: Partial<TabStripState>) {
    const defaults = {
      strip: new RegexWorkbench("tab-strip-search"),
      group: new RegexWorkbench("tab-group-search"),
      groups: new RegexWorkbench("tab-group-name-search"),
      master: new RegexWorkbench("tab-master-search"),
    } as const;
    this.workbenches = defaults;
    this.state = {
      edge: initial?.edge ?? "left",
      activeTabId: initial?.activeTabId,
      tabs: (initial?.tabs ?? []).map((tab) => ({ ...tab })),
      groups: (initial?.groups ?? []).map((group) => ({ ...group, tabIds: [...group.tabIds] })),
      searches: {
        strip: initial?.searches?.strip ?? { ...defaults.strip.state },
        group: initial?.searches?.group ?? { ...defaults.group.state },
        groups: initial?.searches?.groups ?? { ...defaults.groups.state },
        master: initial?.searches?.master ?? { ...defaults.master.state },
      },
    };
  }

  setDockEdge(edge: DockEdge): this { this.state.edge = edge; return this; }
  addTab(tab: Omit<TabRecord, "pinned" | "locked" | "dirty"> & Partial<Pick<TabRecord, "pinned" | "locked" | "dirty">>): this {
    if (this.state.tabs.some((item) => item.id === tab.id)) throw new Error(`Duplicate tab id: ${tab.id}`);
    this.state.tabs.push({ pinned: false, locked: false, dirty: false, ...tab });
    if (!this.state.activeTabId) this.state.activeTabId = tab.id;
    if (tab.groupId) this.ensureGroupMembership(tab.groupId, tab.id);
    return this;
  }
  removeTab(tabId: string): boolean {
    const tab = this.findTab(tabId);
    if (!tab || tab.dirty) return false;
    this.state.tabs = this.state.tabs.filter((item) => item.id !== tabId);
    for (const group of this.state.groups) group.tabIds = group.tabIds.filter((id) => id !== tabId);
    if (this.state.activeTabId === tabId) this.state.activeTabId = this.state.tabs[0]?.id;
    return true;
  }
  pinTab(tabId: string, pinned = true): this { const tab = this.findTab(tabId); if (tab) tab.pinned = pinned; return this; }
  setTabDirty(tabId: string, dirty: boolean): this { const tab = this.findTab(tabId); if (tab) tab.dirty = dirty; return this; }
  reorderTabs(orderedIds: readonly string[]): this {
    const order = new Map(orderedIds.map((id, index) => [id, index]));
    this.state.tabs.sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    return this;
  }
  createGroup(name: string, id = `group-${this.state.groups.length + 1}`): TabGroup {
    if (this.state.groups.some((group) => group.id === id)) throw new Error(`Duplicate group id: ${id}`);
    const group: TabGroup = { id, name, collapsed: false, tabIds: [] };
    this.state.groups.push(group);
    return group;
  }
  updateGroup(groupId: string, patch: Partial<Pick<TabGroup, "name" | "color" | "collapsed">>): this {
    const group = this.state.groups.find((item) => item.id === groupId);
    if (group) Object.assign(group, patch);
    return this;
  }
  moveTabToGroup(tabId: string, groupId?: string): this {
    const tab = this.findTab(tabId);
    if (!tab) return this;
    for (const group of this.state.groups) group.tabIds = group.tabIds.filter((id) => id !== tabId);
    tab.groupId = groupId;
    if (groupId) this.ensureGroupMembership(groupId, tabId);
    return this;
  }
  private ensureGroupMembership(groupId: string, tabId: string): void {
    const group = this.state.groups.find((item) => item.id === groupId);
    if (group && !group.tabIds.includes(tabId)) group.tabIds.push(tabId);
  }
  private findTab(tabId: string): TabRecord | undefined { return this.state.tabs.find((tab) => tab.id === tabId); }

  setSearch(scope: keyof TabStripState["searches"], patch: Partial<Omit<SearchState, "id">>): this {
    const current = this.state.searches[scope];
    const workbench = this.workbenches[scope];
    if (patch.query !== undefined) workbench.setQuery(patch.query);
    if (patch.pattern !== undefined) workbench.setPattern(patch.pattern);
    if (patch.flags !== undefined) workbench.setFlags(patch.flags);
    if (patch.mode !== undefined) workbench.setMode(patch.mode);
    this.state.searches[scope] = { ...current, ...workbench.state, ...patch };
    return this;
  }

  searchStrip(): TabSearchResult[] {
    const workbench = this.workbenches.strip;
    return this.state.tabs.filter((tab) => tabMatches(tab, workbench)).map((tab) => this.result(tab));
  }
  searchGroup(groupId: string): TabSearchResult[] {
    const workbench = this.workbenches.group;
    const group = this.state.groups.find((item) => item.id === groupId);
    if (!group) return [];
    return group.tabIds.map((id) => this.findTab(id)).filter((tab): tab is TabRecord => !!tab && tabMatches(tab, workbench)).map((tab) => this.result(tab));
  }
  searchGroups(): TabSearchResult[] {
    const workbench = this.workbenches.groups;
    return this.state.groups.filter((group) => workbench.evaluate(group.name).matches.length > 0).map((group) => ({
      groupId: group.id, stripEdge: this.state.edge, label: group.name, pinned: false, locked: false, location: `group:${group.id}`,
    }));
  }
  searchAll(): TabSearchResult[] {
    const workbench = this.workbenches.master;
    return this.state.tabs.filter((tab) => tabMatches(tab, workbench)).map((tab) => this.result(tab));
  }
  private result(tab: TabRecord): TabSearchResult { return { tabId: tab.id, groupId: tab.groupId, stripEdge: this.state.edge, label: tab.label, pinned: tab.pinned, locked: tab.locked, location: tab.groupId ? `group:${tab.groupId}/tab:${tab.id}` : `tab:${tab.id}` }; }

  previewBulkClose(mode: BulkCloseMode, query: string, options: { includePinned?: boolean; includeLocked?: boolean; includeDirty?: boolean; matchMode?: MatchMode; pattern?: string; flags?: string } = {}): BulkClosePreview {
    const workbench = new RegexWorkbench(`bulk-close-${mode}`).setMode(options.matchMode ?? "text").setQuery(query);
    if (options.pattern !== undefined) workbench.setPattern(options.pattern);
    else if (options.matchMode === "regex") workbench.setPattern(query);
    if (options.flags !== undefined) workbench.setFlags(options.flags);
    if (!query.trim()) return { mode, query, matchedTabIds: [], excludedPinnedIds: [], excludedLockedIds: [], dirtyTabIds: [], requiresConfirmation: false, valid: false, invalidReason: "empty-query" };
    if (!workbench.analysis().valid) return { mode, query, matchedTabIds: [], excludedPinnedIds: [], excludedLockedIds: [], dirtyTabIds: [], requiresConfirmation: false, valid: false, invalidReason: "invalid-pattern" };
    const match = (tab: TabRecord) => tabMatches(tab, workbench);
    const matched = this.state.tabs.filter((tab) => mode === "contains" ? match(tab) : !match(tab));
    const excludedPinnedIds = options.includePinned ? [] : matched.filter((tab) => tab.pinned).map((tab) => tab.id);
    const excludedLockedIds = options.includeLocked ? [] : matched.filter((tab) => tab.locked).map((tab) => tab.id);
    const dirtyTabIds = matched.filter((tab) => tab.dirty).map((tab) => tab.id);
    const matchedTabIds = matched.filter((tab) => !excludedPinnedIds.includes(tab.id) && !excludedLockedIds.includes(tab.id) && (options.includeDirty || !tab.dirty)).map((tab) => tab.id);
    return { mode, query, matchedTabIds, excludedPinnedIds, excludedLockedIds, dirtyTabIds, requiresConfirmation: matchedTabIds.length > 0, valid: true };
  }
}

export interface PaletteControl {
  readonly type: "switch" | "slider" | "select" | "color" | "text" | "action";
  readonly value?: string | number | boolean;
  readonly min?: number;
  readonly max?: number;
  readonly options?: readonly string[];
  readonly accessibleName: string;
}

export interface PaletteEntry {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly destination: { tabId?: string; groupId?: string; pageId: string; elementId?: string };
  readonly control?: PaletteControl;
  readonly command?: () => void;
}

export class CommandPaletteModel {
  private entries: PaletteEntry[] = [];
  private readonly search = new RegexWorkbench("command-palette-search");
  size: "card" | "window" = "card";

  register(entry: PaletteEntry): this { if (!this.entries.some((item) => item.id === entry.id)) this.entries.push(entry); return this; }
  unregister(id: string): this { this.entries = this.entries.filter((entry) => entry.id !== id); return this; }
  setSearch(patch: Partial<Omit<SearchState, "id">>): this { if (patch.query !== undefined) this.search.setQuery(patch.query); if (patch.pattern !== undefined) this.search.setPattern(patch.pattern); if (patch.flags !== undefined) this.search.setFlags(patch.flags); if (patch.mode !== undefined) this.search.setMode(patch.mode); return this; }
  results(): readonly PaletteEntry[] {
    if (!this.search.state.query) return this.entries;
    return this.entries.filter((entry) => this.search.evaluate(`${entry.label}\n${entry.description ?? ""}`).matches.length > 0);
  }
  activate(id: string): PaletteEntry["destination"] | undefined { const entry = this.entries.find((item) => item.id === id); entry?.command?.(); return entry?.destination; }
  shortcut = "Ctrl+Shift+F" as const;
}

export type NotificationKind = "info" | "success" | "progress" | "error" | "warning";
export interface NotificationRecord { readonly id: string; readonly kind: NotificationKind; title: string; body: string; readonly createdAt: string; dismissed: boolean; action?: { label: string; invoke: () => void }; }
export interface HistoryRecord { readonly id: string; readonly action: string; readonly label: string; readonly createdAt: string; readonly redacted: boolean; }

export class NotificationCenter {
  private readonly items: NotificationRecord[] = [];
  notify(input: Omit<NotificationRecord, "createdAt" | "dismissed"> & Partial<Pick<NotificationRecord, "createdAt" | "dismissed">>): NotificationRecord {
    const item: NotificationRecord = { ...input, createdAt: input.createdAt ?? new Date().toISOString(), dismissed: input.dismissed ?? false };
    this.items.push(item);
    return item;
  }
  dismiss(id: string): boolean { const item = this.items.find((entry) => entry.id === id); if (!item) return false; item.dismissed = true; return true; }
  list(includeDismissed = true): readonly NotificationRecord[] { return this.items.filter((item) => includeDismissed || !item.dismissed); }
  bulkDismiss(ids: readonly string[]): number { const set = new Set(ids); let count = 0; for (const item of this.items) if (set.has(item.id) && !item.dismissed) { item.dismissed = true; count += 1; } return count; }
}

export class HistoryStore {
  private readonly records: HistoryRecord[] = [];
  append(action: string, label: string, id = `history-${this.records.length + 1}`): HistoryRecord { const record = { id, action, label, createdAt: new Date().toISOString(), redacted: true }; this.records.push(record); return record; }
  list(filter: { text?: string; actions?: readonly string[]; from?: string; to?: string } = {}): readonly HistoryRecord[] {
    const query = (filter.text ?? "").toLocaleLowerCase();
    const actions = filter.actions ? new Set(filter.actions) : undefined;
    return this.records.filter((record) => (!query || `${record.action} ${record.label}`.toLocaleLowerCase().includes(query)) && (!actions || actions.has(record.action)) && (!filter.from || record.createdAt >= filter.from) && (!filter.to || record.createdAt <= filter.to));
  }
}

export class BulkSelection<T extends { id: string }> {
  private readonly selectedIds = new Set<string>();
  select(id: string, selected = true): this { selected ? this.selectedIds.add(id) : this.selectedIds.delete(id); return this; }
  toggle(id: string): this { return this.select(id, !this.selectedIds.has(id)); }
  selectAll(items: readonly T[]): this { for (const item of items) this.selectedIds.add(item.id); return this; }
  invert(items: readonly T[]): this { for (const item of items) this.toggle(item.id); return this; }
  clear(): this { this.selectedIds.clear(); return this; }
  ids(): readonly string[] { return [...this.selectedIds]; }
  items(items: readonly T[]): readonly T[] { return items.filter((item) => this.selectedIds.has(item.id)); }
}

export interface LayerState { readonly id: string; name: string; visible: boolean; locked: boolean; opacity: number; blendMode: string; order: number; }
export type AppearanceStateName = "normal" | "hover" | "focus" | "pressed" | "selected" | "disabled" | "dragged" | "validation" | "loading" | "success" | "warning" | "error";
export interface ElementAppearance { readonly elementId: string; states: Record<AppearanceStateName, { layers: LayerState[]; properties: Record<string, unknown> }>; }

export const RAINBOW_SENTINEL = "__WLR_RAINBOW__" as const;
export const RAINBOW_SPEED_SECONDS: Readonly<Record<number, number>> = { 1: 2, 2: 4, 3: 8, 4: 16, 5: 32 };

export interface ColorPickerState { value: string | ColorValue; rainbowSpeed: 1 | 2 | 3 | 4 | 5; reducedMotion: boolean; resolvedValue: string; }

/** A continuous picker model. Rendering the spectrum or wheel belongs to the adapter. */
export class InfiniteColorPickerModel {
  readonly state: ColorPickerState = { value: "#000000", rainbowSpeed: 3, reducedMotion: false, resolvedValue: "#000000" };
  setValue(value: string | ColorValue): this { this.state.value = value; this.state.resolvedValue = value === RAINBOW_SENTINEL ? this.resolveRainbow() : typeof value === "string" ? value : translateColor(value, "hex"); return this; }
  setRainbowSpeed(level: number): this { this.state.rainbowSpeed = Math.max(1, Math.min(5, Math.round(level))) as ColorPickerState["rainbowSpeed"]; this.state.resolvedValue = this.resolveRainbow(); return this; }
  setReducedMotion(reducedMotion: boolean): this { this.state.reducedMotion = reducedMotion; this.state.resolvedValue = this.resolveRainbow(); return this; }
  resolveRainbow(hue = 210): string { if (this.state.value !== RAINBOW_SENTINEL) return this.state.resolvedValue; return `hsl(${hue} 72% 52% / 1)`; }
  cssAnimation(): { name: "rainbow-hue-cycle"; durationSeconds: number; reducedMotion: boolean } | undefined { if (this.state.value !== RAINBOW_SENTINEL || this.state.reducedMotion) return undefined; return { name: "rainbow-hue-cycle", durationSeconds: RAINBOW_SPEED_SECONDS[this.state.rainbowSpeed], reducedMotion: false }; }
}

export interface ColorValue { space: "named" | "hex" | "rgb" | "hsl" | "hsv" | "hwb" | "lab" | "lch" | "oklab" | "oklch" | "cmyk"; values: number[]; alpha: number; name?: string; }

const NAMED_COLORS: Readonly<Record<string, string>> = { black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff", transparent: "#00000000" };

function hexToRgb(hex: string): [number, number, number, number] {
  const clean = hex.replace(/^#/, "");
  const value = clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean;
  const padded = value.padEnd(8, "f");
  return [parseInt(padded.slice(0, 2), 16), parseInt(padded.slice(2, 4), 16), parseInt(padded.slice(4, 6), 16), parseInt(padded.slice(6, 8), 16) / 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b); const light = (max + min) / 2; const delta = max - min;
  if (!delta) return [0, 0, light * 100];
  const saturation = delta / (1 - Math.abs(2 * light - 1)); let hue = 0;
  if (max === r) hue = 60 * (((g - b) / delta) % 6); else if (max === g) hue = 60 * ((b - r) / delta + 2); else hue = 60 * ((r - g) / delta + 4);
  return [(hue + 360) % 360, saturation * 100, light * 100];
}

function parseColor(input: string): ColorValue {
  const trimmed = input.trim().toLocaleLowerCase();
  if (trimmed === RAINBOW_SENTINEL.toLocaleLowerCase()) return { space: "named", values: [], alpha: 1, name: RAINBOW_SENTINEL };
  if (NAMED_COLORS[trimmed]) { const [r, g, b, alpha] = hexToRgb(NAMED_COLORS[trimmed]); return { space: "named", values: [r, g, b], alpha, name: trimmed }; }
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) { const [r, g, b, alpha] = hexToRgb(trimmed); return { space: "hex", values: [r, g, b], alpha }; }
  const rgb = trimmed.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) { const values = rgb[1].split(/[,/ ]+/).filter(Boolean).map(Number); return { space: "rgb", values: values.slice(0, 3), alpha: values[3] ?? 1 }; }
  const hsl = trimmed.match(/^hsla?\(([^)]+)\)$/);
  if (hsl) { const values = hsl[1].split(/[,/ ]+/).filter(Boolean).map((value) => Number(value.replace(/%$/, ""))); return { space: "hsl", values: values.slice(0, 3), alpha: values[3] ?? 1 }; }
  const functional = trimmed.match(/^(hsv|hsb|hwb|lab|lch|oklab|oklch|cmyk)\(([^)]+)\)$/);
  if (functional) {
    const space = functional[1] === "hsb" ? "hsv" : functional[1] as ColorValue["space"];
    const values = functional[2].split(/[,/ ]+/).filter(Boolean).map((value) => Number(value.replace(/%$/, "")));
    return { space, values: values.slice(0, space === "cmyk" ? 4 : 3), alpha: values[space === "cmyk" ? 4 : 3] ?? 1 };
  }
  throw new Error(`Unsupported color representation: ${input}`);
}

export function translateColor(input: string | ColorValue, target: ColorValue["space"]): string {
  const source = typeof input === "string" ? parseColor(input) : input;
  if (source.name === RAINBOW_SENTINEL) return RAINBOW_SENTINEL;
  const rgb = colorToRgb(source);
  if (target === "rgb") return `rgb(${Math.round(rgb[0])} ${Math.round(rgb[1])} ${Math.round(rgb[2])} / ${trimNumber(rgb[3])})`;
  if (target === "hex") return `#${rgb.slice(0, 3).map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}${rgb[3] < 1 ? Math.round(rgb[3] * 255).toString(16).padStart(2, "0") : ""}`;
  if (target === "hsl") { const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]); return `hsl(${trimNumber(h)} ${trimNumber(s)}% ${trimNumber(l)}% / ${trimNumber(rgb[3])})`; }
  if (target === "named") { const hex = translateColor({ space: "rgb", values: rgb.slice(0, 3), alpha: rgb[3] }, "hex"); const entry = Object.entries(NAMED_COLORS).find(([, value]) => value === hex); return entry?.[0] ?? hex; }
  if (target === "hsv") { const [h, s, v] = rgbToHsv(rgb[0], rgb[1], rgb[2]); return `hsv(${trimNumber(h)} ${trimNumber(s)}% ${trimNumber(v)}% / ${trimNumber(rgb[3])})`; }
  if (target === "hwb") { const [h, w, b] = rgbToHwb(rgb[0], rgb[1], rgb[2]); return `hwb(${trimNumber(h)} ${trimNumber(w)}% ${trimNumber(b)}% / ${trimNumber(rgb[3])})`; }
  if (target === "cmyk") { const [c, m, y, k] = rgbToCmyk(rgb[0], rgb[1], rgb[2]); return `cmyk(${trimNumber(c)}% ${trimNumber(m)}% ${trimNumber(y)}% ${trimNumber(k)}% / ${trimNumber(rgb[3])})`; }
  const lab = rgbToLab(rgb[0], rgb[1], rgb[2]);
  if (target === "lab") return `lab(${trimNumber(lab[0])}% ${trimNumber(lab[1])} ${trimNumber(lab[2])} / ${trimNumber(rgb[3])})`;
  if (target === "lch") return `lch(${trimNumber(lab[0])}% ${trimNumber(Math.hypot(lab[1], lab[2]))} ${trimNumber((Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360)} / ${trimNumber(rgb[3])})`;
  const oklab = rgbToOklab(rgb[0], rgb[1], rgb[2]);
  if (target === "oklab") return `oklab(${trimNumber(oklab[0])} ${trimNumber(oklab[1])} ${trimNumber(oklab[2])} / ${trimNumber(rgb[3])})`;
  if (target === "oklch") return `oklch(${trimNumber(oklab[0])} ${trimNumber(Math.hypot(oklab[1], oklab[2]))} ${trimNumber((Math.atan2(oklab[2], oklab[1]) * 180 / Math.PI + 360) % 360)} / ${trimNumber(rgb[3])})`;
  throw new Error(`Unsupported target color space: ${target}`);
}

function colorToRgb(source: ColorValue): [number, number, number, number] {
  if (source.space === "rgb" || source.space === "hex" || source.space === "named") return [source.values[0], source.values[1], source.values[2], source.alpha];
  if (source.space === "hsl") {
    const [h, s, l] = source.values; const sat = s / 100, light = l / 100; const chroma = (1 - Math.abs(2 * light - 1)) * sat; const x = chroma * (1 - Math.abs((h / 60) % 2 - 1)); const m = light - chroma / 2; const segment = h / 60; const base = segment < 1 ? [chroma, x, 0] : segment < 2 ? [x, chroma, 0] : segment < 3 ? [0, chroma, x] : segment < 4 ? [0, x, chroma] : segment < 5 ? [x, 0, chroma] : [chroma, 0, x]; return [(base[0] + m) * 255, (base[1] + m) * 255, (base[2] + m) * 255, source.alpha];
  }
  if (source.space === "hsv") return [...hsvToRgb(source.values[0], source.values[1], source.values[2]), source.alpha];
  if (source.space === "hwb") { const [h, w, b] = source.values; const base = hsvToRgb(h, 100, 100); const whiteness = w / 100, blackness = b / 100; if (whiteness + blackness >= 1) { const gray = whiteness / (whiteness + blackness) * 255; return [gray, gray, gray, source.alpha]; } const factor = (1 - whiteness - blackness) / 255; return [base[0] * factor + whiteness * 255, base[1] * factor + whiteness * 255, base[2] * factor + whiteness * 255, source.alpha]; }
  if (source.space === "cmyk") { const [c, m, y, k] = source.values.map((value) => value / 100); return [255 * (1 - Math.min(1, c * (1 - k) + k)), 255 * (1 - Math.min(1, m * (1 - k) + k)), 255 * (1 - Math.min(1, y * (1 - k) + k)), source.alpha]; }
  if (source.space === "lab" || source.space === "lch") { const lab = source.space === "lab" ? source.values : [source.values[0], source.values[1] * Math.cos(source.values[2] * Math.PI / 180), source.values[1] * Math.sin(source.values[2] * Math.PI / 180)]; return [...labToRgb(lab[0], lab[1], lab[2]), source.alpha]; }
  if (source.space === "oklab" || source.space === "oklch") { const lab = source.space === "oklab" ? source.values : [source.values[0], source.values[1] * Math.cos(source.values[2] * Math.PI / 180), source.values[1] * Math.sin(source.values[2] * Math.PI / 180)]; return [...oklabToRgb(lab[0], lab[1], lab[2]), source.alpha]; }
  throw new Error(`Unsupported color space: ${source.space}`);
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min; let h = 0; if (delta) h = max === r ? 60 * (((g - b) / delta) % 6) : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4); return [(h + 360) % 360, max ? delta / max * 100 : 0, max * 100]; }
function hsvToRgb(h: number, s: number, v: number): [number, number, number] { const sat = s / 100, value = v / 100, chroma = value * sat, x = chroma * (1 - Math.abs((h / 60) % 2 - 1)), m = value - chroma, segment = h / 60; const base = segment < 1 ? [chroma, x, 0] : segment < 2 ? [x, chroma, 0] : segment < 3 ? [0, chroma, x] : segment < 4 ? [0, x, chroma] : segment < 5 ? [x, 0, chroma] : [chroma, 0, x]; return [(base[0] + m) * 255, (base[1] + m) * 255, (base[2] + m) * 255]; }
function rgbToHwb(r: number, g: number, b: number): [number, number, number] { const [h] = rgbToHsv(r, g, b); const white = Math.min(r, g, b) / 255; const black = 1 - Math.max(r, g, b) / 255; return [h, white * 100, black * 100]; }
function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] { const red = r / 255, green = g / 255, blue = b / 255, k = 1 - Math.max(red, green, blue); if (k >= 1) return [0, 0, 0, 100]; return [(1 - red - k) / (1 - k) * 100, (1 - green - k) / (1 - k) * 100, (1 - blue - k) / (1 - k) * 100, k * 100]; }
function linearize(channel: number): number { const value = channel / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; }
function delinearize(channel: number): number { return 255 * (channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055); }
function rgbToLab(r: number, g: number, b: number): [number, number, number] { const red = linearize(r), green = linearize(g), blue = linearize(b); const x = (red * 0.4124564 + green * 0.3575761 + blue * 0.1804375) / 0.95047, y = (red * 0.2126729 + green * 0.7151522 + blue * 0.072175) / 1, z = (red * 0.0193339 + green * 0.119192 + blue * 0.9503041) / 1.08883; const f = (value: number) => value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116; const fx = f(x), fy = f(y), fz = f(z); return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]; }
function labToRgb(l: number, a: number, b: number): [number, number, number] { const fy = (l + 16) / 116, fx = fy + a / 500, fz = fy - b / 200; const finv = (value: number) => { const cube = value ** 3; return cube > 0.008856 ? cube : (value - 16 / 116) / 7.787; }; const x = finv(fx) * 0.95047, y = finv(fy), z = finv(fz) * 1.08883; const red = x * 3.2404542 + y * -1.5371385 + z * -0.4985314, green = x * -0.969266 + y * 1.8760108 + z * 0.041556, blue = x * 0.0556434 + y * -0.2040259 + z * 1.0572252; return [delinearize(red), delinearize(green), delinearize(blue)]; }
function rgbToOklab(r: number, g: number, b: number): [number, number, number] { const red = linearize(r), green = linearize(g), blue = linearize(b); const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue), m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue), s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue); return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]; }
function oklabToRgb(l: number, a: number, b: number): [number, number, number] { const ll = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3, mm = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3, ss = (l - 0.0894841775 * a - 1.291485548 * b) ** 3; return [delinearize(4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss), delinearize(-1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss), delinearize(-0.0041960863 * ll - 0.7034186147 * mm + 1.707614701 * ss)]; }

function trimNumber(value: number): string { return Number(value.toFixed(4)).toString(); }

export class AppearanceEditorModel {
  private readonly elements = new Map<string, ElementAppearance>();
  register(elementId: string): ElementAppearance {
    const existing = this.elements.get(elementId); if (existing) return existing;
    const states = {} as ElementAppearance["states"];
    for (const state of ["normal", "hover", "focus", "pressed", "selected", "disabled", "dragged", "validation", "loading", "success", "warning", "error"] as AppearanceStateName[]) states[state] = { layers: [], properties: {} };
    const result = { elementId, states }; this.elements.set(elementId, result); return result;
  }
  addLayer(elementId: string, state: AppearanceStateName, layer: Omit<LayerState, "order">): LayerState { const target = this.register(elementId).states[state]; const created = { ...layer, order: target.layers.length }; target.layers.push(created); return created; }
  setProperty(elementId: string, state: AppearanceStateName, property: string, value: unknown): this { this.register(elementId).states[state].properties[property] = value; return this; }
  reset(elementId?: string, state?: AppearanceStateName): this { const targets = elementId ? [this.register(elementId)] : [...this.elements.values()]; for (const target of targets) for (const key of (state ? [state] : Object.keys(target.states) as AppearanceStateName[])) target.states[key] = { layers: [], properties: {} }; return this; }
  snapshot(): readonly ElementAppearance[] { return [...this.elements.values()].map((element) => ({ elementId: element.elementId, states: Object.fromEntries(Object.entries(element.states).map(([key, value]) => [key, { layers: value.layers.map((layer) => ({ ...layer })), properties: { ...value.properties } }])) as ElementAppearance["states"] })); }
}

export interface LockRecord { readonly id: string; readonly elementId: string; policy: LockPolicy; unlockMinutes?: number; locked: boolean; createdAt: string; }
export interface LockAttempt { readonly policy: LockPolicy; verified: Record<"pin" | "password" | "totp", boolean>; complete: boolean; }

function factorsForPolicy(policy: LockPolicy): Array<"pin" | "password" | "totp"> { return policy.split("-") as Array<"pin" | "password" | "totp">; }

export class LockManager {
  private readonly locks = new Map<string, LockRecord>();
  private readonly attempts = new Map<string, LockAttempt>();
  create(elementId: string, policy: LockPolicy, unlockMinutes?: number, id = `lock-${elementId}`): LockRecord { if (!LOCK_POLICIES.includes(policy)) throw new Error(`Unknown lock policy: ${policy}`); const lock = { id, elementId, policy, unlockMinutes, locked: true, createdAt: new Date().toISOString() }; this.locks.set(id, lock); return lock; }
  list(): readonly LockRecord[] { return [...this.locks.values()]; }
  remove(id: string): boolean { this.attempts.delete(id); return this.locks.delete(id); }
  begin(id: string): LockAttempt { const lock = this.require(id); const attempt = { policy: lock.policy, verified: { pin: false, password: false, totp: false }, complete: false }; this.attempts.set(id, attempt); return attempt; }
  provide(id: string, factor: "pin" | "password" | "totp", valid: boolean): LockAttempt { const lock = this.require(id); const attempt = this.attempts.get(id) ?? this.begin(id); if (factorsForPolicy(lock.policy).includes(factor)) attempt.verified[factor] = valid; attempt.complete = factorsForPolicy(lock.policy).every((item) => attempt.verified[item]); if (attempt.complete) lock.locked = false; return attempt; }
  relock(id: string): this { this.require(id).locked = true; this.attempts.delete(id); return this; }
  canActivate(id: string): boolean { return !this.require(id).locked; }
  private require(id: string): LockRecord { const lock = this.locks.get(id); if (!lock) throw new Error(`Unknown lock: ${id}`); return lock; }
}

export interface DestructiveAuthorization { readonly scope: string; readonly firstKeyId: string; readonly secondKeyId: string; firstVerified: boolean; secondVerified: boolean; progress: number; completed: boolean; cancelled: boolean; }

export class DestructiveConfirmation {
  private current?: DestructiveAuthorization;
  start(scope: string, firstKeyId: string, secondKeyId: string): DestructiveAuthorization { if (firstKeyId === secondKeyId) throw new Error("Destructive confirmation requires two independent keys."); this.current = { scope, firstKeyId, secondKeyId, firstVerified: false, secondVerified: false, progress: 0, completed: false, cancelled: false }; return this.current; }
  verifyKey(keyId: string, valid: boolean): this { if (!this.current || this.current.cancelled) return this; if (keyId === this.current.firstKeyId) this.current.firstVerified = valid; if (keyId === this.current.secondKeyId) this.current.secondVerified = valid; return this; }
  setSlider(progress: number): this { if (this.current && !this.current.cancelled) this.current.progress = Math.max(0, Math.min(1, progress)); return this; }
  cancel(): this { if (this.current) this.current.cancelled = true; return this; }
  canConfirm(): boolean { return !!this.current && !this.current.cancelled && this.current.firstVerified && this.current.secondVerified && this.current.progress >= 1; }
  confirm(action: () => void): boolean { if (!this.canConfirm()) return false; action(); this.current!.completed = true; return true; }
  state(): DestructiveAuthorization | undefined { return this.current; }
}

export interface AccessibilitySemantics { role: "tab" | "tabpanel" | "group" | "button"; label: string; orientation?: "horizontal" | "vertical"; selected?: boolean; disabled?: boolean; focusable: boolean; live?: "polite" | "assertive"; }
export function tabAccessibility(tab: TabRecord, active: boolean, edge: DockEdge): AccessibilitySemantics { return { role: "tab", label: tab.label, orientation: edge === "left" || edge === "right" ? "vertical" : "horizontal", selected: active, disabled: tab.locked, focusable: true }; }
export function reducedMotionDuration(durationMs: number, reducedMotion: boolean): number { return reducedMotion ? 0 : Math.max(0, durationMs); }
