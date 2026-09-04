import type { ReactNode } from "react";
import type { CatalogCopy, LanguageMode, ScreenId } from "@core/types";
import { copy } from "@core/catalogs";

export function WindowControls(): JSX.Element {
  return (
    <div className="window-controls" aria-label="Window controls">
      <button type="button" className="window-control" aria-label="Minimize" onClick={() => window.desktopBridge?.minimize()}>−</button>
      <button type="button" className="window-control" aria-label="Maximize" onClick={() => window.desktopBridge?.toggleMaximize()}>□</button>
      <button type="button" className="window-control close" aria-label="Close" onClick={() => window.desktopBridge?.close()}>×</button>
    </div>
  );
}

export function BilingualText({ value, mode, className = "" }: { value: CatalogCopy; mode: LanguageMode; className?: string }): JSX.Element {
  return <span className={className}>{copy(value, mode)}</span>;
}

export function StatusDot({ state, label }: { state: "healthy" | "ready" | "waiting"; label: string }): JSX.Element {
  return <span className={`status status-${state}`}><span className="status-dot" aria-hidden="true" />{label}</span>;
}

export function DashboardCard({ icon, title, description, status, action, onAction }: { icon: string; title: string; description: string; status?: JSX.Element; action?: string; onAction?: () => void }): JSX.Element {
  return (
    <article className="dashboard-card">
      <div className="card-topline"><span className="card-icon" aria-hidden="true">{icon}</span>{status}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <button type="button" className="text-button" onClick={onAction}>{action}<span aria-hidden="true"> ↗</span></button>}
    </article>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: string; title: string; description: string; action?: ReactNode }): JSX.Element {
  return <div className="empty-state"><span className="empty-icon" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function TabRail({ active, mode, onNavigate }: { active: ScreenId; mode: LanguageMode; onNavigate: (screen: ScreenId) => void }): JSX.Element {
  const tabs: { id: ScreenId; icon: string; label: CatalogCopy }[] = [
    { id: "overview", icon: "⌂", label: { en: "Overview", zhHant: "總覽" } },
    { id: "activity", icon: "◴", label: { en: "Activity", zhHant: "活動" } },
    { id: "files", icon: "▱", label: { en: "Files", zhHant: "檔案" } },
    { id: "builds", icon: "◈", label: { en: "Builds", zhHant: "建置" } },
  ];
  return <nav className="tab-rail" aria-label="Primary navigation"><div className="rail-mark" aria-hidden="true">WL</div><div role="tablist" aria-orientation="vertical">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id} className={`rail-tab ${active === tab.id ? "active" : ""}`} onClick={() => onNavigate(tab.id)}><span className="rail-icon" aria-hidden="true">{tab.icon}</span><BilingualText value={tab.label} mode={mode} /></button>)}</div><div className="rail-footer"><button type="button" className="rail-tab" aria-label="Settings"><span className="rail-icon" aria-hidden="true">⚙</span><span>Settings</span></button></div></nav>;
}
