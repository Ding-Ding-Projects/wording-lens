import { REGEX_LIMITS, RegexWorkerError } from './types.ts';
import type {
  RegexCapture,
  RegexEvaluateRequest,
  RegexEvaluateResult,
  RegexFilterRequest,
  RegexFilterResult,
  RegexMatch,
  RegexRequest,
  RegexResult,
} from './types.ts';

const SUPPORTED_FLAGS = new Set(['d', 'g', 'i', 'm', 's', 'u', 'v', 'y']);
const encoder = new TextEncoder();

function rejectInvalid(message: string): never {
  throw new RegexWorkerError('invalid-input', message);
}

function validateString(value: unknown, label: string, maximum: number): asserts value is string {
  if (typeof value !== 'string') rejectInvalid(`${label} must be a string.`);
  if (value.length > maximum) rejectInvalid(`${label} exceeds ${maximum} characters.`);
}

function validateRequest(request: RegexRequest): void {
  if (!request || typeof request !== 'object') rejectInvalid('Regex request must be an object.');
  validateString(request.pattern, 'Pattern', REGEX_LIMITS.maxPatternLength);
  validateString(request.flags, 'Flags', 16);
  for (const flag of request.flags) if (!SUPPORTED_FLAGS.has(flag)) rejectInvalid(`Unsupported ECMAScript RegExp flag: ${flag}.`);
  if (new Set(request.flags).size !== request.flags.length) rejectInvalid('RegExp flags must not contain duplicates.');

  if (request.operation === 'evaluate') {
    validateString(request.sample, 'Sample', REGEX_LIMITS.maxSampleLength);
    if (request.replacement !== undefined) validateString(request.replacement, 'Replacement', REGEX_LIMITS.maxReplacementLength);
    return;
  }
  if (request.operation !== 'filter') rejectInvalid('Unknown regex operation.');
  if (!Array.isArray(request.texts)) rejectInvalid('Filter texts must be an array.');
  if (request.texts.length > REGEX_LIMITS.maxTextCount) rejectInvalid(`Filter text count exceeds ${REGEX_LIMITS.maxTextCount}.`);
  let total = 0;
  for (const text of request.texts) {
    validateString(text, 'Filter text', REGEX_LIMITS.maxTotalTextLength);
    total += text.length;
    if (total > REGEX_LIMITS.maxTotalTextLength) rejectInvalid(`Total filter text exceeds ${REGEX_LIMITS.maxTotalTextLength} characters.`);
  }
}

function executableFlags(flags: string): string {
  return flags.includes('g') ? flags : `${flags}g`;
}

function compile(pattern: string, flags: string): RegExp {
  try {
    return new RegExp(pattern, executableFlags(flags));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new RegexWorkerError('invalid-input', message);
  }
}

function advanceAfterZeroWidth(input: string, index: number, unicode: boolean): number {
  if (!unicode) return index + 1;
  const first = input.charCodeAt(index);
  const second = input.charCodeAt(index + 1);
  return first >= 0xd800 && first <= 0xdbff && second >= 0xdc00 && second <= 0xdfff ? index + 2 : index + 1;
}

function outputBytes(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).byteLength;
}

function ensureOutputBound(value: unknown): void {
  if (outputBytes(value) > REGEX_LIMITS.maxOutputBytes) {
    throw new RegexWorkerError('output-limit', `Regex result exceeds ${REGEX_LIMITS.maxOutputBytes} bytes.`);
  }
}

function runMatches(regex: RegExp, input: string): RegexMatch[] {
  const matches: RegexMatch[] = [];
  while (matches.length < REGEX_LIMITS.maxMatches) {
    const found = regex.exec(input);
    if (!found) return matches;
    const namedCaptures: Record<string, RegexCapture> = {};
    for (const [name, value] of Object.entries(found.groups ?? {})) namedCaptures[name] = value;
    const next: RegexMatch = {
      index: found.index,
      text: found[0],
      captures: found.slice(1),
      namedCaptures,
    };
    ensureOutputBound([...matches, next]);
    matches.push(next);
    if (found[0] === '') regex.lastIndex = advanceAfterZeroWidth(input, regex.lastIndex, regex.flags.includes('u') || regex.flags.includes('v'));
  }
  return matches;
}

function evaluate(request: RegexEvaluateRequest): RegexEvaluateResult {
  const matches = runMatches(compile(request.pattern, request.flags), request.sample);
  const replacement = request.replacement === undefined
    ? undefined
    : request.sample.replace(new RegExp(request.pattern, request.flags), request.replacement);
  const result: RegexEvaluateResult = replacement === undefined
    ? { operation: 'evaluate', matches }
    : { operation: 'evaluate', matches, replacement };
  ensureOutputBound(result);
  return result;
}

function filter(request: RegexFilterRequest): RegexFilterResult {
  const matches: Array<{ textIndex: number; matchIndices: number[] }> = [];
  for (const [textIndex, text] of request.texts.entries()) {
    const regex = compile(request.pattern, request.flags);
    const matchIndices: number[] = [];
    while (matchIndices.length < REGEX_LIMITS.maxMatches) {
      const found = regex.exec(text);
      if (!found) break;
      matchIndices.push(found.index);
      if (found[0] === '') regex.lastIndex = advanceAfterZeroWidth(text, regex.lastIndex, regex.flags.includes('u') || regex.flags.includes('v'));
    }
    if (matchIndices.length) {
      const next = { textIndex, matchIndices };
      ensureOutputBound([...matches, next]);
      matches.push(next);
    }
  }
  const result: RegexFilterResult = { operation: 'filter', matches };
  ensureOutputBound(result);
  return result;
}

/** Runs only inside a dedicated worker entry point or a test worker adapter. */
export function evaluateRegexRequest(request: RegexRequest): RegexResult {
  validateRequest(request);
  try {
    return request.operation === 'evaluate' ? evaluate(request) : filter(request);
  } catch (cause) {
    if (cause instanceof RegexWorkerError) throw cause;
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new RegexWorkerError('execution-error', message);
  }
}
