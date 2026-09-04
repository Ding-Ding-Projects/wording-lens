import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CATALOG, copy } from "@core/catalogs";
import { BUILD_PROVENANCE, formatProvenanceDate, isValidProvenance } from "@core/provenance";
import { parseRoute, routeFor } from "@core/navigation";
import type { AppProvenance, LanguageMode, ScreenId, ThemeMode } from "@core/types";
import { DashboardCard, BilingualText, EmptyState, StatusDot, TabRail, WindowControls } from "./components";
import "./styles.css";

const LANGUAGE_KEY = "wording-lens.language";
const THEME_KEY = "wording-lens.theme";

function readLanguage(): LanguageMode {
  const value = localStorage.getItem(LANGUAGE_KEY);
  return value === "zh-Hant" || value === "bilingual" ? value : "en";
}

function readTheme(): ThemeMode {
  return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
}

function useRoute(): [ScreenId, (next: ScreenId) => void] {
  const [route, setRoute] = useState<ScreenId>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return [route, (next) => { window.location.hash = routeFor(next); setRoute(next); }];
}

function ProvenanceHeader({ provenance, mode }: { provenance: AppProvenance; mode: LanguageMode }): JSX.Element {
  const timestamp = isValidProvenance(provenance) ? formatProvenanceDate(provenance.updatedAt, mode === "zh-Hant" ? "zh-HK" : "en-CA") : "Unavailable";
  return <div className="provenance" aria-label={`Version ${provenance.version}, updated ${timestamp}`}><span className="provenance-item"><span className="provenance-label">Version</span><strong>{provenance.version || "Unavailable"}</strong></span><span className="provenance-divider" aria-hidden="true" /><span className="provenance-item"><span className="provenance-label">Updated</span><strong>{timestamp}</strong></span><span className="provenance-source">Local build</span></div>;
}

function Overview({ mode, onNavigate }: { mode: LanguageMode; onNavigate: (screen: ScreenId) => void }): JSX.Element {
  const t = CATALOG.dashboard;
  return <>
    <section className="hero"><p className="eyebrow"><BilingualText value={t.eyebrow} mode={mode} /></p><h1><BilingualText value={t.title} mode={mode} /></h1><p className="hero-copy"><BilingualText value={t.description} mode={mode} /></p><button type="button" className="primary-button" onClick={() => onNavigate("activity")}><span aria-hidden="true">＋</span> New operation</button></section>
    <section className="section-block" aria-labelledby="work-heading"><div className="section-heading"><div><h2 id="work-heading"><BilingualText value={t.activeWork} mode={mode} /></h2><p><BilingualText value={t.activeWorkDescription} mode={mode} /></p></div><span className="section-count">0</span></div><EmptyState icon="◌" title={copy({ en: "Nothing is running", zhHant: "目前沒有執行中的操作" }, mode)} description={copy({ en: "Start an operation when you are ready. Progress will stay visible here.", zhHant: "準備好後開始操作，進度會一直顯示在這裡。" }, mode)} action={<button type="button" className="outlined-button" onClick={() => onNavigate("activity")}>Browse activity</button>} /></section>
    <section className="section-block" aria-labelledby="recent-heading"><div className="section-heading"><div><h2 id="recent-heading"><BilingualText value={t.recentActivity} mode={mode} /></h2><p><BilingualText value={t.recentActivityDescription} mode={mode} /></p></div><button type="button" className="quiet-button" onClick={() => onNavigate("activity")}>View all</button></div><div className="card-grid"><DashboardCard icon="◌" title={copy({ en: "Local projects", zhHant: "本機專案" }, mode)} description={copy({ en: "Projects you open locally will be listed here.", zhHant: "你在本機開啟的專案會列在這裡。" }, mode)} status={<StatusDot state="ready" label={copy(t.ready, mode)} />} action={copy(t.open, mode)} onAction={() => onNavigate("files")} /><DashboardCard icon="▤" title={copy({ en: "Build readiness", zhHant: "建置準備狀態" }, mode)} description={copy({ en: "Build signals and package readiness will appear here.", zhHant: "建置訊號與套件準備狀態會顯示在這裡。" }, mode)} status={<StatusDot state="waiting" label={copy(t.waiting, mode)} />} action={copy(t.viewDetails, mode)} onAction={() => onNavigate("builds")} /></div></section>
  </>;
}

function Placeholder({ screen, mode }: { screen: ScreenId; mode: LanguageMode }): JSX.Element {
  const title = CATALOG.navigation[screen];
  return <section className="placeholder-page"><p className="eyebrow">{copy({ en: "Local workspace", zhHant: "本機工作區" }, mode)}</p><h1>{copy(title, mode)}</h1><EmptyState icon={screen === "files" ? "▱" : screen === "builds" ? "◈" : "◴"} title={copy(CATALOG.dashboard.noActivity, mode)} description={copy({ en: "This surface is ready for the next local operation.", zhHant: "這個介面已準備好處理下一個本機操作。" }, mode)} /></section>;
}

function App(): JSX.Element {
  const [screen, onNavigate] = useRoute();
  const [mode, setMode] = useState<LanguageMode>(readLanguage);
  const [theme, setTheme] = useState<ThemeMode>(readTheme);
  const [provenance, setProvenance] = useState<AppProvenance>(BUILD_PROVENANCE);
  useEffect(() => { window.desktopBridge?.getProvenance().then((value) => { if (isValidProvenance(value)) setProvenance(value); }).catch(() => undefined); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem(THEME_KEY, theme); }, [theme]);
  const appTitle = useMemo(() => copy(CATALOG.app, mode), [mode]);
  return <div className="app-shell"><header className="title-bar"><div className="title-bar-drag"><span className="brand-glyph" aria-hidden="true">WL</span><span className="brand-name">{appTitle}</span></div><ProvenanceHeader provenance={provenance} mode={mode} /><div className="title-bar-actions"><label className="language-control"><span className="sr-only">Language</span><select value={mode} onChange={(event) => { const next = event.target.value as LanguageMode; setMode(next); localStorage.setItem(LANGUAGE_KEY, next); }}><option value="en">English</option><option value="zh-Hant">繁體中文</option><option value="bilingual">Bilingual · 雙語</option></select></label><button type="button" className="theme-button" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "☼" : "☾"}</button></div><WindowControls /></header><div className="workspace"><TabRail active={screen} mode={mode} onNavigate={onNavigate} /><main className="main-content" role="main" aria-live="polite">{screen === "overview" ? <Overview mode={mode} onNavigate={onNavigate} /> : <Placeholder screen={screen} mode={mode} />}</main></div><footer className="status-footer"><span><span className="footer-dot" aria-hidden="true" /> Local only</span><span>Secure bridge active</span><span>Ready</span></footer></div>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
