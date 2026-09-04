// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { RegexBuilder, TabRail } from "../src/components";

describe("renderer controls", () => {
  it("renders a bounded regex workbench and reports matches", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(React.createElement(RegexBuilder, { onClose: () => undefined, query: "Lens" })));
    expect(host.textContent).toContain("Regex workbench");
    expect(host.textContent).toContain("match");
    expect(host.querySelector("input[aria-invalid='false']")).not.toBeNull();
    act(() => root.unmount());
  });

  it("keeps tabs addressable and moves roving focus with vertical keys", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    let active = "overview" as const;
    act(() => root.render(React.createElement(TabRail, { active, mode: "en", onNavigate: (next) => { active = next; }, collapsed: false, onToggle: () => undefined })));
    const tablist = host.querySelector<HTMLElement>("[role='tablist']");
    const tabs = host.querySelectorAll<HTMLButtonElement>("[role='tab']");
    expect(tablist?.getAttribute("aria-orientation")).toBe("vertical");
    expect(tabs.length).toBe(13);
    expect(tabs[0].getAttribute("aria-controls")).toBe("tabpanel-overview");
    expect(tabs[0].tabIndex).toBe(0);
    act(() => tablist?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(active).toBe("projects");
    act(() => root.unmount());
  });
});
