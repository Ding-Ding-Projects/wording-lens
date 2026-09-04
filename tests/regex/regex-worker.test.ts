import { Worker } from 'node:worker_threads';
import { resolve as resolvePath } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { REGEX_LIMITS, RegexRequest, RegexWorkerError, RegexWorkerMessage } from '../../packages/regex/types';

const workers: Worker[] = [];

function startWorker(): Promise<Worker> {
  return new Promise((resolveReady, reject) => {
    const worker = new Worker(resolvePath(process.cwd(), 'tests/regex/node-worker.ts'), {
      type: 'module',
      execArgv: ['--experimental-strip-types'],
    });
    workers.push(worker);
    const timer = setTimeout(() => reject(new Error('test worker failed to start')), 2_000);
    worker.once('message', (message: RegexWorkerMessage) => {
      clearTimeout(timer);
      if (message.kind !== 'ready') reject(new Error('test worker did not send ready'));
      else resolveReady(worker);
    });
    worker.once('error', reject);
  });
}

function evaluateInWorker(worker: Worker, request: RegexRequest, timeoutMs = 250): Promise<RegexWorkerMessage> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => reject(new Error(`worker response exceeded ${timeoutMs}ms`)), timeoutMs);
    const listener = (message: RegexWorkerMessage) => {
      if (message.kind === 'ready' || message.id !== id) return;
      clearTimeout(timer);
      worker.off('message', listener);
      resolve(message);
    };
    worker.on('message', listener);
    worker.postMessage({ kind: 'run', id, request });
  });
}

function runBoundedInWorker(request: RegexRequest, options: { readonly timeoutMs?: number; readonly signal?: AbortSignal } = {}): Promise<RegexWorkerMessage> {
  return new Promise(async (resolve, reject) => {
    let worker: Worker | undefined;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = async (value?: RegexWorkerMessage, error?: RegexWorkerError): Promise<void> => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
      if (worker) await worker.terminate();
      if (error) reject(error);
      else resolve(value!);
    };
    const cancel = (): void => { void settle(undefined, new RegexWorkerError('cancelled', 'Regex evaluation was cancelled.')); };
    try {
      worker = await startWorker();
      options.signal?.addEventListener('abort', cancel, { once: true });
      if (options.signal?.aborted) return cancel();
      const id = crypto.randomUUID();
      timer = setTimeout(() => { void settle(undefined, new RegexWorkerError('timeout', 'Regex worker exceeded its deadline.')); }, options.timeoutMs ?? 250);
      const listener = (message: RegexWorkerMessage) => {
        if (message.kind === 'ready' || message.id !== id) return;
        worker!.off('message', listener);
        void settle(message);
      };
      worker.on('message', listener);
      worker.postMessage({ kind: 'run', id, request });
    } catch (cause) {
      const error = cause instanceof RegexWorkerError
        ? cause
        : new RegexWorkerError('unavailable', cause instanceof Error ? cause.message : String(cause));
      await settle(undefined, error);
    }
  });
}

async function terminate(worker: Worker): Promise<void> {
  await worker.terminate();
  expect(worker.threadId).toBe(-1);
}

afterEach(async () => {
  await Promise.all(workers.splice(0).map((worker) => worker.terminate()));
});

describe('isolated regex worker', () => {
  it('enforces the deadline on a real worker for catastrophic backtracking input', async () => {
    const started = performance.now();
    await expect(runBoundedInWorker({
      operation: 'evaluate', pattern: '^((a)+)+$', flags: '', sample: `${'a'.repeat(32_768)}!`,
    }, { timeoutMs: 100 })).rejects.toMatchObject({ code: 'timeout' });
    expect(performance.now() - started).toBeLessThan(500);
  });

  it('cancels an active worker request and terminates that worker', async () => {
    const controller = new AbortController();
    const pending = runBoundedInWorker({
      operation: 'evaluate', pattern: '^((a)+)+$', flags: '', sample: `${'a'.repeat(32_768)}!`,
    }, { signal: controller.signal, timeoutMs: 250 });
    setTimeout(() => controller.abort(), 25);
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('rejects over-limit input before compiling or evaluating it', async () => {
    const worker = await startWorker();
    const response = await evaluateInWorker(worker, {
      operation: 'filter',
      pattern: 'a',
      flags: 'g',
      texts: Array.from({ length: REGEX_LIMITS.maxTextCount + 1 }, () => ''),
    });
    expect(response).toMatchObject({ kind: 'error', error: { code: 'invalid-input' } });
  });

  it('advances zero-width matches without looping and returns filter indices', async () => {
    const worker = await startWorker();
    const evaluation = await evaluateInWorker(worker, {
      operation: 'evaluate',
      pattern: '(?=a)',
      flags: 'g',
      sample: 'aaa',
      replacement: 'X',
    });
    expect(evaluation).toMatchObject({ kind: 'result', result: { operation: 'evaluate', replacement: 'XaXaXa' } });
    if (evaluation.kind === 'result' && evaluation.result.operation === 'evaluate') expect(evaluation.result.matches.map((match) => match.index)).toEqual([0, 1, 2]);
    const filtered = await evaluateInWorker(worker, { operation: 'filter', pattern: '(?=a)', flags: 'g', texts: ['aaa', 'b'] });
    if (filtered.kind === 'result' && filtered.result.operation === 'filter') expect(filtered.result.matches).toEqual([{ textIndex: 0, matchIndices: [0, 1, 2] }]);
    else throw new Error('filter result was not returned');
  });

  it('terminates the worker after a settled request', async () => {
    const worker = await startWorker();
    const response = await evaluateInWorker(worker, { operation: 'evaluate', pattern: 'a', flags: 'g', sample: 'a' });
    expect(response.kind).toBe('result');
    await terminate(worker);
  });
});
