# Locks, history, and authenticator

Wording Lens will provide playful local locks for any rendered element and a
local authenticator for user-owned one-time passwords. These features are
convenience controls, not encryption or protection from another person who can
use the machine. The application says that plainly wherever it offers them.

## Element locks

Every rendered element exposes `Lock this element` from its context menu and an
accessible keyboard equivalent. The anchored wizard names the exact target and
selects one policy: PIN, password, PIN plus password, password plus TOTP, PIN
plus TOTP, or password plus PIN plus TOTP. Each target receives its own policy,
credential set, duration, and lock state. Locks are opt-in, off by default, and
listed in a searchable management surface.

A locked element is actually disabled while remaining an unlock target. Pointer,
keyboard, touch, assistive technology, alternate shortcuts, command palette
actions, and programmatic activation all open that element's authentication
prompt without executing the protected action. PIN entry offers keypad and
manual routes through one validator and attempt budget. The prompt supports
cancel, Escape, visible focus, ordered multi-factor steps, rate-limited failure,
and a clear recovery line naming the actual application-data folder.

Forgotten credentials lead to local Support Tickets. The fictional desk records
a local ticket number, category, description, severity, status, and canned
response, then opens the application-data folder for the user to delete if they
choose. It never deletes for them, sends a request, contacts a person, or
creates an external ticket. An unstyled disclosure says that nothing leaves the
machine and nobody is reading the ticket.

Tabs, groups, properties, appearance values, menus, notifications, and every
other rendered target receive the same independent lock rules. The unlock
ladder is available where a lockout can occur. School mode starts the ladder at
the arithmetic rung because its dim sum capability is absent there.

## Unlock ladder

The server creates each challenge and grades it against a single-use nonce. A
correct challenge clears the waiting period only. It never signs in, mints a
session, sets a cookie, or refunds an attempt. Three ladder skips per rolling
hour is the fixed budget. The ladder does not shorten the underlying
exponential lockout.

The rungs are one dim sum question with four choices, ten easy sums after five
wrong dishes, and a timed whack-a-mole round after one wrong sum. A lost mole
round returns the person to the clock and the ladder is not offered again for
that lockout. Timed submission cannot arrive before the round ends, and each
mole counts once only when it was visibly present in its cell.

## Authenticator

The built-in authenticator accepts an `otpauth://totp/` URI, an image or
clipboard QR, a camera scan where available, or manual Base32 and parameters.
Pairing registration generates the QR locally, shows the manual value beside
it with algorithm, digit count, and period, and requires one current code
before arming the factor. The secret and QR are never written to a file, log,
capture, export, or network request.

Entries use RFC 6238 TOTP over RFC 4226 HOTP with SHA-1, SHA-256, or SHA-512,
six or eight digits, and a configurable period. The code display has grouped
digits, copy, a numeric countdown, and a next-code preview. Clock skew is
reported rather than hidden. Entries are local, searchable, reorderable,
groupable, and bulk-manageable. Ordinary export omits secrets and says that it
did so. A deliberate secrets export is separate and requires the destructive
confirmation surface.

## Local history

Every app that stores authenticator entries or a display name keeps an isolated
local history repository inside its application-data directory. Add, edit,
remove, rename, reset, restore, import, and bulk actions each create an
append-only record. Snapshots use redacted metadata and encrypted content when
needed, with keys held by the operating-system credential store. The history
manager is itself password, PIN, or TOTP protected and supports browse, search,
date filtering, action filtering, diff, restore, labels, pruning, and redacted
export.

A history failure never falsely reports success. The live operation is kept
when safe, and a localized recovery notification explains what was and was not
recorded. Restoring creates a new revision, never rewrites older history.

## Verification status

At foundation commit `27750632fdac7f5c000e1120e8f2e4c81518b942`, locks, Support
Tickets, the ladder, authenticator, and local history are not implemented and
have no focused tests or real packaged captures. Future verification must
cover every policy, factor route, nonce and timing rule, session-cookie
invariant, QR encoding, RFC vectors, vault failure, history recovery, keyboard
operation, screen-reader labels, all language modes, both funny levels, and
the local-only boundary.

## Suggested articles

- [Language and personal vocabulary](language-and-personal-vocabulary.md)
- [Appearance and accessibility](appearance-and-accessibility.md)
- [Status and notifications](status-updates-and-notifications.md)
