import { describe, expect, it } from "vitest";
import {
  ATTENTION_MODES, BulkSelection, CommandRegistry, DEFAULT_SETTINGS, JsonStore, NarratorQueue, NotificationCenter,
  RAINBOW_SENTINEL, FEATURE_REGISTRY, isRainbow, normalizeSettings, parseColor, projectSchoolMode, translateColor,
  validateFeatureRegistry,
} from "../../packages/runtime/index";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

describe("runtime settings and persistence", () => {
  it("normalizes bounded settings and survives reload", () => {
    const storage = new MemoryStorage();
    const store = new JsonStore("settings", storage, DEFAULT_SETTINGS, normalizeSettings);
    store.update((settings) => ({ ...settings, tone: { english: 99, cantonese: 0 }, displayName: "  Lens  " }));
    const reloaded = new JsonStore("settings", storage, DEFAULT_SETTINGS, normalizeSettings).get();
    expect(reloaded.tone).toEqual({ english: 5, cantonese: 1 });
    expect(reloaded.displayName).toBe("Lens");
    expect(store.clear(DEFAULT_SETTINGS).displayName).toBe(DEFAULT_SETTINGS.displayName);
  });

  it("projects School mode without mutating the stored state", () => {
    const settings = normalizeSettings({ ...DEFAULT_SETTINGS, language: "bilingual", school: { enabled: true, displayName: "Quiet study" } });
    const projected = projectSchoolMode(settings);
    expect(projected).toMatchObject({ language: "en", showEmojis: false, dimSumVisible: false, personalVocabularyVisible: false, displayName: "Quiet study" });
    expect(settings.language).toBe("bilingual");
  });

  it("keeps the five attention modes explicit", () => { expect(ATTENTION_MODES).toHaveLength(5); expect(new Set(ATTENTION_MODES).size).toBe(5); });
});

describe("narration and notifications", () => {
  it("replaces queued lines within one category and serializes playback", () => {
    const queue = new NarratorQueue();
    queue.enqueue({ id: "1", category: "build", english: "old", cantonese: "舊" });
    queue.enqueue({ id: "2", category: "build", english: "new", cantonese: "新" });
    expect(queue.size()).toBe(1); expect(queue.takeNext()?.id).toBe("2"); expect(queue.takeNext()).toBeNull(); queue.complete(); expect(queue.takeNext()).toBeNull();
  });
  it("retains dismissed records in the review center", () => {
    const center = new NotificationCenter(); center.add({ id: "n1", kind: "info", title: "Ready", body: "Done", createdAt: 1 });
    expect(center.dismiss("n1")).toBe(true); expect(center.list(false)).toHaveLength(0); expect(center.list(true)).toHaveLength(1);
  });
});

describe("commands and bulk operations", () => {
  it("supports bounded plain and regex command search", () => {
    const commands = new CommandRegistry(); commands.register({ id: "open", label: "Open settings", description: "Show controls", target: "settings", run() {} });
    expect(commands.search("settings")).toHaveLength(1); expect(commands.search("^Open", true)).toHaveLength(1); expect(commands.search("[", true)).toHaveLength(0);
  });
  it("supports range selection and inverse selection", () => {
    const selection = new BulkSelection<string>(); const ordered = ["a", "b", "c", "d"];
    selection.toggle("b", ordered); selection.toggle("d", ordered, true); expect(selection.values()).toEqual(["b", "c", "d"]);
    selection.invert(ordered); expect(selection.values()).toEqual(["a"]); selection.clear(); expect(selection.values()).toHaveLength(0);
  });
});

describe("color workbench", () => {
  it("translates a continuous color value and preserves alpha", () => {
    const color = parseColor("#336699cc"); expect(color).not.toBeNull(); expect(translateColor(color!)).toMatchObject({ hex: "#336699cc" });
    expect(translateColor(color!)).toMatchObject({ lab: expect.stringContaining("lab("), lch: expect.stringContaining("lch("), oklab: expect.stringContaining("oklab("), oklch: expect.stringContaining("oklch(") });
    expect(isRainbow(parseColor("rainbow")!)).toBe(true); expect(translateColor(RAINBOW_SENTINEL).sentinel).toBe(RAINBOW_SENTINEL);
    expect(translateColor(parseColor("red")!)).toMatchObject({ named: "red" });
  });
  it("accepts the declared color syntaxes", () => {
    for (const input of ["rgb(51 102 153 / .8)", "hsl(210 50% 40% / .8)", "hsv(210 67% 60% / .8)", "hwb(210 20% 40% / .8)", "cmyk(.67 .33 0 .4)", "lab(50 0 0)", "lch(50 0 0)", "oklab(.5 0 0)", "oklch(.5 0 0)"]) expect(parseColor(input)).not.toBeNull();
  });
});

describe("hand-written feature inventory", () => {
  it("fails closed when an inventory row disappears", () => {
    validateFeatureRegistry();
    expect(() => validateFeatureRegistry(FEATURE_REGISTRY.slice(0, -1))).toThrow(/incomplete/);
  });
});
