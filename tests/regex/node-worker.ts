import { parentPort } from 'node:worker_threads';
import { evaluateRegexRequest } from '../../packages/regex/evaluator.ts';
import { RegexWorkerError } from '../../packages/regex/types.ts';
import type { RegexWorkerRequest } from '../../packages/regex/types.ts';

if (!parentPort) throw new Error('Regex test worker requires a parent port.');

parentPort.postMessage({ kind: 'ready' });
parentPort.on('message', (message: RegexWorkerRequest) => {
  try {
    parentPort!.postMessage({ kind: 'result', id: message.id, result: evaluateRegexRequest(message.request) });
  } catch (cause) {
    const error = cause instanceof RegexWorkerError
      ? cause
      : new RegexWorkerError('execution-error', cause instanceof Error ? cause.message : String(cause));
    parentPort!.postMessage({ kind: 'error', id: message.id, error: { code: error.code, message: error.message } });
  }
});
