import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type ScreenId = "overview" | "projects" | "operations" | "queue" | "files" | "models" | "authenticator" | "history" | "documentation" | "changelog" | "notifications" | "status" | "settings";
export type LanguageMode = "en" | "zh-Hant" | "bilingual";
export type Copy = { en: string; zh: string };

export const screenOrder: ScreenId[] = ["overview", "projects", "operations", "queue", "files", "models", "authenticator", "history", "documentation", "changelog", "notifications", "status", "settings"];

export function text(value: Copy, mode: LanguageMode): string {
  if (mode === "zh-Hant") return value.zh;
  if (mode === "bilingual") return `${value.en} · ${value.zh}`;
  return value.en;
}

export function Button({ children, onClick, variant = "secondary", disabled = false, type = "button", ariaLabel }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "quiet" | "danger"; disabled?: boolean; type?: "button" | "submit"; ariaLabel?: string }): JSX.Element {
  return <button type={type} className={`${variant}-button`} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>{children}</button>;
}

export function StatusPill({ label, tone = "ready" }: { label: string; tone?: "ready" | "waiting" | "danger" | "neutral" }): JSX.Element {
  return <span className={`status-pill ${tone}`}><span className="status-dot" aria-hidden="true" />{label}</span>;
}

export function StatCard({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "ready" | "waiting" | "danger" }): JSX.Element {
  return <article className={`stat-card tone-${tone}`}><span className="stat-label">{label}</span><strong>{value}</strong><span className="stat-detail">{detail}</span></article>;
}

export function EmptyState({ icon, title, description, action }: { icon: string; title: string; description: string; action?: ReactNode }): JSX.Element {
  return <div className="empty-state"><span className="empty-icon" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function WindowControls(): JSX.Element {
  return <div className="window-controls" aria-label="Window controls"><button type="button" className="window-control" aria-label="Minimize" onClick={() => window.desktopBridge?.minimize()}>−</button><button type="button" className="window-control" aria-label="Maximize" onClick={() => window.desktopBridge?.toggleMaximize()}>□</button><button type="button" className="window-control close" aria-label="Close" onClick={() => window.desktopBridge?.close()}>×</button></div>;
}

export function SearchField({ label, query, onQuery, onOpenRegex, placeholder = "Search this surface", focusId }: { label: string; query: string; onQuery: (value: string) => void; onOpenRegex: () => void; placeholder?: string; focusId?: string }): JSX.Element {
  const id = `search-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  return <div className="search-wrap" data-focus-id={focusId}><label className="search-label" htmlFor={id}>{label}</label><div className="search-field"><span className="search-icon" aria-hidden="true">⌕</span><input id={id} value={query} onChange={(event) => onQuery(event.target.value)} placeholder={placeholder} /><button type="button" className="regex-button" aria-label={`Open full regex builder for ${label}`} onClick={onOpenRegex}>.*</button></div></div>;
}

type Match = { value: string; index: number; captures: string[] };
export function RegexBuilder({ onClose, query = "", onApply }: { onClose: () => void; query?: string; onApply?: (pattern: string, flags: string) => void }): JSX.Element {
  const [pattern, setPattern] = useState(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const [flags, setFlags] = useState("giu");
  const [sample, setSample] = useState("Wording Lens · 本機操作");
  const [replacement, setReplacement] = useState("$&");
  const [saved, setSaved] = useState<string[]>([]);
  const parsed = useMemo(() => { try { return { expression: new RegExp(pattern || "(?:)", flags), error: "" }; } catch (error) { return { expression: null, error: error instanceof Error ? error.message : "Invalid regular expression" }; } }, [pattern, flags]);
  const matches = useMemo<Match[]>(() => { if (!parsed.expression) return []; const expression = new RegExp(parsed.expression.source, parsed.expression.flags.includes("g") ? parsed.expression.flags : `${parsed.expression.flags}g`); return Array.from(sample.matchAll(expression)).slice(0, 50).map((match) => ({ value: match[0], index: match.index ?? 0, captures: Array.from(match).slice(1) })); }, [parsed.expression, sample]);
  const risky = pattern.length > 120 || /\([^)]*[+*][^)]*\)[+*]/.test(pattern) || /\.\*/.test(pattern);
  const featureRows = ["literals and Unicode", "character classes and anchors", "named and numbered captures", "lookaround and backreferences", "replacement templates", "performance timing and bounded trace"];
  return <aside className="regex-panel" aria-label="Full regex builder"><div className="panel-title"><div><strong>Regex workbench</strong><span className="panel-kicker">JavaScript RegExp · local and bounded</span></div><button type="button" className="icon-button" aria-label="Close regex builder" onClick={onClose}>×</button></div><div className="builder-grid"><label>Pattern<input value={pattern} maxLength={512} onChange={(event) => setPattern(event.target.value)} aria-invalid={Boolean(parsed.error)} /></label><label>Flags<input value={flags} maxLength={8} onChange={(event) => setFlags(event.target.value.replace(/[^dgimsuvy]/g, ""))} /></label><label className="wide">Sample text<textarea value={sample} maxLength={4096} onChange={(event) => setSample(event.target.value)} /></label><label className="wide">Replacement template<input value={replacement} maxLength={512} onChange={(event) => setReplacement(event.target.value)} /></label></div>{parsed.error ? <p className="inline-error" role="alert">{parsed.error}</p> : <div className="builder-results"><div className="builder-summary"><StatusPill label={`${matches.length} match${matches.length === 1 ? "" : "es"}`} tone={risky ? "waiting" : "ready"} /><span>{matches.length ? `${matches[0].value} at ${matches[0].index}` : "No match in sample"}</span></div>{matches.length > 0 && <div className="match-table" role="table" aria-label="Regex matches"><div className="match-row match-head"><span>Match</span><span>Index</span><span>Captures</span></div>{matches.slice(0, 8).map((match) => <div className="match-row" key={`${match.index}-${match.value}`}><code>{match.value || "∅"}</code><span>{match.index}</span><span>{match.captures.length ? match.captures.join(" · ") : "none"}</span></div>)}</div>}<p className="builder-explanation"><strong>Explanation:</strong> {pattern ? `The engine reads ${pattern} with ${flags || "no"} flags.` : "Type a pattern to inspect its structure."}</p></div>}<div className="builder-risk"><span className={`status-dot ${risky ? "waiting" : "ready"}`} aria-hidden="true" /><span>{risky ? "Backtracking risk detected. Evaluation is capped at 50 matches and bounded input." : "No obvious backtracking risk in this bounded sample."}</span></div><details className="feature-matrix"><summary>Capability matrix</summary><ul>{featureRows.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul></details><div className="builder-actions"><Button variant="quiet" onClick={() => setSaved((items) => items.includes(pattern) ? items : [...items, pattern].slice(-8))}>Save snippet</Button><Button variant="quiet" disabled={!saved.length} onClick={() => setPattern(saved.at(-1) ?? "")}>Restore last</Button>{onApply && <Button variant="primary" onClick={() => { onApply(pattern, flags); onClose(); }}>Apply pattern</Button>}</div>{saved.length > 0 && <p className="saved-snippets">Saved snippets: {saved.length}</p>}</aside>;
}

export function TabRail({ active, mode, onNavigate, collapsed, onToggle }: { active: ScreenId; mode: LanguageMode; onNavigate: (screen: ScreenId) => void; collapsed: boolean; onToggle: () => void }): JSX.Element {
  const railRef = useRef<HTMLDivElement>(null);
  const tabs: { id: ScreenId; icon: string; label: Copy }[] = [
    { id: "overview", icon: "⌂", label: { en: "Overview", zh: "總覽" } }, { id: "projects", icon: "▦", label: { en: "Projects", zh: "專案" } }, { id: "operations", icon: "◴", label: { en: "Operations", zh: "操作" } }, { id: "queue", icon: "≋", label: { en: "Queue", zh: "佇列" } }, { id: "files", icon: "▱", label: { en: "Files and Converter", zh: "檔案與轉換器" } }, { id: "models", icon: "◈", label: { en: "Local Models", zh: "本機模型" } }, { id: "authenticator", icon: "◎", label: { en: "Authenticator", zh: "驗證器" } }, { id: "history", icon: "↺", label: { en: "History", zh: "歷史記錄" } }, { id: "documentation", icon: "▤", label: { en: "Documentation", zh: "文件" } }, { id: "changelog", icon: "✦", label: { en: "Changelog", zh: "更新日誌" } }, { id: "notifications", icon: "♢", label: { en: "Notifications", zh: "通知" } }, { id: "status", icon: "◉", label: { en: "Status", zh: "狀態" } }, { id: "settings", icon: "⚙", label: { en: "Settings", zh: "設定" } },
  ];
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => { if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return; event.preventDefault(); const current = tabs.findIndex((tab) => tab.id === active); const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + tabs.length) % tabs.length; onNavigate(tabs[next].id); requestAnimationFrame(() => railRef.current?.querySelector<HTMLButtonElement>(`[data-tab-id="${tabs[next].id}"]`)?.focus()); };
  return <nav ref={railRef} className={`tab-rail ${collapsed ? "collapsed" : ""}`} aria-label="Primary navigation"><div className="rail-top"><div className="rail-mark" aria-hidden="true">WL</div><button type="button" className="rail-toggle" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} onClick={onToggle}>{collapsed ? "›" : "‹"}</button></div><div className="rail-search"><span aria-hidden="true">⌕</span>{!collapsed && <input aria-label="Search tabs" placeholder="Find a tab" />}</div><div role="tablist" aria-orientation="vertical" onKeyDown={onKeyDown}>{tabs.map((tab) => <button key={tab.id} data-tab-id={tab.id} type="button" role="tab" tabIndex={active === tab.id ? 0 : -1} aria-selected={active === tab.id} aria-controls={`tabpanel-${tab.id}`} title={text(tab.label, mode)} className={`rail-tab ${active === tab.id ? "active" : ""}`} onClick={() => onNavigate(tab.id)}><span className="rail-icon" aria-hidden="true">{tab.icon}</span>{!collapsed && <span>{text(tab.label, mode)}</span>}</button>)}</div></nav>;
}

export function SurfaceCard({ children, className = "" }: { children: ReactNode; className?: string }): JSX.Element { return <section className={`surface-card ${className}`}>{children}</section>; }
export function FormField({ label, children, hint, focusId }: { label: string; children: ReactNode; hint?: string; focusId?: string }): JSX.Element { return <label className="form-field" data-focus-id={focusId}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
export function Dialog({ title, eyebrow, children, onClose, className = "" }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; className?: string }): JSX.Element { return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`anchored-dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="panel-title"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id="dialog-title">{title}</h2></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose}>×</button></div>{children}</section></div>; }

export function useReturnFocus(open: boolean, selector: string): void { useEffect(() => { if (!open) return; return () => { requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus()); }; }, [open, selector]); }
