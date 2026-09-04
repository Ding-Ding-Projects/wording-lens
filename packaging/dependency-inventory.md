# Release workflow dependency inventory

The `package` job in `.github/workflows/release.yml` bootstraps every tool it
uses before the first build operation.

| Dependency | Version source | Bootstrap path | Use |
| --- | --- | --- | --- |
| Node.js | `dependencies.manifest.json` | `scripts/bootstrap-dependencies.ps1`, user-local portable archive | npm and the application build |
| npm | bundled with the pinned Node.js archive | `scripts/bootstrap-dependencies.ps1` | declared project dependency installation |
| Project npm dependencies | `package-lock.json` when present, otherwise `package.json` | `npm ci` or `npm install` with scripts disabled | source build inputs |
| electron-builder | `dependencies.manifest.json` | exact `electron-builder@26.15.3` npm install with lockfile changes disabled | Squirrel.Windows packaging |
| Squirrel.Windows | bundled by electron-builder | electron-builder's pinned release tool | Setup executable, `RELEASES`, and full `.nupkg` files |
| GitHub CLI | hosted runner image, verified by the release commands | runner-provided `gh` | workflow timing and release publication |

No dependency is obtained from an issue, pull request, arbitrary mirror, or
user-provided command. No signing tool or signing credential is installed.
The workflow does not run tests, lint, type checks, coverage, accessibility
checks, or capture checks.
