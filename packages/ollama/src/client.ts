import type { OllamaApi, RuntimeHealth, ModelTag } from "./types";

const iso = (): string => new Date().toISOString();
const localHost = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  } catch { return false; }
};

export function createOllamaApi(baseUrl = "http://127.0.0.1:11434", fetcher: typeof fetch = fetch, timeoutMs = 15_000, maxBytes = 8 * 1024 * 1024): OllamaApi {
  if (!localHost(baseUrl)) throw new Error("Ollama API must use bounded loopback HTTP.");
  const request = async (path: string, init: RequestInit = {}): Promise<Response> => {
    if (!path.startsWith("/") || path.includes("..")) throw new Error("Ollama API path is not allowlisted.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const callerSignal = init.signal;
    const abortFromCaller = (): void => controller.abort();
    if (callerSignal?.aborted) controller.abort();
    else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
    try {
      const response = await fetcher(new URL(path, baseUrl), { ...init, signal: controller.signal, redirect: "error" });
      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > maxBytes) throw new Error("Ollama response exceeds the bounded response limit.");
      return response;
    } finally { clearTimeout(timer); callerSignal?.removeEventListener("abort", abortFromCaller); }
  };
  const stream = async (path: string, init: RequestInit, onLine: (line: string) => void, signal?: AbortSignal): Promise<void> => {
    const response = await request(path, { ...init, signal });
    if (!response.ok || !response.body) throw new Error(`Ollama request failed with HTTP ${response.status}.`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        pending += decoder.decode(chunk.value, { stream: true });
        const lines = pending.split("\n"); pending = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) onLine(line.slice(0, maxBytes));
      }
      if (pending.trim()) onLine(pending.slice(0, maxBytes));
    } finally { await reader.cancel().catch(() => undefined); }
  };
  return { request, stream };
}

const MAX_JSON_BYTES = 8 * 1024 * 1024;
async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`Ollama request failed with HTTP ${response.status}.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_JSON_BYTES) throw new Error("Ollama response exceeds the bounded response limit.");
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

export async function health(api: OllamaApi, baseUrl = "http://127.0.0.1:11434"): Promise<RuntimeHealth> {
  const started = Date.now();
  try {
    const response = await api.request("/");
    return { state: response.ok ? "healthy" : "unhealthy", baseUrl, responseMs: Date.now() - started, checkedAt: iso(), reason: response.ok ? undefined : `HTTP ${response.status}` };
  } catch (error) {
    return { state: "stopped", baseUrl, responseMs: Date.now() - started, checkedAt: iso(), reason: error instanceof Error ? error.message : "Local service is unavailable." };
  }
}

export async function version(api: OllamaApi): Promise<string> {
  const body = await json<{ version?: string }>(await api.request("/api/version"));
  if (!body.version) throw new Error("Ollama version response did not include a version.");
  return body.version;
}

export async function installedTags(api: OllamaApi): Promise<ModelTag[]> {
  const body = await json<{ models?: Array<{ name: string; details?: { family?: string; parameter_size?: string; quantization_level?: string }; size?: number }> }>(await api.request("/api/tags"));
  return (body.models ?? []).map((model) => ({ name: model.name, family: model.details?.family, parameterSize: model.details?.parameter_size, quantization: model.details?.quantization_level, sizeBytes: model.size, capabilities: [], source: "installed" }));
}

export async function runningTags(api: OllamaApi): Promise<Set<string>> {
  const body = await json<{ models?: Array<{ name: string }> }>(await api.request("/api/ps"));
  return new Set((body.models ?? []).map((model) => model.name));
}

export async function chatStream(api: OllamaApi, model: string, messages: readonly { role: string; content: string }[], options: Record<string, unknown>, onMessage: (message: { message?: { content?: string }; done?: boolean }) => void, signal?: AbortSignal): Promise<void> {
  if (!model.trim() || messages.length === 0) throw new Error("Chat requires a model and at least one message.");
  await api.stream("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, messages, stream: true, options }) }, (line) => {
    try { const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean }; onMessage(parsed); } catch { throw new Error("Ollama returned malformed streaming JSON."); }
  }, signal);
}
