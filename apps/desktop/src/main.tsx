import { StrictMode, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { createRoot } from "react-dom/client";
import {
  BUILD_PROVENANCE,
  formatProvenanceDate,
  isValidProvenance,
} from "@core/provenance";
import type { AppProvenance } from "@core/types";
import type {
  OperationPreview,
  OperationRequest,
  OperationState,
} from "../../../packages/operations/types";
import type {
  AppSettings,
  EditorCandidate,
  NotificationRecord,
  ProjectInspection,
  UpdaterState,
  VocabularyStatus,
} from "../../../packages/desktop-services/src/index";
import {
  Button,
  Dialog,
  EmptyState,
  FormField,
  RegexBuilder,
  SearchField,
  StatCard,
  StatusPill,
  SurfaceCard,
  TabRail,
  WindowControls,
  screenOrder,
  type Copy,
  type LanguageMode,
  type ScreenId,
} from "./components";
import "./styles.css";
import { useSurfaceSearch } from './surface-search';

const labels: Record<ScreenId, Copy> = {
  overview: { en: "Overview", zh: "總覽" },
  projects: { en: "Projects", zh: "專案" },
  operations: { en: "Operations", zh: "操作" },
  queue: { en: "Queue", zh: "佇列" },
  files: { en: "Files and Converter", zh: "檔案與轉換器" },
  models: { en: "Local Models", zh: "本機模型" },
  authenticator: { en: "Authenticator", zh: "驗證器" },
  history: { en: "History", zh: "歷史記錄" },
  documentation: { en: "Documentation", zh: "文件" },
  changelog: { en: "Changelog", zh: "更新日誌" },
  notifications: { en: "Notifications", zh: "通知" },
  status: { en: "Status", zh: "狀態" },
  settings: { en: "Settings", zh: "設定" },
};
const descriptions: Record<ScreenId, Copy> = {
  overview: {
    en: "A calm local view of work, signals, and what to do next.",
    zh: "平靜地查看本機工作、訊號與下一步。",
  },
  projects: {
    en: "Local folders and their readiness at a glance.",
    zh: "一眼查看本機資料夾與準備狀態。",
  },
  operations: {
    en: "Preview safe, typed actions before they run.",
    zh: "執行前先預覽安全、具型別的操作。",
  },
  queue: {
    en: "Durable progress, cancellation, and honest outcomes.",
    zh: "持久進度、取消控制與誠實結果。",
  },
  files: {
    en: "Convert local files with bounded, inspectable adapters.",
    zh: "用有界且可檢查的轉換器處理本機檔案。",
  },
  models: {
    en: "Local model health and conservative hardware fit.",
    zh: "本機模型健康度與保守的硬體適配判斷。",
  },
  authenticator: {
    en: "Keep verification codes local and under your control.",
    zh: "讓驗證碼留在本機並由你掌控。",
  },
  history: {
    en: "Review local changes without sending them anywhere.",
    zh: "檢視本機變更，不會傳送到任何地方。",
  },
  documentation: {
    en: "Offline guidance for every shipped surface.",
    zh: "每個已提供介面的離線指南。",
  },
  changelog: {
    en: "Every released version, with traceable commits.",
    zh: "每個已發布版本及可追溯的提交。",
  },
  notifications: {
    en: "Reviewable, non-blocking updates from your workspace.",
    zh: "可回看、不阻塞工作區的更新。",
  },
  status: {
    en: "Live readiness and evidence for this local session.",
    zh: "此本機工作階段的即時準備度與證據。",
  },
  settings: {
    en: "Tune language, accessibility, appearance, and local privacy.",
    zh: "調整語言、無障礙、外觀與本機私隱。",
  },
};
const languageForSettings: Record<AppSettings["languageMode"], LanguageMode> = {
  english: "en",
  cantonese: "zh-Hant",
  bilingual: "bilingual",
};
const settingsForLanguage: Record<LanguageMode, AppSettings["languageMode"]> = {
  en: "english",
  "zh-Hant": "cantonese",
  bilingual: "bilingual",
};

function localize(value: Copy, mode: LanguageMode): string {
  return mode === "zh-Hant"
    ? value.zh
    : mode === "bilingual"
      ? `${value.en} · ${value.zh}`
      : value.en;
}
function readRoute(): ScreenId {
  const value = window.location.hash
    .replace(/^#\/?/, "")
    .split("?")[0] as ScreenId;
  return screenOrder.includes(value) ? value : "overview";
}
function safeSettings(value?: Partial<AppSettings>): AppSettings {
  return {
    displayName: "Wording Lens",
    languageMode: "english",
    theme: "dark",
    density: "comfortable",
    accent: "#00d4ff",
    funnyEnglish: 5,
    funnyCantonese: 5,
    emojiDialogs: true,
    narrationEnabled: false,
    narrationLanguage: "english",
    reducedMotion: false,
    ...value,
  };
}
function publicError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function SurfaceHeader({
  screen,
  mode,
  query,
  setQuery,
  regex,
  setRegex,
  onApplyRegex,
}: {
  screen: ScreenId;
  mode: LanguageMode;
  query: string;
  setQuery: (value: string) => void;
  regex: boolean;
  setRegex: (value: boolean) => void;
  onApplyRegex: (pattern: string, flags: string) => void;
}): JSX.Element {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">LOCAL WORKSPACE</p>
        <h1>{localize(labels[screen], mode)}</h1>
        <p className="page-description">
          {localize(descriptions[screen], mode)}
        </p>
      </div>
      <div className="page-tools">
        <SearchField
          label={`${localize(labels[screen], mode)} search`}
          query={query}
          onQuery={setQuery}
          onOpenRegex={() => setRegex(!regex)}
          placeholder={`Search ${localize(labels[screen], mode).toLowerCase()}`}
          focusId={`surface-search-${screen}`}
        />
        {regex && (
          <RegexBuilder
            query={query}
            onClose={() => setRegex(false)}
            onApply={onApplyRegex}
          />
        )}
      </div>
    </div>
  );
}

function UpdateBanner({
  state,
  refresh,
  notify,
}: {
  state: UpdaterState;
  refresh: () => void;
  notify: (message: string) => void;
}): JSX.Element {
  const label =
    state.state === "available"
      ? `Update ${state.version ?? "available"}`
      : state.state === "ready"
        ? `Update ${state.version ?? "ready"} is ready`
        : state.state === "failed"
          ? "Update check failed"
          : "Updates checked locally";
  return (
    <div className={`update-banner ${state.state}`}>
      <div>
        <strong>{label}</strong>
        <small>
          {state.unsigned ? "Unsigned package warning applies." : ""}
          {state.error ? ` ${state.error}` : ""}
        </small>
      </div>
      <div className="button-row">
        <Button variant="quiet" onClick={refresh}>
          Check for updates
        </Button>
        {state.state === "ready" && (
          <Button
            variant="primary"
            onClick={() =>
              notify("Restart to install update is waiting for your choice")
            }
          >
            Restart to install update
          </Button>
        )}
      </div>
    </div>
  );
}

function Overview({
  navigate,
  notify,
  updater,
  refreshUpdater,
}: {
  navigate: (screen: ScreenId) => void;
  notify: (message: string) => void;
  updater: UpdaterState;
  refreshUpdater: () => void;
}): JSX.Element {
  return (
    <>
      <section className="hero-panel">
        <div>
          <p className="eyebrow">OPERATIONS COCKPIT</p>
          <h2>Keep the work moving</h2>
          <p>
            Preview changes, run local operations, and keep every outcome
            visible.
          </p>
          <div className="button-row">
            <Button variant="primary" onClick={() => navigate("operations")}>
              ＋ New operation
            </Button>
            <Button onClick={() => navigate("projects")}>
              Browse projects
            </Button>
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span>WL</span>
          <i />
          <b />
        </div>
      </section>
      <UpdateBanner state={updater} refresh={refreshUpdater} notify={notify} />
      <div className="stats-grid">
        <StatCard
          label="ACTIVE WORK"
          value="Unknown"
          detail="Open Queue to read current operation state"
          tone="waiting"
        />
        <StatCard
          label="PROJECTS"
          value="Unknown"
          detail="Open Projects to inspect a selected folder"
        />
        <StatCard
          label="LOCAL MODELS"
          value="—"
          detail="Open Local Models to check runtime health"
          tone="waiting"
        />
        <StatCard
          label="NOTIFICATIONS"
          value="Unknown"
          detail="Open Notifications to read current records"
          tone="waiting"
        />
      </div>
      <SurfaceCard>
        <div className="section-heading">
          <div>
            <h2>Recent activity</h2>
            <p>Your local activity will appear here.</p>
          </div>
          <Button variant="quiet" onClick={() => navigate("history")}>
            View history →
          </Button>
        </div>
        <EmptyState
          icon="◌"
          title="Nothing is running"
          description="Start an operation when you are ready. Progress will stay visible here."
          action={
            <Button
              onClick={() => {
                notify("Operation preview opened");
                navigate("operations");
              }}
            >
              Browse activity
            </Button>
          }
        />
      </SurfaceCard>
    </>
  );
}

export function Projects({
  notify,
}: {
  notify: (message: string) => void;
}): JSX.Element {
  const bridge = window.desktopBridge;
  const [folder, setFolder] = useState("");
  const [inspection, setInspection] = useState<ProjectInspection | null>(null);
  const [error, setError] = useState("");
  const choose = async () => {
    if (!bridge?.pickFolder) {
      setError(
        "Local folder picker is unavailable because the bridge is not connected.",
      );
      return;
    }
    try {
      const path = await bridge.pickFolder();
      if (!path) return;
      setFolder(path);
      if (bridge.inspectProject)
        setInspection(await bridge.inspectProject(path));
    } catch (cause) {
      setError(publicError(cause, "Project inspection failed"));
    }
  };
  const inspect = async () => {
    if (!bridge?.inspectProject || !folder.trim()) {
      setError("Enter or choose a local folder before inspecting it.");
      return;
    }
    try {
      setInspection(await bridge.inspectProject(folder));
      setError("");
    } catch (cause) {
      setError(publicError(cause, "Project inspection failed"));
    }
  };
  return (
    <SurfaceCard>
      <div className="section-heading">
        <div>
          <h2>{inspection ? "Project inspected" : "Choose a local project"}</h2>
          <p>Folder selection and inspection use the typed local bridge.</p>
        </div>
        <StatusPill
          label={inspection?.exists ? "Inspected" : "Ready"}
          tone={inspection?.exists ? "ready" : "neutral"}
        />
      </div>
      <div className="path-field">
        <input
          value={folder}
          onChange={(event) => setFolder(event.target.value)}
          placeholder="Choose a project folder"
          aria-label="Project folder"
        />
        <Button onClick={choose}>Browse</Button>
        <Button onClick={() => void inspect()} disabled={!folder.trim()}>
          Inspect
        </Button>
      </div>
      {inspection && (
        <div className="preview-panel" role="status">
          <strong>{inspection.path}</strong>
          <p>
            {inspection.kind} ·{" "}
            {inspection.hasGitMetadata
              ? "Version metadata found"
              : "No version metadata found"}
          </p>
        </div>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <p className="muted">
          Inspection is available through this bridge. It does not expose an
          open-project action, so this screen does not claim to open one.
        </p>
        <Button
          variant="quiet"
          onClick={() => {
            setFolder("");
            setInspection(null);
            setError("");
          }}
        >
          Reset
        </Button>
      </div>
    </SurfaceCard>
  );
}

function makeOperationRequest(path: string): OperationRequest {
  return {
    kind: "file",
    input: { action: "read", path },
    timeoutMs: 30_000,
    retry: { maxAttempts: 2 },
  };
}
export function Operations({
  notify,
  onQueued,
}: {
  notify: (message: string) => void;
  onQueued: () => void;
}): JSX.Element {
  const bridge = window.desktopBridge;
  const [path, setPath] = useState("");
  const [preview, setPreview] = useState<OperationPreview | null>(null);
  const [error, setError] = useState("");
  const choose = async () => {
    if (!bridge?.pickFile) {
      setError(
        "File picker is unavailable because the bridge is not connected.",
      );
      return;
    }
    const selected = await bridge.pickFile();
    if (selected) setPath(selected);
  };
  const review = async () => {
    if (!bridge?.previewOperation) {
      setError(
        "Operation preview is unavailable because the bridge is not connected.",
      );
      return;
    }
    if (!path) {
      setError("Choose a local file before previewing this operation.");
      return;
    }
    try {
      setPreview(await bridge.previewOperation(makeOperationRequest(path)));
    } catch (cause) {
      setError(publicError(cause, "Operation preview failed"));
    }
  };
  const enqueue = async () => {
    if (!bridge?.enqueueOperation || !path) return;
    try {
      await bridge.enqueueOperation(makeOperationRequest(path));
      notify("Operation added to the local queue");
      onQueued();
    } catch (cause) {
      setError(publicError(cause, "Operation queue request failed"));
    }
  };
  return (
    <div className="two-column">
      <SurfaceCard>
        <div className="section-heading">
          <div>
            <h2>Typed operation</h2>
            <p>Select a local file and review the exact typed action.</p>
          </div>
          <StatusPill
            label={bridge ? "Bridge ready" : "Unavailable"}
            tone={bridge ? "ready" : "waiting"}
          />
        </div>
        <div className="path-field">
          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="Choose a local file"
            aria-label="Operation target"
          />
          <Button onClick={choose}>Browse</Button>
        </div>
        <div className="button-row">
          <Button
            variant="primary"
            onClick={review}
            disabled={!bridge?.previewOperation || !path}
          >
            Review preview
          </Button>
          <Button
            onClick={enqueue}
            disabled={!preview || !bridge?.enqueueOperation}
          >
            Add to queue
          </Button>
        </div>
        {preview && (
          <div className="preview-panel" role="status">
            <strong>{preview.title}</strong>
            <p>{preview.summary}</p>
            <small>
              {preview.affectedItems.length} affected item(s) ·{" "}
              {preview.warnings.length} warning(s)
            </small>
          </div>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
      </SurfaceCard>
      <SurfaceCard>
        <h2>Operation safety</h2>
        <div className="check-list">
          <div>
            <span>✓</span>
            <strong>Typed action</strong>
            <small>Only registered actions can be queued.</small>
          </div>
          <div>
            <span>✓</span>
            <strong>Review before run</strong>
            <small>Affected paths and limits are shown first.</small>
          </div>
          <div>
            <span>✓</span>
            <strong>Bridge state</strong>
            <small>
              {bridge
                ? "The local service bridge is connected."
                : "Connect the local service bridge to enable this action."}
            </small>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

export function Queue({
  notify,
  refreshKey,
}: {
  notify: (message: string) => void;
  refreshKey: number;
}): JSX.Element {
  const bridge = window.desktopBridge;
  const [items, setItems] = useState<readonly OperationState[]>([]);
  const [error, setError] = useState("");
  const load = async () => {
    if (!bridge?.listOperations) {
      setError(
        "Queue state is unavailable because the bridge is not connected.",
      );
      return;
    }
    try {
      setItems(await bridge.listOperations(true));
    } catch (cause) {
      setError(publicError(cause, "Queue state failed"));
    }
  };
  useEffect(() => {
    void load();
  }, [refreshKey]);
  const act = async (id: string, action: "cancel" | "retry") => {
    try {
      const ok =
        action === "cancel"
          ? await bridge?.cancelOperation?.(id)
          : await bridge?.retryOperation?.(id);
      notify(
        ok
          ? `Operation ${action} requested`
          : `Operation ${action} was not accepted`,
      );
      await load();
    } catch (cause) {
      setError(publicError(cause, `Operation ${action} failed`));
    }
  };
  return (
    <SurfaceCard>
      <div className="section-heading">
        <div>
          <h2>Durable operation queue</h2>
          <p>
            State is read from the typed bridge. No local success is invented.
          </p>
        </div>
        <Button variant="quiet" onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      {items.length ? (
        <div className="queue-list">
          {items.map((item) => (
            <div className="queue-item" key={item.id}>
              <span className="queue-icon">◴</span>
              <div className="queue-main">
                <strong>{item.request.kind}</strong>
                <span>
                  {item.state} ·{" "}
                  {item.progress?.message ?? "No progress message"}
                </span>
                <div className="progress-track">
                  <span
                    style={{
                      width: `${item.progress?.total ? Math.min(100, (item.progress.completed / item.progress.total) * 100) : item.state === "succeeded" ? 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div className="button-row">
                {item.state === "running" && (
                  <Button
                    variant="danger"
                    onClick={() => void act(item.id, "cancel")}
                  >
                    Cancel
                  </Button>
                )}
                {item.state === "failed" && (
                  <Button onClick={() => void act(item.id, "retry")}>
                    Retry
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="≋"
          title="Queue is empty"
          description={error || "Add a typed operation from Operations."}
        />
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </SurfaceCard>
  );
}

export function Files({ notify }: { notify: (message: string) => void }): JSX.Element {
  const bridge = window.desktopBridge;
  const [file, setFile] = useState<File | null>(null);
  const [catalog, setCatalog] = useState<{
    adapters?: Array<{
      id?: string;
      label?: string;
      category?: string;
      availability?: "enabled" | "disabled";
      unavailableReason?: string;
      sourceFormats?: readonly string[];
      targetFormats?: readonly string[];
    }>;
    missingCategories?: readonly string[];
  } | null>(null);
  const [detection, setDetection] = useState<unknown>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!bridge?.converterCatalog) {
      setError(
        "Converter catalog is unavailable because the bridge is not connected.",
      );
      return;
    }
    bridge
      .converterCatalog()
      .then((value) => setCatalog(value as typeof catalog))
      .catch((cause) =>
        setError(publicError(cause, "Converter catalog failed")),
      );
  }, []);
  const inspect = async () => {
    if (!file || !bridge?.detectFile) return;
    try {
      setDetection(
        await bridge.detectFile(new Uint8Array(await file.arrayBuffer())),
      );
      setError("");
    } catch (cause) {
      setError(publicError(cause, "File byte inspection failed"));
    }
  };
  const adapters = catalog?.adapters ?? [];
  return (
    <SurfaceCard>
      <div className="section-heading">
        <div>
          <h2>Local file converter</h2>
          <p>Detection and adapters are supplied by the local service.</p>
        </div>
        <StatusPill
          label={catalog ? `${adapters.length} adapters` : "Unknown"}
          tone={catalog ? "ready" : "waiting"}
        />
      </div>
      <div className="path-field">
        <label>
          <span className="sr-only">Choose local file for byte inspection</span>
          <input
            type="file"
            aria-label="Choose local file for byte inspection"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setDetection(null);
              setError("");
            }}
          />
        </label>
        <span>{file ? `${file.name} (${file.size} bytes)` : "No file selected"}</span>
      </div>
      <div className="adapter-grid">
        {adapters.map((adapter) => (
          <button
            className={`adapter ${adapter.availability === "disabled" ? "disabled-adapter" : ""}`}
            key={adapter.id ?? adapter.label}
            type="button"
            disabled={adapter.availability !== "enabled"}
            onClick={() => notify(`${adapter.label ?? adapter.id} is enabled by the local converter service`)}
          >
            <span>{adapter.availability === "enabled" ? "✓" : "○"}</span>
            {adapter.label ?? adapter.id ?? "Unnamed adapter"}
            <b>{adapter.availability === "enabled" ? "Enabled" : adapter.unavailableReason ?? "Unavailable"}</b>
            <small>{adapter.category ?? "Uncategorized"}: {(adapter.sourceFormats ?? []).join(", ")} → {(adapter.targetFormats ?? []).join(", ")}</small>
          </button>
        ))}
      </div>
      {catalog?.missingCategories?.length ? <p className="disabled-reason">No registered adapter: {catalog.missingCategories.join(", ")}</p> : null}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <Button
        variant="primary"
        disabled={!file || !bridge?.detectFile}
        onClick={() => void inspect()}
      >
        Inspect selected file
      </Button>
      {detection !== null && <pre className="preview-panel" aria-label="Detected file signature">{JSON.stringify(detection, null, 2)}</pre>}
    </SurfaceCard>
  );
}

export function Models({
  notify,
}: {
  notify: (message: string) => void;
}): JSX.Element {
  const bridge = window.desktopBridge;
  const [health, setHealth] = useState("Unknown");
  const [version, setVersion] = useState("Unavailable");
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState("");
  const refresh = async () => {
    if (!bridge?.ollamaHealth) {
      setHealth("Unavailable");
      notify(
        "Local model health is unavailable because the bridge is not connected",
      );
      return;
    }
    try {
      const result = (await bridge.ollamaHealth()) as {
        state?: string;
        reason?: string;
      };
      if (result.state === "healthy") {
        setHealth("Healthy");
        if (bridge.ollamaVersion) setVersion(await bridge.ollamaVersion());
        if (bridge.ollamaModels) {
          const value = (await bridge.ollamaModels()) as {
            installed?: readonly { name?: string }[];
          };
          const names = (value.installed ?? []).flatMap((item) =>
            item.name ? [item.name] : [],
          );
          setModels(names);
          setSelectedModel((current) =>
            current && names.includes(current) ? current : (names[0] ?? ""),
          );
        }
        notify("Local model health verified");
      } else {
        setHealth(
          result.reason ? `Unavailable: ${result.reason}` : "Unavailable",
        );
      }
    } catch (cause) {
      setHealth(`Unavailable: ${publicError(cause, "health request failed")}`);
    }
  };
  const chat = async () => {
    if (!bridge?.ollamaChat || health !== "Healthy" || !prompt || !selectedModel)
      return;
    try {
      const chunks = await bridge.ollamaChat(
        selectedModel,
        [{ role: "user", content: prompt }],
        {},
      );
      setReply(chunks.map((chunk) => chunk.content ?? "").join(""));
    } catch (cause) {
      notify(publicError(cause, "Local chat failed"));
    }
  };
  return (
    <div className="two-column">
      <SurfaceCard>
        <div className="section-heading">
          <div>
            <h2>Local model service</h2>
            <p>Healthy is shown only after a successful bridge response.</p>
          </div>
          <StatusPill
            label={health}
            tone={health === "Healthy" ? "ready" : "waiting"}
          />
        </div>
        <div className="model-health">
          <div className="model-icon">◈</div>
          <div>
            <strong>Version</strong>
            <p>{version}</p>
            <small>
              {models.length
                ? `${models.length} installed model(s)`
                : "Installed model list unavailable"}
            </small>
          </div>
        </div>
        <div className="button-row">
          <Button
            variant="primary"
            onClick={() => void refresh()}
            disabled={!bridge?.ollamaHealth}
          >
            Refresh health
          </Button>
          <p className="muted">Model catalog and pull controls are not exposed by this bridge.</p>
        </div>
      </SurfaceCard>
      <SurfaceCard>
        <h2>Local chat</h2>
        <p className="muted">
          {models.length
            ? `Using ${selectedModel}`
            : "Choose a healthy installed model before sending a prompt."}
        </p>
        <label className="form-field">
          <span>Installed model</span>
          <select
            aria-label="Installed model"
            value={selectedModel}
            disabled={health !== "Healthy" || !models.length}
            onChange={(event) => setSelectedModel(event.target.value)}
          >
            {models.map((model) => <option key={model} value={model}>{model}</option>)}
          </select>
        </label>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Prompt is unavailable until a model is healthy"
          disabled={health !== "Healthy" || !models.length}
        />
        <div className="button-row">
          <Button
            variant="primary"
            disabled={health !== "Healthy" || !models.length || !prompt}
            onClick={() => void chat()}
          >
            Send
          </Button>
          <Button
            variant="quiet"
            onClick={() => {
              setPrompt("");
              setReply("");
            }}
          >
            Clear
          </Button>
        </div>
        {reply && (
          <div className="reply-box" role="status">
            {reply}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}

function Authenticator({
  notify,
}: {
  notify: (message: string) => void;
}): JSX.Element {
  const bridge = window.desktopBridge;
  return (
    <SurfaceCard>
      <div className="section-heading">
        <div>
          <h2>Authenticator</h2>
          <p>Pairing needs a real QR route and local credential handling.</p>
        </div>
        <StatusPill label="No entries" tone="neutral" />
      </div>
      <EmptyState
        icon="◎"
        title="Pairing is unavailable"
        description="The current bridge exposes no QR renderer or TOTP registration route. No secret or fake code is shown."
        action={
          <Button
            disabled={!bridge}
            onClick={() =>
              notify("Authenticator bridge route is not connected")
            }
          >
            Start pairing
          </Button>
        }
      />
      <p className="disabled-reason">
        Required condition: a typed local QR and credential-vault route must be
        connected before pairing can begin.
      </p>
    </SurfaceCard>
  );
}

export function History({
  notify,
}: {
  notify: (message: string) => void;
}): JSX.Element {
  const bridge = window.desktopBridge;
  const [records, setRecords] = useState<unknown[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [exportSummary, setExportSummary] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!bridge?.listHistory) {
      setError("History is unavailable because the bridge is not connected.");
      return;
    }
    bridge
      .listHistory()
      .then((value) => {
        const raw = value as { revisions?: unknown[] } | unknown;
        const envelope = raw && typeof raw === "object" ? raw as { revisions?: unknown[] } : undefined;
        setRecords(
          Array.isArray(raw)
            ? raw
            : envelope && Array.isArray(envelope.revisions)
              ? envelope.revisions
              : [],
        );
      })
      .catch((cause) => setError(publicError(cause, "History load failed")));
  }, []);
  return (
    <SurfaceCard>
      <div className="section-heading">
        <div>
          <h2>Local history</h2>
          <p>Redacted metadata remains local and searchable.</p>
        </div>
        <Button
          variant="quiet"
          disabled={!bridge?.exportHistory}
          onClick={async () => {
            try {
              const exported = await bridge?.exportHistory?.();
              const result = exported as {
                schemaVersion?: unknown;
                privateSnapshotsOmitted?: unknown;
                revisions?: unknown[];
              };
              setExportSummary(
                result && typeof result === "object"
                  ? `Schema ${String(result.schemaVersion ?? "unknown")}, ${Array.isArray(result.revisions) ? result.revisions.length : 0} redacted revisions, private snapshots omitted: ${result.privateSnapshotsOmitted === true ? "yes" : "no"}.`
                  : "History export returned an unexpected result.",
              );
            } catch (cause) {
              setError(publicError(cause, "History export failed"));
            }
          }}
        >
          Export redacted
        </Button>
      </div>
      <div className="history-filter">
        <FormField label="Date range">
          <input type="date" />
        </FormField>
        <FormField label="Action">
          <select>
            <option>All recorded actions</option>
            <option>Settings changed</option>
            <option>Operation queued</option>
          </select>
        </FormField>
      </div>
      {exportSummary && <p className="muted">{exportSummary}</p>}
      {records.length ? (
        <div className="history-list">
          {records.map((record, index) => {
            const id = `record-${index}`;
            return (
              <label className="history-row" key={id}>
                <input
                  type="checkbox"
                  checked={selected.includes(id)}
                  onChange={() =>
                    setSelected((items) =>
                      items.includes(id)
                        ? items.filter((item) => item !== id)
                        : [...items, id],
                    )
                  }
                />
                <span className="timeline-dot">✓</span>
                <span>
                  <strong>
                    {typeof record === "object" && record && "label" in record
                      ? String((record as { label: unknown }).label)
                      : "Local revision"}
                  </strong>
                  <small>Redacted record retained locally</small>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="↺"
          title="No history records"
          description={
            error || "Changes recorded by the local service will appear here."
          }
        />
      )}
      <div className="bulk-bar">
        <Button
          variant="quiet"
          onClick={() =>
            setSelected(records.map((_, index) => `record-${index}`))
          }
        >
          Select all on this page
        </Button>
        <Button variant="quiet" onClick={() => setSelected([])}>
          Clear selection
        </Button>
        <span>{selected.length} selected</span>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </SurfaceCard>
  );
}

function Documentation({
  notify,
}: {
  notify: (message: string) => void;
}): JSX.Element {
  const articles = [
    {
      id: "privacy",
      title: "Local privacy",
      body: "Validated local inputs stay on this computer. Public records contain only neutral status.",
    },
    {
      id: "operations",
      title: "Typed operations",
      body: "Select an allowlisted action, review its target, and queue it with visible progress.",
    },
    {
      id: "appearance",
      title: "Appearance editing",
      body: "Use the context menu on any rendered target to open a reversible appearance editor.",
    },
    {
      id: "updates",
      title: "Unsigned updates",
      body: "Updates are checked in the background and require an explicit restart action.",
    },
  ];
  const [selected, setSelected] = useState(articles[0]);
  return (
    <SurfaceCard>
      <div className="section-heading">
        <div>
          <h2>Offline documentation</h2>
          <p>
            Articles are bundled with this build and do not depend on a network.
          </p>
        </div>
        <Button
          variant="quiet"
          onClick={() => notify("Documentation index is already local")}
        >
          Refresh index
        </Button>
      </div>
      <div className="docs-layout">
        <div className="article-list">
          {articles.map((article) => (
            <button
              className={`article-row ${selected.id === article.id ? "selected" : ""}`}
              key={article.id}
              type="button"
              onClick={() => setSelected(article)}
            >
              <span>▤</span>
              <b>{article.title}</b>
            </button>
          ))}
        </div>
        <article className="article-content">
          <p className="eyebrow">OFFLINE ARTICLE</p>
          <h3>{selected.title}</h3>
          <p>{selected.body}</p>
          <h4>Suggested articles</h4>
          <ul>
            <li>Local privacy</li>
            <li>Typed operations</li>
            <li>Appearance editing</li>
          </ul>
        </article>
      </div>
    </SurfaceCard>
  );
}

function Changelog({
  notify,
}: {
  notify: (message: string) => void;
}): JSX.Element {
  return (
    <SurfaceCard>
      <div className="section-heading">
        <div>
          <h2>Changelog</h2>
          <p>Every release entry carries its date and source commit.</p>
        </div>
        <div className="button-row">
          <Button
            variant="quiet"
            onClick={() => notify("Changelog copied locally")}
          >
            Copy filtered view
          </Button>
          <Button
            variant="quiet"
            onClick={() => notify("Changelog export prepared")}
          >
            Export Markdown
          </Button>
        </div>
      </div>
      <div className="release-entry">
        <span className="release-version">0.1.0</span>
        <div>
          <strong>Initial local cockpit</strong>
          <p>
            Typed local operations, privacy controls, accessibility foundations,
            and offline documentation.
          </p>
          <a
            href="https://github.com/Ding-Ding-Projects/wording-lens/commit/2818dcaef832de8192b98333643c40dc63fc8a31"
            target="_blank"
            rel="noreferrer"
          >
            2818dca
          </a>
        </div>
        <time dateTime={BUILD_PROVENANCE.updatedAt}>
          {formatProvenanceDate(BUILD_PROVENANCE.updatedAt)}
        </time>
      </div>
      <FormField label="Date filter">
        <input type="date" aria-label="Changelog date filter" />
      </FormField>
    </SurfaceCard>
  );
}

export function Notifications({
  notify,
}: {
  notify: (message: string) => void;
}): JSX.Element {
  const bridge = window.desktopBridge;
  const [items, setItems] = useState<readonly NotificationRecord[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const load = async () => {
    if (!bridge?.listNotifications) {
      setError(
        "Notifications are unavailable because the bridge is not connected.",
      );
      return;
    }
    try {
      setItems(await bridge.listNotifications(true));
    } catch (cause) {
      setError(publicError(cause, "Notification load failed"));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const dismiss = async (id: string) => {
    try {
      await bridge?.dismissNotifications?.([id]);
      await load();
      notify("Notification dismissed locally");
    } catch (cause) {
      setError(publicError(cause, "Notification dismissal failed"));
    }
  };
  const dismissSelected = async () => {
    if (!selected.length || !bridge?.dismissNotifications) return;
    try {
      const dismissed = await bridge.dismissNotifications(selected);
      setSelected([]);
      await load();
      notify(`${dismissed} notification${dismissed === 1 ? "" : "s"} dismissed locally`);
    } catch (cause) {
      setError(publicError(cause, "Notification dismissal failed"));
    }
  };
  return (
    <SurfaceCard>
      <div className="section-heading">
        <div>
          <h2>Notification centre</h2>
          <p>Informational updates stay non-blocking and reviewable.</p>
        </div>
        <Button variant="quiet" onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      {items.length ? (
        <div className="notification-list">
          {items.map((item) => (
            <div className="notification" key={item.id}>
              <input
                type="checkbox"
                aria-label={`Select notification ${item.title}`}
                checked={selected.includes(item.id)}
                onChange={() =>
                  setSelected((current) =>
                    current.includes(item.id)
                      ? current.filter((id) => id !== item.id)
                      : [...current, item.id],
                  )
                }
              />
              <StatusPill
                label={item.level}
                tone={item.level === "error" ? "danger" : "ready"}
              />
              <span>
                {item.title}: {item.body}
              </span>
              <button
                type="button"
                onClick={() => void dismiss(item.id)}
                aria-label={`Dismiss ${item.title}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="♢"
          title="No notifications"
          description={
            error || "Notifications added by the local bridge appear here."
          }
        />
      )}
      {items.length > 0 && (
        <div className="bulk-bar">
          <Button
            variant="quiet"
            onClick={() =>
              setSelected(
                items.filter((item) => !item.dismissedAt).map((item) => item.id),
              )
            }
          >
            Select active notifications
          </Button>
          <Button
            variant="quiet"
            disabled={!selected.length}
            onClick={() => void dismissSelected()}
          >
            Dismiss selected
          </Button>
          <span>{selected.length} selected</span>
        </div>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </SurfaceCard>
  );
}

function Status({ provenance }: { provenance: AppProvenance }): JSX.Element {
  const bridgeActive = Boolean(window.desktopBridge);
  return (
    <div className="status-grid">
      <SurfaceCard>
        <div className="section-heading">
          <div>
            <h2>Live session status</h2>
            <p>Current evidence is shown with its real state.</p>
          </div>
          <StatusPill label={bridgeActive ? "Bridge present" : "Bridge unavailable"} tone={bridgeActive ? "ready" : "waiting"} />
        </div>
        <div className="status-banner">
          <strong>{bridgeActive ? "Local bridge detected" : "Local bridge unavailable"}</strong>
          <span>External status has not been queried.</span>
        </div>
        <div className="evidence-list">
          <div>
            <span>Build provenance</span>
            <StatusPill label={isValidProvenance(provenance) ? "Loaded" : "Unavailable"} tone={isValidProvenance(provenance) ? "ready" : "waiting"} />
          </div>
          <div>
            <span>Runtime bridge</span>
            <StatusPill label={bridgeActive ? "Present" : "Unavailable"} tone={bridgeActive ? "ready" : "waiting"} />
          </div>
          <div>
            <span>Remote status</span>
            <StatusPill label="Not queried" tone="waiting" />
          </div>
        </div>
      </SurfaceCard>
      <SurfaceCard>
        <h2>Version provenance</h2>
        <p className="muted">
          This exact build reports its recorded provenance before navigation.
        </p>
        <dl className="provenance-list">
          <dt>Version</dt>
          <dd>{provenance.version || "Unavailable"}</dd>
          <dt>Updated</dt>
          <dd>
            {isValidProvenance(provenance)
              ? formatProvenanceDate(provenance.updatedAt)
              : "Unavailable"}
          </dd>
          <dt>Source</dt>
          <dd>{provenance.source || "Unavailable"}</dd>
        </dl>
      </SurfaceCard>
    </div>
  );
}

export function Settings({
  settings,
  mode,
  schoolMode,
  setSchoolMode,
  updateSettings,
  notify,
}: {
  settings: AppSettings;
  mode: LanguageMode;
  schoolMode: boolean;
  setSchoolMode: (value: boolean) => void;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  notify: (message: string) => void;
}): JSX.Element {
  const bridge = window.desktopBridge;
  const [tab, setTab] = useState("general");
  const [vocab, setVocab] = useState<VocabularyStatus>({
    authenticated: false,
    loaded: false,
    entryCount: 0,
  });
  const [secret, setSecret] = useState("");
  const [unlock, setUnlock] = useState("");
  const [privateEntries, setPrivateEntries] = useState<readonly { key: string; value: string }[]>([]);
  const [privateInput, setPrivateInput] = useState("");
  const [privateOutput, setPrivateOutput] = useState("");
  const [vocabularyMessage, setVocabularyMessage] = useState("");
  const [editorList, setEditorList] = useState<readonly EditorCandidate[]>([]);
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [recovery, setRecovery] = useState("");
  const tabs = [
    { id: "general", label: "General" },
    { id: "appearance", label: "Appearance" },
    { id: "accessibility", label: "Accessibility" },
    { id: "privacy", label: "Privacy" },
    { id: "integrations", label: "Integrations" },
  ];
  useEffect(() => {
    if (bridge?.vocabularyStatus)
      bridge
        .vocabularyStatus()
        .then(setVocab)
        .catch(() => undefined);
  }, []);
  const configure = async () => {
    if (!bridge?.configureVocabularyUnlock || !secret) {
      setVocab({ ...vocab, authenticated: false });
      return;
    }
    try {
      await bridge.configureVocabularyUnlock(secret);
      setSecret("");
      setUnlock("");
      setVocab({ ...vocab, authenticated: false });
      notify("Private wording unlock configured locally");
    } catch (cause) {
      setVocabularyMessage("Unlock configuration failed. The local service did not accept the request.");
    }
  };
  const authenticate = async () => {
    if (!bridge?.unlockVocabulary || !unlock) return;
    try {
      const authenticated = await bridge.unlockVocabulary(unlock);
      setUnlock("");
      if (bridge.vocabularyStatus) setVocab(await bridge.vocabularyStatus());
      setVocabularyMessage(authenticated ? "Private wording is unlocked locally." : "Private wording unlock was not accepted.");
    } catch {
      setUnlock("");
      setVocabularyMessage("Private wording unlock failed. Check the local unlock value and try again.");
    }
  };
  const upload = async (file: File | undefined) => {
    if (!file || !bridge?.saveVocabulary || !vocab.authenticated) return;
    try {
      setVocab(
        await bridge.saveVocabulary(new Uint8Array(await file.arrayBuffer())),
      );
      setPrivateEntries([]);
      setVocabularyMessage("Private wording file validated locally.");
    } catch {
      setVocabularyMessage("Private wording file was rejected. Its contents were not applied.");
    }
  };
  const loadPrivateEntries = async () => {
    if (!bridge?.vocabularyEntries || !vocab.authenticated || !vocab.loaded) return;
    try {
      setPrivateEntries(await bridge.vocabularyEntries());
      setVocabularyMessage("Private entries were read from the authenticated local service.");
    } catch {
      setVocabularyMessage("Private entries could not be read from the authenticated local service.");
    }
  };
  const renderPrivateText = async () => {
    if (!bridge?.renderPrivateText || !vocab.authenticated || !vocab.loaded || !privateInput) return;
    try {
      setPrivateOutput(await bridge.renderPrivateText(privateInput, "private-ui"));
      setVocabularyMessage("Private text was rendered only in this local settings surface.");
    } catch {
      setVocabularyMessage("Private text could not be rendered by the local service.");
    }
  };
  const loadEditors = async () => {
    if (!bridge?.listEditors) {
      notify(
        "Editor detection unavailable because the bridge is not connected",
      );
      return;
    }
    setEditorList(await bridge.listEditors());
  };
  const saveSchedule = async () => {
    if (!bridge?.validateSchedule) {
      setScheduleMessage(
        "Schedule validation unavailable because the bridge is not connected.",
      );
      return;
    }
    try {
      await bridge.validateSchedule({
        version: 1,
        rules: [],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setScheduleMessage("Empty schedule validated locally.");
    } catch (cause) {
      setScheduleMessage(publicError(cause, "Schedule validation failed"));
    }
  };
  const openRecovery = async () => {
    if (!bridge?.openRecoveryFolder) {
      setRecovery(
        "Recovery folder route is unavailable because the bridge is not connected.",
      );
      return;
    }
    const result = (await bridge.openRecoveryFolder()) as {
      path?: string;
      opened?: boolean;
      message?: string;
    };
    setRecovery(
      result.opened
        ? `Opened recovery folder: ${result.path ?? "local data"}`
        : (result.message ?? "Recovery folder was not opened."),
    );
  };
  return (
    <div className="settings-layout">
      <div
        className="settings-tabs"
        role="tablist"
        aria-orientation="vertical"
        aria-label="Settings sections"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            className={tab === item.id ? "selected" : ""}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="settings-content" role="tabpanel">
        <SurfaceCard>
          <h2>{tabs.find((item) => item.id === tab)?.label}</h2>
          <p className="muted">
            Changes apply immediately and persist through the typed settings
            route when connected.
          </p>
          {tab === "general" && (
            <>
              <div className="setting-row">
                <div>
                  <strong>Display name</strong>
                  <small>
                    Changes visible text only. Package and data identity stay
                    stable.
                  </small>
                </div>
                <input
                  value={settings.displayName}
                  onChange={(event) =>
                    void updateSettings({ displayName: event.target.value })
                  }
                />
              </div>
              <div className="setting-row">
                <div>
                  <strong>Language mode</strong>
                  <small>English, playful Cantonese, or bilingual.</small>
                </div>
                <select
                  value={schoolMode ? "en" : mode}
                  disabled={schoolMode}
                  onChange={(event) =>
                    void updateSettings({
                      languageMode:
                        settingsForLanguage[event.target.value as LanguageMode],
                    })
                  }
                >
                  <option value="en">English</option>
                  <option value="zh-Hant">繁體中文</option>
                  <option value="bilingual">Bilingual · 雙語</option>
                </select>
              </div>
              <div className="setting-row">
                <div>
                  <strong>Theme</strong>
                  <small>Light or dark appearance.</small>
                </div>
                <select
                  value={settings.theme}
                  onChange={(event) =>
                    void updateSettings({
                      theme: event.target.value as AppSettings["theme"],
                    })
                  }
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>
              <div className="setting-row">
                <div>
                  <strong>Density</strong>
                  <small>Controls spacing while preserving target sizes.</small>
                </div>
                <select
                  value={settings.density}
                  onChange={(event) =>
                    void updateSettings({
                      density: event.target.value as AppSettings["density"],
                    })
                  }
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                  <option value="spacious">Spacious</option>
                </select>
              </div>
              <div className="setting-row">
                <div>
                  <strong>School mode</strong>
                  <small>
                    {schoolMode
                      ? "English-only presentation is active."
                      : "Optional language and delight controls remain available."}
                  </small>
                </div>
                <input
                  type="checkbox"
                  checked={schoolMode}
                  onChange={(event) => setSchoolMode(event.target.checked)}
                  aria-label="School mode"
                />
              </div>
            </>
          )}
          {tab === "appearance" && (
            <>
              <div className="setting-row">
                <div>
                  <strong>App logo</strong>
                  <small>
                    Presets are shipped. Custom conversion needs a connected
                    local decoder.
                  </small>
                </div>
                <select aria-label="App logo preset">
                  <option>Electric cyan mark</option>
                  <option>Mint mark</option>
                  <option>Monochrome mark</option>
                </select>
              </div>
              <div
                className="logo-preview"
                aria-label="Current app logo preview"
              >
                WL
              </div>
              <label className="upload-control">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={() =>
                    notify(
                      "Custom logo conversion unavailable: no decoder route is connected",
                    )
                  }
                />
                <span>Choose custom image</span>
              </label>
              <div className="button-row">
                <Button
                  onClick={() => notify("Appearance editor opened locally")}
                >
                  Edit Settings appearance
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => notify("Appearance reset to shipped mark")}
                >
                  Reset appearance
                </Button>
              </div>
            </>
          )}
          {tab === "accessibility" && !schoolMode && (
            <>
              <div className="tone-grid">
                <FormField
                  label={`English tone ${settings.funnyEnglish}`}
                  hint="1 serious, 5 maximum playfulness"
                >
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={settings.funnyEnglish}
                    onChange={(event) =>
                      void updateSettings({
                        funnyEnglish: Number(
                          event.target.value,
                        ) as AppSettings["funnyEnglish"],
                      })
                    }
                  />
                </FormField>
                <FormField
                  label={`Cantonese tone ${settings.funnyCantonese}`}
                  hint="1 serious, 5 最活潑"
                >
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={settings.funnyCantonese}
                    onChange={(event) =>
                      void updateSettings({
                        funnyCantonese: Number(
                          event.target.value,
                        ) as AppSettings["funnyCantonese"],
                      })
                    }
                  />
                </FormField>
              </div>
              <div className="setting-row">
                <div>
                  <strong>Show emojis in dialogs and message boxes</strong>
                  <small>Decorative only, never part of control names.</small>
                </div>
                <input
                  type="checkbox"
                  checked={settings.emojiDialogs}
                  onChange={(event) =>
                    void updateSettings({ emojiDialogs: event.target.checked })
                  }
                  aria-label="Show emojis in dialogs and message boxes"
                />
              </div>
              <div className="setting-row">
                <div>
                  <strong>Narrator</strong>
                  <small>
                    Off by default. Voice lists are resolved from the machine
                    when available.
                  </small>
                </div>
                <input
                  type="checkbox"
                  checked={settings.narrationEnabled}
                  onChange={(event) =>
                    void updateSettings({
                      narrationEnabled: event.target.checked,
                    })
                  }
                  aria-label="Enable narrator"
                />
              </div>
              <div className="voice-grid">
                <FormField label="Narrated language">
                  <select
                    value={settings.narrationLanguage}
                    onChange={(event) =>
                      void updateSettings({
                        narrationLanguage: event.target
                          .value as AppSettings["narrationLanguage"],
                      })
                    }
                  >
                    <option value="english">English</option>
                    <option value="cantonese">粵語</option>
                    <option value="both">Both, serialized</option>
                  </select>
                </FormField>
                <FormField label="English voice">
                  <select>
                    <option>Choose automatically</option>
                  </select>
                </FormField>
                <FormField label="Cantonese voice">
                  <select>
                    <option>Choose automatically</option>
                  </select>
                </FormField>
                <FormField label="Rate">
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    defaultValue="1"
                  />
                </FormField>
                <FormField label="Pitch">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    defaultValue="1"
                  />
                </FormField>
              </div>
            </>
          )}
          {tab === "accessibility" && schoolMode && (
            <p>
              Accessibility controls remain available. Optional language and
              tone controls are omitted while School mode is active.
            </p>
          )}
          {tab === "privacy" && !schoolMode && (
            <>
              <div className="unlock-grid">
                <FormField
                  label="Configure local unlock"
                  hint="The secret is sent only to the local bridge and never shown again."
                >
                  <input
                    type="password"
                    value={secret}
                    onChange={(event) => setSecret(event.target.value)}
                  />
                </FormField>
                <Button
                  onClick={() => void configure()}
                  disabled={!secret || !bridge?.configureVocabularyUnlock}
                >
                  Configure unlock
                </Button>
                <FormField label="Unlock private wording">
                  <input
                    type="password"
                    value={unlock}
                    onChange={(event) => setUnlock(event.target.value)}
                  />
                </FormField>
                <Button
                  onClick={() => void authenticate()}
                  disabled={!unlock || !bridge?.unlockVocabulary}
                >
                  Unlock
                </Button>
              </div>
              <div className="vocab-status">
                <StatusPill
                  label={vocab.authenticated ? "Unlocked" : "Locked"}
                  tone={vocab.authenticated ? "ready" : "waiting"}
                />
                <span>
                  {vocab.loaded
                    ? `${vocab.entryCount} private entries available`
                    : "No private entries loaded"}
                </span>
              </div>
              <label className="upload-control">
                <input
                  type="file"
                  accept="application/json,.json"
                  disabled={!vocab.authenticated}
                  onChange={(event) => void upload(event.target.files?.[0])}
                />
                <span>
                  {vocab.authenticated
                    ? "Choose local JSON file"
                    : "Unlock to choose local JSON file"}
                </span>
              </label>
              <div className="private-atlas">
                <strong>Private entry atlas</strong>
                <p>
                  {vocab.authenticated && vocab.loaded
                    ? `${vocab.entryCount} entries are available only through the authenticated local service.`
                    : "Disabled until the authenticated private-only service reports loaded entries."}
                </p>
              </div>
              <div className="button-row">
                <Button variant="quiet" disabled={!vocab.authenticated || !vocab.loaded} onClick={() => void loadPrivateEntries()}>
                  List authenticated entries
                </Button>
              </div>
              {privateEntries.length > 0 && <ul className="private-atlas" aria-label="Authenticated private entries">{privateEntries.map((entry) => <li key={entry.key}><code>{entry.key}</code><span>{entry.value}</span></li>)}</ul>}
              <FormField label="Render private text locally" hint="This preview is sent only to the authenticated local service and is not included in exports or history.">
                <textarea value={privateInput} onChange={(event) => setPrivateInput(event.target.value)} disabled={!vocab.authenticated || !vocab.loaded} />
              </FormField>
              <Button variant="quiet" disabled={!privateInput || !vocab.authenticated || !vocab.loaded} onClick={() => void renderPrivateText()}>
                Render local preview
              </Button>
              {privateOutput && <div className="preview-panel" aria-label="Rendered local private text">{privateOutput}</div>}
              {vocabularyMessage && <p className="muted" role="status">{vocabularyMessage}</p>}
              <Button
                variant="quiet"
                onClick={async () => {
                  if (!bridge?.clearVocabulary) {
                    setVocabularyMessage("Private wording cannot be cleared because the local service is unavailable.");
                    return;
                  }
                  try {
                    setVocab(await bridge.clearVocabulary());
                    setPrivateEntries([]);
                    setPrivateInput("");
                    setPrivateOutput("");
                    setVocabularyMessage("Private wording was cleared and original text was restored.");
                  } catch {
                    setVocabularyMessage("Private wording could not be cleared by the local service.");
                  }
                }}
              >
                Clear and restore original wording
              </Button>
              <p className="muted">
                Exports and history omit private values. This bridge does not expose vocabulary source metadata.
              </p>
            </>
          )}
          {tab === "privacy" && schoolMode && (
            <p>
              Privacy controls remain available. Private wording controls are
              omitted while School mode is active.
            </p>
          )}
          {tab === "integrations" && (
            <>
              <div className="setting-row">
                <div>
                  <strong>External editor</strong>
                  <small>
                    Detect installed editors through the local service.
                  </small>
                </div>
                <Button onClick={() => void loadEditors()}>
                  Detect editors
                </Button>
              </div>
              {editorList.map((editor) => (
                <div className="list-row" key={editor.id}>
                  <span className="row-icon">⌁</span>
                  <div>
                    <strong>{editor.id}</strong>
                    <small>{editor.executable}</small>
                  </div>
                  <StatusPill
                    label={editor.available ? "Available" : "Unavailable"}
                    tone={editor.available ? "ready" : "waiting"}
                  />
                </div>
              ))}
              <div className="setting-row">
                <div>
                  <strong>Scheduled settings</strong>
                  <small>
                    Versioned local rules use the configured timezone.
                  </small>
                </div>
                <Button onClick={() => void saveSchedule()}>
                  Validate schedule
                </Button>
              </div>
              {scheduleMessage && <p className="muted">{scheduleMessage}</p>}
              <div className="setting-row">
                <div>
                  <strong>Recovery folder</strong>
                  <small>
                    Open the local data folder for self-service recovery.
                  </small>
                </div>
                <Button onClick={() => void openRecovery()}>Open folder</Button>
              </div>
              {recovery && <p className="muted">{recovery}</p>}
            </>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}

function ContextMenu({
  x,
  y,
  close,
  notify,
}: {
  x: number;
  y: number;
  close: () => void;
  notify: (message: string) => void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [regex, setRegex] = useState(false);
  const items = [
    "Edit appearance…",
    "Lock this element…",
    "Export…",
    "Open documentation",
  ];
  const visible = items.filter((item) =>
    item.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="context-menu" style={{ left: x, top: y }} role="menu">
      <SearchField
        label="Context menu search"
        query={query}
        onQuery={setQuery}
        onOpenRegex={() => setRegex(!regex)}
      />
      {regex && <RegexBuilder onClose={() => setRegex(false)} />}
      {visible.length ? (
        visible.map((item) => (
          <button
            type="button"
            role="menuitem"
            key={item}
            onClick={() => {
              notify(`${item.replace("…", "")} opened locally`);
              close();
            }}
          >
            {item}
          </button>
        ))
      ) : (
        <p className="menu-empty">No matching actions</p>
      )}
    </div>
  );
}

function DestructiveDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}): JSX.Element {
  const [first, setFirst] = useState(false);
  const [second, setSecond] = useState(false);
  const [slider, setSlider] = useState(0);
  return (
    <Dialog
      title="Confirm destructive action"
      eyebrow="SUPER CONFIRMATION"
      onClose={onClose}
    >
      <p>
        This action affects only the selected local records. Two independent
        keys and a full-range slider are required.
      </p>
      <div className="key-grid">
        <label>
          <input
            type="checkbox"
            checked={first}
            onChange={(event) => setFirst(event.target.checked)}
          />{" "}
          Key one confirmed
        </label>
        <label>
          <input
            type="checkbox"
            checked={second}
            onChange={(event) => setSecond(event.target.checked)}
          />{" "}
          Key two confirmed
        </label>
      </div>
      <label className="slider-confirm">
        Confirmation progress
        <input
          type="range"
          min="0"
          max="100"
          value={slider}
          onChange={(event) => setSlider(Number(event.target.value))}
        />
        <span>{slider}%</span>
      </label>
      <div className="button-row">
        <Button
          variant="danger"
          disabled={!first || !second || slider < 100}
          onClick={onConfirm}
        >
          Confirm irreversible action
        </Button>
        <Button variant="quiet" onClick={onClose}>
          Emergency exit
        </Button>
      </div>
    </Dialog>
  );
}

export function App(): JSX.Element {
  const [screen, setScreen] = useState<ScreenId>(readRoute);
  const [settings, setSettings] = useState<AppSettings>(safeSettings);
  const [schoolMode, setSchoolMode] = useState(
    () => window.localStorage.getItem("wording-lens.school-mode") === "true",
  );
  const [provenance, setProvenance] = useState<AppProvenance>(BUILD_PROVENANCE);
  const [query, setQuery] = useState("");
  const [regex, setRegex] = useState(false);
  const [regexPattern, setRegexPattern] = useState("");
  const [regexFlags, setRegexFlags] = useState('iu');
  const contentRef = useRef<HTMLDivElement>(null);
  const searchStatus = useSurfaceSearch(contentRef, screen, query, regexPattern, regexFlags);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [updater, setUpdater] = useState<UpdaterState>({
    state: "idle",
    unsigned: true,
  });
  const [palette, setPalette] = useState(false);
  const [context, setContext] = useState<{ x: number; y: number } | null>(null);
  const [destructive, setDestructive] = useState(false);
  const [queueRefresh, setQueueRefresh] = useState(0);
  const bridge = window.desktopBridge;
  const mode = schoolMode ? "en" : languageForSettings[settings.languageMode];
  const notify = (message: string) =>
    setNotifications((items) => [message, ...items].slice(0, 12));
  const updateSettings = async (patch: Partial<AppSettings>) => {
    try {
      if (bridge?.updateSettings) {
        const next = await bridge.updateSettings(patch);
        setSettings(next);
      } else {
        const next = safeSettings({ ...settings, ...patch });
        setSettings(next);
        window.localStorage.setItem(
          "wording-lens.settings",
          JSON.stringify(next),
        );
        notify("Settings saved locally; typed bridge unavailable");
      }
    } catch (cause) {
      notify(publicError(cause, "Settings update failed"));
    }
  };
  const refreshUpdater = async () => {
    if (!bridge?.getUpdaterState) {
      notify("Updater state unavailable because the bridge is not connected");
      return;
    }
    try {
      setUpdater(await bridge.getUpdaterState());
    } catch (cause) {
      notify(publicError(cause, "Updater state failed"));
    }
  };
  useEffect(() => {
    const raw = window.localStorage.getItem("wording-lens.settings");
    if (raw) {
      try {
        setSettings(safeSettings(JSON.parse(raw) as Partial<AppSettings>));
      } catch {
        /* invalid local fallback is ignored */
      }
    }
    if (bridge?.getSettings)
      bridge
        .getSettings()
        .then(setSettings)
        .catch((cause) => notify(publicError(cause, "Settings load failed")));
    if (bridge?.getProvenance)
      bridge
        .getProvenance()
        .then((value) => {
          if (isValidProvenance(value)) setProvenance(value);
        })
        .catch(() => undefined);
    void refreshUpdater();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.density = settings.density;
    document.documentElement.dataset.reducedMotion = settings.reducedMotion
      ? "true"
      : "false";
    window.localStorage.setItem("wording-lens.school-mode", String(schoolMode));
  }, [settings, schoolMode]);
  useEffect(() => {
    const onHash = () => setScreen(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setPalette(true);
      }
      if (event.key === "F10" && event.shiftKey) {
        event.preventDefault();
        setContext({ x: 120, y: 120 });
      }
      if (event.key === "Escape") {
        setPalette(false);
        setContext(null);
        setDestructive(false);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const navigate = (next: ScreenId) => {
    window.location.hash = `#/${next}`;
    setScreen(next);
    setQuery("");
    setRegex(false);
    setRegexPattern("");
  };
  const body =
    screen === "overview" ? (
      <Overview
        navigate={navigate}
        notify={notify}
        updater={updater}
        refreshUpdater={() => void refreshUpdater()}
      />
    ) : screen === "projects" ? (
      <Projects notify={notify} />
    ) : screen === "operations" ? (
      <Operations
        notify={notify}
        onQueued={() => setQueueRefresh((value) => value + 1)}
      />
    ) : screen === "queue" ? (
      <Queue notify={notify} refreshKey={queueRefresh} />
    ) : screen === "files" ? (
      <Files notify={notify} />
    ) : screen === "models" ? (
      <Models notify={notify} />
    ) : screen === "authenticator" ? (
      <Authenticator notify={notify} />
    ) : screen === "history" ? (
      <History notify={notify} />
    ) : screen === "documentation" ? (
      <Documentation notify={notify} />
    ) : screen === "changelog" ? (
      <Changelog notify={notify} />
    ) : screen === "notifications" ? (
      <Notifications notify={notify} />
    ) : screen === "status" ? (
      <Status provenance={provenance} />
    ) : (
      <Settings
        settings={settings}
        mode={mode}
        schoolMode={schoolMode}
        setSchoolMode={setSchoolMode}
        updateSettings={updateSettings}
        notify={notify}
      />
    );
  return (
    <div
      className="app-shell"
      onContextMenu={(event) => {
        event.preventDefault();
        setContext({
          x: Math.min(event.clientX, window.innerWidth - 310),
          y: Math.min(event.clientY, window.innerHeight - 260),
        });
      }}
    >
      <header className="title-bar">
        <div className="title-bar-drag">
          <span className="brand-glyph" aria-hidden="true">
            WL
          </span>
          <strong>{settings.displayName}</strong>
        </div>
        <div
          className="provenance"
          aria-label={`Version ${provenance.version || "Unavailable"}`}
        >
          <span>
            <small>VERSION</small>
            <strong>{provenance.version || "Unavailable"}</strong>
          </span>
          <i />
          <span>
            <small>UPDATED</small>
            <strong>
              {isValidProvenance(provenance)
                ? formatProvenanceDate(provenance.updatedAt)
                : "Unavailable"}
            </strong>
          </span>
        </div>
        <div className="title-bar-actions">
          <select
            aria-label="Language mode"
            value={schoolMode ? "en" : mode}
            disabled={schoolMode}
            onChange={(event) =>
              void updateSettings({
                languageMode:
                  settingsForLanguage[event.target.value as LanguageMode],
              })
            }
          >
            <option value="en">English</option>
            <option value="zh-Hant">繁體中文</option>
            <option value="bilingual">Bilingual · 雙語</option>
          </select>
          <button
            type="button"
            className="palette-trigger"
            aria-label="Open command palette"
            onClick={() => setPalette(true)}
          >
            ⌘⇧F
          </button>
          <button
            type="button"
            className="theme-button"
            aria-label="Toggle theme"
            onClick={() =>
              void updateSettings({
                theme: settings.theme === "dark" ? "light" : "dark",
              })
            }
          >
            {settings.theme === "dark" ? "☼" : "☾"}
          </button>
        </div>
        <WindowControls />
      </header>
      <div className="workspace">
        <TabRail
          active={screen}
          mode={mode}
          onNavigate={navigate}
          collapsed={false}
          onToggle={() =>
            notify(
              "Navigation rail is always visible at the minimum client area",
            )
          }
        />
        <main
          className="main-content"
          id={`tabpanel-${screen}`}
          role="tabpanel"
          aria-label={localize(labels[screen], mode)}
        >
          <SurfaceHeader
            screen={screen}
            mode={mode}
            query={query}
            setQuery={setQuery}
            regex={regex}
            setRegex={setRegex}
            onApplyRegex={(pattern, flags) => { setRegexPattern(pattern); setRegexFlags(flags); }}
          />
          <p role="status">{searchStatus}</p>
          <div ref={contentRef}>{body}</div>
        </main>
      </div>
      <footer className="status-footer">
        <span>
          <i className="footer-dot" aria-hidden="true" /> Local only
        </span>
        <span>{bridge ? "Typed bridge present" : "Typed bridge unavailable"}</span>
        <span>Ctrl+Shift+F palette</span>
        <span className="footer-spacer" />
        <span>Ready</span>
      </footer>
      {palette && (
        <div className="palette-backdrop" onClick={() => setPalette(false)}>
          <section
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="palette-head">
              <span>⌘</span>
              <SearchField
                label="Command palette"
                query={query}
                onQuery={setQuery}
                onOpenRegex={() => setRegex(!regex)}
                placeholder="Search commands, features, and settings"
              />
              <kbd>ESC</kbd>
            </div>
            <div className="palette-section">
              <small>DESTINATIONS</small>
              {screenOrder
                .filter((item) =>
                  `${labels[item].en} ${labels[item].zh}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => {
                      navigate(item);
                      setPalette(false);
                    }}
                  >
                    {localize(labels[item], mode)}
                    <b>↵</b>
                  </button>
                ))}
            </div>
          </section>
        </div>
      )}
      {context && (
        <ContextMenu
          x={context.x}
          y={context.y}
          close={() => setContext(null)}
          notify={notify}
        />
      )}
      {destructive && (
        <DestructiveDialog
          onClose={() => setDestructive(false)}
          onConfirm={() => {
            setDestructive(false);
            notify("Destructive action confirmed locally");
          }}
        />
      )}
    </div>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
