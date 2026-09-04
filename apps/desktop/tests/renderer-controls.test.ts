// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { RegexBuilder, TabRail, type ScreenId } from "../src/components";
import { Files, Models, Notifications, Projects, Settings } from "../src/main";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function mount(element: React.ReactElement) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(element));
  return { host, root };
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function setBridge(value: unknown): void {
  window.desktopBridge = value as Window["desktopBridge"];
}

describe("renderer controls", () => {
  it("renders a bounded regex workbench and reports matches", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        React.createElement(RegexBuilder, {
          onClose: () => undefined,
          query: "Lens",
        }),
      ),
    );
    expect(host.textContent).toContain("Regex workbench");
    expect(host.textContent).toContain("match");
    expect(host.querySelector("input[aria-invalid='false']")).not.toBeNull();
    act(() => root.unmount());
  });

  it("keeps tabs addressable and moves roving focus with vertical keys", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    let active: ScreenId = "overview";
    act(() =>
      root.render(
        React.createElement(TabRail, {
          active,
          mode: "en",
          onNavigate: (next) => {
            active = next;
          },
          collapsed: false,
          onToggle: () => undefined,
        }),
      ),
    );
    const tablist = host.querySelector<HTMLElement>("[role='tablist']");
    const tabs = host.querySelectorAll<HTMLButtonElement>("[role='tab']");
    expect(tablist?.getAttribute("aria-orientation")).toBe("vertical");
    expect(tabs.length).toBe(13);
    expect(tabs[0].getAttribute("aria-controls")).toBe("tabpanel-overview");
    expect(tabs[0].tabIndex).toBe(0);
    act(() =>
      tablist?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      ),
    );
    expect(active).toBe("projects");
    act(() => root.unmount());
  });

  it("inspects a chosen project through the typed bridge and does not invent an open action", async () => {
    const inspectProject = async (path: string) => ({
      path,
      exists: true,
      kind: "directory" as const,
      hasGitMetadata: true,
      inspectedAt: "2026-09-04T00:00:00Z",
    });
    setBridge({ inspectProject });
    const { host, root } = mount(
      React.createElement(Projects, { notify: () => undefined }),
    );
    const field = host.querySelector<HTMLInputElement>(
      "input[aria-label='Project folder']",
    )!;
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(field, "C:/work/demo");
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });
    act(() => host.querySelectorAll<HTMLButtonElement>("button")[1].click());
    await settle();
    expect(host.textContent).toContain("C:/work/demo");
    expect(host.textContent).toContain("does not claim to open one");
    act(() => root.unmount());
  });

  it("renders returned converter availability and inspects selected bytes", async () => {
    const detectFile = async (bytes: Uint8Array) => ({
      format: "pdf",
      byteLength: bytes.byteLength,
    });
    setBridge({
      converterCatalog: async () => ({
        categories: ["documents-pdf"],
        missingCategories: ["audio"],
        adapters: [
          {
            id: "pdf-copy",
            label: "PDF copy",
            category: "documents-pdf",
            availability: "enabled",
            sourceFormats: ["pdf"],
            targetFormats: ["pdf"],
          },
          {
            id: "audio",
            label: "Audio",
            category: "audio",
            availability: "disabled",
            unavailableReason: "No bundled proof",
            sourceFormats: ["wav"],
            targetFormats: ["mp3"],
          },
        ],
      }),
      detectFile,
    });
    const { host, root } = mount(
      React.createElement(Files, { notify: () => undefined }),
    );
    await settle();
    expect(host.textContent).toContain("PDF copy");
    expect(host.textContent).toContain("No bundled proof");
    const input = host.querySelector<HTMLInputElement>("input[type='file']")!;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["%PDF"], "report.pdf", { type: "application/pdf" })],
    });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));
    const inspectButton = [
      ...host.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.includes("Inspect selected file"))!;
    act(() => inspectButton.click());
    await settle();
    expect(host.textContent).toContain('"format": "pdf"');
    act(() => root.unmount());
  });

  it("keeps missing bridge states honest", () => {
    setBridge(undefined);
    const { host, root } = mount(
      React.createElement(Files, { notify: () => undefined }),
    );
    expect(host.textContent).toContain(
      "Converter catalog is unavailable because the bridge is not connected.",
    );
    act(() => root.unmount());
  });

  it("uses actual empty model results instead of declaring a simulated healthy service", async () => {
    setBridge({
      ollamaHealth: async () => ({ state: "healthy" }),
      ollamaVersion: async () => "0.12.0",
      ollamaModels: async () => ({ installed: [], running: [] }),
    });
    const { host, root } = mount(
      React.createElement(Models, { notify: () => undefined }),
    );
    const refresh = [
      ...host.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.includes("Refresh health"))!;
    act(() => refresh.click());
    await settle();
    expect(host.textContent).toContain("Healthy");
    expect(host.textContent).toContain("Installed model list unavailable");
    expect(
      host.querySelector<HTMLButtonElement>("button")?.disabled ?? false,
    ).toBe(false);
    act(() => root.unmount());
  });

  it("bulk dismisses only notification ids returned by the bridge", async () => {
    let dismissedIds: readonly string[] = [];
    const dismissNotifications = async (ids: readonly string[]) => {
      dismissedIds = ids;
      return ids.length;
    };
    setBridge({
      listNotifications: async () => [
        {
          id: "notice-1",
          level: "info" as const,
          title: "Saved",
          body: "Local only",
          createdAt: "2026-09-04T00:00:00Z",
        },
      ],
      dismissNotifications,
    });
    const { host, root } = mount(
      React.createElement(Notifications, { notify: () => undefined }),
    );
    await settle();
    const select = host.querySelector<HTMLInputElement>(
      "input[aria-label='Select notification Saved']",
    )!;
    act(() => select.click());
    const dismiss = [
      ...host.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.includes("Dismiss selected"))!;
    act(() => dismiss.click());
    await settle();
    expect(dismissedIds).toEqual(["notice-1"]);
    expect(host.textContent).toContain("0 selected");
    act(() => root.unmount());
  });

  it("uses generic private-vocabulary errors and exposes no source metadata", async () => {
    setBridge({
      vocabularyStatus: async () => ({
        authenticated: true,
        loaded: true,
        entryCount: 1,
      }),
      vocabularyEntries: async () => [{ key: "ordinary", value: "private" }],
      renderPrivateText: async (text: string) =>
        text.replace("ordinary", "private"),
      clearVocabulary: async () => ({
        authenticated: false,
        loaded: false,
        entryCount: 0,
      }),
    });
    const settings = {
      displayName: "Wording Lens",
      languageMode: "english" as const,
      theme: "dark" as const,
      density: "comfortable" as const,
      accent: "#00d4ff",
      funnyEnglish: 5 as const,
      funnyCantonese: 5 as const,
      emojiDialogs: true,
      narrationEnabled: false,
      narrationLanguage: "english" as const,
      reducedMotion: false,
    };
    const { host, root } = mount(
      React.createElement(Settings, {
        settings,
        mode: "en",
        schoolMode: false,
        setSchoolMode: () => undefined,
        updateSettings: async () => undefined,
        notify: () => undefined,
      }),
    );
    await settle();
    act(() =>
      [...host.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent === "Privacy")!
        .click(),
    );
    await settle();
    act(() =>
      [...host.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) =>
          button.textContent?.includes("List authenticated entries"),
        )!
        .click(),
    );
    await settle();
    expect(host.textContent).toContain("ordinary");
    expect(host.textContent).toContain(
      "does not expose vocabulary source metadata",
    );
    act(() => root.unmount());
  });
});
