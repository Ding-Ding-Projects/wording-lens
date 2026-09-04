# Local Ollama manager

The Ollama package is a local manager for a running Ollama service. It uses an
injected API boundary so the product can keep loopback networking in its
privileged process and keep renderer code free of credentials. No cloud model,
unofficial proxy, or arbitrary process launch is part of this package.

## Runtime and catalog

`createOllamaApi()` accepts only bounded loopback HTTP URLs, refuses path
traversal, rejects redirects, applies a request deadline, and bounds declared
response size. `health()`, `version()`, `installedTags()`, and `runningTags()`
provide truthful missing, stopped, unhealthy, and healthy states.

`refreshCatalog()` follows every page from an injected official catalog source,
deduplicates by exact tag, records page count, revision, refresh time, and a
completeness verdict, and retains the last verified snapshot when a refresh
fails. `reconcileInstalled()` combines the complete catalog with installed and
running tags rather than hiding either side.

## Hardware fit

`assessFit()` returns Runs well, Runs with limits, Unlikely, or Unknown. It
includes the exact model metadata, hardware facts, assumptions, limitations,
and assessment time. Missing model size, context, RAM, or VRAM evidence yields
Unknown instead of an optimistic estimate. Disk headroom and runtime overhead
are included in the conservative decision.

## Pulls and chat

`pullBatch()` deduplicates tags, limits concurrency to eight, reports byte
progress when the service provides it, supports cancellation, and preserves
per-item pulled, skipped, cancelled, and failed outcomes. A failed pull never
deletes an already installed model.

`createChatSession()`, `appendMessage()`, and `redactedChatExport()` provide
local multi-session state and exports that explicitly exclude credentials,
environment values, private paths, and raw API payloads. `chatStream()` parses
newline-delimited streaming responses and rejects malformed records. The
`attachmentDecision()` helper leaves unsupported attachment controls visible
but disabled with the exact required capability.

## Allowlisted harnesses and rollback

`validateHarnessProfile()` rejects shell metacharacters, shell launchers,
unallowlisted or unbundled executables, invalid ports, and secret-like
environment keys. `preflightHarness()` returns an inspectable launch preview
containing model, executable, arguments, working directory, environment-key
names, ports, and required files. `launchWithRollback()` restores the supplied
configuration snapshot after a launch exception or non-zero exit. Snapshots
are redacted by `createSnapshot()` and never contain values whose names look
like secrets.

## Verification notes

Focused tests should inject local API responses for pagination, stale/offline
catalogs, malformed streams, cancellation, fit evidence, capability gaps,
allowlist rejection, and rollback. Product verification must drive healthy,
missing, offline, pulling, chat, preflight, failure, and restored states in the
packaged application, with secrets excluded from logs, exports, and captures.

Suggested articles: [File converter](converter.md), the offline recovery guide,
and the release packaging guide.
