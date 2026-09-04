import type { AdapterDescriptor, FormatCategory } from "./types";

export const REQUIRED_CATEGORIES: readonly FormatCategory[] = [
  "documents-pdf", "images", "audio", "video", "archives",
  "structured-data-spreadsheets", "code-text", "binary-encodings",
];

export class AdapterRegistry {
  private readonly adapters = new Map<string, AdapterDescriptor>();

  register(adapter: AdapterDescriptor): void {
    if (!adapter.id.trim()) throw new Error("Adapter id is required");
    if (this.adapters.has(adapter.id)) throw new Error(`Adapter already registered: ${adapter.id}`);
    const enabled = adapter.bundled && adapter.packagedProof.status === "verified" && adapter.dependencies.every((dependency) => dependency.bundled && dependency.available);
    this.adapters.set(adapter.id, {
      ...adapter,
      availability: enabled ? "enabled" : "disabled",
      unavailableReason: enabled ? undefined : adapter.unavailableReason ?? "Adapter is not bundled and package-proven.",
    });
  }

  all(): AdapterDescriptor[] { return [...this.adapters.values()].map((adapter) => ({ ...adapter })); }
  byCategory(category: FormatCategory): AdapterDescriptor[] { return this.all().filter((adapter) => adapter.category === category); }
  find(id: string): AdapterDescriptor | undefined { return this.adapters.get(id); }
  enabledFor(sourceFormat: string, targetFormat?: string): AdapterDescriptor[] {
    return this.all().filter((adapter) => adapter.availability === "enabled" && adapter.sourceFormats.includes(sourceFormat) && (!targetFormat || adapter.targetFormats.includes(targetFormat)));
  }
  catalog(): { categories: FormatCategory[]; adapters: AdapterDescriptor[]; missingCategories: FormatCategory[] } {
    const adapters = this.all();
    const categories = [...new Set(adapters.map((adapter) => adapter.category))];
    return { categories, adapters, missingCategories: REQUIRED_CATEGORIES.filter((category) => !categories.includes(category)) };
  }
}

/** The registry is honest by default: no external binary is assumed bundled. */
export function createDefaultAdapterRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();
  const add = (id: string, label: string, category: FormatCategory, sourceFormats: string[], targetFormats: string[], sourceSignatures = sourceFormats): void => registry.register({
    id, label, category, sourceFormats, targetFormats, sourceSignatures,
    bundled: false,
    packagedProof: { status: "missing", reason: "No bundled converter proof has been recorded." },
    dependencies: [], lossiness: "unknown", metadataBehavior: "Adapter must declare metadata behavior before enabling.",
    resourceLimits: { maxInputBytes: 512 * 1024 * 1024, maxOutputBytes: 1024 * 1024 * 1024, maxItems: Number.MAX_SAFE_INTEGER },
    availability: "disabled",
  });
  add("pdf-offline", "Documents and PDF", "documents-pdf", ["pdf"], ["pdf", "text"]);
  add("image-offline", "Images", "images", ["png", "jpeg", "gif", "webp", "bmp", "svg"], ["png", "jpeg", "webp"]);
  add("audio-offline", "Audio", "audio", ["mp3", "wav", "flac"], ["mp3", "wav", "flac"]);
  add("video-offline", "Video", "video", ["mp4", "webm", "avi"], ["mp4", "webm"]);
  add("archive-offline", "Archives", "archives", ["zip", "7z", "tar", "gz"], ["zip", "7z"]);
  add("data-offline", "Structured data and spreadsheets", "structured-data-spreadsheets", ["csv", "tsv", "json", "xlsx", "ods"], ["csv", "tsv", "json"]);
  add("text-offline", "Code and text", "code-text", ["text"], ["text", "json", "csv"]);
  add("encoding-offline", "Binary encodings", "binary-encodings", ["base64", "hex"], ["base64", "hex"]);
  return registry;
}
