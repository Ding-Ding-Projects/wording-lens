# Tools feature documentation

This category documents the local file converter and local Ollama manager.
Both surfaces operate locally, keep credentials out of ordinary state, and
fail closed when a required capability is not bundled and verified.

## Articles

- [File converter](converter.md)
- [Ollama manager](ollama.md)

The public API of each package is exported from its `src/index.ts` file. The
packages deliberately use injected I/O interfaces so applications can provide
their own storage, progress presentation, and platform process launcher.
