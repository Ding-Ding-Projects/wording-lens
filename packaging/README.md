# Windows build and release path

This directory contains the checked-in packaging contract for Wording Lens.
The supported installer is an unsigned Squirrel.Windows build. Code signing is
disabled deliberately and is never requested, discovered, or invoked.

## Local commands

Run these commands from a clean checkout on Windows:

```text
download-dependencies.bat /s
build.bat /s
build-installer.bat /s
```

The first command installs the pinned Node.js toolchain in the user-local
application toolchain directory and installs the pinned `electron-builder`
release tool. The build command produces `dist-electron/main.js` and
`dist/index.html`. The installer command produces `Setup.exe`, `RELEASES`, the
full `.nupkg`, and `source-receipt.json` under `dist/squirrel-windows/`.

The scripts verify SHA-256 for the downloaded Node.js archive, verify the
installer has `NotSigned` Authenticode status, verify that `RELEASES` names each
full package, and record the source commit and output hashes. They never tag,
publish, or push.

## Workflow contract

`.github/workflows/release.yml` runs for every push to `main` and for manual
workflow dispatch. It bootstraps dependencies, builds, packages, collects safe
failure outputs, uploads bounded evidence, records measured UTC timing, runs
the committed line counter, and publishes one unique monotonic release tag
with the verified Squirrel.Windows files.

The workflow intentionally does not run tests, lint, type checks, coverage,
accessibility checks, or capture checks. Those checks are local development
responsibilities and are not release gates. The release notes state that
boundary explicitly.

The workflow token uses the additive fallback
`secrets.RELEASE_TOKEN || secrets.ORG_TOKEN || secrets.GITHUB_TOKEN` and is
passed only through `GH_TOKEN`. Release assets are collected from the exact
Squirrel output directory, never from a stale root-level directory.

## Required icon input

The packaging configuration expects the project-owned icon at
`packaging/wording-lens.ico`. It must be a real multi-resolution Windows icon
generated from the project's committed logo source. The installer build fails
closed when that input is absent, so an unsigned installer is never published
with a framework-default icon.
