import type { LanguageMode, LocalizedCatalog } from "./types";

export const CATALOG: LocalizedCatalog = {
  app: { en: "Wording Lens", zhHant: "文字透鏡" },
  navigation: {
    overview: { en: "Overview", zhHant: "總覽" },
    activity: { en: "Activity", zhHant: "活動" },
    files: { en: "Files", zhHant: "檔案" },
    builds: { en: "Builds", zhHant: "建置" },
  },
  dashboard: {
    eyebrow: { en: "Operations cockpit", zhHant: "操作駕駛艙" },
    title: { en: "Keep the work moving", zhHant: "讓工作穩步前進" },
    description: { en: "A calm local view of projects, files, builds, and release readiness.", zhHant: "以平靜的本機視角，查看專案、檔案、建置與發佈準備狀態。" },
    activeWork: { en: "Active work", zhHant: "進行中的工作" },
    activeWorkDescription: { en: "No operation is running right now.", zhHant: "目前沒有執行中的操作。" },
    recentActivity: { en: "Recent activity", zhHant: "最近活動" },
    recentActivityDescription: { en: "Your local activity will appear here.", zhHant: "本機活動會顯示在這裡。" },
    healthy: { en: "Healthy", zhHant: "狀態良好" },
    ready: { en: "Ready", zhHant: "準備就緒" },
    waiting: { en: "Waiting", zhHant: "等待中" },
    noActivity: { en: "No activity yet", zhHant: "尚未有活動" },
    open: { en: "Open", zhHant: "開啟" },
    viewDetails: { en: "View details", zhHant: "查看詳情" },
  },
};

export function copy(catalogCopy: { en: string; zhHant: string }, mode: LanguageMode): string {
  if (mode === "zh-Hant") return catalogCopy.zhHant;
  if (mode === "bilingual") return `${catalogCopy.en} · ${catalogCopy.zhHant}`;
  return catalogCopy.en;
}
