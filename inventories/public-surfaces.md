# Public surface checklist

This checklist names every surface that can be presented to a user. Each
surface independently owes the canonical feature set in [INVENTORY.md](../INVENTORY.md).
The documentation site cannot delegate a contract to the desktop application,
and the desktop application cannot delegate its offline documentation browser
to the hosted site.

| Surface | Required behavior | Current status |
| --- | --- | --- |
| Desktop front screen | Version provenance, language, startup notice, status, and accessible navigation | Pending implementation |
| Desktop settings | All settings, local search, regular-expression builder, tabs, appearance, upload, schedules, and reset paths | Pending implementation |
| Desktop operations cockpit | Projects, files, builds, releases, services, external tools, progress, and recovery | Pending implementation |
| Desktop documentation browser | Bundled articles, rendered provider text, internal links, offline use, and search | Pending implementation |
| Desktop changelog viewer | Every release, date range, search, commit links, copy, and export | Pending implementation |
| Desktop notification center | Reviewable notices, filters, bulk actions, export, and accessibility | Pending implementation |
| Desktop file converter | Categorized adapters, previews, queues, progress, cancellation, and validation | Pending implementation |
| Desktop local model manager | Runtime health, exhaustive catalog, fit evidence, pulls, chat, and harness recovery | Pending implementation |
| Desktop authenticator | QR pairing, code display, vault records, history, and redacted export | Pending implementation |
| Desktop lock and recovery surfaces | Six policies, unlock ladder, Support Tickets, and local reset guidance | Pending implementation |
| Documentation site home | Product presentation, verified downloads, link preview, responsive layout, and local visitor state | Pending implementation |
| Documentation site feature articles | One article per feature, suggested articles, search, tabs, and accessible markup | Pending implementation |
| Documentation site settings | Site-local language, tone, appearance, tabs, locks, exports, and reset | Pending implementation |
| Documentation site status and changelog | Current evidence, release history, date filtering, search, and local fallback | Pending implementation |
| Design-reference application | Direct reference files, deterministic route, parity tuple, and comparison evidence | Pending implementation |

For every row, a future update must add exact implementation paths, localization
keys, persistence records, focused test names and counts, built-application
interaction steps, capture paths and hashes, source commit, package hash,
viewport, display scale, theme, and privacy result. Until then the row remains
pending.

## Suggested articles

- [Product documentation index](../docs/features/product/README.md)
- [Accessibility interaction contract](../docs/features/accessibility/interaction-contract.md)
- [Build, package, and publish](../docs/features/release/build-package-and-publish.md)
