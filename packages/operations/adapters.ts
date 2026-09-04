import { spawn } from 'node:child_process';
import { access, copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_RETRY_POLICY,
  MAX_ARGUMENT_LENGTH,
  MAX_ARGUMENTS,
  MAX_OPERATION_TIMEOUT_MS,
  MAX_OUTPUT_BYTES,
  type AllowedExecutable,
  type BuildAction,
  type DestructiveClass,
  type DockerCliAction,
  type ExternalEditorAction,
  type FileAction,
  type GitAction,
  type GitHubCliAction,
  type HomeAssistantHttpAction,
  type OllamaHttpAction,
  type OperationError,
  type OperationPreview,
  type OperationRequest,
  type OperationResult,
  type ProgressEvent,
  type RetryPolicy,
  type VerificationResult,
} from './types.js';

export type AdapterContext = {
  signal?: AbortSignal;
  onProgress?: (event: ProgressEvent) => void;
  verify?: (request: OperationRequest, value: unknown) => Promise<VerificationResult>;
  now?: () => Date;
};

type ProcessResult = {
  code: number;
  stdout: string;
  stderr: string;
};

const executableNames: Record<AllowedExecutable, string> = {
  git: 'git.exe',
  gh: 'gh.exe',
  docker: 'docker.exe',
  npm: 'npm.cmd',
  pnpm: 'pnpm.cmd',
  yarn: 'yarn.cmd',
  dotnet: 'dotnet.exe',
  cargo: 'cargo.exe',
  go: 'go.exe',
  python: 'python.exe',
  msbuild: 'MSBuild.exe',
  code: 'code.cmd',
  'code-insiders': 'code-insiders.cmd',
  notepad: 'notepad.exe',
  'notepad++': 'notepad++.exe',
};

const shellControlArguments = new Set([
  '-c',
  '/c',
  '-command',
  '/command',
  '-encodedcommand',
  '/encodedcommand',
  '--eval',
  '-e',
]);

function operationId(request: OperationRequest): string {
  return request.operationId ?? randomUUID();
}

function timestamp(context: AdapterContext): string {
  return (context.now ?? (() => new Date()))().toISOString();
}

function error(code: OperationError['code'], message: string, retryable = false, details?: Record<string, unknown>): OperationError {
  return { code, message, retryable, details };
}

function safeString(value: string, label: string, max = MAX_ARGUMENT_LENGTH): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || value.includes('\0') || /[\r\n]/u.test(value)) {
    throw new Error(`${label} is empty, oversized, or contains an unsafe control character`);
  }
  return value;
}

function safePath(value: string, label: string): string {
  return resolve(safeString(value, label));
}

function validateArgs(args: readonly string[] | undefined): string[] {
  const values = [...(args ?? [])];
  if (values.length > MAX_ARGUMENTS) throw new Error('Too many process arguments');
  for (const arg of values) {
    safeString(arg, 'argument');
    if (shellControlArguments.has(arg.toLowerCase())) throw new Error('Shell evaluation arguments are not allowed');
  }
  return values;
}

function redact(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/giu, 'Bearer [redacted]')
    .replace(/(token|password|secret|authorization|api[-_]?key)(\s*[:=]\s*)[^\s,;]+/giu, '$1$2[redacted]');
}

function retryPolicy(request: OperationRequest): RetryPolicy {
  const candidate = request.retry ?? {};
  return {
    ...DEFAULT_RETRY_POLICY,
    ...candidate,
    maxAttempts: Math.max(1, Math.min(10, candidate.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts)),
    backoffMs: Math.max(0, Math.min(30_000, candidate.backoffMs ?? DEFAULT_RETRY_POLICY.backoffMs)),
    maxBackoffMs: Math.max(0, Math.min(120_000, candidate.maxBackoffMs ?? DEFAULT_RETRY_POLICY.maxBackoffMs)),
  };
}

function timeoutFor(request: OperationRequest): number {
  return Math.max(1, Math.min(MAX_OPERATION_TIMEOUT_MS, request.timeoutMs ?? 60_000));
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw Object.assign(new Error('Operation cancelled'), { code: 'ABORT_ERR' });
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolveDelay, reject) => {
    const timer = setTimeout(resolveDelay, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('Operation cancelled'), { code: 'ABORT_ERR' }));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function runProcess(
  executable: AllowedExecutable,
  args: readonly string[],
  options: { cwd?: string; environment?: Readonly<Record<string, string>>; timeoutMs: number; signal?: AbortSignal },
): Promise<ProcessResult> {
  const command = executableNames[executable];
  const commandArgs = validateArgs(args);
  const cwd = options.cwd ? safePath(options.cwd, 'working directory') : undefined;
  const env = { ...process.env, ...(options.environment ?? {}) } as NodeJS.ProcessEnv;
  return await new Promise<ProcessResult>((resolveProcess, rejectProcess) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const child = spawn(command, commandArgs, { cwd, env, shell: false, windowsHide: true });
    const finish = (callback: () => void) => {
      if (!settled) {
        settled = true;
        callback();
      }
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(() => rejectProcess(Object.assign(new Error('Process timed out'), { code: 'ETIMEDOUT' })));
    }, options.timeoutMs);
    const abort = () => {
      child.kill();
      finish(() => rejectProcess(Object.assign(new Error('Operation cancelled'), { code: 'ABORT_ERR' })));
    };
    options.signal?.addEventListener('abort', abort, { once: true });
    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
      if (Buffer.byteLength(stdout) > MAX_OUTPUT_BYTES) child.kill();
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
      if (Buffer.byteLength(stderr) > MAX_OUTPUT_BYTES) child.kill();
    });
    child.once('error', (cause: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      finish(() => rejectProcess(cause));
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      finish(() => resolveProcess({ code: code ?? 1, stdout: redact(stdout.slice(0, MAX_OUTPUT_BYTES)), stderr: redact(stderr.slice(0, MAX_OUTPUT_BYTES)) }));
    });
  });
}

async function runWithRetry(
  request: OperationRequest,
  context: AdapterContext,
  operation: (attempt: number) => Promise<unknown>,
): Promise<{ value: unknown; attempts: number }> {
  const policy = retryPolicy(request);
  let last: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    throwIfCancelled(context.signal);
    try {
      return { value: await operation(attempt), attempts: attempt };
    } catch (cause) {
      last = cause;
      const code = typeof cause === 'object' && cause !== null && 'code' in cause ? String((cause as { code: unknown }).code) : 'unknown';
      const canRetry = policy.retryableCodes?.includes(code) ?? false;
      if (!canRetry || attempt >= policy.maxAttempts) throw cause;
      await delay(Math.min(policy.maxBackoffMs, policy.backoffMs * 2 ** (attempt - 1)), context.signal);
    }
  }
  throw last;
}

function processValue(result: ProcessResult, operation: string): unknown {
  if (result.code !== 0) {
    throw Object.assign(new Error(`${operation} exited with code ${result.code}: ${result.stderr.trim() || 'no diagnostic output'}`), { code: 'process', retryable: false });
  }
  return { exitCode: result.code, stdout: result.stdout, stderr: result.stderr };
}

function commandForGit(input: GitAction): { executable: AllowedExecutable; args: string[]; cwd: string } {
  const cwd = safePath(input.cwd, 'repository path');
  switch (input.action) {
    case 'status': return { executable: 'git', args: ['status', '--porcelain=v1', '--branch'], cwd };
    case 'fetch': return { executable: 'git', args: ['fetch', safeString(input.remote ?? 'origin', 'remote')], cwd };
    case 'pull-fast-forward': return { executable: 'git', args: ['pull', '--ff-only', safeString(input.remote ?? 'origin', 'remote'), safeString(input.branch ?? 'main', 'branch')], cwd };
    case 'commit': {
      const args = ['commit', '-m', safeString(input.message, 'commit message')];
      for (const path of input.paths ?? []) args.push('--', safeString(path, 'path'));
      return { executable: 'git', args, cwd };
    }
    case 'push': return { executable: 'git', args: ['push', safeString(input.remote ?? 'origin', 'remote'), safeString(input.branch ?? 'HEAD', 'branch')], cwd };
  }
}

function commandForGitHub(input: GitHubCliAction): { executable: AllowedExecutable; args: string[] } {
  const repository = safeString(input.repository, 'repository');
  switch (input.action) {
    case 'repo-view': return { executable: 'gh', args: ['repo', 'view', repository, '--json', 'nameWithOwner,defaultBranchRef'] };
    case 'run-list': return { executable: 'gh', args: ['run', 'list', '--repo', repository, '--limit', String(Math.max(1, Math.min(100, input.limit ?? 20))), '--json', 'databaseId,status,conclusion,url'] };
    case 'release-list': return { executable: 'gh', args: ['release', 'list', '--repo', repository, '--limit', String(Math.max(1, Math.min(100, input.limit ?? 20))), '--json', 'tagName,isDraft,isPrerelease,url'] };
    case 'issue-list': return { executable: 'gh', args: ['issue', 'list', '--repo', repository, '--state', input.state ?? 'open', '--limit', String(Math.max(1, Math.min(100, input.limit ?? 50))), '--json', 'number,title,state,url'] };
  }
}

function commandForDocker(input: DockerCliAction): { executable: AllowedExecutable; args: string[]; cwd?: string } {
  switch (input.action) {
    case 'info': return { executable: 'docker', args: ['info', '--format', '{{json .}}'] };
    case 'ps': return { executable: 'docker', args: ['ps', ...(input.all ? ['--all'] : []), '--format', '{{json .}}'] };
    case 'compose-up': return { executable: 'docker', args: ['compose', 'up', '--detach', ...(input.services ?? []).map((service) => safeString(service, 'service'))], cwd: safePath(input.cwd, 'compose path') };
    case 'compose-down': return { executable: 'docker', args: ['compose', 'down', ...(input.services ?? []).map((service) => safeString(service, 'service'))], cwd: safePath(input.cwd, 'compose path') };
  }
}

function validateLocalUrl(value: string, kind: 'ollama' | 'home-assistant'): URL {
  const url = new URL(safeString(value, 'base URL'));
  if (url.username || url.password) throw new Error('URLs with embedded credentials are not allowed');
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]' || url.hostname === '::1';
  if (kind === 'ollama' ? !(url.protocol === 'https:' || (url.protocol === 'http:' && local)) : !(url.protocol === 'https:' || (url.protocol === 'http:' && local))) {
    throw new Error('Only HTTPS or bounded loopback HTTP is allowed');
  }
  url.hash = '';
  return url;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { code: `HTTP_${response.status}`, retryable: response.status >= 500 || response.status === 408 || response.status === 429 });
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_OUTPUT_BYTES) throw new Error('Response exceeds the bounded output size');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('Response was not valid JSON');
  }
}

async function fetchJson(url: URL, options: RequestInit & { timeoutMs: number; signal?: AbortSignal }): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    return await readJsonResponse(await fetch(url, { ...options, redirect: 'error', signal: controller.signal }));
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

async function executeOllama(input: OllamaHttpAction, request: OperationRequest, context: AdapterContext): Promise<unknown> {
  const base = validateLocalUrl(input.baseUrl, 'ollama');
  const path = input.action === 'health' ? '/' : input.action === 'version' ? '/api/version' : input.action === 'tags' ? '/api/tags' : input.action === 'show' ? '/api/show' : '/api/pull';
  const url = new URL(path, base);
  if (input.action === 'health' || input.action === 'version' || input.action === 'tags') return await fetchJson(url, { method: 'GET', timeoutMs: timeoutFor(request), signal: context.signal });
  const model = safeString(input.model, 'model');
  if (input.action === 'show') return await fetchJson(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: model }), timeoutMs: timeoutFor(request), signal: context.signal });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutFor(request));
  const abort = () => controller.abort();
  context.signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: model, stream: true }), redirect: 'error', signal: controller.signal });
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { code: `HTTP_${response.status}`, retryable: response.status >= 500 || response.status === 429 });
    if (!response.body) return await readJsonResponse(response);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    const events: unknown[] = [];
    let completed = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      pending += decoder.decode(chunk.value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        if (Buffer.byteLength(line) > MAX_OUTPUT_BYTES) throw new Error('Response exceeds the bounded output size');
        const event = JSON.parse(line) as Record<string, unknown>;
        events.push(event);
        completed += 1;
        context.onProgress?.({ operationId: operationId(request), phase: 'pull', completed, message: typeof event.status === 'string' ? event.status : undefined, timestamp: timestamp(context) });
      }
    }
    if (pending.trim()) events.push(JSON.parse(pending) as unknown);
    return events;
  } finally {
    clearTimeout(timer);
    context.signal?.removeEventListener('abort', abort);
  }
}

async function executeHomeAssistant(input: HomeAssistantHttpAction, request: OperationRequest, context: AdapterContext): Promise<unknown> {
  const base = validateLocalUrl(input.baseUrl, 'home-assistant');
  if (!/^[a-z0-9_]+\.[a-z0-9_]+$/u.test(safeString(input.entityId, 'entity ID'))) throw new Error('Entity ID must use the domain.name form');
  const url = new URL(`/api/states/${encodeURIComponent(input.entityId)}`, base);
  return await fetchJson(url, { method: 'GET', timeoutMs: timeoutFor(request), signal: context.signal });
}

async function executeFile(input: FileAction, request: OperationRequest, context: AdapterContext): Promise<unknown> {
  throwIfCancelled(context.signal);
  switch (input.action) {
    case 'read': return await readFile(safePath(input.path, 'file path'), { encoding: input.encoding ?? 'utf8' });
    case 'write': {
      const target = safePath(input.path, 'file path');
      if (input.overwrite === false) await access(target).then(() => { throw new Error('Destination already exists'); }, () => undefined);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, input.content, { encoding: 'utf8', flag: input.overwrite === false ? 'wx' : 'w' });
      return { path: target, bytes: Buffer.byteLength(input.content) };
    }
    case 'copy': {
      const source = safePath(input.source, 'source path');
      const destination = safePath(input.destination, 'destination path');
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(source, destination, input.overwrite === false ? 1 : 0);
      return { source, destination };
    }
    case 'move': {
      const source = safePath(input.source, 'source path');
      const destination = safePath(input.destination, 'destination path');
      await mkdir(dirname(destination), { recursive: true });
      if (input.overwrite === false) await access(destination).then(() => { throw new Error('Destination already exists'); }, () => undefined);
      await rename(source, destination);
      return { source, destination };
    }
    case 'delete': {
      const target = safePath(input.path, 'file path');
      await rm(target, { recursive: false, force: false });
      return { path: target, deleted: true };
    }
  }
}

async function executeBuild(input: BuildAction, request: OperationRequest, context: AdapterContext): Promise<unknown> {
  const taskArgs: Record<BuildAction['tool'], string[]> = {
    npm: ['run', input.task], pnpm: [input.task], yarn: [input.task], dotnet: [input.task], cargo: [input.task], go: [input.task], python: ['-m', input.task], msbuild: [input.task],
  };
  const result = await runProcess(input.tool, [...taskArgs[input.tool], ...validateArgs(input.extraArgs)], { cwd: safePath(input.cwd, 'build path'), timeoutMs: timeoutFor(request), signal: context.signal });
  return processValue(result, `${input.tool} ${input.task}`);
}

async function executeEditor(input: ExternalEditorAction, request: OperationRequest, context: AdapterContext): Promise<unknown> {
  const executable: AllowedExecutable = input.editor === 'vscode' ? 'code' : input.editor === 'vscode-insiders' ? 'code-insiders' : input.editor === 'notepad' ? 'notepad' : 'notepad++';
  const target = safePath(input.target, 'editor target');
  const args = input.targetKind === 'folder' && (input.editor === 'vscode' || input.editor === 'vscode-insiders') ? ['--new-window', target] : [target];
  const result = await runProcess(executable, args, { timeoutMs: timeoutFor(request), signal: context.signal });
  return processValue(result, `${executable} open`);
}

function classification(request: OperationRequest): DestructiveClass {
  if (request.kind === 'file' && ['delete', 'move'].includes(request.input.action)) return 'destructive';
  if (request.kind === 'docker-cli' && request.input.action === 'compose-down') return 'destructive';
  if (request.kind === 'git' && ['commit', 'push', 'pull-fast-forward'].includes(request.input.action)) return 'mutating';
  if (request.kind === 'build' && ['package', 'install'].includes(request.input.task)) return 'mutating';
  if (request.kind === 'file' && ['write', 'copy'].includes(request.input.action)) return 'mutating';
  if (request.kind === 'docker-cli' && request.input.action === 'compose-up') return 'mutating';
  if (request.kind === 'ollama-http' && request.input.action === 'pull') return 'mutating';
  return 'safe';
}

function affectedItems(request: OperationRequest): string[] {
  const input = request.input as unknown as Record<string, unknown>;
  return Object.values(input).filter((value): value is string => typeof value === 'string' && value.length > 0).slice(0, 4);
}

export function previewOperation(request: OperationRequest): OperationPreview {
  const destructive = classification(request);
  return {
    kind: request.kind,
    title: `${request.kind} operation`,
    summary: destructive === 'destructive' ? 'This operation can remove or replace user data.' : destructive === 'mutating' ? 'This operation changes local or external state.' : 'This operation reads state without changing it.',
    destructive,
    affectedItems: affectedItems(request),
    warnings: destructive === 'safe' ? [] : ['Review the affected paths and target before confirming.'],
    requiresConfirmation: destructive === 'destructive',
  };
}

function checkConfirmation(request: OperationRequest): void {
  if (classification(request) !== 'destructive') return;
  const confirmation = request.confirmation;
  if (!confirmation || confirmation.firstKey.length === 0 || confirmation.secondKey.length === 0 || !confirmation.sliderComplete || confirmation.firstKey === confirmation.secondKey) {
    throw Object.assign(new Error('Destructive operations require two independent keys and a completed confirmation slider'), { code: 'not-allowed' });
  }
}

async function executeRequest(request: OperationRequest, context: AdapterContext): Promise<{ value: unknown; attempts: number }> {
  checkConfirmation(request);
  switch (request.kind) {
    case 'git': {
      const command = commandForGit(request.input);
      return await runWithRetry(request, context, async () => processValue(await runProcess(command.executable, command.args, { cwd: command.cwd, timeoutMs: timeoutFor(request), signal: context.signal }), `git ${request.input.action}`));
    }
    case 'github-cli': {
      const command = commandForGitHub(request.input);
      return await runWithRetry(request, context, async () => processValue(await runProcess(command.executable, command.args, { timeoutMs: timeoutFor(request), signal: context.signal }), `gh ${request.input.action}`));
    }
    case 'docker-cli': {
      const command = commandForDocker(request.input);
      return await runWithRetry(request, context, async () => processValue(await runProcess(command.executable, command.args, { cwd: command.cwd, timeoutMs: timeoutFor(request), signal: context.signal }), `docker ${request.input.action}`));
    }
    case 'ollama-http': return await runWithRetry(request, context, (attempt) => executeOllama(request.input, request, context));
    case 'home-assistant-http': return await runWithRetry(request, context, (attempt) => executeHomeAssistant(request.input, request, context));
    case 'file': return await runWithRetry(request, context, () => executeFile(request.input, request, context));
    case 'process': return await runWithRetry(request, context, () => runProcess(request.input.executable, request.input.args ?? [], { cwd: request.input.cwd, environment: request.input.environment, timeoutMs: timeoutFor(request), signal: context.signal }));
    case 'build': return await runWithRetry(request, context, () => executeBuild(request.input, request, context));
    case 'external-editor': return await runWithRetry(request, context, () => executeEditor(request.input, request, context));
  }
}

export async function executeOperation(request: OperationRequest, context: AdapterContext = {}): Promise<OperationResult> {
  const id = operationId(request);
  const effectiveRequest = { ...request, operationId: id } as OperationRequest;
  const startedAt = timestamp(context);
  try {
    const execution = await executeRequest(effectiveRequest, context);
    const verification = context.verify ? await context.verify(effectiveRequest, execution.value) : undefined;
    if (verification && !verification.verified) {
      return { operationId: id, status: 'failed', error: error('verification', 'The far side did not verify the requested result', false, verification.details), verification, startedAt, finishedAt: timestamp(context), attempts: execution.attempts };
    }
    return { operationId: id, status: 'succeeded', value: execution.value, verification, startedAt, finishedAt: timestamp(context), attempts: execution.attempts };
  } catch (cause) {
    const code = typeof cause === 'object' && cause !== null && 'code' in cause ? String((cause as { code: unknown }).code) : '';
    const cancelled = code === 'ABORT_ERR' || context.signal?.aborted;
    const retryable = typeof cause === 'object' && cause !== null && 'retryable' in cause ? Boolean((cause as { retryable: unknown }).retryable) : DEFAULT_RETRY_POLICY.retryableCodes?.includes(code) ?? false;
    return { operationId: id, status: cancelled ? 'cancelled' : 'failed', error: error(cancelled ? 'cancelled' : code.startsWith('HTTP_') ? 'transport' : code === 'not-allowed' ? 'not-allowed' : code === 'ETIMEDOUT' ? 'timeout' : 'unknown', redact(cause instanceof Error ? cause.message : 'Operation failed'), retryable), startedAt, finishedAt: timestamp(context), attempts: 1 };
  }
}
