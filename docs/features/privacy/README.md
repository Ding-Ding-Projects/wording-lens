# Privacy feature documentation

This category documents the local wording overlay and its privacy boundaries.
The implementation accepts only a user-selected local payload at runtime. The
repository carries a neutral schema, generic validation, and payload-free tests.

## Articles

- [Local wording overlay](local-wording-overlay.md)

## Public-safe verification

The focused verification reports contract names and pass counts only. It never
prints payloads, mappings, source names, source paths, cache bytes, or derived
private wording. Public sinks are tested to remain byte-for-byte original.
