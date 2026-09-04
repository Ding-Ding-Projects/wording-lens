# Security and local recovery

This feature family keeps authentication helpers local and makes every recovery
result explicit. The implementation does not contact a network service. A
credential-vault adapter is supplied by the host application, while tests use a
memory adapter.

## TOTP and QR payloads

`packages/security/totp.ts` implements RFC 6238 time-based one-time passwords
with SHA-1, SHA-256, and SHA-512, six through eight digits, configurable periods,
bounded clock-skew verification, and constant-time code comparison. The
`buildOtpAuthUri` function only creates the local `otpauth://` payload. A UI QR
renderer can consume that payload through `QrPayloadGenerator`; it must render
locally and must not send the secret to a web service.

Verification returns the matched counter offset and a human-readable clock
alignment status. A rejected code never reveals or describes a stored secret.

## Novelty locks and support tickets

`ToyLockManager` supports all six independent policies: PIN, password, PIN plus
password, password plus TOTP, PIN plus TOTP, and password plus PIN plus TOTP.
Each lock receives separate vault references and a lock-specific duration. Lock
records contain references and presence information, never credential material.
The default is locked on launch. A relock is explicit, and a missing or invalid
factor leaves the target locked.

`LocalSupportTicketStore` is a fictional, local-only recovery desk. Tickets are
stored in memory by this engine, advance through received, reviewing, and
resolved states, and resolve by returning the exact application-data path for
the host file manager to open. The engine reports `networkUsed: false` and never
deletes the folder for the user.

## Unlock ladder

`UnlockLadderService` creates server-side-style, single-use nonces for dish,
arithmetic, mole, and clock rungs. The challenge answer is retained by the
service, not trusted from a client assertion. Nonces expire and cannot be
replayed. A successful rung clears only the waiting period and returns
`grantsAuthentication: false` with `sessionCookie: null`. Three ladder skips
per subject per rolling hour are allowed; after that the clock is the only
route. School mode starts at arithmetic and does not expose the dish rung.

## Privacy and verification

Secrets are passed only to the vault or the in-memory verifier. Redacted
exports include metadata and explicitly omit encrypted snapshots or credential
references. Focused tests cover RFC vectors, URI payloads, clock skew, all lock
policies, duration expiry, local ticket progression, nonce replay and expiry,
early mole submissions, ladder budget, and the no-authentication-grant result.
