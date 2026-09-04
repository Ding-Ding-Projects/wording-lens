# Accessibility interaction contract

Wording Lens will keep every user-facing surface keyboard operable, screen
reader understandable, visually focused, contrast-safe, and usable without
motion. The same contract applies to the application, its offline
documentation browser, and the documentation site.

## Keyboard and assistive technology

Every interactive element has a semantic role, an accessible name, a value or
state, a visible focus indicator, and a keyboard path. A control that appears
disabled but remains an unlock target uses an operable wrapper so it can open
the correct authentication prompt without executing the protected action.
Menus, dropdowns, dialogs, pickers, tabs, sliders, file controls, date fields,
editors, and long-operation controls have equivalent keyboard actions and
return focus to the element that opened them.

Tab strips use `tablist`, `tab`, and `tabpanel` roles, roving focus, live
`aria-controls`, and an orientation that matches the docking edge. Search
results announce the result count and filtered set. Timers and progress expose
readable numbers and status text, not only color or animation. Screen readers
receive full names for icons and images, while decorative icons are hidden from
the accessible name.

## Motion, sound, and contrast

Reduced motion removes non-essential movement. The rainbow color mode settles
on one hue, mole rounds use a non-motion cue, and progress remains readable.
The narrator is off by default, has independent language and voice choices,
uses a serialized queue, yields to screen readers, and follows quiet settings.
Contrast is checked for text, focus, disabled state, overlays, controls, and
data-independent chrome in both themes. Data colors do not carry meaning by
color alone.

## Touch and responsive sizing

Targets have adequate size and separation. At approximately 320 pixels and up,
the body does not scroll sideways, wide content scrolls inside its own region,
and text reflows without truncation. The tab strip can collapse to an edge
affordance or icons, overlays stay inside the viewport, and anchored editors
remain reachable with an on-screen keyboard. The same checks run in portrait
and landscape and at larger text settings.

## Attention-support modes

Five independent modes are available and off by default: Focus, Low
stimulation, Time awareness, One thing at a time, and Momentum. They describe
observable interface behavior without medical claims or judgment. Each mode is
persistent, searchable, keyboard accessible, screen-reader named, and
compatible with School mode and reduced motion. A prompt states what is true,
such as how long nothing has changed, without guilt or scoring.

## Failure modes and security

An inaccessible shortcut, missing name, low-contrast state, or layout overflow
is a product defect. A visual-only success indicator is not accepted. User
data, credential values, local paths, private wording, and diagnostic evidence
never appear in accessible labels, exports, logs, captures, telemetry, or
public records.

## Verification status

At foundation commit `27750632fdac7f5c000e1120e8f2e4c81518b942`, no interface
exists to verify. Future checks must exercise keyboard-only flows, screen-reader
roles and names, visible focus, both themes, reduced motion, reduced sound,
all language modes, high text sizes, narrow layouts, touch targets, and each
attention-support mode from the real packaged application.

## Suggested articles

- [Appearance and accessibility](../product/appearance-and-accessibility.md)
- [Search, navigation, and tabs](../product/search-navigation-and-tabs.md)
- [Language and personal vocabulary](../product/language-and-personal-vocabulary.md)
