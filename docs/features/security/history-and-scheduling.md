# Local history and scheduled settings

`packages/history/history.ts` provides an append-only history interface for a
per-application Git-backed store. The host supplies a narrow `GitExecutor`
adapter so the application can keep the history repository beside its private
application data without exposing project folders. Every revision has a stable
record identity, a factual action label, and a new revision identifier.

Snapshots use AES-256-GCM with a fresh nonce and authenticated data derived from
the stable record identity. The identity, not an auto-increment row number,
forms the authenticated-data binding, so delete and restore operations retain
the ability to decrypt a valid snapshot. `restoreAsNewRevision` decrypts the
old state and writes a new `restored` revision; history is never rewritten.
`exportRedacted` omits snapshots and states that private snapshots were omitted.

`packages/scheduling/schedule.ts` validates schema version 1, bounded rule
counts, IANA timezones, ISO dates, HH:mm times, weekday lists, safe HTTPS API
sources, and Home Assistant boolean entity identifiers. Matching is evaluated
in the selected local timezone. Date ranges are inclusive, ordinary windows use
an inclusive start and exclusive end, cross-midnight windows wrap to the next
local day, and equal start and end times intentionally match nothing. `every-day`
means all local weekdays without duplicating rules.

Matching rules apply in descending priority, then by the most recently updated
rule, then by stable identifier. Base settings are copied first and temporary
scheduled values overlay them. External values must have version `1` and only
known setting fields. Home Assistant accepts only `on` and `off`; `off` leaves
the local base or another matching rule in effect. The host must keep access
credentials outside the schedule and validate network responses before applying
them.
