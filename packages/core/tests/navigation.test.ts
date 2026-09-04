import { describe, expect, it } from "vitest";
import { parseRoute, routeFor, SCREEN_IDS } from "../src/navigation";

describe("deterministic screen routing", () => {
  it("accepts every registered screen and ignores query strings", () => {
    for (const screen of SCREEN_IDS) expect(parseRoute(routeFor(screen) + "?state=ready")).toBe(screen);
  });

  it("falls back to overview for unknown or empty routes", () => {
    expect(parseRoute("")).toBe("overview");
    expect(parseRoute("#/not-a-screen")).toBe("overview");
  });
});
