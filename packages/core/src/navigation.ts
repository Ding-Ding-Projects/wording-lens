import type { ScreenId } from "./types";

export const SCREEN_IDS: readonly ScreenId[] = ["overview", "activity", "files", "builds"];

export function parseRoute(hash: string): ScreenId {
  const value = hash.replace(/^#\/?/, "").split("?")[0] as ScreenId;
  return SCREEN_IDS.includes(value) ? value : "overview";
}

export function routeFor(screen: ScreenId): string {
  return `#/${screen}`;
}
