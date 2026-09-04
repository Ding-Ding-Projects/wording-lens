# Interface interaction models

This package provides the shared state and decision models used by the Wording
Lens interface. It is framework-agnostic: React, Electron, and browser adapters
can render the models without duplicating their state rules.

## Tab strips and search

`TabStripEngine` owns tabs, groups, pinning, ordering, docking, and persisted
search state. The four search scopes are intentionally separate:

1. the current strip,
2. one group's tabs,
3. group names, and
4. every tab owned by the application.

Each scope has an independent `RegexWorkbench`. Plain text is the default.
Regex mode provides flags, validation, token annotations, capture details,
replacement previews, capability information, and bounded match evaluation.
Invalid patterns return an explicit analysis error and never produce a partial
result. Empty-string matches advance safely to avoid an infinite loop.

Bulk-close previews report matched tabs, protected pinned or locked tabs, dirty
tabs, and whether confirmation is required. Adapters must show this preview
before applying a close operation and retain unsaved-work protection.

Side docking maps to vertical accessibility semantics. Top and bottom docking
maps to horizontal semantics. The adapter should use `tabAccessibility` for
tab roles, focusability, selected state, and orientation, and should pass its
reduced-motion preference to `reducedMotionDuration`.

## Command palette and collections

`CommandPaletteModel` uses `Ctrl+Shift+F` and keeps rich control metadata with
each result. A result identifies its page, tab, group, and exact element. The
adapter performs the visual focus and highlight step after `activate` returns
the destination. Notifications remain non-blocking and are retained after
dismissal by `NotificationCenter`. `HistoryStore` records redacted, append-only
events and supports text, action, and date filtering. `BulkSelection` provides
select-all, inverse selection, toggle, and clear operations for any collection.

## Appearance and color

`AppearanceEditorModel` keeps independent layer stacks and property maps for
normal, hover, focus, pressed, selected, disabled, dragged, validation,
loading, success, warning, and error states. Layers expose ordering, visibility,
locking, opacity, and blend mode. The UI adapter adds the full typography and
image-editing inspector while using this state as the serializable source.

`translateColor` supports named colors, HEX, RGB, HSL, HSV/HSB, HWB, CIELAB,
CIELCH, OKLab, OKLCH, and CMYK. The API preserves alpha and keeps the active
color space explicit. Out-of-gamut values remain representable and adapters
should show a clipping warning before applying them. The continuous picker can
use `RAINBOW_SENTINEL` as a value, never as a CSS color string. Rainbow speed
levels are global and map to the documented durations in
`RAINBOW_SPEED_SECONDS`. Reduced motion resolves the sentinel to one stable hue
in the renderer. `InfiniteColorPickerModel` exposes this state without owning a
timer, so the adapter can animate in CSS and keep all rainbow surfaces in sync.

## Toy locks and destructive confirmation

`LockManager` supports exactly six ordered policies: PIN, password, PIN plus
password, password plus TOTP, PIN plus TOTP, and password plus PIN plus TOTP.
Each lock has an independent identifier, target, policy, duration, and state.
The application supplies credential-vault verification callbacks to `provide`;
the model never stores or serializes credential material. Every required factor
must verify before a target becomes active again.

`DestructiveConfirmation` requires two distinct key identifiers and a full-range
slider after both keys verify. It supports cancellation and exposes a factual
state for progress, accessibility announcements, and reduced-motion rendering.
Calling `confirm` before the full authorization returns `false` and does not
invoke the action.

## Verification

The focused test file exercises default text search, named captures, invalid
patterns, all four tab searches, docking semantics, bulk-close protection,
rich palette results, notification history, redacted history, bulk selection,
color translation, rainbow preservation, appearance states, all six lock
policies, and two-key destructive confirmation.

The package contains no network access, DOM mutation, credential persistence,
or external process invocation. Those concerns belong to the owning adapter and
must preserve the same local-only, accessible, bounded behavior.
