# Shared engineering contract mirror

This is a sanitized mirror of the shared engineering rules. It intentionally
contains no private vocabulary, machine-specific paths, hostnames, network
addresses, credentials, or account details. Update the canonical private source
first, then refresh this mirror.

## Product and privacy

- Keep all user data local by default. Never put credentials, private wording,
  local paths, private infrastructure, or user-derived evidence in source,
  logs, diagnostics, telemetry, captures, exports, issue text, release text, or
  generated public assets.
- Ship only a neutral, versioned personal-vocabulary schema and payload-free
  fixtures. Validate the entire file before applying it. Invalid input applies
  nothing, and clearing the cache restores original wording immediately.
- Keep stable package, installer, update-feed, and data-directory identities
  separate from the user-editable display name.

## Interface contract

- Use Material Design 3 throughout. Provide English, playful Hong Kong
  Cantonese, and bilingual modes, plus independent persisted tone controls for
  both languages.
- Provide accessible browser-style tabs, complete search and regular-expression
  tools, a command palette on Ctrl+Shift+F, non-blocking notifications, local
  history, complete exports, bulk actions, guided forms, appearance editing,
  per-element novelty locks, local authentication tools, a file converter, a
  local Ollama manager, scheduled settings, attention-support modes, offline
  documentation, update status, and a changelog.
- Every rendered collection, menu, picker, dropdown, panel, editor, settings
  section, and page has its own local search and adjacent full regular-expression
  builder. Every interactive-looking control must perform its stated action.
- Every irreversible action names the exact scope and requires two independent
  keys plus a full-range confirmation slider before execution.
- Maintain keyboard operation, visible focus, screen-reader names and states,
  reduced-motion behavior, readable contrast, adequate targets, and layouts
  without clipping at all supported sizes and display scales.

## Engineering and evidence

- Use typed, allowlisted operations instead of arbitrary shell strings. Put
  credentials only in the operating-system credential vault and never print or
  persist them in ordinary settings.
- Maintain a hand-written feature and surface inventory. Each row identifies its
  implementation, localization, documentation, focused test, built-product
  interaction, and real capture evidence.
- Add executable completeness checks and deliberately break each protected
  boundary once to prove that the check turns red before restoring it to green.
- Verify visible behavior against the real packaged application on an isolated
  off-screen Windows desktop. Source previews and mocks are not runtime evidence.
- Keep `README.md`, categorized feature documentation, `ROADMAP.md`,
  `HANDOFF.md`, the wiki, documentation site, changelog, and evidence current in
  the same change as the behavior they describe.

## Source control and delivery

- Preserve unrelated work and never rewrite published history or force-push.
- Attribute every commit to `Claude Fable 5 <noreply@anthropic.com>` and include
  exactly one matching `Co-Authored-By` trailer.
- Run tests locally. GitHub Actions builds, packages, and publishes, but does not
  run test, lint, type-check, coverage, accessibility, or screenshot jobs.
- The active product target is Windows. Package only with unsigned
  Squirrel.Windows and publish the setup executable, release index, full package,
  and available delta packages. Code signing is prohibited.
- Every successful push or manual workflow dispatch creates one unique,
  non-draft release with real downloadable installation files and truthful
  workflow timing, line-count, verification, and third-party attribution data.
