export type LanguageMode = "en" | "zh-Hant" | "bilingual";
export type ThemeMode = "light" | "dark";

export type ScreenId = "overview" | "activity" | "files" | "builds";

export interface AppProvenance {
  readonly appId: string;
  readonly displayName: string;
  readonly version: string;
  readonly updatedAt: string;
  readonly source: string;
}

export interface CatalogCopy {
  readonly en: string;
  readonly zhHant: string;
}

export interface LocalizedCatalog {
  readonly app: CatalogCopy;
  readonly navigation: Record<ScreenId, CatalogCopy>;
  readonly dashboard: {
    readonly eyebrow: CatalogCopy;
    readonly title: CatalogCopy;
    readonly description: CatalogCopy;
    readonly activeWork: CatalogCopy;
    readonly activeWorkDescription: CatalogCopy;
    readonly recentActivity: CatalogCopy;
    readonly recentActivityDescription: CatalogCopy;
    readonly healthy: CatalogCopy;
    readonly ready: CatalogCopy;
    readonly waiting: CatalogCopy;
    readonly noActivity: CatalogCopy;
    readonly open: CatalogCopy;
    readonly viewDetails: CatalogCopy;
  };
}
