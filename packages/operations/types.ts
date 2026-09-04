/**
 * Public contracts for safe, typed operations.
 *
 * The package deliberately models commands as data. Callers cannot provide a
 * shell command, shell expansion, or an unbounded executable path.
 */

export type OperationKind =
  | 'git'
  | 'github-cli'
  | 'docker-cli'
  | 'ollama-http'
  | 'home-assistant-http'
  | 'file'
  | 'process'
  | 'build'
  | 'external-editor';

export type DestructiveClass = 'safe' | 'mutating' | 'destructive';

export type RetryPolicy = {
  maxAttempts: number;
  backoffMs: number;
  maxBackoffMs: number;
  retryableCodes?: readonly string[];
};

export type ProgressEvent = {
  operationId: string;
  phase: string;
  completed: number;
  total?: number;
  message?: string;
  timestamp: string;
};

export type VerificationResult = {
  verified: boolean;
  verifier: string;
  details?: Record<string, unknown>;
};

export type OperationResult<T = unknown> = {
  operationId: string;
  status: 'succeeded' | 'partial' | 'cancelled' | 'failed';
  value?: T;
  error?: OperationError;
  verification?: VerificationResult;
  startedAt: string;
  finishedAt: string;
  attempts: number;
  partialResults?: readonly PartialResult[];
};

export type PartialResult = {
  item: string;
  status: 'succeeded' | 'skipped' | 'cancelled' | 'failed';
  message?: string;
  value?: unknown;
};

export type OperationError = {
  code:
    | 'invalid-input'
    | 'not-allowed'
    | 'timeout'
    | 'cancelled'
    | 'transport'
    | 'process'
    | 'verification'
    | 'persistence'
    | 'unknown';
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
};

export type OperationPreview = {
  kind: OperationKind;
  title: string;
  summary: string;
  destructive: DestructiveClass;
  affectedItems: readonly string[];
  warnings: readonly string[];
  requiresConfirmation: boolean;
};

export type BaseRequest = {
  operationId?: string;
  timeoutMs?: number;
  retry?: Partial<RetryPolicy>;
  confirmation?: {
    firstKey: string;
    secondKey: string;
    sliderComplete: boolean;
  };
};

export type GitAction =
  | { action: 'status'; cwd: string }
  | { action: 'fetch'; cwd: string; remote?: string }
  | { action: 'pull-fast-forward'; cwd: string; remote?: string; branch?: string }
  | { action: 'commit'; cwd: string; message: string; paths?: readonly string[] }
  | { action: 'push'; cwd: string; remote?: string; branch?: string };

export type GitHubCliAction =
  | { action: 'repo-view'; repository: string }
  | { action: 'run-list'; repository: string; limit?: number }
  | { action: 'release-list'; repository: string; limit?: number }
  | { action: 'issue-list'; repository: string; state?: 'open' | 'closed' | 'all'; limit?: number };

export type DockerCliAction =
  | { action: 'info' }
  | { action: 'ps'; all?: boolean }
  | { action: 'compose-up'; cwd: string; services?: readonly string[] }
  | { action: 'compose-down'; cwd: string; services?: readonly string[] };

export type OllamaHttpAction =
  | { action: 'health'; baseUrl: string }
  | { action: 'version'; baseUrl: string }
  | { action: 'tags'; baseUrl: string }
  | { action: 'show'; baseUrl: string; model: string }
  | { action: 'pull'; baseUrl: string; model: string };

export type HomeAssistantHttpAction = {
  action: 'get-state';
  baseUrl: string;
  entityId: string;
};

export type FileAction =
  | { action: 'read'; path: string; encoding?: BufferEncoding }
  | { action: 'write'; path: string; content: string; overwrite?: boolean }
  | { action: 'copy'; source: string; destination: string; overwrite?: boolean }
  | { action: 'move'; source: string; destination: string; overwrite?: boolean }
  | { action: 'delete'; path: string };

export type ProcessAction = {
  action: 'run';
  executable: AllowedExecutable;
  args?: readonly string[];
  cwd?: string;
  environment?: Readonly<Record<string, string>>;
};

export type BuildTool = 'npm' | 'pnpm' | 'yarn' | 'dotnet' | 'cargo' | 'go' | 'python' | 'msbuild';

export type BuildAction = {
  action: 'run';
  tool: BuildTool;
  cwd: string;
  task: 'build' | 'test' | 'package' | 'install';
  extraArgs?: readonly string[];
};

export type ExternalEditorAction = {
  action: 'open';
  editor: 'vscode' | 'vscode-insiders' | 'notepad' | 'notepad-plus-plus';
  target: string;
  targetKind: 'file' | 'folder';
};

export type AllowedExecutable =
  | 'git'
  | 'gh'
  | 'docker'
  | 'npm'
  | 'pnpm'
  | 'yarn'
  | 'dotnet'
  | 'cargo'
  | 'go'
  | 'python'
  | 'msbuild'
  | 'code'
  | 'code-insiders'
  | 'notepad'
  | 'notepad++';

export type OperationRequest =
  | (BaseRequest & { kind: 'git'; input: GitAction })
  | (BaseRequest & { kind: 'github-cli'; input: GitHubCliAction })
  | (BaseRequest & { kind: 'docker-cli'; input: DockerCliAction })
  | (BaseRequest & { kind: 'ollama-http'; input: OllamaHttpAction })
  | (BaseRequest & { kind: 'home-assistant-http'; input: HomeAssistantHttpAction })
  | (BaseRequest & { kind: 'file'; input: FileAction })
  | (BaseRequest & { kind: 'process'; input: ProcessAction })
  | (BaseRequest & { kind: 'build'; input: BuildAction })
  | (BaseRequest & { kind: 'external-editor'; input: ExternalEditorAction });

export type OperationState = {
  id: string;
  request: OperationRequest;
  state: 'queued' | 'running' | 'succeeded' | 'partial' | 'cancelled' | 'failed';
  attempts: number;
  createdAt: string;
  updatedAt: string;
  progress?: ProgressEvent;
  result?: OperationResult;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({
  maxAttempts: 3,
  backoffMs: 250,
  maxBackoffMs: 5_000,
  retryableCodes: ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'HTTP_408', 'HTTP_429', 'HTTP_500', 'HTTP_502', 'HTTP_503', 'HTTP_504'],
});

export const MAX_OPERATION_TIMEOUT_MS = 15 * 60 * 1_000;
export const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
export const MAX_ARGUMENTS = 64;
export const MAX_ARGUMENT_LENGTH = 4 * 1024;
