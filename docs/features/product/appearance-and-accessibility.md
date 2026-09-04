# Appearance and accessibility

Wording Lens will use Material Design 3 tokens, typography, shape, elevation,
motion, and component anatomy throughout its own chrome. Functional data
colors remain data, not a substitute for product styling. The appearance
surface is persistent, live where practical, resettable, importable, and
exportable.

## Appearance editor

Every rendered element and every normal, hover, focus, pressed, selected,
disabled, dragged, validation, loading, success, warning, and error state is an
appearance target. Its context menu provides `Edit appearance`, and its
keyboard equivalent opens an anchored, non-modal editor beside the exact
target. The editor tracks the anchor, avoids viewport edges, and returns focus
on close.

The editor provides non-destructive layers and groups, visibility and locking,
reordering, masks, effects, fills, borders, shadows, glows, transforms,
filters, state inheritance, typography, spacing, layout, elevation, motion,
before and after previews, undo and redo, named presets, copy and paste, and
per-property, per-element, and global reset. Unsupported properties remain
visible with an exact platform explanation.

Typography includes installed and bundled fonts with a live preview and
CJK-safe fallback, size entry and stepping, weight, style, underlines,
strikethrough variants, overline, capitalization, small caps, superscript,
subscript, color, highlight, outline, shadow, glow, character and word
spacing, line height, baseline offset, direction, and alignment.

## Color

Every color control has a continuous spectrum or wheel, not only finite
swatches. It translates bidirectionally among named colors where defined,
HEX/HEX8, RGB/RGBA, HSL/HSLA, HSV/HSB, HWB, CIELAB/LCH, OKLab/OKLCH, and CMYK,
preserving alpha. It identifies the active color space and gamut, warns before
clipping, shows accessible contrast, and supports copying each representation.
An animated rainbow is one selectable sentinel mode with a shared speed level.
CSS performs the animation, and reduced motion settles on one hue.

## App name and logo

The person can rename the displayed application name and reset it. The chosen
name affects the title bar, About surface, notifications, and other
introductions, but never changes package identity, installer identity, update
feed, or data directory. Diagnostics use the shipped product name so a report
remains identifiable.

Logo customization provides shipped presets and a local custom-image picker.
Input is decoded from verified bytes with bounds on input size, dimensions,
pixels, frames, memory, and CPU. Crop, fit, fill, focal point, safe area,
transparency, and background choices are real rendering controls. Output
variants are validated by signature, dimensions, alpha handling, and decoder
round trip. A failed conversion keeps the previous valid logo active.

## Responsive sizing

The layout will hold at supported widths, 100, 125, 150, and 200 percent
display scale, and the longest bilingual labels. No label or control is
silently clipped, overlapped, or pushed off screen. Dense surfaces use internal
scrolling and progressive disclosure. The default and minimum window sizes are
bounded by the display's usable area so a high-scale laptop remains usable.

## Failure modes and security

Appearance changes are local and reversible. Invalid logo input never partially
applies. A color outside the selected gamut is reported before clipping.
Unavailable font features remain visible as unsupported rather than being
silently dropped. Custom images, font choices, and appearance exports stay
local and do not enter diagnostics or public records.

## Verification status

At foundation commit `27750632fdac7f5c000e1120e8f2e4c81518b942`, appearance,
logo, color, naming, and responsive behavior are not implemented and have no
focused tests or real packaged captures. The future evidence must cover the
editor's full capability matrix, every interaction state, both themes, all
language modes, high display scales, and reduced motion.

## Suggested articles

- [Accessibility interaction contract](../accessibility/interaction-contract.md)
- [Language and personal vocabulary](language-and-personal-vocabulary.md)
- [Search, navigation, and tabs](search-navigation-and-tabs.md)
