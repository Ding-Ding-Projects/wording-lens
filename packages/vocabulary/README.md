# Local wording overlay

This package implements a local-only, user-supplied wording overlay. It ships
only a neutral schema and generic processing code. No private term, mapping,
source filename, source path, example payload, or user-derived evidence belongs
in this package.

## Contract

The supported payload is schema version `1` with exactly `schemaVersion` and
`entries` at the root. The parser reads UTF-8 bytes, enforces a 256 KiB payload
limit, allows at most 4,096 entries, bounds keys at 160 characters and
replacements at 1,000 characters, and permits empty replacement strings.
Objects may be at most two levels deep. It rejects duplicate JSON keys at every
object depth, unsafe object keys, control characters, unknown fields, and
unsupported versions. Validation completes before a controller changes state.

The parser is duplicate-aware because ordinary object parsing has already lost a
duplicate before a schema validator can inspect it. The bounded parser therefore
tracks keys while reading the byte payload.

## Rendering and boundaries

`createAliasIndex` orders keys longest first. `renderProtectedSpans` copies caller
protected ranges byte-for-byte and performs replacements only outside those
ranges. This lets the owning surface protect URLs, identifiers, code, paths,
quoted provider text, and other exact content before rendering private UI text.

`renderToSink` and `createTypedSink` accept an explicit sink boundary. Only
`private-ui` and `accessible-name` may apply the overlay. Public records, logs,
exports, history, telemetry, prompts, captures, and diagnostics receive the
original text unchanged. Unknown boundaries are rejected.

## Cache and reset

`createEncryptedCache` requires host-provided `seal`, `unseal`, and atomic storage
operations. It validates before sealing, revalidates after unsealing, and fails
closed on any cache problem. It never accepts a source path and never exposes
plaintext persistence. `clear` removes the cache and prevents a stale read from
reappearing in the current process.

`createVocabularyController` applies a complete payload atomically. A rejected
payload leaves the prior state untouched. `clear` and `reset` restore original
wording. `setSchoolMode(true)` suppresses the overlay while retaining the valid
local selection for restoration when the mode ends; the status surface exposes
only generic state, not mapping content.

## Verification

The focused tests cover valid and invalid payloads, all schema bounds, duplicate
keys, unsafe keys, atomic apply, longest-key precedence, protected spans, sink
boundaries, encrypted-cache revalidation, clear/reset, and School-mode
suppression. They use neutral payloads only. The fixtures include a deliberate
red/green contract probe that removes one required implementation boundary in a
temporary copy, observes the expected failure, then restores it; no real private
wording is used.
