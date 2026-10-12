# Build, package, and publish

Wording Lens targets Windows. A release is published only from a reproducible
build and includes the exact package and evidence produced for its commit.
Code signing is not used. The installer is unsigned and may trigger an
unknown-publisher warning.

## Root scripts

The repository will provide `download-dependencies.bat`, `build.bat`, and
`build-installer.bat`. Each script will be idempotent, support `/s`,
`--silent`, and `SILENT=1`, report each phase, use user-scoped or portable
tools, verify recorded digests, and refuse secrets and signing material.
`build.bat --run` will be the one-click path: fetch pinned dependencies, build
the real application, verify its executable and resources, refuse an
uncommitted source state, and ask whether to launch only after success. The
installer script will create the same Squirrel.Windows package used for
publication, verify its files, report a SHA-256, and never publish or create a
release itself.

## Packaging and dependencies

Every runtime dependency needed by the app is bundled in the installer or is
obtained automatically through a verified user-scoped fallback when a license
prevents redistribution. Optional integrations such as an editor are not
dependencies and are detected at use time. The package is checked from the
installed result, not only from configuration. A missing bundled file lists
every path searched and fails clearly.

The supported Windows installer is Squirrel.Windows and includes `Setup.exe`,
`RELEASES`, the complete `.nupkg`, and delta packages where available. Signing
inputs are cleared and signing controls are explicitly disabled. Automatic
updates use HTTPS feed metadata, package hashes, rollback protection, and an
explicit user-selected restart. The interface states when the feed or package
is unsigned and never claims authenticity from a hash alone.

## Continuous integration

Every push and manual dispatch builds, packages, and publishes one unique,
non-draft release when those operations succeed. Workflows do not run tests,
lint, type checks, coverage, accessibility checks, or screenshot checks. Local
tasks still run the relevant tests and report their actual result. The
workflow records bootstrap inputs, runner context, commit SHA, package files,
safe failure outputs, start and finish timestamps, and exact duration.

## Release metadata and evidence

Release notes contain the version, workflow start and finish times, duration,
line-count table, exclusions, attribution method, installer names and hashes,
verification status, and a dim sum code name only when its photo is available
from the approved public catalog. The line counter is committed and reports
source, tests, styles or markup, generated content, excluded dependencies, and
total and non-blank lines. It also reports surviving-line authorship and a
human-time estimate with its arithmetic and assumptions.

The README and feature articles show real captures of each available surface,
with state, commit, build method, dimensions, and accessible alt text. The
application also ships a short real screen recording of a genuine workflow.
No design mock, source preview, edited image, or monitor recording is accepted.

## Documentation site and link preview

The documentation site is a responsive, local-asset surface with all required
feature equivalents, browser-style tabs, settings, search, accessibility,
offline behavior, and local visitor state. It serves product-specific Open
Graph metadata in the initial HTML, including an absolute HTTPS image URL,
dimensions, alt text, and `summary_large_image`. A root `social-preview.png`
is the versioned source, and a served copy is byte-identical when a subdirectory
deployment requires one. Anonymous fetch of the deployed page and image proves
the link preview; source-only tags do not.

The repository homepage points to the live documentation site after it is
verified. A GitHub Pages deployment is enabled only when its served path,
assets, and metadata have been checked. The site never presents an unreleased
build as available and never hosts the installed runtime as a substitute.

The pending project-Pages workflow update stages the actual base-path export
before uploading it; the source-preservation branch retains existing workflows.
See [Pages publication](pages-publication.md) for local commands, artifact
requirements, and the remaining independent deployment checks.

## Design parity

When the repository contains checked-in design references, a dedicated
reference application renders those files directly. A hand-written inventory
records each screen, state, theme, viewport, scale, routes, Material Design 3
audit, raw captures, side-by-side comparison, visual diff, and intentional
deviation. The reference and packaged application use an identical capture
tuple. Missing references, routes, tuple fields, audits, comparisons, or diffs
keep the release incomplete.

## Failure modes and security

A warm local build is not proof of a cold build. The scripts and workflow must
bootstrap dependencies from declared manifests, verify package contents, and
record the exact source commit. Failed packaging never produces a success
release. A failed test does not block the workflow because tests are outside
the workflow, but its local result remains visible and is never called a
release verification. Secrets, signing keys, private wording, credentials,
source trees, dependency folders, and caches are excluded from collected
outputs and public records.

## Verification status

At foundation commit `27750632fdac7f5c000e1120e8f2e4c81518b942`, root scripts,
the packaged application, CI workflow, release, site, link preview, design
reference app, line counter, captures, and recording are not implemented or
verified. Future work must update [INVENTORY.md](../../../INVENTORY.md) with
real paths, exact hashes, test counts, run links, and capture evidence.

## Suggested articles

- [Product overview](../product/overview.md)
- [Status and notifications](../product/status-updates-and-notifications.md)
- [Accessibility interaction contract](../accessibility/interaction-contract.md)
