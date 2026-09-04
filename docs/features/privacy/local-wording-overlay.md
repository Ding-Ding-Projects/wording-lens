# Local wording overlay

The overlay is a private presentation choice applied only after a person
selects a local JSON file. Until a complete payload validates, the application
uses its shipped wording. A rejected payload applies nothing, and clearing the
selection restores shipped wording immediately.

## Schema and bounds

Version `1` has exactly two root properties: `schemaVersion` and `entries`.
The complete UTF-8 payload is bounded at 256 KiB, the entry count at 4,096,
each key at 160 characters, and each replacement at 1,000 characters. Empty
replacement strings are valid. Objects may be at most two levels deep.
Duplicate JSON keys, unsupported versions, unknown fields, unsafe object keys,
malformed UTF-8, control characters, arrays at the root or entries, and
non-string replacements are refused before state changes.

## Rendering boundary

Keys are indexed longest-first. The owning UI identifies protected ranges before
rendering, so URLs, identifiers, paths, code, quoted provider text, and public
records remain exact. The typed sink API allows transformation only for private
UI text and accessible names. Public records, exports, logs, history, telemetry,
prompts, captures, and diagnostics always receive original text.

## Local cache

The host provides encryption and atomic storage. The package validates before
sealing and validates again after unsealing. Corrupt, stale, unsupported, or
unavailable cache data fails closed to original wording. The cache interface does
not accept a source path and does not expose plaintext persistence.

## School mode and reset

When School mode is active, rendering is suppressed and the generic status says
that the overlay is inactive. The valid local selection remains available for
restoration after the mode ends. `clear` and `reset` remove the selection and
return to original wording.

## Security and recovery

Processing is local-only and performs no network operation. The caller owns
file-picker permissions, encryption, storage, and deletion. If validation or
cache recovery fails, the original wording remains active and the UI can offer
the local replace or clear action without exposing payload details.

### Desktop and website boundaries

The desktop accepts privileged requests only from its exact main renderer document.
Unexpected navigation, redirects, subframes, and new windows cannot inherit the
bridge. The private text endpoint accepts only `private-ui` and `accessible-name`;
an export or unknown destination is rejected.

A configured private unlock cannot be overwritten. Clear the old local profile
before configuring a replacement. Unlock verification uses a salted scrypt record
stored with the platform's encrypted-storage provider. Earlier preview records
using a different verifier shape require a local profile reset.

Pending private writes are serialized. Clear invalidates prior operations and
locks private presentation immediately, even if removing a cache file fails.
The failure state explains that local files remain and offers local recovery.
The last valid map becomes active only after its encrypted write succeeds.

The website invalidates pending file, credential, and cache operations after lock,
clear, a newer request, or unmount. Its element menu derives generic identities from
structural position, never displayed text, accessible names, or selected file data.
Elements containing private wording cannot export their contents. Renderer-created
desktop notifications use fixed event identifiers so arbitrary private text cannot
be passed to that durable notification route.

History snapshots use a random per-installation key sealed by the platform provider.
Sensitive snapshots are refused when persistent encrypted storage is unavailable.
Toy-lock factors are encrypted through that same platform provider in the private
credential directory. Redacted lock metadata is restored on startup and always
begins locked. Invalid stored metadata reports local recovery as required instead
of accepting new locks over a damaged inventory. This uses platform-protected
encrypted files; a native credential-manager adapter and the separate local Git
history manager remain open requirements in the feature inventory.

## Verification

Focused tests exercise the parser, state transition, protected spans, typed
sinks, cache revalidation, reset, and School-mode seam with neutral payloads.
The test command is `node --test tests/vocabulary/*.test.mjs`. Suggested next
articles: the settings upload control and the local history privacy contract.
