import { evaluateRegexRequest } from './evaluator.ts';
import { RegexWorkerError } from './types.ts';
import type { RegexWorkerMessage, RegexWorkerRequest } from './types.ts';

const scope = self as unknown as {
  postMessage(message: RegexWorkerMessage): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<RegexWorkerRequest>) => void): void;
};

scope.postMessage({ kind: 'ready' } satisfies RegexWorkerMessage);

scope.addEventListener('message', (event: MessageEvent<RegexWorkerRequest>) => {
  const { id, request } = event.data;
  try {
    const result = evaluateRegexRequest(request);
    scope.postMessage({ kind: 'result', id, result } satisfies RegexWorkerMessage);
  } catch (cause) {
    const error = cause instanceof RegexWorkerError
      ? cause
      : new RegexWorkerError('execution-error', cause instanceof Error ? cause.message : String(cause));
    scope.postMessage({ kind: 'error', id, error: { code: error.code, message: error.message } } satisfies RegexWorkerMessage);
  }
});
