import { describe, expect, it } from "vitest";
import { BUILD_PROVENANCE, formatProvenanceDate, isValidProvenance } from "../src/provenance";

describe("build provenance", () => {
  it("ships a valid version and recorded updated-at value", () => {
    expect(isValidProvenance(BUILD_PROVENANCE)).toBe(true);
    expect(BUILD_PROVENANCE.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(formatProvenanceDate(BUILD_PROVENANCE.updatedAt)).toContain("2026");
  });

  it("rejects missing or invalid provenance", () => {
    expect(isValidProvenance(null)).toBe(false);
    expect(isValidProvenance({ ...BUILD_PROVENANCE, updatedAt: "not-a-date" })).toBe(false);
    expect(isValidProvenance({ ...BUILD_PROVENANCE, version: "" })).toBe(false);
  });
});
