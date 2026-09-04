import type { AppProvenance } from "./types";

export const APP_ID = "wording-lens";
export const SHIPPED_DISPLAY_NAME = "Wording Lens";
export const BUILD_PROVENANCE: AppProvenance = Object.freeze({
  appId: APP_ID,
  displayName: SHIPPED_DISPLAY_NAME,
  version: "0.1.0",
  updatedAt: "2026-09-04T00:00:00.000Z",
  source: "foundation-shell",
});

export function isValidProvenance(value: unknown): value is AppProvenance {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppProvenance>;
  return [candidate.appId, candidate.displayName, candidate.version, candidate.updatedAt, candidate.source]
    .every((field) => typeof field === "string" && field.length > 0)
    && !Number.isNaN(Date.parse(candidate.updatedAt ?? ""));
}

export function formatProvenanceDate(iso: string, locale = "en-CA"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
