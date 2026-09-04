import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { executeOperation, type AdapterContext } from './adapters.js';
import type { OperationRequest, OperationResult, OperationState, ProgressEvent } from './types.js';

type QueueDocument = {
  schemaVersion: 1;
  updatedAt: string;
  operations: OperationState[];
};

export type QueueOptions = {
  filePath: string;
  executor?: (request: OperationRequest, context?: AdapterContext) => Promise<OperationResult>;
  now?: () => Date;
  onProgress?: (event: ProgressEvent) => void;
};

export type EnqueueResult = {
  id: string;
  previewable: true;
};

const terminalStates = new Set<OperationState['state']>(['succeeded', 'partial', 'cancelled', 'failed']);

function clock(now: () => Date): string {
  return now().toISOString();
}
function copyRequestForPersistence(request: OperationRequest): OperationRequest {
  if (request.kind === 'process' && request.input.environment && Object.keys(request.input.environment).length > 0) {
    throw new Error('Process environment values cannot be durably queued because they may contain credentials');
  }
  const copy = structuredClone(request) as OperationRequest;
  if ('confirmation' in copy) delete copy.confirmation;
  return copy;
}

function isQueueDocument(value: unknown): value is QueueDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<QueueDocument>;
  return candidate.schemaVersion === 1 && typeof candidate.updatedAt === 'string' && Array.isArray(candidate.operations);
}

async function atomicWrite(path: string, document: QueueDocument): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const content = JSON.stringify(document, null, 2);
  await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' });
  let lastError: unknown;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await rename(temporary, path);
      return;
    } catch (cause) {
      lastError = cause;
      const code = typeof cause === 'object' && cause !== null && 'code' in cause ? String((cause as { code: unknown }).code) : '';
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(code) || attempt === 5) throw cause;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 50 * (attempt + 1)));
    }
  }
  throw lastError;
}

export class DurableOperationQueue {
  private readonly filePath: string;
  private readonly execute: (request: OperationRequest, context?: AdapterContext) => Promise<OperationResult>;
  private readonly now: () => Date;
  private readonly progressListener?: (event: ProgressEvent) => void;
  private document: QueueDocument = { schemaVersion: 1, updatedAt: new Date(0).toISOString(), operations: [] };
  private readonly cancellations = new Map<string, AbortController>();
  private pumpPromise: Promise<void> | undefined;
  private readyPromise: Promise<void>;

  public constructor(options: QueueOptions) {
    this.filePath = options.filePath;
    this.execute = options.executor ?? executeOperation;
    this.now = options.now ?? (() => new Date());
    this.progressListener = options.onProgress;
    this.readyPromise = this.load();
  }

  public async ready(): Promise<void> {
    await this.readyPromise;
  }

  public async list(includeTerminal = true): Promise<readonly OperationState[]> {
    await this.ready();
    return this.document.operations.filter((item) => includeTerminal || !terminalStates.has(item.state)).map((item) => structuredClone(item));
  }

  public async enqueue(request: OperationRequest): Promise<EnqueueResult> {
    await this.ready();
    const persistedRequest = copyRequestForPersistence(request);
    const id = request.operationId ?? randomUUID();
    const createdAt = clock(this.now);
    const state: OperationState = { id, request: { ...persistedRequest, operationId: id }, state: 'queued', attempts: 0, createdAt, updatedAt: createdAt };
    this.document.operations.push(state);
    await this.persist();
    void this.pump();
    return { id, previewable: true };
  }

  public async enqueueBatch(requests: readonly OperationRequest[]): Promise<readonly EnqueueResult[]> {
    await this.ready();
    const result: EnqueueResult[] = [];
    for (const request of requests) {
      const persistedRequest = copyRequestForPersistence(request);
      const id = request.operationId ?? randomUUID();
      const createdAt = clock(this.now);
      this.document.operations.push({ id, request: { ...persistedRequest, operationId: id }, state: 'queued', attempts: 0, createdAt, updatedAt: createdAt });
      result.push({ id, previewable: true });
    }
    await this.persist();
    void this.pump();
    return result;
  }

  public async cancel(id: string): Promise<boolean> {
    await this.ready();
    const item = this.document.operations.find((entry) => entry.id === id);
    if (!item || terminalStates.has(item.state)) return false;
    if (item.state === 'queued') {
      item.state = 'cancelled';
      item.updatedAt = clock(this.now);
      item.result = {
        operationId: id,
        status: 'cancelled',
        error: { code: 'cancelled', message: 'Operation cancelled before it started', retryable: false },
        startedAt: item.createdAt,
        finishedAt: item.updatedAt,
        attempts: item.attempts,
      };
      await this.persist();
      return true;
    }
    this.cancellations.get(id)?.abort();
    return true;
  }

  public async retry(id: string): Promise<boolean> {
    await this.ready();
    const item = this.document.operations.find((entry) => entry.id === id);
    if (!item || item.state !== 'failed') return false;
    item.state = 'queued';
    item.result = undefined;
    item.updatedAt = clock(this.now);
    await this.persist();
    void this.pump();
    return true;
  }

  public async recover(): Promise<void> {
    await this.ready();
    let changed = false;
    for (const item of this.document.operations) {
      if (item.state === 'running') {
        item.state = 'queued';
        item.updatedAt = clock(this.now);
        changed = true;
      }
    }
    if (changed) await this.persist();
    void this.pump();
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (!isQueueDocument(parsed)) throw new Error('Queue file has an unsupported schema');
      this.document = parsed;
    } catch (cause) {
      const code = typeof cause === 'object' && cause !== null && 'code' in cause ? String((cause as { code: unknown }).code) : '';
      if (code === 'ENOENT') return;
      throw new Error(`Unable to load durable operation queue: ${cause instanceof Error ? cause.message : 'invalid queue data'}`);
    }
  }

  private async persist(): Promise<void> {
    this.document.updatedAt = clock(this.now);
    try {
      await atomicWrite(this.filePath, this.document);
    } catch (cause) {
      throw new Error(`Unable to persist durable operation queue: ${cause instanceof Error ? cause.message : 'write failed'}`);
    }
  }

  private async pump(): Promise<void> {
    if (this.pumpPromise) return this.pumpPromise;
    this.pumpPromise = this.runPump().finally(() => { this.pumpPromise = undefined; });
    return this.pumpPromise;
  }

  private async runPump(): Promise<void> {
    await this.ready();
    while (true) {
      const item = this.document.operations.find((entry) => entry.state === 'queued');
      if (!item) return;
      item.state = 'running';
      item.attempts += 1;
      item.updatedAt = clock(this.now);
      await this.persist();
      const controller = new AbortController();
      this.cancellations.set(item.id, controller);
      try {
        const result = await this.execute(item.request, {
          signal: controller.signal,
          onProgress: (event) => {
            item.progress = event;
            item.updatedAt = clock(this.now);
            this.progressListener?.(event);
            void this.persist();
          },
        });
        item.result = result;
        item.state = result.status === 'succeeded' ? 'succeeded' : result.status;
      } catch (cause) {
        item.state = 'failed';
        item.result = {
          operationId: item.id,
          status: 'failed',
          error: { code: 'persistence', message: cause instanceof Error ? cause.message : 'Queue execution failed', retryable: false },
          startedAt: item.createdAt,
          finishedAt: clock(this.now),
          attempts: item.attempts,
        };
      } finally {
        this.cancellations.delete(item.id);
        item.updatedAt = clock(this.now);
        await this.persist();
      }
    }
  }
}
