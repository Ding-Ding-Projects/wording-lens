# Handoff

## 2026-10-12 bounded Pages publication repair

- The source-preservation branch keeps both existing main-only workflows
  unchanged. Its source repairs can be saved without triggering those release
  or deployment jobs. The separate Pages workflow patch remains pending:
  it selects toolchain-only bootstrap, builds for `/wording-lens`, stages the
  actual base-path export, and uploads `apps/site/dist/pages`.
- Staging promotes the homepage, assets, public files, and RSC payload to the
  artifact root, retains the generated 404 documents, and adds `.nojekyll`.
  It rejects missing or empty local resources, invalid base paths, overlapping
  staging directories, and symbolic links. The favicon metadata uses the same
  base path as the site.
- Separately from the Pages layout repair, the shared Node.js pin is 22.22.2:
  locked `jsdom` 30.0.1 requires `^22.22.2 || ^24.15.0 || >=26.0.0`, excluding
  the former 22.14.0 pin. Its Windows archive digest was checked against the
  official release checksum. Bootstrap hashing uses .NET SHA-256 directly.
  Raw job logs now confirm `Get-FileHash` was unavailable in historical
  release run 33910964111 and current-main release run 33916759742, both
  failing dependency bootstrap. Current-main Pages run 33916759691 completed
  its static build, then failed its incorrect root `index.html` check; it also
  recorded the incompatible Node engine warnings. Windows execution of the
  repaired hash path remains pending. `-ToolchainOnly` preserves the full
  desktop bootstrap path.
  `tests/build/bootstrap-hash.test.ps1` covers a known digest, the exact
  mismatch guard, and exclusive file reopening after both paths; it has not
  run in this environment.
- Local site verification on Node.js 22.22.2: 20 tests passed, TypeScript passed,
  changed-file lint passed, and the base-path build and staging passed with
  26 validated HTML `src`/`href` resource references. Full site lint reports 19 identical
  preexisting errors on the candidate and a clean `f42ffa8` baseline.
- The desktop source build and renderer type check passed. Historical clean
  `f42ffa8` verification reproduced two stale test expectations: a hardcoded
  Windows editor-preview path on Linux and a quoted `settings` token search in
  the wrong source file. That baseline passed 94 of 96 Vitest checks.
- The separate test-only repair uses a platform-native temporary path and
  checks the actual 13-tab inventory plus a real Settings interaction. The
  source/test verification before the wrapper regressions passed 96/96
  Vitest, 12/12 Node privacy/completeness, and 8/8 operations checks, totaling
  116 checks, plus renderer type checking. Removing the Settings tab or panel,
  or the editor NUL guard, deliberately turns the improved checks red.
- The download, build, and installer batch wrappers now clear `PSModulePath`
  only inside their existing `setlocal`, immediately before their unchanged
  Windows PowerShell invocation. Their PowerShell 7-to-batch-to-Windows
  PowerShell launch chain matches Microsoft's documented module-discovery
  failure; this remains an inferred cause because the historical jobs did not
  capture child module paths. The later installer hash sites share that host
  boundary, while direct PowerShell 7 collection and verification do not.
  See [Microsoft's module-path documentation](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_psmodulepath?view=powershell-7.6).
  Seven local static checks protect reset order, process scope, unchanged
  invocation, and exit forwarding. Removing the actual download-wrapper reset
  turned its check red before restoration. Current source/test/wrapper
  verification passes 103/103 Vitest, 12/12 privacy, and 8/8 operations checks,
  totaling 123 checks, plus renderer type checking. Native Windows execution
  and the polluted-versus-cleared module-path experiment remain pending;
  these checks do not establish installer or release readiness.
- A repeat aggregate run hit two unchanged regex-worker timing/startup checks:
  the deadline result exceeded its 500 ms assertion and worker startup reached
  its 2-second limit. The exact unchanged file then passed 5/5 focused checks,
  and an unchanged default aggregate retry passed 123/123. The file matches
  the clean baseline byte-for-byte, but these failures were not separately
  reproduced on that baseline. Timing sensitivity remains a verification
  limitation; no worker source, test thresholds, or hosted gates were changed.
- No new Windows bootstrap run, installer, hosted deployment, live-site read,
  packaged runtime capture, or release is claimed by this local repair.
  Verify the exact published commit and served Pages homepage, assets,
  favicon, preview image, and provenance before changing deployment status.
  Issue #1 remains open for the complete-release acceptance checklist.
- Current private-operation epoch, encrypted-cache validation, and private
  element-export protections are preserved. The older `task/resume-build`
  branch was not merged because its site tree predates these protections.

## 2026-09-04 resumed work, paused again at owner request

- `main` now includes the retained desktop bridge wiring, private-operation race
  repairs, strict IPC document and sink checks, registered notification events,
  installation-specific history encryption, restored encrypted toy-lock records,
  local renderer type checking, and the isolated regex worker package.
- Focused verification passed: 32 service/security/renderer tests, 13 worker and
  renderer tests, and renderer/main TypeScript compilation. These are separate
  focused runs with overlap, not an aggregate count for the final tree.
- Headless verification is blocked because the installed cheap runtime and its
  HTTP binding do not expose `list_headless_desktops`, required by the lifecycle
  helper. A scoped tooling repair was proposed but was not authorized or performed.
- `task/resume-search-checkpoint` preserves unfinished UI integration of isolated
  regex filtering and previews at `d6302dc`. The worker package is tested; the final
  UI integration has not completed its verification and remains outside `main`.
- `task/resume-build` preserves the Node 22.22.2 pin, .NET hash helpers, immutable
  icon handling, and interrupted Pages/PowerShell corrections. Installer attempts
  produced no verified installer. Its final corrections remain unverified.
- `task/desktop-ui-complete` retains final status-label corrections at `83f3036`.
  The prior bridge-wiring commit `9750d98` is already integrated into `main`.
- No new installer, release, deployment, runtime capture, or design parity proof
  is claimed. Existing inventory gaps remain open.
- The sections below record the earlier baseline and must not be interpreted as
  verification of the later interrupted changes.

## 2026-09-04 preservation closeout

### Current state

- The public repository exists at `Ding-Ding-Projects/wording-lens`.
- Local `main` contains the desktop shell, typed service boundary, local operation
  engines, converter and local-model contracts, privacy parser and encrypted cache,
  security and history models, deterministic design reference viewer, browser
  download companion, original logo, multi-resolution Windows icon, social preview,
  documentation site, build scripts, and release automation.
- The root desktop build succeeds through `build.bat /s`.
- The complete local test command succeeds with 92 checks: 72 Vitest checks,
  12 Node privacy and completeness checks, and 8 real-operation checks.
- The documentation site succeeds on Node.js 22.14.0 with 10 focused checks,
  TypeScript validation, lint, static rendering, and a zero-finding production audit.
- The canonical public-boundary scan reports zero private-vocabulary matches across
  tracked files and local commit history.

### Preserved but not integrated

- `task/desktop-ui-complete` contains checkpoint commit
  `f60885f7658701ab93f661eb299dafe25c977b2e`.
- That checkpoint continues the renderer conversion from local simulations to the
  typed desktop service bridge. It passed source formatting and public-boundary
  scanning, but it did not complete a build or interaction run before closeout.
- Keep that branch and its linked worktree. It is active, unmerged, and not eligible
  for deletion.

### Verified limitations

- No Squirrel.Windows installer has been produced or executed. Packaging source and
  structural checks pass, but the installer path remains unverified.
- The pinned Node.js 22.14.0 runtime is below the engine declarations for the current
  `jsdom` and `undici` packages. The build completed with warnings, but the pin should
  move to a compatible verified Node.js 22 release before the first release.
- No real built-application screenshot, screen recording, layout matrix, or design
  parity comparison has been captured. The deterministic parity inventory correctly
  leaves all ten evidence rows pending.
- The documentation site has not been deployed to GitHub Pages or Sites.
- No GitHub release, installer asset, update feed, or workflow verdict exists yet.
- The shared status service was reachable, but this session had no agent-ingest
  credential. Status remained in a private local fallback page.
- The full feature inventory remains incomplete. Several engines and surfaces exist,
  but many rows still lack end-to-end UI behavior, focused tests, packaged interaction,
  and real capture evidence.

### External records

- Issue `#1` tracks the first complete build and release.
- Discussion `#2` is the rolling progress record.
- Organization Project `#32` is linked to the repository and remains in progress.

### Next safe actions

1. Resume `task/desktop-ui-complete`, merge the current `main`, finish its typed bridge
   wiring, and run the complete local test and build commands.
2. Upgrade and verify the pinned Node.js 22 toolchain against every package engine.
3. Build the unsigned Squirrel.Windows installer through `build-installer.bat /s` and
   verify `Setup.exe`, `RELEASES`, the full package, hashes, and unsigned status.
4. Drive the packaged application through the approved isolated desktop route, fix
   any visible or accessibility defects, and create real evidence.
5. Deploy and verify the documentation site, then publish and independently verify
   one release.
6. Update every feature-inventory row with exact implementation, test, interaction,
   and capture links before marking the product complete.
