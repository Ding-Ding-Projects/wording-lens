import { describe, expect, it } from "vitest";
import { CATALOG, copy } from "../src/catalogs";

describe("neutral localization catalogs", () => {
  it("has English, Traditional Chinese, and bilingual output", () => {
    expect(copy(CATALOG.dashboard.title, "en")).toBe("Keep the work moving");
    expect(copy(CATALOG.dashboard.title, "zh-Hant")).toBe("讓工作穩步前進");
    expect(copy(CATALOG.dashboard.title, "bilingual")).toBe("Keep the work moving · 讓工作穩步前進");
  });

  it("covers every navigation destination", () => {
    expect(Object.keys(CATALOG.navigation).sort()).toEqual(["activity", "builds", "files", "overview"]);
  });
});
