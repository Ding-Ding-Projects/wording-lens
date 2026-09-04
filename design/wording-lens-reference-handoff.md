# Wording Lens primary desktop reference handoff

## Summary

The reference defines a local-first Windows operations cockpit with a custom title bar, a left-docked tab rail, a dense but calm operations field, and a contextual settings rail.

## Design files

- Primary interactive reference: `design/wording-lens-operations-cockpit.html`
- Visual tokens and type rules: `design/brand-spec.md`

The HTML is self-contained. It uses no external scripts, fonts, images, network calls, or user data.

## Target and implementation boundary

- Reference implementation: semantic HTML, CSS, and small local JavaScript behaviors.
- Production target: the real Windows desktop framework used by Wording Lens.
- The reference is a design and interaction specification. It does not prove native shell, storage, adapter, or processing behavior.

## Screen and state inventory

| Surface or state | Address | Required state |
| --- | --- | --- |
| Operations overview | `#panel-operations` | Default front screen with provenance, summary, active queue, import, settings, adapter health, and evidence |
| Queue workspace | `#panel-queue` | Searchable queue with pause, resume, and start actions |
| Adapter workspace | `#panel-adapters` | Ready and review states with a refresh action |
| Evidence workspace | `#panel-evidence` | Static evidence cards and deterministic activity fixture |
| Settings workspace | `#panel-settings` | Density, contrast, reduced motion, layout language spacing, and personal wording import |
| Command palette | `#command-dialog` | Opens from the rail or `Ctrl+Shift+F`, filters destinations and actions |
| New operation | `#operation-dialog` | Validated name entry, adapter choice, priority choice, and session-only queue creation |
| Evidence detail | `#evidence-dialog` | Clearly labelled static preview with local and network boundaries |
| Personal wording import | `[data-import-zone]` | Empty, valid, invalid, oversized, atomically refused, loaded, drag-over, and cleared states |
| Compact layout | CSS breakpoint at 700 pixels | Rail becomes an icon tab row and content becomes one column |

## Deterministic review tuples

| Purpose | Viewport | Theme | Language presentation | Scale |
| --- | --- | --- | --- | --- |
| Primary desktop reference | 1440 × 1000 | Dark graphite | English with bilingual-ready spacing | 100% |
| Compact reference | 390 × 844 | Dark graphite | English with bilingual-ready spacing | 100% |

The production implementation should also be verified in its complete supported language, theme, and display-scale matrix.

## Interaction contract

- Left-docked tabs switch real tab panels and expose the correct selected state.
- Arrow keys follow the rail orientation. Vertical tabs use Up and Down, while the compact row uses Left and Right.
- The command palette opens from the visible affordance and from `Ctrl+Shift+F`, filters locally, and returns focus after closing.
- Queue filters, queue control buttons, adapter disclosure rows, evidence details, and all visible settings provide an immediate visible response.
- Density, contrast, reduced motion, layout spacing, and selected tab persist only in local browser storage.
- Personal wording import validates exactly `schemaVersion: 1` plus `entries` in memory. The complete payload is limited to 256 KiB, 4,096 entries, object depth 2, key length 1 to 160, and value length 0 to 1,000. Duplicate keys, unsafe keys, control characters, unexpected fields, malformed JSON, and unsupported versions are rejected as one whole payload. A rejected replacement leaves the last valid local wording active until explicit Clear. Public evidence never includes a file name, path, entry key, value, content, or count.
- Window controls are clearly handled as shell-preview controls in the HTML. The production desktop host must perform the native actions.

## Provenance contract

The front screen shows reference version `1.0.0` and the exact reference update time `2026-09-04 13:42:28 EDT`, bound to this HTML revision. These values describe the design reference only. Production must replace them with the running product version and its build or release provenance, including seconds and timezone. Missing production provenance must render an honest unavailable state.

## Asset provenance

- Product mark: CSS geometry authored for this reference.
- Interface icons: inline, stroke-based SVG symbols authored for the reference.
- Fonts: installed Windows font stacks with safe fallbacks.
- Operational content: generic deterministic fixture data, labelled as reference or static preview content.

## Intentional reference limitations

- Native window actions display an explanatory notification because a browser reference cannot control the desktop host.
- Queue processing, adapter refresh, and evidence export are interaction demonstrations. They do not read or write production files.
- The wording import validator fixes the portable local contract at `schemaVersion: 1` plus `entries`, demonstrates privacy and atomic refusal states, and retains no imported payload. Production must implement the same contract and evidence boundary in its own private local storage layer.
- Only neutral English copy is included. The geometry deliberately leaves space for longer bilingual labels, but final localized copy requires a separate content pass.

## Production destinations

- Desktop shell: frameless title bar, drag region, and native window controls.
- Renderer navigation: docked tab rail, compact tab row, keyboard movement, and persistent selected tab.
- Operations domain: summary cards, queue states, progress, row actions, and adapter state.
- Evidence domain: evidence cards, provenance, activity, and export routing.
- Settings domain: local preference storage, reduced motion, contrast, density, language spacing, and the exact local personal-wording import contract.

## Accessibility notes

- Interactive targets are at least 48 pixels.
- Focus indicators use a three-pixel electric-cyan ring.
- Controls use semantic buttons, tabs, tab panels, switches, progress bars, dialogs, and labelled fields.
- Status meaning is carried by text as well as color.
- Motion can be reduced from the visible setting and follows the operating system preference.
- The compact layout removes horizontal page scrolling and keeps dialogs within the viewport.

## Verification state

- Static source audit passed with 37 unique HTML IDs and 79 unique `data-od-id` targets.
- The embedded JavaScript passed an in-memory syntax check.
- Required regions, exact provenance, 48 pixel target token, compact breakpoint, responsive tab orientation, radio keyboard behavior, and repeated-card design targets are present.
- Import-contract needles passed for the exact `schemaVersion` and `entries` root, byte limit 262144, entry limit 4096, object depth 2, key limits 1 and 160, value limits 0 and 1000, strict UTF-8 decoding, duplicate and unsafe key refusal before property assignment, control-character refusal, exact-root enforcement, malformed JSON refusal, unsupported-version refusal, newest-attempt-only state mutation, last-valid-state preservation after rejection, and explicit-Clear reset.
- Privacy needles passed: visible import states and evidence copy contain no selected file name, path, entry key, value, payload content, or derived count.
- A single design export attempt returned a success code but did not emit an image. One bounded file search found no generated image, so visual inspection remains unverified rather than inferred from source.
