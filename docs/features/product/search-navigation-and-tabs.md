# Search, navigation, and tabs

Wording Lens will present destinations as browser-style tabs. The strip docks
to the left by default and can move to the top, right, or bottom. Docking,
order, pinned order, groups, group order, collapsed state, and membership are
persisted per surface.

## Tab behavior

The strip has an overflow surface instead of silently clipping labels. Users
can pin and reorder tabs, create and name groups, move tabs with pointer or
keyboard input, and collapse groups without losing their structure. Moving a
tab into a collapsed group keeps that group collapsed. Pinned tabs remain in a
stable region and are excluded from bulk close operations by default.

Tabs support a target-specific context menu with management actions, visible
keyboard shortcuts, `Edit tab appearance`, and `Lock this element`. Shift plus
right-click opens the appearance editor directly where the platform supports
that gesture. Keyboard and screen-reader behavior follows the strip axis.

## Four tab searches

Every application provides four separate tab searches: the current strip, each
group, group names, and a master search across every open tab. Each field owns
its query, pattern, flags, validation, mode, history, and saved snippets. A
result identifies its window, workspace, strip, group, pinned state, and label.
Activating a result reveals collapsed groups without changing their saved
collapsed preference.

## Regular-expression builder

Plain text is the default. An anchored builder beside every search field is an
explicit regular-expression mode. The builder exposes the real engine and
dialect, flags, escaping, supported constructs, parse structure, token
explanations, capture tables, replacement preview, saved snippets, import and
export, match navigation, zero-width behavior, timing, backtracking warnings,
and bounded tracing where the engine supports it. Unsupported constructs stay
visible with an exact capability explanation. Patterns and samples are bounded
and evaluated locally.

The same builder is available for settings, collections, dropdowns, pickers,
context menus, editors, history, notifications, and documentation. A short
menu is not an exception. Every surface has its own isolated field.

## Command palette

`Ctrl+Shift+F` opens a searchable command palette. It lists commands,
destinations, feature articles, settings, and appearance controls. Results use
the live control where one applies, and selection teleports to the exact tab,
group, page, and element with focus and a brief highlight. The palette itself
has the full builder and a persisted bounded-card or full-window size.

## Bulk close and bulk actions

Tab strips and searchable tab lists provide `Close tabs containing text` and
`Close tabs not containing text`. Both use the same predicate, support plain
text by default and regular expressions by opt-in, reject empty or invalid
input, preview the exact count, exclude pinned and locked tabs unless the user
explicitly includes them, and preserve unsaved-work prompts.

Every list, table, grid, and collection also supports multi-select, shift-range
selection, keyboard selection, select-all with a stated scope, inverse
selection, and the actions the surface supports, including export, move,
copy, duplicate, rename, enable, disable, retry, and delete. Long operations
show progress and partial results. Destructive batches use the application's
two-key confirmation surface.

## Menus, overlays, and filters

Every right-click menu and dropdown has its own local search and anchored
builder. Filtering never changes action semantics and an empty result names
the no-match state. Menus return focus to the opener. Popovers paint their own
background, border, shape, and elevation, stay within the viewport, and scroll
their content when needed. Panels can be resized, and floating panels can be
dragged, with persisted position and size plus keyboard equivalents. Collapsed
filter and statistics rows preserve active-filter disclosure.

## Failure modes and security

Missing or invalid patterns never silently close tabs or delete records. Search
does not inspect hidden page content when the contract names visible labels.
Locked items remain discoverable and prompt for unlock. Pattern and sample
limits prevent runaway evaluation, while zero-width matches are handled without
an infinite loop.

## Verification status

At foundation commit `27750632fdac7f5c000e1120e8f2e4c81518b942`, navigation,
search, tabs, the palette, menus, overlays, and bulk actions are not
implemented and have no focused tests or real captures. Later work must add a
hand-written surface list and deliberate red-then-green omission checks.

## Suggested articles

- [Appearance and accessibility](appearance-and-accessibility.md)
- [Locks, history, and authenticator](locks-history-and-authenticator.md)
- [Status and notifications](status-updates-and-notifications.md)
