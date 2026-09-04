/** Contracts for a local Ollama manager. No cloud service is implied. */

export type RuntimeState = "missing" | "stopped" | "healthy" | "unhealthy" | "offline";
export type FitVerdict = "Runs well" | "Runs with limits" | "Unlikely" | "Unknown";

export interface RuntimeHealth {
  state: RuntimeState;
  baseUrl: string;
  version?: string;
  responseMs?: number;
  reason?: string;
  checkedAt: string;
}

export interface ModelTag {
  name: string;
  family?: string;
  parameterSize?: string;
  quantization?: string;
  sizeBytes?: number;
  contextWindow?: number;
  capabilities: readonly string[];
  source: "catalog" | "installed" | "catalog+installed";
  running?: boolean;
}

export interface CatalogPage<T = ModelTag> {
  items: readonly T[];
  next?: string;
  revision?: string;
}

export interface CatalogSnapshot {
  items: readonly ModelTag[];
  sourceRevision?: string;
  refreshedAt: string;
  pages: number;
  complete: boolean;
  lastSuccessfulRefresh?: string;
  stale: boolean;
  error?: string;
}

export interface InstalledModel extends ModelTag {
  digest?: string;
  modifiedAt?: string;
  running: boolean;
}

export interface HardwareFacts {
  ramBytes?: number;
  gpuModel?: string;
  vramBytes?: number;
  backend?: string;
  architecture?: string;
  freeDiskBytes?: number;
  capturedAt: string;
}

export interface FitEvidence {
  verdict: FitVerdict;
  model: Pick<ModelTag, "name" | "sizeBytes" | "parameterSize" | "quantization" | "contextWindow">;
  hardware: HardwareFacts;
  assumptions: readonly string[];
  limitations: readonly string[];
  assessedAt: string;
}

export type PullState = "queued" | "pulling" | "pulled" | "skipped" | "cancelled" | "failed";
export interface PullItem {
  tag: string;
  state: PullState;
  completedBytes?: number;
  totalBytes?: number;
  error?: string;
}
export interface PullSummary { items: readonly PullItem[]; running: number; cancelled: boolean; }

export interface ChatParameters {
  temperature?: number;
  topP?: number;
  topK?: number;
  numCtx?: number;
  seed?: number;
}
export interface ChatMessage { role: "system" | "user" | "assistant"; content: string; }
export interface ChatSession { id: string; model: string; systemPrompt: string; parameters: ChatParameters; messages: readonly ChatMessage[]; updatedAt: string; }
export type ChatState = "idle" | "streaming" | "stopping" | "complete" | "failed";

export interface Attachment { name: string; mime: string; bytes: number; }
export interface AttachmentDecision { allowed: boolean; reason?: string; requiredCapability?: string; }

export interface HarnessProfile {
  id: string;
  label: string;
  executable: string;
  arguments: readonly string[];
  workingDirectory: string;
  environment: Readonly<Record<string, string>>;
  requiredPorts: readonly number[];
  requiredFiles: readonly string[];
  bundled: boolean;
  allowlisted: boolean;
}
export interface HarnessPreflight { ok: boolean; profileId: string; model: string; blockers: readonly string[]; preview: string; }
export interface ConfigSnapshot { id: string; createdAt: string; values: Readonly<Record<string, string>>; }
export interface ProcessHandle { pid: number; wait(): Promise<{ code: number | null }>; stop(): Promise<void>; }
export interface ProcessLauncher { launch(profile: HarnessProfile, model: string): Promise<ProcessHandle>; }

export interface OllamaApi {
  request(path: string, init?: RequestInit): Promise<Response>;
  stream(path: string, init: RequestInit, onLine: (line: string) => void, signal?: AbortSignal): Promise<void>;
}
