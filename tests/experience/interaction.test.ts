import {
  AppearanceEditorModel,
  BulkSelection,
  CommandPaletteModel,
  DestructiveConfirmation,
  HistoryStore,
  InfiniteColorPickerModel,
  LOCK_POLICIES,
  LockManager,
  NotificationCenter,
  RAINBOW_SENTINEL,
  RegexWorkbench,
  TabStripEngine,
  translateColor,
  tabAccessibility,
} from "../../packages/experience/interaction";

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function runInteractionTests(): void {
  const plain = new RegexWorkbench("plain").setQuery("alpha");
  expect(plain.state.mode === "text", "plain search is the default");
  expect(plain.evaluate("alpha beta alpha").matches.length === 2, "plain search finds both matches");

  const regex = new RegexWorkbench("regex").setMode("regex").setPattern("(?<word>\\w+)").setFlags("g");
  expect(regex.analysis().valid, "named-group regex compiles");
  expect(regex.analysis().namedCaptures.includes("word"), "named group is explained");
  expect(regex.evaluate("one two").matches[1].namedGroups.word === "two", "capture table preserves named groups");
  const invalid = new RegexWorkbench("invalid").setMode("regex").setPattern("[");
  expect(!invalid.analysis().valid, "invalid regex is reported");

  const tabs = new TabStripEngine();
  tabs.createGroup("Writing", "writing");
  tabs.addTab({ id: "one", label: "Alpha", destination: "home", groupId: "writing" });
  tabs.addTab({ id: "two", label: "Beta", destination: "settings", pinned: true });
  tabs.addTab({ id: "three", label: "Gamma", destination: "docs", locked: true, dirty: true });
  tabs.setDockEdge("right").setSearch("strip", { query: "alpha" });
  expect(tabs.searchStrip().map((tab) => tab.tabId).join() === "one", "strip search is isolated and addressable");
  tabs.setSearch("groups", { query: "writing" });
  expect(tabs.searchGroups()[0].groupId === "writing", "group-name search searches groups only");
  tabs.setSearch("group", { query: "beta" });
  expect(tabs.searchGroup("writing").length === 0, "group search is isolated to its group");
  const preview = tabs.previewBulkClose("contains", "a");
  expect(preview.valid, "bulk close preview validates non-empty input");
  expect(preview.excludedPinnedIds.includes("two"), "bulk close protects pinned tabs by default");
  expect(preview.excludedLockedIds.includes("three"), "bulk close protects locked tabs by default");
  expect(preview.dirtyTabIds.includes("three"), "bulk close reports unsaved tabs separately");
  expect(tabs.previewBulkClose("contains", "").invalidReason === "empty-query", "bulk close rejects empty input");
  expect(tabs.previewBulkClose("contains", "[", { matchMode: "regex" }).invalidReason === "invalid-pattern", "bulk close rejects invalid regex input");
  expect(tabAccessibility(tabs.state.tabs[0], true, "right").orientation === "vertical", "side docking changes tab orientation semantics");

  const palette = new CommandPaletteModel();
  let invoked = false;
  palette.register({ id: "setting", label: "Accent color", description: "Change the current accent", destination: { pageId: "settings", tabId: "appearance", elementId: "accent" }, control: { type: "color", value: "#ff0000", accessibleName: "Accent color" }, command: () => { invoked = true; } });
  palette.setSearch({ query: "accent" });
  expect(palette.results().length === 1 && palette.results()[0].control?.type === "color", "palette keeps rich controls in search results");
  expect(palette.activate("setting")?.elementId === "accent" && invoked, "palette teleports and invokes the real route");
  expect(palette.shortcut === "Ctrl+Shift+F", "palette uses the required shortcut");

  const notifications = new NotificationCenter();
  notifications.notify({ id: "n1", kind: "info", title: "Saved", body: "The change is saved" });
  notifications.notify({ id: "n2", kind: "error", title: "Could not save", body: "Try again" });
  expect(notifications.bulkDismiss(["n1", "n2"]) === 2, "notification history supports bulk dismiss");
  const history = new HistoryStore();
  history.append("updated", "Accent color changed");
  expect(history.list({ actions: ["updated"] }).length === 1 && history.list()[0].redacted, "history records redacted, filterable events");
  const selection = new BulkSelection<{ id: string }>();
  selection.selectAll([{ id: "a" }, { id: "b" }]).invert([{ id: "b" }]);
  expect(selection.ids().join() === "a", "bulk selection supports select-all and inverse selection");

  expect(translateColor("#ff000080", "rgb") === "rgb(255 0 0 / 0.502)", "hex translates with alpha");
  expect(translateColor("hsl(120 100% 50% / 1)", "hex") === "#00ff00", "hsl translates to hex");
  expect(translateColor(RAINBOW_SENTINEL, "hex") === RAINBOW_SENTINEL, "rainbow is a stable sentinel, not a color string");
  expect(translateColor("#336699", "cmyk").startsWith("cmyk("), "color translator exposes CMYK");
  expect(translateColor("#336699", "oklch").startsWith("oklch("), "color translator exposes OKLCH");
  const picker = new InfiniteColorPickerModel().setValue(RAINBOW_SENTINEL).setRainbowSpeed(5).setReducedMotion(false);
  expect(picker.cssAnimation()?.durationSeconds === 32, "rainbow animation uses one global speed level");
  picker.setReducedMotion(true);
  expect(picker.cssAnimation() === undefined && picker.state.resolvedValue.startsWith("hsl("), "reduced motion resolves rainbow to one hue");
  const appearance = new AppearanceEditorModel();
  appearance.addLayer("accent", "normal", { id: "fill", name: "Fill", visible: true, locked: false, opacity: 1, blendMode: "normal" });
  appearance.setProperty("accent", "hover", "color", RAINBOW_SENTINEL);
  expect(appearance.snapshot()[0].states.hover.properties.color === RAINBOW_SENTINEL, "appearance keeps independent state layers");

  const locks = new LockManager();
  for (const [index, policy] of LOCK_POLICIES.entries()) {
    const id = `lock-${index}`;
    locks.create(`element-${index}`, policy, undefined, id);
    locks.begin(id);
    for (const factor of policy.split("-") as Array<"pin" | "password" | "totp">) locks.provide(id, factor, true);
    expect(locks.canActivate(id), `${policy} unlocks only after every factor`);
    locks.relock(id);
    expect(!locks.canActivate(id), `${policy} relocks the target`);
  }

  const confirmation = new DestructiveConfirmation();
  confirmation.start("delete selected records", "first", "second");
  expect(!confirmation.confirm(() => undefined), "destructive action is blocked before both keys and slider");
  confirmation.verifyKey("first", true).verifyKey("second", true).setSlider(1);
  let deleted = false;
  expect(confirmation.confirm(() => { deleted = true; }) && deleted, "destructive action runs only after two keys and full slider");
}

runInteractionTests();
