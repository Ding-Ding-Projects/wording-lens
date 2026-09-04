import type { OllamaApi, PullItem, PullSummary } from "./types";

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
export interface PullBatchOptions { maxConcurrent?: number; signal?: AbortSignal; onUpdate?: (item: PullItem) => void; }

export async function pullBatch(api: OllamaApi, tags: readonly string[], options: PullBatchOptions = {}): Promise<PullSummary> {
  const items: PullItem[] = [...new Map(tags.map((tag) => [tag, { tag, state: "queued" as PullItem["state"] }])).values()];
  const maxConcurrent = Math.max(1, Math.min(8, options.maxConcurrent ?? 2)); let cursor = 0; let running = 0; let cancelled = false;
  const runOne = async (item: PullItem): Promise<void> => {
    item.state = "pulling"; running += 1; options.onUpdate?.({ ...item });
    try {
      await api.stream("/api/pull", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: item.tag, stream: true }) }, (line) => {
        try {
          const update = JSON.parse(line) as { status?: string; completed?: number; total?: number; error?: string };
          if (typeof update.completed === "number") item.completedBytes = update.completed;
          if (typeof update.total === "number") item.totalBytes = update.total;
          if (update.error) throw new Error(update.error);
          options.onUpdate?.({ ...item });
        } catch (error) { throw error instanceof Error ? error : new Error("Malformed pull response."); }
      }, options.signal);
      item.state = options.signal?.aborted ? "cancelled" : "pulled";
    } catch (error) { item.state = options.signal?.aborted ? "cancelled" : "failed"; item.error = error instanceof Error ? error.message : "Pull failed."; }
    finally { running -= 1; options.onUpdate?.({ ...item }); }
  };
  const workers: Promise<void>[] = [];
  const next = async (): Promise<void> => { while (!cancelled && !(options.signal?.aborted) && cursor < items.length) { const item = items[cursor++]; await runOne(item); } };
  for (let i = 0; i < maxConcurrent; i += 1) workers.push(next());
  await Promise.all(workers);
  if (options.signal?.aborted) { cancelled = true; for (const item of items) if (item.state === "queued") item.state = "cancelled"; }
  while (running > 0) await delay(5);
  return { items, running, cancelled };
}
