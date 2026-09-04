/**
 * Browser-safe contracts for isolated regular-expression evaluation.
 *
 * Requests are data only. The renderer sends them to a module worker and
 * never invokes a user supplied pattern itself.
 */

export const REGEX_LIMITS = Object.freeze({
  maxPatternLength: 4_096,
  maxSampleLength: 65_536,
  maxTotalTextLength: 1_048_576,
  maxTextCount: 4_096,
  maxReplacementLength: 256,
  maxMatches: 1_000,
  maxOutputBytes: 1_048_576,
  defaultTimeoutMs: 250,
  maxTimeoutMs: 250,
  absoluteStartupTimeoutMs: 2_000,
});

export type RegexEvaluateRequest = {
  readonly operation: 'evaluate';
  readonly pattern: string;
  readonly flags: string;
  readonly sample: string;
  readonly replacement?: string;
};

export type RegexFilterRequest = {
  readonly operation: 'filter';
  readonly pattern: string;
  readonly flags: string;
  readonly texts: readonly string[];
};

export type RegexRequest = RegexEvaluateRequest | RegexFilterRequest;

export type RegexCapture = string | undefined;

export type RegexMatch = {
  readonly index: number;
  readonly text: string;
  readonly captures: readonly RegexCapture[];
  readonly namedCaptures: Readonly<Record<string, RegexCapture>>;
};

export type RegexFilterMatch = {
  readonly textIndex: number;
  readonly matchIndices: readonly number[];
};

export type RegexEvaluateResult = {
  readonly operation: 'evaluate';
  readonly matches: readonly RegexMatch[];
  readonly replacement?: string;
};

export type RegexFilterResult = {
  readonly operation: 'filter';
  readonly matches: readonly RegexFilterMatch[];
};

export type RegexResult = RegexEvaluateResult | RegexFilterResult;

export type RegexErrorCode =
  | 'invalid-input'
  | 'timeout'
  | 'cancelled'
  | 'unavailable'
  | 'output-limit'
  | 'execution-error';

export class RegexWorkerError extends Error {
  readonly code: RegexErrorCode;

  constructor(code: RegexErrorCode, message: string) {
    super(message);
    this.name = 'RegexWorkerError';
    this.code = code;
  }
}

export type RegexWorkerRequest = { readonly kind: 'run'; readonly id: string; readonly request: RegexRequest };
export type RegexWorkerReady = { readonly kind: 'ready' };
export type RegexWorkerSuccess = { readonly kind: 'result'; readonly id: string; readonly result: RegexResult };
export type RegexWorkerFailure = {
  readonly kind: 'error';
  readonly id: string;
  readonly error: { readonly code: RegexErrorCode; readonly message: string };
};
export type RegexWorkerMessage = RegexWorkerReady | RegexWorkerSuccess | RegexWorkerFailure;
