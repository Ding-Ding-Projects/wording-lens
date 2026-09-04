# Wording Lens

Wording Lens is a local-first Windows operations cockpit for projects, tasks,
files, builds, releases, local services, and external tools. It can apply a
user-supplied wording overlay inside the private interface without embedding or
publishing that user's vocabulary.

> This repository is at its foundation milestone. The first runnable build and
> verified installer will be documented here as soon as they exist.

## Project links

- Documentation site: pending the first verified deployment
- Releases: pending the first verified Windows package
- Roadmap: [ROADMAP.md](ROADMAP.md)
- Handoff: [HANDOFF.md](HANDOFF.md)

## Build

The supported one-command build will be:

```powershell
.\build.bat --run
```

The script will bootstrap its pinned toolchain, refuse an uncommitted source
state, build the real application, verify the executable and resources, and
launch only after those checks pass.

## Privacy boundary

The repository contains a neutral schema and loader only. It does not contain a
real personal vocabulary, mappings, examples derived from a private file,
private infrastructure, or private captures. A selected vocabulary file is
validated and processed locally. Clearing it restores the shipped wording.

## Shared engineering contract

This project follows the sanitized shared engineering contract in [AGENTS.md](AGENTS.md).
That copy is informational; canonical instruction changes are maintained outside
this public repository.
