import type { CatalogPage, CatalogSnapshot, InstalledModel, ModelTag } from "./types";

const iso = (): string => new Date().toISOString();
export type CatalogPageFetcher = (cursor?: string) => Promise<CatalogPage>;

/** Follow every page and preserve the completeness verdict instead of curating a list. */
export async function refreshCatalog(fetchPage: CatalogPageFetcher, previous?: CatalogSnapshot, now = iso()): Promise<CatalogSnapshot> {
  const items: ModelTag[] = []; let cursor: string | undefined; let pages = 0; let revision: string | undefined;
  try {
    do {
      const page = await fetchPage(cursor); pages += 1; items.push(...page.items); revision ??= page.revision; cursor = page.next;
      if (pages > 10_000) throw new Error("Catalog pagination exceeded its safety bound.");
    } while (cursor);
    const unique = [...new Map(items.map((item) => [item.name, item])).values()];
    return { items: unique, sourceRevision: revision, refreshedAt: now, pages, complete: true, lastSuccessfulRefresh: now, stale: false };
  } catch (error) {
    return { items: previous?.items ?? [], sourceRevision: previous?.sourceRevision, refreshedAt: now, pages, complete: false, stale: true, lastSuccessfulRefresh: previous?.lastSuccessfulRefresh, error: error instanceof Error ? error.message : "Catalog refresh failed." };
  }
}

export function reconcileInstalled(catalog: CatalogSnapshot, installed: readonly InstalledModel[]): ModelTag[] {
  const running = new Set(installed.filter((item) => item.running).map((item) => item.name));
  const byName = new Map<string, ModelTag>();
  for (const item of catalog.items) byName.set(item.name, { ...item, source: "catalog" });
  for (const item of installed) {
    const old = byName.get(item.name);
    byName.set(item.name, { ...(old ?? item), ...item, source: old ? "catalog+installed" : "installed", capabilities: old?.capabilities ?? item.capabilities, running: running.has(item.name) });
  }
  return [...byName.values()];
}
