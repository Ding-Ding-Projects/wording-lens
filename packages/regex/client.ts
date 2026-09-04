import { REGEX_LIMITS, RegexWorkerError } from './types.ts';
import type {
  RegexRequest,
  RegexResult,
  RegexWorkerMessage,
} from './types.ts';

export type RunRegexOptions = {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
};

function timeoutFor(options: RunRegexOptions): number {
  const requested = options.timeoutMs ?? REGEX_LIMITS.defaultTimeoutMs;
  if (!Number.isFinite(requested) || requested <= 0) return REGEX_LIMITS.defaultTimeoutMs;
  return Math.min(Math.floor(requested), REGEX_LIMITS.maxTimeoutMs);
}

/**
 * Evaluates a request only in a fresh Vite-bundled module worker.
 *
 * Each terminal path terminates that worker. There is intentionally no main
 * thread fallback and no retry path for untrusted regular expressions.
 */
export function runRegex(request: RegexRequest, options: RunRegexOptions = {}): Promise<RegexResult> {
  if (typeof Worker === 'undefined') {
    return Promise.reject(new RegexWorkerError('unavailable', 'Regex evaluation requires a module worker.'));
  }
  if (options.signal?.aborted) {
    return Promise.reject(new RegexWorkerError('cancelled', 'Regex evaluation was cancelled.'));
  }

  return new Promise<RegexResult>((resolve, reject) => {
    let settled = false;
    let evaluationTimer: ReturnType<typeof setTimeout> | undefined;
    const id = crypto.randomUUID();
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

    const settle = (value?: RegexResult, error?: RegexWorkerError): void => {
      if (settled) return;
      settled = true;
      clearTimeout(startupTimer);
      if (evaluationTimer) clearTimeout(evaluationTimer);
      options.signal?.removeEventListener('abort', cancel);
      worker.terminate();
      if (error) reject(error);
      else resolve(value!);
    };
    const cancel = (): void => settle(undefined, new RegexWorkerError('cancelled', 'Regex evaluation was cancelled.'));
    const startupTimer = setTimeout(
      () => settle(undefined, new RegexWorkerError('timeout', 'Regex worker did not start before the absolute deadline.')),
      REGEX_LIMITS.absoluteStartupTimeoutMs,
    );

    options.signal?.addEventListener('abort', cancel, { once: true });
    worker.addEventListener('error', () => settle(undefined, new RegexWorkerError('unavailable', 'Regex worker became unavailable.')));
    worker.addEventListener('message', (event: MessageEvent<RegexWorkerMessage>) => {
      const message = event.data;
      if (message.kind === 'ready') {
        evaluationTimer = setTimeout(
          () => settle(undefined, new RegexWorkerError('timeout', `Regex evaluation exceeded ${timeoutFor(options)}ms.`)),
          timeoutFor(options),
        );
        worker.postMessage({ kind: 'run', id, request });
        return;
      }
      if (message.kind === 'result' && message.id === id) settle(message.result);
      if (message.kind === 'error' && message.id === id) settle(undefined, new RegexWorkerError(message.error.code, message.error.message));
    });
  });
}
