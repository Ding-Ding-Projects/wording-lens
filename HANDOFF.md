# Handoff

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
