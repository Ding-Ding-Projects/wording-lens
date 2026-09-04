# Typed operation adapters and durable queue

The operations package provides one local boundary for actions that change or
inspect a project, a local service, a file, or an external editor. Callers send
typed discriminated unions. They do not send shell text, shell fragments, or a
free-form executable name.

## Supported adapters

The adapter registry covers:

- Git status, fetch, fast-forward pull, commit, and push.
- GitHub CLI repository, run, release, and issue inventory reads.
- Docker CLI information, container inventory, and Compose start or stop.
- Ollama local HTTP health, version, tags, model inspection, and pull streams.
- Home Assistant HTTPS state reads for validated boolean-entity identifiers,
  using a host-supplied in-memory credential resolver.
- Bounded file read, write, copy, move, and delete actions.
- Allowlisted process execution with an argument array and no shell.
- Build tasks for the supported package and build tools.
- Opening files or folders in detected external editors.

`packages/operations/types.ts` is the source of truth for input and result
schemas. `packages/operations/adapters.ts` constructs the fixed argument lists,
validates paths and URLs, bounds output, applies timeouts, supports cancellation,
and redacts sensitive-looking process output. HTTP redirects and embedded URL
credentials are rejected. Ollama allows only HTTPS or bounded loopback HTTP;
Home Assistant follows the same transport rule. Home Assistant requests do not
carry a token field. A host callback resolves the token for one request, the
adapter uses it only in an `Authorization` header, and the queue never sees or
serializes that value.

## Guided preview and destructive actions

`previewOperation` returns the adapter kind, summary, affected values, warnings,
and destructive classification. Reads are safe, writes and service changes are
mutating, and file deletion, file moves, overwrite-enabled file writes or
copies, and Compose stop are destructive. A
destructive request is refused unless the caller supplies two different
non-empty confirmation keys and marks the full-range confirmation slider as
complete. The adapter never treats a preview as execution.

## Verification and partial outcomes

`executeOperation` returns a stable operation id, timestamps, attempt count,
status, value, error, and optional far-side verification. A caller can supply a
verifier that independently checks the remote or local result. A verifier that
returns `verified: false` becomes a failed operation with a verification error.
Long Ollama pull responses emit bounded progress events. Queue consumers retain
partial item results and distinguish succeeded, skipped, cancelled, and failed
items instead of turning a mixed batch into a false success.

## Durable queue

`DurableOperationQueue` stores a versioned JSON document at a caller-selected
application-data path. It writes to a unique temporary file and retries only
transient Windows rename errors before replacing the active document. Queue
entries are processed serially, survive restart, and convert an interrupted
`running` entry back to `queued` during recovery. `cancel`, `retry`, listing,
progress callbacks, and batch enqueue are available without an artificial total
queue length limit.

Environment values are not persisted because they can contain credentials. A
process action that supplies an environment map must use a transient execution
boundary rather than the durable queue. Confirmation keys are also omitted from
the persisted request. Logs and operation results must not contain credentials,
authorization headers, access tokens, or private paths beyond the requested
target value.

## Configuration and failure modes

- Use an application-data location owned by the product, not a user project
  folder. The queue creates its parent directory when needed.
- Keep timeout values within the SDK bound. A timeout produces a retryable error
  only when its configured retry code permits another attempt.
- A malformed or unsupported queue document fails closed during `ready()` and
  must be recovered from an application-managed backup rather than silently
  discarded.
- A missing executable, invalid path, unsafe URL, refused redirect, malformed
  response, non-zero process exit, cancelled operation, failed verifier, or
  process output beyond the bounded limit is surfaced with a typed result and
  no guessed success. Output-limit termination is reported as
  `output-limit`, not as an ordinary process exit.
- Build and editor actions use allowlisted tool identities and arrays of
  arguments. Shell evaluation flags such as `-c`, `/c`, and `--eval` are
  rejected.
- `docker compose down` is emitted without service arguments because Compose
  down operates on the project as a whole. Service selection is not presented
  for that action.

## Verification

The focused Node test file in `tests/operations/operations.test.mjs` covers
destructive confirmation, real temporary file writes and deletion, loopback
Ollama HTTP handling, Home Assistant validation and redirect policy, durable
queue execution and recovery, and refusal to persist process environment
values. Compile `packages/operations` with its local `tsconfig.json`, then run
the test file against the emitted build.

### Suggested articles

- [Operations category index](README.md)
- [Shared engineering contract](../../../AGENTS.md)
- [Project roadmap](../../../ROADMAP.md)
