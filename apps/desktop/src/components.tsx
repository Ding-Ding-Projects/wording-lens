import type { ReactNode } from "react";

export type ScreenId = "overview" | "projects" | "operations" | "queue" | "files" | "models" | "authenticator" | "history" | "documentation" | "changelog" | "notifications" | "status" | "settings";
export type LanguageMode = "en" | "zh-Hant" | "bilingual";
export type Copy = { en: string; zh: string };

export function text(value: Copy, mode: LanguageMode): string {
  if (mode === "zh-Hant") return value.zh;
  if (mode === "bilingual") return `${value.en} · ${value.zh}`;
  return value.en;
}

export function WindowControls(): JSX.Element {
  return <div className="window-controls" aria-label="Window controls"><button type="button" className="window-control" aria-label="Minimize" onClick={() => window.desktopBridge?.minimize()}>−</button><button type="button" className="window-control" aria-label="Maximize" onClick={() => window.desktopBridge?.toggleMaximize()}>□</button><button type="button" className="window-control close" aria-label="Close" onClick={() => window.desktopBridge?.close()}>×</button></div>;
}

export function SearchField({ label, query, onQuery, onOpenRegex }: { label: string; query: string; onQuery: (value: string) => void; onOpenRegex: () => void }): JSX.Element {
  const id = `search-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  return <div className="search-wrap"><label className="search-label" htmlFor={id}>{label}</label><div className="search-field"><span className="search-icon" aria-hidden="true">⌕</span><input id={id} value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search this surface" /><button type="button" className="regex-button" aria-label="Open full regex builder" onClick={onOpenRegex}>.*</button></div></div>;
}

export function RegexBuilder({ onClose }: { onClose: () => void }): JSX.Element {
  return <aside className="regex-panel" aria-label="Full regex builder"><div className="panel-title"><div><strong>Regex builder</strong><span className="panel-kicker">JavaScript RegExp · local only</span></div><button type="button" className="icon-button" aria-label="Close regex builder" onClick={onClose}>×</button></div><div className="builder-grid"><label>Pattern<input placeholder="Enter a pattern" /></label><label>Flags<input defaultValue="giu" /></label><label className="wide">Sample text<textarea placeholder="Try a sample against the pattern" /></label></div><div className="builder-note"><span className="status-dot ready" aria-hidden="true" /> Plain text is the default. Regex is opt-in, bounded, and evaluated locally.</div></aside>;
}

export function StatCard({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "ready" | "waiting" | "danger" }): JSX.Element {
  return <article className={`stat-card tone-${tone}`}><span className="stat-label">{label}</span><strong>{value}</strong><span className="stat-detail">{detail}</span></article>;
}
export function EmptyState({ icon, title, description, action }: { icon: string; title: string; description: string; action?: ReactNode }): JSX.Element { return <div className="empty-state"><span className="empty-icon" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{description}</p>{action}</div>; }
export function StatusPill({ label, tone = "ready" }: { label: string; tone?: "ready" | "waiting" | "danger" | "neutral" }): JSX.Element { return <span className={`status-pill ${tone}`}><span className="status-dot" aria-hidden="true" />{label}</span>; }
export function Button({ children, onClick, variant = "secondary", disabled = false }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "quiet" | "danger"; disabled?: boolean }): JSX.Element { return <button type="button" className={`${variant}-button`} onClick={onClick} disabled={disabled}>{children}</button>; }

export function TabRail({ active, mode, onNavigate, collapsed, onToggle }: { active: ScreenId; mode: LanguageMode; onNavigate: (screen: ScreenId) => void; collapsed: boolean; onToggle: () => void }): JSX.Element {
  const tabs: { id: ScreenId; icon: string; label: Copy }[] = [
    { id: "overview", icon: "⌂", label: { en: "Overview", zh: "總覽" } }, { id: "projects", icon: "▦", label: { en: "Projects", zh: "專案" } }, { id: "operations", icon: "◴", label: { en: "Operations", zh: "操作" } }, { id: "queue", icon: "≋", label: { en: "Queue", zh: "佇列" } }, { id: "files", icon: "▱", label: { en: "Files and Converter", zh: "檔案與轉換器" } }, { id: "models", icon: "◈", label: { en: "Local Models", zh: "本機模型" } }, { id: "authenticator", icon: "◎", label: { en: "Authenticator", zh: "驗證器" } }, { id: "history", icon: "↺", label: { en: "History", zh: "歷史記錄" } }, { id: "documentation", icon: "▤", label: { en: "Documentation", zh: "文件" } }, { id: "changelog", icon: "✦", label: { en: "Changelog", zh: "更新日誌" } }, { id: "notifications", icon: "♢", label: { en: "Notifications", zh: "通知" } }, { id: "status", icon: "◉", label: { en: "Status", zh: "狀態" } },
  ];
  return <nav className={`tab-rail ${collapsed ? "collapsed" : ""}`} aria-label="Primary navigation"><div className="rail-top"><div className="rail-mark" aria-hidden="true">WL</div><button type="button" className="rail-toggle" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} onClick={onToggle}>{collapsed ? "›" : "‹"}</button></div><div className="rail-search"><span aria-hidden="true">⌕</span>{!collapsed && <input aria-label="Search tabs" placeholder="Find a tab" />}</div><div role="tablist" aria-orientation="vertical">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id} title={text(tab.label, mode)} className={`rail-tab ${active === tab.id ? "active" : ""}`} onClick={() => onNavigate(tab.id)}><span className="rail-icon" aria-hidden="true">{tab.icon}</span>{!collapsed && <span>{text(tab.label, mode)}</span>}</button>)}</div><div className="rail-footer"><button type="button" role="tab" aria-selected={active === "settings"} title="Settings" className={`rail-tab ${active === "settings" ? "active" : ""}`} onClick={() => onNavigate("settings")}><span className="rail-icon" aria-hidden="true">⚙</span>{!collapsed && <span>{mode === "zh-Hant" ? "設定" : mode === "bilingual" ? "Settings · 設定" : "Settings"}</span>}</button></div></nav>;
}
