import type { ConversionResult, QueueItem, QueueStore, QueueSummary } from "./types";

const now = (): string => new Date().toISOString();

export class MemoryQueueStore<T> implements QueueStore<T> {
  private readonly records = new Map<string, QueueItem<T>>();
  async get(id: string): Promise<QueueItem<T> | undefined> { return this.records.get(id); }
  async put(item: QueueItem<T>): Promise<void> { this.records.set(item.id, { ...item }); }
  async list(): Promise<QueueItem<T>[]> { return [...this.records.values()].map((item) => ({ ...item })); }
}

export interface QueueRunOptions<T> {
  input: AsyncIterable<{ id: string; input: T }>;
  worker: (input: T, signal: AbortSignal) => Promise<ConversionResult>;
  maxConcurrent?: number;
  store?: QueueStore<T>;
  onUpdate?: (item: QueueItem<T>) => void;
}

/** A streaming queue. It never materializes the input iterable or input bytes. */
export class ResumableQueue<T> {
  private readonly store: QueueStore<T>;
  private readonly controllers = new Map<string, AbortController>();
  private paused = false;
  private cancelled = false;
  private totalSeen = 0;

  constructor(store: QueueStore<T> = new MemoryQueueStore<T>()) { this.store = store; }

  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }
  cancel(): void { this.cancelled = true; for (const controller of this.controllers.values()) controller.abort(); }

  async run(options: QueueRunOptions<T>): Promise<QueueSummary> {
    const limit = Math.max(1, Math.min(64, options.maxConcurrent ?? 2));
    const worker = options.worker;
    const active = new Set<Promise<void>>();
    const launch = async (id: string, input: T): Promise<void> => {
      const existing = await this.store.get(id);
      if (existing && ["converted", "skipped"].includes(existing.status)) return;
      const record: QueueItem<T> = { id, input, status: "running", attempts: (existing?.attempts ?? 0) + 1, updatedAt: now() };
      await this.store.put(record); options.onUpdate?.(record);
      const controller = new AbortController(); this.controllers.set(id, controller);
      try {
        const result = await worker(input, controller.signal);
        const next: QueueItem<T> = { ...record, status: result.status, result, updatedAt: now() };
        await this.store.put(next); options.onUpdate?.(next);
      } catch (error) {
        const result: ConversionResult = { sourceId: id, status: controller.signal.aborted ? "cancelled" : "failed", error: error instanceof Error ? error.message : "Conversion failed." };
        const next: QueueItem<T> = { ...record, status: result.status, result, updatedAt: now() };
        await this.store.put(next); options.onUpdate?.(next);
      } finally { this.controllers.delete(id); }
    };
    for await (const entry of options.input) {
      this.totalSeen += 1;
      while (this.paused && !this.cancelled) await new Promise((resolve) => setTimeout(resolve, 25));
      if (this.cancelled) break;
      while (active.size >= limit) await Promise.race(active);
      const task = launch(entry.id, entry.input);
      active.add(task);
      task.then(() => active.delete(task), () => active.delete(task));
    }
    await Promise.all(active);
    return this.summary();
  }

  async summary(): Promise<QueueSummary> {
    const records = await this.store.list();
    return {
      totalSeen: Math.max(this.totalSeen, records.length),
      completed: records.filter((record) => ["converted", "skipped", "cancelled", "failed"].includes(record.status)).length,
      converted: records.filter((record) => record.status === "converted").length,
      skipped: records.filter((record) => record.status === "skipped").length,
      cancelled: records.filter((record) => record.status === "cancelled").length,
      failed: records.filter((record) => record.status === "failed").length,
      running: records.filter((record) => record.status === "running").length,
      paused: this.paused,
    };
  }
}
