# Operations, converter, and local model manager

Wording Lens is planned to coordinate local files, builds, releases, services,
and external tools while remaining useful offline. Operations are guided by
real local data and bounded adapters. A freeform shell command is not a
substitute for a typed action.

## File converter

The converter accepts a user-selected file through a guided picker, detects its
type from bounded bytes rather than the extension alone, and shows a searchable
adapter catalog with these categories: Documents/PDF, Images, Audio, Video,
Archives, Structured Data/Spreadsheets, Code/Text, and Binary Encodings.
Known unavailable formats remain visible but disabled with their exact missing
adapter, dependency, or other reason in the product's ordinary wording.

Enabled adapters are bundled, offline-capable, explicitly registered, and
validated after conversion. PDF operations include inspect, split, merge,
extract, reorder, rotate, and metadata handling within documented opaque
limits. Writes are atomic and reopening validates type, page order, count,
rotation, metadata, and encoding. Lossy changes disclose what can change
before the user confirms.

The queue supports unlimited length without loading all paths or bytes into
memory. It uses paged discovery, bounded concurrency, constant-memory
backpressure, durable pause and resume state, cancellation, per-file progress,
storage preflight, crash recovery, and partial outcomes.

## Local model manager

The manager uses only the documented local Ollama HTTP API through a privileged
application boundary. It reports runtime health, installed models, versions,
tags, pulls, deletes, copies, generation, chat, and capability metadata. The
model store enumerates every verified catalog page and published tag, records
the source identity and refresh time, combines catalog and installed state,
and shows a stale or offline state honestly.

Each variant receives a conservative hardware verdict: Runs well, Runs with
limits, Unlikely, or Unknown. The evidence includes detected memory, graphics
hardware, usable video memory, driver support, free destination space, exact
blob size, parameters, quantization, context, and assumptions. A model name
alone cannot produce a fit promise.

The cart schedules local pulls only. It shows tag, size, additional space,
free space, transfer disclosure, fit evidence, aggregate estimate, bounded
parallelism, byte progress when available, cancellation, retry, resume, and
partial outcomes. It never introduces money or payment semantics.

Chat supports streaming, model selection, editable system prompt, validated
parameters, stop and retry, multiple sessions, search, rename, delete through
super confirmation, and redacted export. Attachments are enabled only when
verified model capability and local API support them. Harness launch uses
allowlisted executable profiles, file pickers, preflight, reviewable previews,
configuration snapshots, restore, and automatic rollback after failed health
verification. It never accepts an arbitrary shell string.

## External editor and publishing

The app detects installed editors, lets the user choose one, and reports when
none is available. Exports open directly in Visual Studio Code, with a folder
opened as a workspace root. Publishing surfaces offer the signed-in accounts
and owners the user can write to, maintain separate account records, and report
whether copy-and-push or provider-specific fork was used.

## Failure modes and security

Unknown, malformed, encrypted-without-access, unsupported, oversized, or
resource-exceeding input remains untouched. A missing local model runtime
distinguishes missing, stopped, unhealthy, offline catalog, stale catalog,
insufficient space, unsupported hardware, pull failure, and harness failure.
The next in-app action is stated for each condition. Credentials remain in the
operating-system credential store. Local APIs, converters, and harnesses use
bounded payloads, timeouts, resource limits, and no ambient network.

## Verification status

At foundation commit `27750632fdac7f5c000e1120e8f2e4c81518b942`, the converter,
model manager, editor handoff, and publishing flows are not implemented and
have no focused tests or packaged captures. Later work must prove cold offline
operation, adapter and catalog completeness, all fit verdicts, queue recovery,
streaming chat, harness rollback, and secret exclusion.

## Suggested articles

- [Status and notifications](status-updates-and-notifications.md)
- [Locks, history, and authenticator](locks-history-and-authenticator.md)
- [Release surface](../release/build-package-and-publish.md)
