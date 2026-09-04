# Wording Lens visual specification

Wording Lens uses a quiet graphite Material Design 3 shell, electric cyan for the current action, and mint only for healthy operational state.

## Core tokens

```css
:root {
  --bg: oklch(0.145 0.012 240);
  --surface: oklch(0.19 0.014 240);
  --fg: oklch(0.945 0.014 210);
  --muted: oklch(0.72 0.025 220);
  --border: oklch(0.35 0.022 232);
  --accent: oklch(0.84 0.15 210);
}
```

Supporting healthy-state color: `oklch(0.84 0.135 160)`.

## Type

- Display: `Bahnschrift, "Aptos Display", "Segoe UI Variable Display", sans-serif`
- Body: `"Segoe UI Variable Text", "Segoe UI", sans-serif`
- Mono: `"Cascadia Mono", Consolas, monospace`

## Visual rules

1. Graphite surfaces are separated by tonal steps and one-pixel borders, not decorative gradients.
2. Electric cyan marks the selected tab, primary action, and focus ring. It is not used as general decoration.
3. Mint communicates ready, running, current, or healthy state. Amber communicates a waiting or review state.
4. Every interactive target is at least 48 pixels, with generous label width for bilingual content.
5. Rounded rectangles use a restrained 10, 16, and 24 pixel radius hierarchy. Pills are reserved for compact state labels.
